import Matter from "matter-js";

import GameMode from "../game/gameMode";
import Level from "../level/level";
import Player from "../players/player";
import PlayerTypes from "../players/playerTypes";
import Shape from "../level/shape";
import Square from "../level/square";
import Slope from "../level/slope";
import Constants from "../constants";
import Utils from "../utils";

const NON_COLLIDING_TYPES = new Set([
    "trunk",
    "leaves",
    "goal",
    "backgroundleaves",
    // Hill fill rects sit beneath slopes purely as visual padding so the hill
    // reads as a solid mass. Their vertical sides happen to align with slope
    // segment boundaries; if they were collidable, players running up a hill
    // could sometimes hit a fill's left edge as a "wall" instead of smoothly
    // continuing up the slope.
    "hillfill",
]);

const CATEGORY_PLAYER = 0x0001;
const CATEGORY_PLATFORM = 0x0002;

// Matter integrates with delta in milliseconds; default _baseDelta is 1000/60.
// We use the same so velocity is interpreted as pixels/frame and Body.setVelocity's
// internal timeScale collapses to 1 (otherwise it scales velocities by ~1/16.66).
const PHYSICS_DELTA = 1000 / 60;

interface PendingHit {
    hitType: "leftWall" | "rightWall" | "ceiling" | "floor";
    speed: number;
    platform: Shape;
}

class Physics {
    private engine: Matter.Engine;
    private world: Matter.World;
    private levelRef: Level | null = null;
    private platformBodies = new Map<Shape, Matter.Body>();
    private playerBodies = new Map<string, Matter.Body>();
    private playerKeys = new Map<Matter.Body, string>();
    private bodyToPlatform = new Map<number, Shape>();
    private wasOnSurface = new Map<string, boolean>();
    // Tracks which platform body IDs each player was already touching last frame.
    // Used to fire wall-bounce only on the transition (not while held against the wall).
    private prevContacts = new Map<string, Set<number>>();

    constructor() {
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        // Per-frame Δv from gravity = gravity.y * gravity.scale * delta². With delta = baseDelta,
        // setting gravity.scale = 1/baseDelta² makes gravity.y read directly as pixels/frame².
        this.engine.gravity.x = 0;
        this.engine.gravity.y = Constants.VERTICALACCELERATION;
        (this.engine.gravity as any).scale = 1 / (PHYSICS_DELTA * PHYSICS_DELTA);
    }

