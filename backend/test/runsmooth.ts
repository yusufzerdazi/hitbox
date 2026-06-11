// Locomotion check: run continuously across the Hills terrain and measure how
// often the player flickers off the ground. Run: npx tsx test/runsmooth.ts
import { Client } from "colyseus.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main(){
    const client = new Client("ws://localhost:2567");
    const room = await client.joinOrCreate<any>("Game3D", {
        gameMode: "battleroyale", map: "hills", room: "smooth-" + Date.now() });
    room.onMessage("*", () => {});
    room.send("play", { user: { name: "runner", id: "runner" }, room: null, rank: 1000 });
    await sleep(3000);

    const me = () => room.state.players.get(room.sessionId);
    for(let i = 0; i < 60 && !(me() && me().alive && me().onSurface); i++) await sleep(200);

    // Chase a waypoint orbiting the island centre, so the runner crosses the
    // rolling interior without marching into the sea.
    let samples = 0, grounded = 0, lastY = me().y, maxJolt = 0;
    for(let t = 0; t < 50; t++){
        const angle = t * 0.25;
        const targetX = Math.cos(angle) * 800;
        const targetZ = Math.sin(angle) * 800;
        const dx = targetX - me().x, dz = targetZ - me().z;
        const mag = Math.hypot(dx, dz) || 1;
        room.send("move", { x: dx / mag, z: dz / mag });
        await sleep(100);
        if(!me().alive) break;
        samples++;
        if(me().onSurface) grounded++;
        const jolt = Math.abs(me().y - lastY);
        if(me().yVelocity > 1) maxJolt = Math.max(maxJolt, jolt);
        lastY = me().y;
    }
    if(samples < 30) throw new Error("runner died too early to measure (" + samples + " samples)");
    room.send("move", { x: 0, z: 0 });
    const ratio = grounded / samples;
    console.log(`grounded ${grounded}/${samples} (${(ratio * 100).toFixed(0)}%), max upward jolt ${maxJolt.toFixed(1)}`);

    // The critical regression: jumping must work while standing on terrain.
    for(let i = 0; i < 60 && !(me().alive && me().onSurface); i++) await sleep(200);
    const beforeJump = me().y;
    let peak = beforeJump;
    room.send("space", true);
    for(let i = 0; i < 8; i++){
        await sleep(60);
        peak = Math.max(peak, me().y);
    }
    room.send("space", false);
    console.log(`terrain jump: ${beforeJump.toFixed(0)} -> peak ${peak.toFixed(0)}`);
    if(peak - beforeJump < 150) throw new Error("cannot jump while standing on terrain");

    console.log("RUN CHECK PASSED");
    room.leave();
    process.exit(0);
}

main().catch(e => { console.error("RUN SMOOTHNESS FAILED:", e.message); process.exit(1); });
