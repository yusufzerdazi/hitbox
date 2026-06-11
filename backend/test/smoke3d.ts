// Quick smoke test for the Game3D room: joins, plays, moves, and asserts the
// 3D physics is ticking. Run with the server up: npx tsx test/smoke3d.ts
import { Client } from "colyseus.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main(){
    const client = new Client("ws://localhost:2567");
    let room: any = null;
    for(let attempt = 0; attempt < 30 && !room; attempt++){
        try {
            room = await client.joinOrCreate<any>("Game3D", { room: "smoke-" + Date.now() });
        } catch (e) {
            await sleep(1000);
        }
    }
    if(!room) throw new Error("could not connect to server");
    console.log("joined", room.roomId);

    let gameMode: any = null;
    let starting: number = null;
    room.onMessage("gameMode", (m: any) => gameMode = m);
    room.onMessage("starting", (c: number) => starting = c);
    room.onMessage("collision", (c: any) => console.log("collision msg", JSON.stringify(c)));
    room.onMessage("hitWall", () => {});
    room.onMessage("boost", () => {});
    room.onMessage("event", (e: any) => console.log("event", e.type, e.causeOfDeath || ""));
    room.onMessage("winner", (w: any) => console.log("winner", w.name));
    room.onMessage("newGame", () => {});
    room.onMessage("gameCountdown", () => {});

    room.send("play", { user: { name: "smoke", id: "smoke-id" }, room: null, rank: 1000 });
    await sleep(1000);

    const me = () => room.state.players.get(room.sessionId);
    if(!me()) throw new Error("player did not join state");
    console.log("player spawned at", me().x.toFixed(0), me().y.toFixed(0), me().z.toFixed(0));
    console.log("gameMode:", gameMode, "countdown:", starting);
    console.log("level:", room.state.level?.name, "platforms:", room.state.level?.platforms?.length);
    const ais = Array.from(room.state.players.values()).filter((p: any) => p.ai && !p.type).length;
    console.log("ai players:", ais);
    if(ais !== 3) throw new Error("expected 3 AI players, got " + ais);

    // Wait for the starting countdown to elapse and for solid ground underfoot.
    const grounded = async () => {
        for(let i = 0; i < 100; i++){
            if(me() && me().alive && me().onSurface) return;
            await sleep(200);
        }
        throw new Error("player never landed");
    };
    await sleep(2500);
    await grounded();

    // Jump and confirm we leave the ground.
    const y0 = me().y;
    room.send("space", true);
    await sleep(200);
    const y1 = me().y;
    room.send("space", false);
    console.log("jumped y:", y0.toFixed(0), "->", y1.toFixed(0));
    if(y1 - y0 < 10) throw new Error("player did not jump");

    // Move briefly and confirm displacement.
    await grounded();
    const x0 = me().x, z0 = me().z;
    room.send("move", { x: me().x > 0 ? -1 : 1, z: 0 });
    await sleep(400);
    const moved = Math.hypot(me().x - x0, me().z - z0);
    console.log("moved:", moved.toFixed(0), "units");
    if(moved < 50) throw new Error("player did not move");
    room.send("move", { x: 0, z: 0 });

    // Spam jump for several seconds: with the one-air-jump latch the player
    // must stay bounded (ground jump + one air jump ≈ +1000), not fly away.
    await grounded();
    const groundY = me().y;
    let maxY = groundY;
    for(let i = 0; i < 30; i++){
        room.send("space", true);
        await sleep(80);
        room.send("space", false);
        await sleep(80);
        maxY = Math.max(maxY, me().y);
    }
    console.log("jump spam: ground", groundY.toFixed(0), "peak", maxY.toFixed(0));
    if(maxY - groundY > 1800) throw new Error("player can fly: climbed " + (maxY - groundY).toFixed(0));

    // Boost and confirm the dash + stamina cost.
    await grounded();
    while(me().boostCooldown > 20) await sleep(200);
    const boostDir = me().z > 0 ? -1 : 1;
    room.send("boost", { x: 0, z: boostDir });
    await sleep(150);
    console.log("after boost: zVel", me().zVelocity.toFixed(1), "stamina cooldown", me().boostCooldown.toFixed(0));
    if(Math.abs(me().zVelocity) < 10 && me().boostCooldown < 30) throw new Error("boost did not apply");

    // Watch the AIs brawl for a bit; healths should change in battle royale.
    await sleep(6000);
    const healths = Array.from(room.state.players.values()).map((p: any) => `${p.name}:${Math.round(p.health)}${p.alive ? "" : "(dead)"}${p.it ? "(it)" : ""}`);
    console.log("healths:", healths.join(", "));
    console.log("my pos:", me().x.toFixed(0), me().y.toFixed(0), me().z.toFixed(0), "onSurface:", me().onSurface);

    console.log("SMOKE TEST PASSED");
    room.leave();
    process.exit(0);
}

main().catch(e => { console.error("SMOKE TEST FAILED:", e.message); process.exit(1); });