    calculate(players: Player[], level: Level, gameMode: GameMode): any[] {
        const messages: any[] = [];

        this.syncLevel(level);
        this.syncPlatformDurability(level);

        const playerKey = (p: Player) => p.clientId || p.sessionId || p.name;
        const liveKeys = new Set<string>();

        // Apply input-driven velocity changes (boost, jump, drift, ducked) before integration.
        players.forEach((player) => {
            const key = playerKey(player);
            if (!key) return;
            liveKeys.add(key);

            const skipBody =
                !player.alive || !!player.attachedToPlayer || player.health === 0;
            if (skipBody) {
                this.removeBody(key);
                return;
            }

            const body = this.ensureBody(key, player);
            this.applyDuckedAndBoost(player, level, gameMode, messages);
            this.applyHorizontalAcceleration(player, level);
            this.applyJump(player);
            this.applyDriftDecay(player);

            // Push schema state into the body for this tick. While ducked, the
            // original physics filters the player out of movement, so the body
            // shouldn't slide horizontally — but yVelocity must still apply so
            // jumps out of a crouch launch the player.
            const targetCenter = this.bodyCenterForPlayer(player);
            Matter.Body.setPosition(body, targetCenter);
            Matter.Body.setVelocity(body, {
                x: player.ducked ? 0 : player.xVelocity,
                y: player.yVelocity,
            });
        });

        // Drop bodies for players that disappeared this tick.
        Array.from(this.playerBodies.keys()).forEach((key) => {
            if (!liveKeys.has(key)) this.removeBody(key);
        });

        // Capture pre-step positions and velocities. We need the velocity *before*
        // Matter's collision solver zeroes it out so wall bounce can use the
        // approach speed.
        const preStep = new Map<
            string,
            { x: number; y: number; xVel: number; yVel: number; speed: number }
        >();
        this.playerBodies.forEach((body, key) => {
            preStep.set(key, {
                x: body.position.x,
                y: body.position.y,
                xVel: body.velocity.x,
                yVel: body.velocity.y,
                speed: Math.hypot(body.velocity.x, body.velocity.y),
            });
        });

        Matter.Engine.update(this.engine, PHYSICS_DELTA);

        // Resolve contacts: classify each pair as wall/floor/ceiling and react.
        const contacts = this.collectActiveContacts();
        const onSurfaceNow = new Map<string, boolean>();
        const landingPlatforms = new Map<string, Shape>();
        const currentContacts = new Map<string, Set<number>>();
        contacts.forEach(({ pair, key, platform, body, platformBody }) => {
            const player = players.find((p) => playerKey(p) === key);
            if (!player) return;
            const pre = preStep.get(key);
            const hit = this.classifyContact(pair, body, platformBody);
            if (!hit) return;
            const speed = pre ? pre.speed : Math.hypot(body.velocity.x, body.velocity.y);
            const prevSet = this.prevContacts.get(key);
            const isNewContact = !prevSet || !prevSet.has(platformBody.id);
            let curSet = currentContacts.get(key);
            if (!curSet) {
                curSet = new Set();
                currentContacts.set(key, curSet);
            }
            curSet.add(platformBody.id);
            this.handleHit(
                player,
                body,
                platform,
                hit,
                speed,
                pre,
                isNewContact,
                gameMode,
                messages,
                onSurfaceNow,
                landingPlatforms
            );
        });
        this.prevContacts = currentContacts;

        // Pull body state back into the schema.
        players.forEach((player) => {
            const key = playerKey(player);
            const body = this.playerBodies.get(key);
            if (!body) return;
            player.x = body.position.x - player.width / 2;
            player.y = body.position.y + player.height / 2;
            player.xVelocity = body.velocity.x;
            player.yVelocity = body.velocity.y;
        });

        // Update onSurface flags. (gameMode.onLanding is fired inside handleHit
        // so it sees the pre-impact velocity — Spleef's "broke through" branch
        // depends on yVelocity being the landing speed, not the post-snap 0.)
        players.forEach((player) => {
            const key = playerKey(player);
            const nowOn = !!onSurfaceNow.get(key);
            player.onSurface = nowOn;
            this.wasOnSurface.set(key, nowOn);
        });

        // Attached players ride their host (skip engine integration entirely).
        PlayerTypes.movingPlayers(players).forEach((player) => (player.attachedPlayers = 0));
        PlayerTypes.attachedPlayers(players).forEach((player) => {
            const host = PlayerTypes.movingPlayers(players).filter(
                (p) => p.name == player.attachedToPlayer
            )[0];
            if (!host) {
                player.attachedToPlayer = null;
                player.invincibility = 1000;
                return;
            }
            host.attachedPlayers = (host.attachedPlayers | 0) + 1;
            player.x = host.x;
            player.y = host.y - 100 * host.attachedPlayers;
        });

        // Angular velocity decay (affects ball spin etc.).
        players.forEach((player) => {
            if (player.angularVelocity) {
                player.angle = (player.angle || 0) + player.angularVelocity;
                player.angularVelocity = player.angularVelocity * 0.99;
            }
        });

        // Player-vs-player collisions reuse the original AABB/shunt/damage rules.
        this.calculatePlayerCollisions(players, gameMode, messages);

        // Drowning: anything that falls past the death floor dies.
        PlayerTypes.livingPlayers(players).forEach((player) => {
            if (player.y >= Constants.HEIGHT + Constants.PLAYERHEIGHT) {
                player.death();
                messages.push([
                    "event",
                    {
                        type: "death",
                        timestamp: Utils.millis(),
                        causeOfDeath: "water",
                        killed: { name: player.name, colour: player.colour },
                        location: { x: player.x, y: player.y },
                        method:
                            Constants.SUICIDEMETHODS[
                                Math.floor(Math.random() * Constants.SUICIDEMETHODS.length)
                            ],
                    },
                ]);
            }
        });

        PlayerTypes.invulnerablePlayers(players).forEach((player) => {
            player.invincibility -= 20;
        });

        return messages;
    }

    // ---------- input / velocity prep -----------

