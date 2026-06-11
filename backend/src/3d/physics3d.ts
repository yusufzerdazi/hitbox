import * as CANNON from "cannon-es";

import Constants from "../constants";
import Constants3D from "./constants3d";
import Utils from "../utils";
import Player3D from "./player3d";
import PlayerTypes3D from "./playerTypes3d";
import Level3D from "./level3d";
import Box3D from "./box3d";
import GameMode3D from "./gameMode3d";
import { terrainHeightAt } from "./terrain3d";

// 3D physics on cannon-es, mirroring the 2D matter.js port: the engine does
// integration and world contacts; the Hitbox rules (acceleration, boost
// stamina, wall damping, momentum damage, shunts) are layered on top.
//
// Units: velocities are pixels-per-frame, so the world is stepped with dt = 1
// and gravity.y is read directly as pixels/frame².
const MAXFALLSPEED = 50;
const AIR_RECHARGE = 0.25; // stamina regenerates much slower in the air

const GROUP_STATIC = 1;
const GROUP_PLAYER = 2;

class Physics3D {
    private world: CANNON.World;
    private levelRef: Level3D | null = null;
    private staticMaterial: CANNON.Material;
    private playerMaterial: CANNON.Material;
    private ballMaterial: CANNON.Material;
    private platformBodies = new Map<Box3D, CANNON.Body>();
    private bodyToPlatform = new Map<number, Box3D>();
    private terrainBodyId: number | null = null;
    private playerBodies = new Map<string, CANNON.Body>();
    private bodyToKey = new Map<number, string>();
    // Wall-contact tracking so the bounce/message fires on the transition only.
    private prevContacts = new Map<string, Set<number>>();

