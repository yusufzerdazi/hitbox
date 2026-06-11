// Boots every 3D game mode in its own room and asserts mode-specific state.
// Run with the server up: npx tsx test/modes3d.ts
import { Client } from "colyseus.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function check(name: string, assertion: (room: any) => Promise<void>){
    const client = new Client("ws://localhost:2567");
    let room: any = null;
    for(let attempt = 0; attempt < 30 && !room; attempt++){
        try {
            room = await client.joinOrCreate("Game3D", { gameMode: name, room: "test-" + name });
        } catch (e) {
            await sleep(1000);
        }
    }
    if(!room) throw new Error(name + ": could not connect");
    room.onMessage("*", () => {});
    await sleep(4000); // let the countdown elapse and the sim run
    try {
        await assertion(room);
        console.log("PASS", name);
    } catch (e: any) {
        console.error("FAIL", name, "-", e.message);
        process.exitCode = 1;
    }
    room.leave();
}

const playersOf = (room: any) => Array.from(room.state.players.values()) as any[];

async function main(){
    await check("battleroyale", async room => {
        if(!["Arena", "Towers", "Islands", "Hills", "Pyramid", "Steps", "Skyway", "Donut", "Twins", "Moon", "Canyon", "Atoll"].includes(room.state.level.name)) throw new Error("bad level " + room.state.level.name);
        if(playersOf(room).filter(p => p.ai && !p.type).length !== 4) throw new Error("expected 4 ai");
    });

    await check("tag", async room => {
        if(playersOf(room).filter(p => p.it).length !== 1) throw new Error("expected exactly one player it");
    });

    await check("football", async room => {
        if(!["Pitch", "Bridge"].includes(room.state.level.name)) throw new Error("bad level " + room.state.level.name);
        const ball = playersOf(room).find(p => p.type === "ball");
        if(!ball) throw new Error("no ball");
        if(ball.width !== 200) throw new Error("ball width " + ball.width);
        const goals = room.state.level.platforms.filter((p: any) => p.type === "goal");
        if(goals.length !== 2) throw new Error("expected 2 goals, got " + goals.length);
    });

    await check("collecttheboxes", async room => {
        const orb = playersOf(room).find(p => p.orb);
        if(!orb) throw new Error("no orb");
    });

    await check("capturetheflag", async room => {
        if(!["Highlands", "Crater"].includes(room.state.level.name)) throw new Error("bad level " + room.state.level.name);
        if(!room.state.level.terrainCols) throw new Error("no terrain on CTF map");
        const flags = playersOf(room).filter(p => p.type === "flag");
        if(flags.length !== 2) throw new Error("expected 2 flags, got " + flags.length);
        const teams = new Set(playersOf(room).filter(p => !p.type).map(p => p.team));
        if(!teams.has("red") || !teams.has("blue")) throw new Error("teams not allocated: " + Array.from(teams).join(","));
    });

    await check("deathwall", async room => {
        if(!["Towers", "Islands", "Pyramid", "Hills", "Steps", "Canyon"].includes(room.state.level.name)) throw new Error("bad level " + room.state.level.name);
        // Rounds reset the water, so poll for any high-water mark.
        let peak = 0;
        for(let i = 0; i < 50; i++){
            peak = Math.max(peak, room.state.level.waterLevel);
            if(peak > 50) return;
            await sleep(200);
        }
        throw new Error(`water never rose above ${peak.toFixed(0)} in 10s`);
    });

    await check("spleef", async room => {
        if(!["Spleef", "SkySpleef"].includes(room.state.level.name)) throw new Error("bad level " + room.state.level.name);
        // Rounds are short; poll so a round transition doesn't hide the damage.
        for(let i = 0; i < 60; i++){
            const broken = room.state.level.platforms.filter((p: any) => p.durability < 100).length;
            if(broken >= 1) return;
            await sleep(200);
        }
        throw new Error("no pads damaged by the AIs within 12s");
    });

    await check("flood", async room => {
        if(room.state.level.name !== "Flood") throw new Error("bad level " + room.state.level.name);
        const startCount = room.state.level.platforms.length;
        let peakWater = 0;
        for(let i = 0; i < 50; i++){
            peakWater = Math.max(peakWater, room.state.level.waterLevel);
            if(peakWater > 80 && room.state.level.platforms.length > startCount) return;
            await sleep(200);
        }
        throw new Error(`flood not flooding: water ${peakWater.toFixed(0)}, pads ${room.state.level.platforms.length}/${startCount}`);
    });

    console.log(process.exitCode ? "MODE TESTS FAILED" : "ALL MODE TESTS PASSED");
    process.exit(process.exitCode || 0);
}

main().catch(e => { console.error(e); process.exit(1); });