    private applyDuckedAndBoost(
        player: Player,
        level: Level,
        gameMode: GameMode,
        messages: any[]
    ) {
        if (player.boostRight && player.boostLeft) {
            // cancel out
        } else if (
            player.boostRight &&
            player.boostCooldown + Constants.BOOSTCOST <= 100 &&
            player.alive
        ) {
            player.xVelocity = Constants.BOOSTSPEED;
            player.boostCooldown += Constants.BOOSTCOST;
            messages.push(["boost", { name: player.name, direction: "right" }]);
        } else if (
            player.boostLeft &&
            player.boostCooldown + Constants.BOOSTCOST <= 100 &&
            player.alive
        ) {
            player.xVelocity = -Constants.BOOSTSPEED;
            player.boostCooldown += Constants.BOOSTCOST;
            messages.push(["boost", { name: player.name, direction: "left" }]);
        } else if (
            player.clicked &&
            player.boostRight == 0 &&
            player.xVelocity != 0 &&
            player.boostCooldown + Constants.BOOSTCOST <= 100 &&
            player.alive
        ) {
            player.xVelocity = Constants.BOOSTSPEED * Math.sign(player.xVelocity);
            player.boostCooldown += Constants.BOOSTCOST;
            messages.push([
                "boost",
                { name: player.name, direction: player.xVelocity > 0 ? "right" : "left" },
            ]);
        }

        if (player.down && player.onSurface && player.yVelocity >= 0) {
            // The floor-contact handler also fires gameMode.onLanding once per
            // frame the player is on a platform; we don't double-fire here.
            player.ducked = true;
            player.yVelocity = 0;
            player.boostCooldown = Math.max(player.boostCooldown, 50);
        } else {
            player.ducked = false;
        }

        if (
            player.down &&
            player.boostCooldown + Constants.BOOSTCOST <= 100 &&
            !player.onSurface &&
            player.alive
        ) {
            player.yVelocity = Constants.BOOSTSPEED;
            player.boostCooldown += Constants.BOOSTCOST;
            messages.push([
                "boost",
                { name: player.name, direction: "down", timestamp: Utils.millis() },
            ]);
        }

        const inAirBoostCooldown = !player.onSurface ? level.inAirBoostCooldown || 1 : 1;
        player.boostCooldown = Math.max(player.boostCooldown - inAirBoostCooldown, 0);
        player.boostRight = false;
        player.boostLeft = false;
        player.boostDown = false;
        player.clicked = false;
    }

    private applyHorizontalAcceleration(player: Player, level: Level) {
        if (Math.abs(player.xVelocity) <= Constants.TERMINAL) {
            if (player.right) {
                const m = player.right === true ? 1 : (1 / 0.75) * (player.right as number);
                player.xVelocity =
                    m * Math.min(player.xVelocity + Constants.ACCELERATION, Constants.TERMINAL);
            }
            if (player.left) {
                const m = player.left === true ? 1 : (1 / 0.75) * (player.left as number);
                player.xVelocity =
                    m * Math.max(player.xVelocity - Constants.ACCELERATION, -Constants.TERMINAL);
            }
        } else {
            if (player.right && player.xVelocity < 0) {
                const m = player.right === true ? 1 : (1 / 0.75) * (player.right as number);
                player.xVelocity =
                    m * Math.min(player.xVelocity + Constants.ACCELERATION, Constants.TERMINAL);
            } else if (player.left && player.xVelocity > 0) {
                const m = player.left === true ? 1 : (1 / 0.75) * (player.left as number);
                player.xVelocity =
                    m * Math.max(player.xVelocity - Constants.ACCELERATION, -Constants.TERMINAL);
            } else {
                player.xVelocity = player.xVelocity * Constants.FRICTION;
            }
        }
    }

    private applyJump(player: Player) {
        if (player.space && player.onSurface && player.alive) {
            player.yVelocity = -Constants.JUMPSPEED;
            player.space = false;
        }
        if (
            player.space &&
            player.y != Constants.PLATFORMHEIGHT &&
            player.boostCooldown + Constants.BOOSTCOST <= 100 &&
            player.alive
        ) {
            player.yVelocity = -Constants.JUMPSPEED;
            player.boostCooldown += Constants.BOOSTCOST;
        }
    }

    private applyDriftDecay(player: Player) {
        if (!player.right && !player.left) {
            const sign = Math.sign(player.xVelocity);
            const magnitude = Math.abs(player.xVelocity);
            const decel =
                player.type === "ball" ? Constants.BALLACCELERATION : Constants.ACCELERATION;
            player.xVelocity = Math.max(0, magnitude - decel) * sign;
        }
    }

    // ---------- body lifecycle -----------