    constructor() {
        this.world = new CANNON.World();
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = false;
        this.staticMaterial = new CANNON.Material("static");
        this.playerMaterial = new CANNON.Material("player");
        this.ballMaterial = new CANNON.Material("ball");
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.staticMaterial, this.playerMaterial, { friction: 0, restitution: 0 }));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.staticMaterial, this.ballMaterial, { friction: 0, restitution: Constants.WALLDAMPING }));
    }

    calculate(players: Player3D[], level: Level3D, gameMode: GameMode3D): any[] {
        const messages: any[] = [];
        this.syncLevel(level);
        this.syncDurability(level);
        this.world.gravity.set(0, -Constants.VERTICALACCELERATION * (level.gravity || 1), 0);

        const liveKeys = new Set<string>();
        players.forEach(player => {
            const key = this.playerKey(player);
            const simulated = player.alive && !player.attachedToPlayer && player.type !== "orb";
            if(!simulated){
                this.removeBody(key);
                if(player.type === "orb"){
                    player.xVelocity = 0;
                    player.yVelocity = 0;
                    player.zVelocity = 0;
                }
                return;
            }
            liveKeys.add(key);

            if(!player.type){
                this.applyBoost(player, messages);
                this.applyDuckedAndDive(player, messages);
                this.applyHorizontalAcceleration(player);
                this.applyJump(player);
                this.rechargeBoost(player, level);
            } else {
                this.applyDriftDecay(player);
            }
            player.yVelocity = Math.max(player.yVelocity, -MAXFALLSPEED);

            const body = this.ensureBody(key, player);
            body.position.set(player.x, player.y + player.height / 2, player.z);
            body.velocity.set(
                player.ducked ? 0 : player.xVelocity,
                player.yVelocity,
                player.ducked ? 0 : player.zVelocity);
        });

        Array.from(this.playerBodies.keys()).forEach(key => {
            if(!liveKeys.has(key)) this.removeBody(key);
        });

        // Pre-step velocities: wall bounce needs the approach speed that the
        // solver will have zeroed by the time we read contacts.
        const preVelocity = new Map<string, { x: number, y: number, z: number }>();
        this.playerBodies.forEach((body, key) => {
            preVelocity.set(key, { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z });
        });
        this.world.step(1);

        this.resolveContacts(players, gameMode, preVelocity, messages);

        // Pull body state back into the schema (positions are feet-centred).
        players.forEach(player => {
            const body = this.playerBodies.get(this.playerKey(player));
            if(!body) return;
            player.x = body.position.x;
            player.y = body.position.y - player.height / 2;
            player.z = body.position.z;
            player.xVelocity = body.velocity.x;
            player.yVelocity = body.velocity.y;
            player.zVelocity = body.velocity.z;
        });

        // Attached entities (flags, riders) follow their host above the head.
        PlayerTypes3D.movingPlayers(players).forEach(player => player.attachedPlayers = 0);
        PlayerTypes3D.attachedPlayers(players).forEach(player => {
            const host = PlayerTypes3D.movingPlayers(players).filter(p => p.name == player.attachedToPlayer)[0];
            if(!host){
                player.attachedToPlayer = null;
                player.invincibility = 1000;
                return;
            }
            host.attachedPlayers = (host.attachedPlayers | 0) + 1;
            player.x = host.x;
            player.z = host.z;
            player.y = host.y + host.currentHeight() + 40 + 90 * (host.attachedPlayers - 1);
            player.xVelocity = 0;
            player.yVelocity = 0;
            player.zVelocity = 0;
        });

        this.calculatePlayerCollisions(players, gameMode, messages);

        // Drowning: anything that sinks below the water dies.
        PlayerTypes3D.livingPlayers(players).forEach(player => {
            if(player.y <= level.waterLevel - Constants3D.DROWNDEPTH && !player.attachedToPlayer){
                player.death();
                messages.push(["event", {
                    type: "death",
                    timestamp: Utils.millis(),
                    causeOfDeath: "water",
                    killed: { name: player.name, colour: player.colour },
                    location: { x: player.x, y: player.y, z: player.z },
                    method: Constants.SUICIDEMETHODS[Math.floor(Math.random() * Constants.SUICIDEMETHODS.length)]
                }]);
            }
        });

        PlayerTypes3D.invulnerablePlayers(players).forEach(player => {
            player.invincibility = Math.max(0, player.invincibility - Constants3D.INVINCIBILITYDECAY);
        });

        return messages;
    }

    // ---------- contacts ----------

    private resolveContacts(players: Player3D[], gameMode: GameMode3D,
            preVelocity: Map<string, { x: number, y: number, z: number }>, messages: any[]){
        const onSurfaceNow = new Set<string>();
        const currentContacts = new Map<string, Set<number>>();

        this.world.contacts.forEach(contact => {
            const aIsPlayer = this.bodyToKey.has(contact.bi.id);
            const bIsPlayer = this.bodyToKey.has(contact.bj.id);
            if(aIsPlayer === bIsPlayer) return;
            const playerBody = aIsPlayer ? contact.bi : contact.bj;
            const staticBody = aIsPlayer ? contact.bj : contact.bi;
            const key = this.bodyToKey.get(playerBody.id);
            const player = players.find(p => this.playerKey(p) === key);
            if(!player) return;

            // Orient the contact normal so it points from the static body to the player.
            let nx = contact.ni.x, ny = contact.ni.y, nz = contact.ni.z;
            if(aIsPlayer){ nx = -nx; ny = -ny; nz = -nz; }

            const pre = preVelocity.get(key) || { x: 0, y: 0, z: 0 };
            const speed = Math.sqrt(pre.x ** 2 + pre.y ** 2 + pre.z ** 2);
            const platform = this.bodyToPlatform.get(staticBody.id) || null;
            const location = { x: player.x, y: player.y + player.currentHeight() / 2, z: player.z };
            const size = { width: player.width, height: player.currentHeight(), depth: player.depth };

            let set = currentContacts.get(key);
            if(!set){ set = new Set(); currentContacts.set(key, set); }
            const isNewContact = !(this.prevContacts.get(key) || new Set()).has(staticBody.id);
            set.add(staticBody.id);

            if(ny > 0.5){
                onSurfaceNow.add(key);
                if(platform){
                    // The hook sees the pre-impact fall speed (Spleef's rule).
                    const stored = player.yVelocity;
                    player.yVelocity = pre.y;
                    gameMode.onLanding(platform, player);
                    player.yVelocity = stored;
                }
                if(isNewContact){
                    messages.push(["hitWall", { hitType: "floor", location, speed, size }]);
                }
            } else if(ny < -0.5){
                if(isNewContact){
                    messages.push(["hitWall", { hitType: "ceiling", location, speed, size }]);
                }
            } else if(player.type !== "ball"){
                // Side hit: the 2D wall rule — reflect the approach velocity
                // with damping (the solver has already zeroed it).
                if(isNewContact){
                    const body = this.playerBodies.get(key);
                    if(Math.abs(nx) >= Math.abs(nz)){
                        body.velocity.x = -pre.x * Constants.WALLDAMPING;
                    } else {
                        body.velocity.z = -pre.z * Constants.WALLDAMPING;
                    }
                    messages.push(["hitWall", { hitType: "wall", location, speed, size }]);
                }
            }
        });

        this.prevContacts = currentContacts;
        players.forEach(player => {
            const key = this.playerKey(player);
            if(!this.playerBodies.has(key)) return;
            player.onSurface = onSurfaceNow.has(key);
            if(player.onSurface){
                player.airJumped = false;
            }
        });
    }

    // ---------- input / velocity prep (unchanged Hitbox rules) ----------

    private applyBoost(player: Player3D, messages: any[]){
        const magnitude = Math.hypot(player.boostX, player.boostZ);
        if(magnitude > 0 && player.boostCooldown + Constants.BOOSTCOST <= 100 && player.alive){
            player.xVelocity = Constants.BOOSTSPEED * player.boostX / magnitude;
            player.zVelocity = Constants.BOOSTSPEED * player.boostZ / magnitude;
            player.boostCooldown += Constants.BOOSTCOST;
            messages.push(["boost", {
                name: player.name,
                direction: { x: player.boostX / magnitude, z: player.boostZ / magnitude },
                location: { x: player.x, y: player.y, z: player.z },
                timestamp: Utils.millis()
            }]);
        }
        player.boostX = 0;
        player.boostZ = 0;
    }

    private applyDuckedAndDive(player: Player3D, messages: any[]){
        if(player.down && player.onSurface && player.yVelocity <= 0){
            player.ducked = true;
            player.yVelocity = 0;
            player.boostCooldown = Math.max(player.boostCooldown, 50);
        } else {
            player.ducked = false;
        }

        // Ground pound: dive straight down mid-air, same cost as a boost.
        if(player.down && !player.onSurface && player.boostCooldown + Constants.BOOSTCOST <= 100 && player.alive){
            player.yVelocity = -Constants.BOOSTSPEED;
            player.boostCooldown += Constants.BOOSTCOST;
            messages.push(["boost", {
                name: player.name,
                direction: "down",
                location: { x: player.x, y: player.y, z: player.z },
                timestamp: Utils.millis()
            }]);
        }
    }

    private applyHorizontalAcceleration(player: Player3D){
        const inputMagnitude = Math.hypot(player.moveX, player.moveZ);
        const speed = player.horizontalSpeed();
        if(inputMagnitude > 0.1){
            const dirX = player.moveX / Math.max(1, inputMagnitude);
            const dirZ = player.moveZ / Math.max(1, inputMagnitude);
            const braking = (dirX * player.xVelocity + dirZ * player.zVelocity) < 0;
            if(speed <= Constants.TERMINAL || braking){
                player.xVelocity += Constants.ACCELERATION * dirX;
                player.zVelocity += Constants.ACCELERATION * dirZ;
                const newSpeed = player.horizontalSpeed();
                if(newSpeed > Constants.TERMINAL && speed <= Constants.TERMINAL){
                    player.xVelocity *= Constants.TERMINAL / newSpeed;
                    player.zVelocity *= Constants.TERMINAL / newSpeed;
                }
            } else {
                player.xVelocity *= Constants.FRICTION;
                player.zVelocity *= Constants.FRICTION;
            }
        } else {
            this.applyDriftDecay(player);
        }
    }

    private applyDriftDecay(player: Player3D){
        const speed = player.horizontalSpeed();
        if(speed > 0){
            const decel = player.type === "ball" ? Constants.BALLACCELERATION : Constants.ACCELERATION;
            const newSpeed = Math.max(0, speed - decel);
            player.xVelocity *= newSpeed / speed;
            player.zVelocity *= newSpeed / speed;
        }
    }

    private applyJump(player: Player3D){
        if(player.space && player.onSurface && player.alive){
            player.yVelocity = Constants.JUMPSPEED;
            player.space = false;
        }
        // One stamina-funded jump per airtime: without the latch, stamina
        // regenerates faster than repeated jumps fall, allowing flight.
        else if(player.space && !player.airJumped &&
                player.boostCooldown + Constants.BOOSTCOST <= 100 && player.alive){
            player.yVelocity = Constants.JUMPSPEED;
            player.boostCooldown += Constants.BOOSTCOST;
            player.airJumped = true;
            player.space = false;
        }
    }

    private rechargeBoost(player: Player3D, level: Level3D){
        const recharge = !player.onSurface
            ? (level.inAirBoostCooldown != null ? level.inAirBoostCooldown : AIR_RECHARGE)
            : 1;
        player.boostCooldown = Math.max(player.boostCooldown - recharge, 0);
    }

    // ---------- body lifecycle ----------

    private playerKey(player: Player3D){
        return player.clientId || player.sessionId || player.name;
    }

    private ensureBody(key: string, player: Player3D): CANNON.Body {
        const existing = this.playerBodies.get(key);
        if(existing) return existing;
        const isBall = player.type === "ball";
        const body = new CANNON.Body({
            mass: 1,
            fixedRotation: true,
            material: isBall ? this.ballMaterial : this.playerMaterial,
            collisionFilterGroup: GROUP_PLAYER,
            collisionFilterMask: GROUP_STATIC,
        });
        if(isBall){
            body.addShape(new CANNON.Sphere(player.width / 2));
        } else {
            // A sphere at the feet rolls smoothly over terrain triangles where
            // a box corner would catch; the slimmer box above handles walls.
            const radius = player.width / 2;
            body.addShape(new CANNON.Sphere(radius),
                new CANNON.Vec3(0, -(player.height / 2) + radius, 0));
            body.addShape(new CANNON.Box(new CANNON.Vec3(
                    player.width / 2 * 0.85, (player.height - radius) / 2, player.depth / 2 * 0.85)),
                new CANNON.Vec3(0, radius / 2, 0));
        }
        body.linearDamping = 0;
        this.world.addBody(body);
        this.playerBodies.set(key, body);
        this.bodyToKey.set(body.id, key);
        return body;
    }

    private removeBody(key: string){
        const body = this.playerBodies.get(key);
        if(!body) return;
        this.world.removeBody(body);
        this.playerBodies.delete(key);
        this.bodyToKey.delete(body.id);
        this.prevContacts.delete(key);
    }

    // ---------- static world ----------

    private syncLevel(level: Level3D){
        if(this.levelRef === level) return;
        this.levelRef = level;
        this.platformBodies.forEach(body => this.world.removeBody(body));
        this.platformBodies.clear();
        this.bodyToPlatform.clear();
        this.playerBodies.forEach(body => this.world.removeBody(body));
        this.playerBodies.clear();
        this.bodyToKey.clear();
        this.prevContacts.clear();
        if(this.terrainBodyId != null){
            const terrainBody = this.world.bodies.find(b => b.id === this.terrainBodyId);
            if(terrainBody) this.world.removeBody(terrainBody);
            this.terrainBodyId = null;
        }

        level.platforms.forEach(platform => this.upsertPlatformBody(platform));
        this.addTerrainBody(level);
    }

    private syncDurability(level: Level3D){
        level.platforms.forEach(platform => this.upsertPlatformBody(platform));
        // The Flood prunes drowned pads from the level; drop their bodies too.
        if(this.platformBodies.size > level.platforms.length){
            const live = new Set<Box3D>();
            level.platforms.forEach(platform => live.add(platform));
            Array.from(this.platformBodies.keys()).forEach(platform => {
                if(!live.has(platform)){
                    const body = this.platformBodies.get(platform);
                    this.world.removeBody(body);
                    this.platformBodies.delete(platform);
                    this.bodyToPlatform.delete(body.id);
                }
            });
        }
    }

    private upsertPlatformBody(platform: Box3D){
        const collidable = platform.type !== "goal" && platform.type !== "tree" && platform.durability > 0;
        const existing = this.platformBodies.get(platform);
        if(collidable && !existing){
            const body = new CANNON.Body({
                mass: 0,
                type: CANNON.Body.STATIC,
                material: this.staticMaterial,
                collisionFilterGroup: GROUP_STATIC,
                collisionFilterMask: GROUP_PLAYER,
            });
            body.addShape(new CANNON.Box(new CANNON.Vec3(platform.width / 2, platform.height / 2, platform.depth / 2)));
            body.position.set(
                platform.x + platform.width / 2,
                platform.y + platform.height / 2,
                platform.z + platform.depth / 2);
            this.world.addBody(body);
            this.platformBodies.set(platform, body);
            this.bodyToPlatform.set(body.id, platform);
        } else if(!collidable && existing){
            this.world.removeBody(existing);
            this.platformBodies.delete(platform);
            this.bodyToPlatform.delete(existing.id);
        }
    }

    private addTerrainBody(level: Level3D){
        if(!level.terrainCols) return;
        // cannon's Heightfield lives in a z-up local frame: data[i][j] sits at
        // local (i*e, j*e). Rotating -90° about x maps local (x, y, h) to world
        // (x, h, -y), so rows are filled in reverse and the body is placed at
        // the far-z edge.
        const cols = level.terrainCols, rows = level.terrainRows, element = level.terrainElement;
        const data: number[][] = [];
        for(let i = 0; i < cols; i++){
            data.push([]);
            for(let j = 0; j < rows; j++){
                data[i].push(level.terrain[i * rows + (rows - 1 - j)]);
            }
        }
        const body = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.STATIC,
            material: this.staticMaterial,
            collisionFilterGroup: GROUP_STATIC,
            collisionFilterMask: GROUP_PLAYER,
        });
        body.addShape(new CANNON.Heightfield(data, { elementSize: element }));
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        body.position.set(level.terrainX, 0, level.terrainZ + (rows - 1) * element);
        this.world.addBody(body);
        this.terrainBodyId = body.id;
    }

    // ---------- player-vs-player (unchanged Hitbox rules) ----------

    private calculatePlayerCollisions(players: Player3D[], gameMode: GameMode3D, messages: any[]){
        const collisions: Player3D[][] = [];
        PlayerTypes3D.vulnerablePlayers(players).forEach(player => {
            PlayerTypes3D.movingPlayers(players)
                .filter(c => c != player && c.invincibility == 0)
                .forEach(otherPlayer => {
                    if(!player.isCollision(otherPlayer) || !this.isDamaged(player, otherPlayer)){
                        return;
                    }
                    const clientSpeed = player.speed();
                    const otherClientSpeed = otherPlayer.speed();
                    const speedDifference = Math.abs(clientSpeed - otherClientSpeed);
                    const damageImmune = ["ball", "flag", "orb"].includes(player.type) ||
                        ["ball", "flag", "orb"].includes(otherPlayer.type);

                    if(clientSpeed < otherClientSpeed){
                        if(gameMode.damageEnabled && !damageImmune){
                            player.health = Math.max(player.health -
                                (gameMode.playerDamage ? gameMode.playerDamage : otherClientSpeed), 0);
                        }
                        if(player.health == 0){
                            player.death();
                            messages.push(["event", {
                                type: "death",
                                timestamp: Utils.millis(),
                                causeOfDeath: "murder",
                                method: Constants.DEATHMETHODS[Math.floor(Math.random() * Constants.DEATHMETHODS.length)],
                                killed: { name: player.name, colour: player.colour },
                                location: { x: player.x, y: player.y, z: player.z },
                                killer: { name: otherPlayer.name, colour: otherPlayer.colour }
                            }]);
                        }
                        player.invincibility = damageImmune ? 0 : 100;
                    } else if(speedDifference == 0){
                        if(gameMode.damageEnabled && !damageImmune)
                            player.health = Math.max(player.health -
                                (gameMode.playerDamage ? 0 : 0.5 * otherClientSpeed), 0);
                    }

                    if(Math.abs(player.xVelocity) < Math.abs(otherPlayer.xVelocity)){
                        player.newXVelocity = otherPlayer.xVelocity + Constants.SHUNTSPEED * Math.sign(otherPlayer.xVelocity);
                    } else if(Math.abs(player.xVelocity) == Math.abs(otherPlayer.xVelocity)){
                        player.newXVelocity = Math.sign(player.xVelocity) * Math.sign(otherPlayer.xVelocity) * player.xVelocity;
                    }
                    if(Math.abs(player.zVelocity) < Math.abs(otherPlayer.zVelocity)){
                        player.newZVelocity = otherPlayer.zVelocity + Constants.SHUNTSPEED * Math.sign(otherPlayer.zVelocity);
                    } else if(Math.abs(player.zVelocity) == Math.abs(otherPlayer.zVelocity)){
                        player.newZVelocity = Math.sign(player.zVelocity) * Math.sign(otherPlayer.zVelocity) * player.zVelocity;
                    }

                    if(player.ducked){
                        player.newYVelocity = Math.min(-otherPlayer.yVelocity, Constants.JUMPSPEED);
                        player.boostCooldown = Math.min(100, player.boostCooldown + 80);
                        otherPlayer.newYVelocity = 0;
                    } else if(Math.abs(player.yVelocity) < Math.abs(otherPlayer.yVelocity)){
                        otherPlayer.newYVelocity = Math.min(-otherPlayer.yVelocity, Constants.JUMPSPEED);
                        player.newYVelocity = otherPlayer.yVelocity + Constants.SHUNTSPEED * Math.sign(otherPlayer.yVelocity);
                    } else if(Math.abs(player.yVelocity) == Math.abs(otherPlayer.yVelocity)){
                        player.newYVelocity = Math.sign(player.yVelocity) * Math.sign(otherPlayer.yVelocity) * player.yVelocity;
                    }

                    if(players.indexOf(player) < players.indexOf(otherPlayer)){
                        collisions.push([player, otherPlayer]);
                    }
                });
        });

        collisions.forEach(c => {
            messages.push(["collision", {
                type: this.getCollisionType(c),
                location: {
                    x: (c[0].x + c[1].x) / 2,
                    y: (c[0].y + c[1].y + (c[0].currentHeight() + c[1].currentHeight()) / 2) / 2,
                    z: (c[0].z + c[1].z) / 2
                },
                speed: Math.max(c[0].speed(), c[1].speed())
            }]);
            gameMode.onCollision(c[0], c[1], players);
        });

        PlayerTypes3D.livingPlayers(players).forEach(player => {
            const body = this.playerBodies.get(this.playerKey(player));
            if(player.newXVelocity){
                player.xVelocity = player.newXVelocity;
                player.newXVelocity = null;
                if(body) body.velocity.x = player.xVelocity;
            }
            if(player.newYVelocity){
                player.yVelocity = player.newYVelocity;
                player.newYVelocity = null;
                if(body) body.velocity.y = player.yVelocity;
            }
            if(player.newZVelocity){
                player.zVelocity = player.newZVelocity;
                player.newZVelocity = null;
                if(body) body.velocity.z = player.zVelocity;
            }
        });
    }

    private isDamaged(p1: Player3D, p2: Player3D){
        return !p1.ducked || p2.yVelocity < 0;
    }

    private getCollisionType(collision: Player3D[]){
        let type = "player";
        collision.forEach(p => {
            if(p.orb || p.it || p.type == "flag") type = "box";
            if(p.type == "ball") type = "football";
        });
        return type;
    }
}

export default Physics3D;
