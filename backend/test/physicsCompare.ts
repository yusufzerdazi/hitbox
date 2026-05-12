// Numerical comparison harness: simulate canonical scenarios under the OLD
// physics formulas (re-derived inline from the original speed.ts/movement.ts)
// and the NEW Matter-backed engine, frame-by-frame. Tolerances are tight on
// metrics that should be exactly equal, looser on those affected by Matter's
// integration ordering (post-step vs pre-step velocity sampling).

import { ArraySchema } from "@colyseus/schema";

import Constants from "../src/constants";
import Physics from "../src/physics/physics";
import Player from "../src/players/player";
import Level from "../src/level/level";
import Square from "../src/level/square";
import GameMode from "../src/game/gameMode";

class StubGameMode extends GameMode {
    constructor() {
        // The base GameMode constructor calls roomRef.state.map; a null roomRef
        // is fine because we never invoke getLevel.
        super(null as any);
        this.damageEnabled = false;
    }
    onLanding() {}
    onCollision() {}
    onPlayerJoin() {}
    onPlayerDeath() {}
}

interface OldPlayerState {
    x: number;
    y: number;
    xVel: number;
    yVel: number;
    onSurface: boolean;
}

interface FrameSample {
    frame: number;
    x: number;
    y: number;
    xVel: number;
    yVel: number;
}

// ---------- Reference (old) physics ----------

function stepOld(
    p: OldPlayerState,
    inputs: { right?: boolean; left?: boolean; space?: boolean },
    platforms: Square[],
    gravity: number
) {
    // Speed phase — only the bits we exercise here.
    if (Math.abs(p.xVel) <= Constants.TERMINAL) {
        if (inputs.right) p.xVel = Math.min(p.xVel + Constants.ACCELERATION, Constants.TERMINAL);
        if (inputs.left) p.xVel = Math.max(p.xVel - Constants.ACCELERATION, -Constants.TERMINAL);
    } else {
        if (inputs.right && p.xVel < 0) p.xVel = Math.min(p.xVel + Constants.ACCELERATION, Constants.TERMINAL);
        else if (inputs.left && p.xVel > 0) p.xVel = Math.max(p.xVel - Constants.ACCELERATION, -Constants.TERMINAL);
        else p.xVel = p.xVel * Constants.FRICTION;
    }

    if (inputs.space && p.onSurface) {
        p.yVel = -Constants.JUMPSPEED;
    }

    if (!inputs.right && !inputs.left) {
        const sign = Math.sign(p.xVel);
        const mag = Math.max(0, Math.abs(p.xVel) - Constants.ACCELERATION);
        p.xVel = mag * sign;
    }

    // Gravity (skip the PLATFORMHEIGHT special case for these tests; we
    // exercise mid-air bodies only).
    p.yVel += Constants.VERTICALACCELERATION * gravity;

    // Movement: wall/floor/ceiling against AABBs.
    const w = Constants.PLAYERWIDTH;
    const h = Constants.PLAYERHEIGHT;

    let landed = false;
    platforms.forEach((plat) => {
        // rightWall: player to the left, moving right into the wall.
        if (
            p.x <= plat.leftX() - w &&
            p.x + p.xVel > plat.leftX() - w &&
            p.y + p.yVel > plat.topY() &&
            p.y + p.yVel < plat.bottomY() + h
        ) {
            p.x = plat.leftX() - w;
            p.xVel = -p.xVel * Constants.WALLDAMPING;
        }
        // leftWall: player to the right, moving left into the wall.
        if (
            p.x >= plat.rightX() &&
            p.x + p.xVel < plat.rightX() &&
            p.y + p.yVel > plat.topY() &&
            p.y + p.yVel < plat.bottomY() + h
        ) {
            p.x = plat.rightX();
            p.xVel = -p.xVel * Constants.WALLDAMPING;
        }
        // ceiling.
        if (
            p.y >= plat.bottomY() + h &&
            p.y + p.yVel <= plat.bottomY() + h &&
            p.x + p.xVel <= plat.rightX() &&
            p.x + p.xVel >= plat.leftX() - w
        ) {
            p.y = plat.bottomY() + h;
            p.yVel = 0;
        }
        // floor.
        if (
            p.y <= plat.topY() &&
            p.y + p.yVel >= plat.topY() &&
            p.x + p.xVel <= plat.rightX() &&
            p.x + p.xVel >= plat.leftX() - w
        ) {
            p.y = plat.topY();
            p.yVel = 0;
            landed = true;
        }
    });

    p.x += p.xVel;
    p.y += p.yVel;
    p.onSurface = landed;
}

function simulateOld(
    initial: OldPlayerState,
    inputsAt: (frame: number) => { right?: boolean; left?: boolean; space?: boolean },
    platforms: Square[],
    frames: number,
    gravity = 1
): FrameSample[] {
    const p = { ...initial };
    const samples: FrameSample[] = [];
    for (let i = 0; i < frames; i++) {
        stepOld(p, inputsAt(i), platforms, gravity);
        samples.push({ frame: i + 1, x: p.x, y: p.y, xVel: p.xVel, yVel: p.yVel });
    }
    return samples;
}

// ---------- Live (new) physics ----------