    private bodyCenterForPlayer(player: Player) {
        return {
            x: player.x + player.width / 2,
            y: player.y - player.height / 2,
        };
    }

    private ensureBody(key: string, player: Player): Matter.Body {
        const existing = this.playerBodies.get(key);
        const desiredW = player.width;
        const desiredH = player.height;
        if (existing) {
            const existingW = (existing as any).hitboxW as number;
            const existingH = (existing as any).hitboxH as number;
            if (existingW === desiredW && existingH === desiredH) {
                return existing;
            }
            // Size changed (e.g. ball width); rebuild the body.
            this.removeBody(key);
        }
        const center = this.bodyCenterForPlayer(player);
        const isBall = player.type === "ball";
        const body = Matter.Bodies.rectangle(center.x, center.y, desiredW, desiredH, {
            inertia: Infinity,
            inverseInertia: 0,
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0,
            restitution: isBall ? Constants.WALLDAMPING : 0,
            collisionFilter: {
                category: CATEGORY_PLAYER,
                mask: CATEGORY_PLATFORM,
            },
        });
        (body as any).hitboxW = desiredW;
        (body as any).hitboxH = desiredH;
        Matter.World.add(this.world, body);
        this.playerBodies.set(key, body);
        this.playerKeys.set(body, key);
        return body;
    }

    private removeBody(key: string) {
        const body = this.playerBodies.get(key);
        if (!body) return;
        Matter.World.remove(this.world, body);
        this.playerBodies.delete(key);
        this.playerKeys.delete(body);
        this.wasOnSurface.delete(key);
    }

    // ---------- platforms -----------

    private syncLevel(level: Level) {
        if (this.levelRef === level) return;
        // Tear down everything and rebuild for the new level.
        this.platformBodies.forEach((body) => Matter.World.remove(this.world, body));
        this.platformBodies.clear();
        this.bodyToPlatform.clear();
        this.playerBodies.forEach((body) => Matter.World.remove(this.world, body));
        this.playerBodies.clear();
        this.playerKeys.clear();
        this.wasOnSurface.clear();
        this.levelRef = level;
        this.engine.gravity.y = Constants.VERTICALACCELERATION * (level.gravity || 1);
        level.platforms.forEach((p) => this.upsertPlatformBody(p));
    }

    private syncPlatformDurability(level: Level) {
        // Update gravity in case level.gravity changes mid-life.
        this.engine.gravity.y = Constants.VERTICALACCELERATION * (level.gravity || 1);
        level.platforms.forEach((p) => this.upsertPlatformBody(p));
    }

    private upsertPlatformBody(platform: Shape) {
        const collidable =
            !NON_COLLIDING_TYPES.has(platform.type) && platform.durability > 0;
        const existing = this.platformBodies.get(platform);
        if (collidable && !existing) {
            let body: Matter.Body;
            const opts: Matter.IBodyDefinition = {
                isStatic: true,
                friction: 0,
                frictionStatic: 0,
                restitution: 0,
                collisionFilter: {
                    category: CATEGORY_PLATFORM,
                    mask: CATEGORY_PLAYER,
                },
            };
            if (platform instanceof Slope) {
                const verts = platform.vertices();
                const cx = (verts[0].x + verts[1].x + verts[2].x) / 3;
                const cy = (verts[0].y + verts[1].y + verts[2].y) / 3;
                body = Matter.Bodies.fromVertices(cx, cy, [verts], opts);
            } else {
                body = Matter.Bodies.rectangle(
                    platform.leftX() + platform.width / 2,
                    platform.topY() + platform.height / 2,
                    platform.width,
                    platform.height,
                    opts
                );
            }
            this.platformBodies.set(platform, body);
            this.bodyToPlatform.set(body.id, platform);
            Matter.World.add(this.world, body);
        } else if (!collidable && existing) {
            Matter.World.remove(this.world, existing);
            this.platformBodies.delete(platform);
            this.bodyToPlatform.delete(existing.id);
        }
    }

    // ---------- contact resolution -----------

