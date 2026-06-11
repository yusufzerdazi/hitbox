// Dumps live state for a given map/mode: platform boxes and player tracks.
// Usage: npx tsx test/inspect3d.ts hills
import { Client } from "colyseus.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main(){
    const map = process.argv[2] || "hills";
    const gameMode = process.argv[3] || "battleroyale";
    const client = new Client("ws://localhost:2567");
    const room = await client.joinOrCreate<any>("Game3D", { map, gameMode, room: "inspect-" + map + Math.random() });
    room.onMessage("*", () => {});
    await sleep(2500);

    console.log("level:", room.state.level.name);
    room.state.level.platforms.forEach((p: any, i: number) => {
        console.log(`  platform[${i}] type=${p.type} slope=${p.slope || "-"} x=${p.x}..${p.x + p.width} y=${p.y}..${p.y + p.height} z=${p.z}..${p.z + p.depth}`);
    });

    for(let t = 0; t < 6; t++){
        const players = Array.from(room.state.players.values()) as any[];
        console.log("t=" + t + "s " + players.map(p =>
            `${p.name.slice(0, 12)}(${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)})${p.alive ? "" : "DEAD"}${p.onSurface ? "G" : ""}`).join(" | "));
        await sleep(1000);
    }
    room.leave();
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