function simulateNew(
    initial: { x: number; y: number; xVel: number; yVel: number; onSurface: boolean },
    inputsAt: (frame: number) => { right?: boolean; left?: boolean; space?: boolean },
    platforms: Square[],
    frames: number,
    gravity = 1
): FrameSample[] {
    const level = new Level(
        "test",
        new ArraySchema<Square>(...platforms),
        new Square(0, 0, 100, 100),
        null,
        null,
        gravity
    );
    const player = new Player("red", "p1", initial.x, initial.y, false, "p1");
    player.clientId = "p1";
    player.xVelocity = initial.xVel;
    player.yVelocity = initial.yVel;
    player.onSurface = initial.onSurface;
    player.health = 100;
    player.alive = true;

    const phys = new Physics();
    const gm = new StubGameMode();

    const samples: FrameSample[] = [];
    for (let i = 0; i < frames; i++) {
        const inp = inputsAt(i);
        player.right = !!inp.right;
        player.left = !!inp.left;
        if (inp.space) player.space = true;
        phys.calculate([player], level, gm);
        samples.push({
            frame: i + 1,
            x: player.x,
            y: player.y,
            xVel: player.xVelocity,
            yVel: player.yVelocity,
        });
    }
    return samples;
}

// ---------- Reporting ----------

interface ScenarioReport {
    name: string;
    rows: { frame: number; field: string; old: number; mat: number; diff: number }[];
}

function diffScenario(
    name: string,
    oldSamples: FrameSample[],
    newSamples: FrameSample[],
    sampleFrames: number[]
): ScenarioReport {
    const rows: ScenarioReport["rows"] = [];
    sampleFrames.forEach((f) => {
        const o = oldSamples[f - 1];
        const n = newSamples[f - 1];
        if (!o || !n) return;
        (["x", "y", "xVel", "yVel"] as const).forEach((field) => {
            rows.push({
                frame: f,
                field,
                old: o[field],
                mat: n[field],
                diff: n[field] - o[field],
            });
        });
    });
    return { name, rows };
}

function fmt(n: number) {
    return n.toFixed(2).padStart(10);
}

function printReport(r: ScenarioReport) {
    console.log(`\n== ${r.name} ==`);
    console.log("frame  field      old        new        Δ");
    r.rows.forEach((row) => {
        console.log(
            `${String(row.frame).padStart(5)}  ${row.field.padEnd(5)}  ${fmt(row.old)}  ${fmt(row.mat)}  ${fmt(row.diff)}`
        );
    });
}

// ---------- Scenarios ----------

function runFreeFall() {
    // Mid-air, no input, no platforms. yVel should grow by 0.4/frame.
    const platforms: Square[] = [];
    const initial = { x: 100, y: 0, xVel: 0, yVel: 0, onSurface: false };
    const noInput = () => ({});
    const oldS = simulateOld(initial, noInput, platforms, 30);
    const newS = simulateNew(initial, noInput, platforms, 30);
    printReport(diffScenario("free fall, 30 frames", oldS, newS, [1, 5, 10, 20, 30]));
}

function runHorizontalRun() {
    // Player on a wide floor at y=0, holding "right". Acceleration capped at TERMINAL=20.
    const floor = new Square(-1000, 0, 4000, 100);
    const platforms = [floor];
    const initial = { x: 200, y: 0, xVel: 0, yVel: 0, onSurface: true };
    const right = () => ({ right: true });
    const oldS = simulateOld(initial, right, platforms, 30);
    const newS = simulateNew(initial, right, platforms, 30);
    printReport(diffScenario("run right on floor, 30 frames", oldS, newS, [1, 3, 5, 10, 20, 30]));
}

function runJump() {
    // Player on floor, presses space frame 0. Should jump up at -20 and fall.
    const floor = new Square(-1000, 0, 4000, 100);
    const platforms = [floor];
    const initial = { x: 200, y: 0, xVel: 0, yVel: 0, onSurface: true };
    const inputs = (i: number) => (i === 0 ? { space: true } : {});
    const oldS = simulateOld(initial, inputs, platforms, 30);
    const newS = simulateNew(initial, inputs, platforms, 30);
    printReport(diffScenario("standing jump, 30 frames", oldS, newS, [1, 5, 10, 15, 20, 25, 30]));
}

function runWallBounce() {
    // Floor + a wall to the right. Player runs into wall and should bounce
    // back at -WALLDAMPING * speed.
    const floor = new Square(-1000, 0, 4000, 100);
    const wall = new Square(500, -200, 100, 200);
    const platforms = [floor, wall];
    const initial = { x: 200, y: 0, xVel: Constants.TERMINAL, yVel: 0, onSurface: true };
    const right = () => ({ right: true });
    const oldS = simulateOld(initial, right, platforms, 40);
    const newS = simulateNew(initial, right, platforms, 40);
    printReport(diffScenario("run into right wall, 40 frames", oldS, newS, [1, 5, 10, 14, 15, 16, 20, 30, 40]));
}

console.log("Physics comparison: OLD (Speed/Movement reference) vs NEW (Matter)");
runFreeFall();
runHorizontalRun();
runJump();
runWallBounce();