    private collectActiveContacts(): {
        pair: Matter.Pair;
        key: string;
        platform: Shape;
        body: Matter.Body;
        platformBody: Matter.Body;
    }[] {
        const out: {
            pair: Matter.Pair;
            key: string;
            platform: Shape;
            body: Matter.Body;
            platformBody: Matter.Body;
        }[] = [];
        ((this.engine as any).pairs.list as Matter.Pair[]).forEach((pair) => {
            if (!pair.isActive) return;
            const a = pair.bodyA;
            const b = pair.bodyB;
            const aIsPlatform = this.bodyToPlatform.has(a.id);
            const bIsPlatform = this.bodyToPlatform.has(b.id);
            if (aIsPlatform === bIsPlatform) return;
            const platformBody = aIsPlatform ? a : b;
            const playerBody = aIsPlatform ? b : a;
            const platform = this.bodyToPlatform.get(platformBody.id);
            const key = this.playerKeys.get(playerBody);
            if (!platform || !key) return;
            out.push({ pair, key, platform, body: playerBody, platformBody });
        });
        return out;
    }

    // Classify the contact using Matter's narrow-phase normal — works for both
    // axis-aligned rectangles and arbitrary polygons (slopes). The threshold of
    // 0.5 on |normal.y| means anything up to a ~60° slope counts as a floor.
    private classifyContact(
        pair: Matter.Pair,
        playerBody: Matter.Body,
        platformBody: Matter.Body
    ): PendingHit["hitType"] | null {
        const normal = (pair as any).collision?.normal as { x: number; y: number } | undefined;
        if (!normal) return null;
        // Orient the normal so it points FROM the platform TO the player.
        const dx = playerBody.position.x - platformBody.position.x;
        const dy = playerBody.position.y - platformBody.position.y;
        const dot = dx * normal.x + dy * normal.y;
        const nx = dot >= 0 ? normal.x : -normal.x;
        const ny = dot >= 0 ? normal.y : -normal.y;
        if (ny < -0.5) return "floor";
        if (ny > 0.5) return "ceiling";
        return nx > 0 ? "leftWall" : "rightWall";
    }

    private handleHit(
        player: Player,
        body: Matter.Body,
        platform: Shape,
        hitType: PendingHit["hitType"],
        speed: number,
        pre: { x: number; y: number; xVel: number; yVel: number; speed: number } | undefined,
        isNewContact: boolean,
        gameMode: GameMode,
        messages: any[],
        onSurfaceNow: Map<string, boolean>,
        landingPlatforms: Map<string, Shape>
    ) {
        const key = player.clientId || player.sessionId || player.name;
        const isBall = player.type === "ball";
        const halfW = player.width / 2;
        const halfH = player.height / 2;
        // Ball restitution = WALLDAMPING handles its bounce naturally; only
        // axis-aligned rectangles trigger the custom snap-and-flip used to
        // match the original physics' frame timing on wall hits.
        const customWallBounce = platform instanceof Square && !isBall;
        switch (hitType) {
            case "leftWall": {
                if (customWallBounce) {
                    const sq = platform as Square;
                    if (isNewContact) {
                        const preXVel = pre ? pre.xVel : body.velocity.x;
                        const newXVel = -preXVel * Constants.WALLDAMPING;
                        Matter.Body.setPosition(body, {
                            x: sq.rightX() + halfW + newXVel,
                            y: body.position.y,
                        });
                        Matter.Body.setVelocity(body, {
                            x: newXVel,
                            y: body.velocity.y,
                        });
                        messages.push([
                            "hitWall",
                            {
                                hitType: "leftWall",
                                location: {
                                    x: body.position.x - halfW,
                                    y: body.position.y + halfH,
                                },
                                speed,
                                size: { width: player.width, height: player.height },
                            },
                        ]);
                    } else {
                        Matter.Body.setPosition(body, {
                            x: sq.rightX() + halfW,
                            y: body.position.y,
                        });
                    }
                } else if (isNewContact) {
                    // Slope/ball: trust Matter's solver, just emit the message.
                    messages.push([
                        "hitWall",
                        {
                            hitType: "leftWall",
                            location: {
                                x: body.position.x - halfW,
                                y: body.position.y + halfH,
                            },
                            speed,
                            size: { width: player.width, height: player.height },
                        },
                    ]);
                }
                break;
            }
            case "rightWall": {
                if (customWallBounce) {
                    const sq = platform as Square;
                    if (isNewContact) {
                        const preXVel = pre ? pre.xVel : body.velocity.x;
                        const newXVel = -preXVel * Constants.WALLDAMPING;
                        Matter.Body.setPosition(body, {
                            x: sq.leftX() - halfW + newXVel,
                            y: body.position.y,
                        });
                        Matter.Body.setVelocity(body, {
                            x: newXVel,
                            y: body.velocity.y,
                        });
                        messages.push([
                            "hitWall",
                            {
                                hitType: "rightWall",
                                location: {
                                    x: body.position.x - halfW,
                                    y: body.position.y + halfH,
                                },
                                speed,
                                size: { width: player.width, height: player.height },
                            },
                        ]);
                    } else {
                        Matter.Body.setPosition(body, {
                            x: sq.leftX() - halfW,
                            y: body.position.y,
                        });
                    }
                } else if (isNewContact) {
                    messages.push([
                        "hitWall",
                        {
                            hitType: "rightWall",
                            location: {
                                x: body.position.x - halfW,
                                y: body.position.y + halfH,
                            },
                            speed,
                            size: { width: player.width, height: player.height },
                        },
                    ]);
                }
                break;
            }
            case "ceiling": {
                // Force vy=0 even for the ball — original ceiling code zeroes it
                // for every type, regardless of restitution.
                Matter.Body.setVelocity(body, { x: body.velocity.x, y: 0 });
                if (isNewContact) {
                    messages.push([
                        "hitWall",
                        {
                            hitType: "ceiling",
                            location: {
                                x: body.position.x - halfW,
                                y: body.position.y + halfH,
                            },
                            speed,
                            size: { width: player.width, height: player.height },
                        },
                    ]);
                }
                break;
            }
            case "floor": {
                // Matter's solver already snapped position and resolved velocity
                // (vy=0 with restitution=0 for non-ball, or -WALLDAMPING*vy for the
                // ball with restitution=WALLDAMPING). We only set onSurface and
                // fire the gameMode hook, with player.yVelocity temporarily set
                // to the pre-impact speed so Spleef's hard-landing branch works.
                const preYVel = pre ? pre.yVel : body.velocity.y;
                onSurfaceNow.set(key, true);
                if (!landingPlatforms.has(key)) landingPlatforms.set(key, platform);
                player.yVelocity = preYVel;
                gameMode.onLanding(platform, player);
                const previously = !!this.wasOnSurface.get(key);
                if (!previously) {
                    messages.push([
                        "hitWall",
                        {
                            hitType: "floor",
                            location: {
                                x: body.position.x - halfW,
                                y: body.position.y + halfH,
                            },
                            speed,
                            size: { width: player.width, height: player.height },
                        },
                    ]);
                }
                break;
            }
        }
    }

    // ---------- player-vs-player (preserved logic) -----------

    private calculatePlayerCollisions(
        players: Player[],
        gameMode: GameMode,
        messages: any[]
    ) {
        const collisions: Player[][] = [];
        PlayerTypes.vulnerablePlayers(players).forEach((player) => {
            PlayerTypes.movingPlayers(players)
                .filter((c) => c != player && c.invincibility == 0)
                .forEach((otherPlayer) => {
                    if (
                        player.isCollision(otherPlayer) &&
                        this.isDamaged(player, otherPlayer)
                    ) {
                        const clientSpeed = player.speed();
                        const otherClientSpeed = otherPlayer.speed();
                        const speedDifference = Math.abs(clientSpeed - otherClientSpeed);

                        if (clientSpeed < otherClientSpeed) {
                            if (
                                gameMode.damageEnabled &&
                                !["ball", "flag"].includes(player.type) &&
                                !["ball", "flag"].includes(otherPlayer.type)
                            ) {
                                player.health = Math.max(
                                    player.health -
                                        (gameMode.playerDamage
                                            ? gameMode.playerDamage
                                            : otherClientSpeed),
                                    0
                                );
                            }
                            if (player.health == 0) {
                                player.death();
                                messages.push([
                                    "event",
                                    {
                                        type: "death",
                                        timestamp: Utils.millis(),
                                        causeOfDeath: "murder",
                                        method:
                                            Constants.DEATHMETHODS[
                                                Math.floor(
                                                    Math.random() *
                                                        Constants.DEATHMETHODS.length
                                                )
                                            ],
                                        killed: {
                                            name: player.name,
                                            colour: player.colour,
                                        },
                                        location: { x: player.x, y: player.y },
                                        killer: {
                                            name: otherPlayer.name,
                                            colour: otherPlayer.colour,
                                        },
                                    },
                                ]);
                            }
                            player.invincibility = 100;
                        } else if (speedDifference == 0) {
                            if (gameMode.damageEnabled)
                                player.health = Math.max(
                                    player.health -
                                        (gameMode.playerDamage ? 0 : 0.5 * otherClientSpeed),
                                    0
                                );
                        }

                        if (Math.abs(player.xVelocity) < Math.abs(otherPlayer.xVelocity)) {
                            player.newXVelocity =
                                otherPlayer.xVelocity +
                                Constants.SHUNTSPEED * Math.sign(otherPlayer.xVelocity);
                        } else if (
                            Math.abs(player.xVelocity) == Math.abs(otherPlayer.xVelocity)
                        ) {
                            const flip =
                                Math.sign(player.xVelocity) * Math.sign(otherPlayer.xVelocity);
                            player.newXVelocity = flip * player.xVelocity;
                        }

                        if (player.ducked) {
                            player.newYVelocity = -Math.min(
                                otherPlayer.yVelocity,
                                Constants.JUMPSPEED
                            );
                            player.boostCooldown = Math.min(100, player.boostCooldown + 80);
                            otherPlayer.newYVelocity = 0;
                        } else if (
                            Math.abs(player.yVelocity) < Math.abs(otherPlayer.yVelocity)
                        ) {
                            otherPlayer.newYVelocity = -Math.min(
                                otherPlayer.yVelocity,
                                Constants.JUMPSPEED
                            );
                            player.newYVelocity =
                                otherPlayer.yVelocity +
                                Constants.SHUNTSPEED * Math.sign(otherPlayer.yVelocity);
                        } else if (
                            Math.abs(player.yVelocity) == Math.abs(otherPlayer.yVelocity)
                        ) {
                            const flip =
                                Math.sign(player.yVelocity) * Math.sign(otherPlayer.yVelocity);
                            player.newYVelocity = flip * player.yVelocity;
                        }

                        if (players.indexOf(player) < players.indexOf(otherPlayer)) {
                            collisions.push([player, otherPlayer]);
                        }
                    }
                });
        });
        collisions.forEach((c) => {
            messages.push([
                "collision",
                {
                    type: this.getCollisionType(c),
                    location: this.getCollisionLocation(c),
                    speed: Math.max(c[0].speed(), c[1].speed()),
                },
            ]);
            gameMode.onCollision(c[0], c[1], players);
        });
        PlayerTypes.livingPlayers(players).forEach((player) => {
            if (player.newXVelocity) {
                player.xVelocity = player.newXVelocity;
                player.newXVelocity = null;
                const body = this.playerBodies.get(player.clientId || player.sessionId || player.name);
                if (body)
                    Matter.Body.setVelocity(body, {
                        x: player.xVelocity,
                        y: body.velocity.y,
                    });
            }
            if (player.newYVelocity) {
                player.yVelocity = player.newYVelocity;
                player.newYVelocity = null;
                const body = this.playerBodies.get(player.clientId || player.sessionId || player.name);
                if (body)
                    Matter.Body.setVelocity(body, {
                        x: body.velocity.x,
                        y: player.yVelocity,
                    });
            }
        });
    }

    private isDamaged(p1: Player, p2: Player) {
        return !p1.ducked || p2.yVelocity > 0;
    }

    private getCollisionType(collision: Player[]) {
        let type = "player";
        collision.forEach((p) => {
            if (p.orb || p.it || p.type == "flag") type = "box";
            if (p.type == "ball") type = "football";
        });
        return type;
    }

    private getCollisionLocation(collision: Player[]) {
        const ball = collision.filter((c) => c.type == "ball");
        const notBall = collision.filter((c) => c.type != "ball");
        if (ball[0]) {
            const ballCenter = {
                x: ball[0].x + Constants.BALLWIDTH / 2,
                y: ball[0].y - Constants.BALLWIDTH / 2,
            };
            const playerCenter = {
                x: notBall[0].x + Constants.PLAYERWIDTH / 2,
                y: notBall[0].y - Constants.PLAYERHEIGHT / 2,
            };
            const angle = Math.atan2(
                playerCenter.y - ballCenter.y,
                playerCenter.x - ballCenter.x
            );
            return {
                x: ballCenter.x + Math.cos(angle) * Constants.BALLWIDTH / 2,
                y: ballCenter.y + Math.sin(angle) * Constants.BALLWIDTH / 2,
            };
        }
        return {
            x: (collision[0].x + collision[1].x + Constants.PLAYERWIDTH) / 2,
            y: (collision[0].y + collision[1].y - Constants.PLAYERHEIGHT) / 2,
        };
    }
}

export default Physics;
