import { ArraySchema } from "@colyseus/schema";
import Box3D from "./box3d";
import Level3D from "./level3d";
import Constants from "../constants";
import Constants3D from "./constants3d";
import { makeIslandTerrain, heightOnDef, TerrainDef } from "./terrain3d";

// Levels sit in the ocean: the water surface is y = WATERLEVEL and land rises
// out of it. "goal" boxes are sensor volumes, "tree" boxes are decorative
// (no collision), "house" boxes are solid props with a roof drawn client-side.

const W = Constants3D.WATERLEVEL;

function spleefPads(size: number, gap: number, layers: number, baseY: number): Box3D[] {
    const pads: Box3D[] = [];
    const span = 4 * size + 3 * gap;
    for(let layer = 0; layer < layers; layer++){
        const y = baseY + layer * 400;
        const offset = layer % 2 == 0 ? 0 : (size + gap) / 2;
        for(let i = 0; i < 4; i++){
            for(let j = 0; j < 4; j++){
                pads.push(new Box3D(
                    -span / 2 + i * (size + gap) + offset,
                    y,
                    -span / 2 + j * (size + gap) + offset,
                    size, 80, size, "pad"));
            }
        }
    }
    return pads;
}

// Deterministic pseudo-random scatter of trees/houses onto terrain land.
function scatterProps(def: TerrainDef, seed: number, trees: number, houses: number): Box3D[] {
    const props: Box3D[] = [];
    let state = seed;
    const rand = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0xffffffff;
    };
    const halfW = (def.cols - 1) * def.element / 2;
    const halfD = (def.rows - 1) * def.element / 2;
    let attempts = 0;
    while((trees > 0 || houses > 0) && attempts++ < 400){
        const x = (rand() * 2 - 1) * halfW * 0.85;
        const z = (rand() * 2 - 1) * halfD * 0.85;
        const h = heightOnDef(def, x, z);
        if(h == null || h < W + 60) continue;
        const clear = props.every(p => Math.hypot(p.x - x, p.z - z) > 420);
        if(!clear) continue;
        if(houses > 0){
            houses--;
            props.push(new Box3D(x - 160, h - 10, z - 160, 320, 240, 320, "house"));
        } else {
            trees--;
            const size = 180 + rand() * 140;
            props.push(new Box3D(x - size / 2, h - 10, z - size / 2, size, 320 + rand() * 160, size, "tree"));
        }
    }
    return props;
}

export default {
    // ---------- box arenas ----------

    Arena: () => new Level3D("Arena", new ArraySchema<Box3D>(
        new Box3D(-1200, W - 500, -1200, 2400, 750, 2400),
    ), new Box3D(-1000, W + 350, -1000, 2000, 400, 2000), 0.5),

    Towers: () => new Level3D("Towers", new ArraySchema<Box3D>(
        new Box3D(-1400, W - 500, -1400, 800, 750, 800),
        new Box3D(600, W - 500, -1400, 800, 750, 800),
        new Box3D(-1400, W - 500, 600, 800, 750, 800),
        new Box3D(600, W - 500, 600, 800, 750, 800),
        new Box3D(-400, W - 500, -400, 800, 1150, 800),
    ), new Box3D(-1300, W + 750, -1300, 2600, 400, 2600), 0.5),

    Islands: () => new Level3D("Islands", new ArraySchema<Box3D>(
        new Box3D(-600, W - 500, -600, 1200, 750, 1200),
        new Box3D(-1700, W + 250, -500, 700, 100, 1000),
        new Box3D(1000, W + 250, -500, 700, 100, 1000),
        new Box3D(-500, W + 250, -1700, 1000, 100, 700),
        new Box3D(-500, W + 250, 1000, 1000, 100, 700),
        new Box3D(-1500, W + 650, -1500, 600, 100, 600),
        new Box3D(900, W + 650, 900, 600, 100, 600),
        new Box3D(900, W + 650, -1500, 600, 100, 600),
        new Box3D(-1500, W + 650, 900, 600, 100, 600),
    ), new Box3D(-1400, W + 850, -1400, 2800, 400, 2800), 0.5),

    // Stepped pyramid: each tier is one jump high.
    Pyramid: () => new Level3D("Pyramid", new ArraySchema<Box3D>(
        new Box3D(-1500, W - 500, -1500, 3000, 750, 3000),
        new Box3D(-900, W + 250, -900, 1800, 250, 1800),
        new Box3D(-300, W + 500, -300, 600, 250, 600),
    ), new Box3D(-1200, W + 850, -1200, 2400, 400, 2400), 0.5),

    // Ziggurat in low gravity: concentric tiers and floaty brawling.
    Steps: () => new Level3D("Steps", new ArraySchema<Box3D>(
        new Box3D(-1700, W - 500, -1700, 3400, 750, 3400),
        new Box3D(-1200, W + 250, -1200, 2400, 220, 2400),
        new Box3D(-750, W + 470, -750, 1500, 220, 1500),
        new Box3D(-350, W + 690, -350, 700, 220, 700),
    ), new Box3D(-1400, W + 1000, -1400, 2800, 400, 2800), 0.5, 0.7),

    // A spiral of floating pads — pure platforming, generous air stamina.
    Skyway: () => {
        const pads = new ArraySchema<Box3D>(
            new Box3D(-700, W - 500, -700, 1400, 750, 1400));
        for(let i = 0; i < 14; i++){
            const angle = i * 0.85;
            const radius = 950 + i * 55;
            pads.push(new Box3D(
                Math.cos(angle) * radius - 200,
                W + 250 + i * 110,
                Math.sin(angle) * radius - 200,
                400, 80, 400));
        }
        return new Level3D("Skyway", pads, new Box3D(-600, W + 350, -600, 1200, 300, 1200), 0.75);
    },

    // ---------- terrain maps ----------

    // Smooth rolling hills with a small wood.
    Hills: () => {
        const terrain = makeIslandTerrain("hitbox-hills", 48, 48, 100, 420);
        return new Level3D("Hills", new ArraySchema<Box3D>(
            ...scatterProps(terrain, 7, 6, 1)
        ), new Box3D(-1500, W + 800, -1500, 3000, 400, 3000), 0.5, 1, terrain);
    },

    // A donut island around a lagoon: fall in the middle and you swim.
    Donut: () => {
        const terrain = makeIslandTerrain("hitbox-donut", 52, 52, 100, 400, [], { shape: "ring" });
        return new Level3D("Donut", new ArraySchema<Box3D>(
            ...scatterProps(terrain, 11, 5, 0)
        ), new Box3D(-2000, W + 700, -2000, 4000, 400, 4000), 0.5, 1, terrain);
    },

    // Two villages joined by a narrow land bridge — fight for the crossing.
    Twins: () => {
        const terrain = makeIslandTerrain("hitbox-twins", 60, 44, 100, 420, [], { shape: "twins" });
        return new Level3D("Twins", new ArraySchema<Box3D>(
            ...scatterProps(terrain, 13, 4, 2)
        ), new Box3D(-2200, W + 700, -1500, 4400, 400, 3000), 0.5, 1, terrain);
    },

    // Cratered lowlands in lunar gravity: huge floaty leaps.
    Moon: () => {
        const terrain = makeIslandTerrain("hitbox-moon", 50, 50, 100, 380, [
            { x: -900, z: 600, radius: 500, height: -60 },
            { x: 800, z: -700, radius: 450, height: -50 },
            { x: 200, z: 900, radius: 400, height: -40 },
        ], { sharpness: 1.6 });
        return new Level3D("Moon", new ArraySchema<Box3D>(),
            new Box3D(-1600, W + 900, -1600, 3200, 400, 3200), 0.5, 0.45, terrain);
    },

    // An island split by a water ravine — boost the gap or go around.
    Canyon: () => {
        const terrain = makeIslandTerrain("hitbox-canyon", 56, 48, 100, 430, [], { shape: "canyon" });
        return new Level3D("Canyon", new ArraySchema<Box3D>(
            ...scatterProps(terrain, 17, 5, 0)
        ), new Box3D(-2100, W + 800, -1700, 4200, 400, 3400), 0.5, 1, terrain);
    },

    // An archipelago of grassy humps — island hopping with the sea between.
    Atoll: () => {
        const terrain = makeIslandTerrain("hitbox-atoll", 56, 56, 100, 520, [],
            { sharpness: 2.4, frequency: 0.0008 });
        return new Level3D("Atoll", new ArraySchema<Box3D>(
            ...scatterProps(terrain, 19, 6, 0)
        ), new Box3D(-2000, W + 800, -2000, 4000, 400, 4000), 0.5, 1, terrain);
    },

    // ---------- mode-specific maps ----------

    // Long island with a goal volume at each end. No walls: shots that miss
    // splash into the sea and the ball resets to the centre circle.
    Pitch: () => new Level3D("Pitch", new ArraySchema<Box3D>(
        new Box3D(-2400, W - 500, -1300, 4800, 750, 2600),
        new Box3D(-2400, W + 250, -1300, 350, 500, 2600, "goal", Constants.TEAM1),
        new Box3D(2050, W + 250, -1300, 350, 500, 2600, "goal", Constants.TEAM2),
    ), new Box3D(-1500, W + 350, -1100, 3000, 300, 2200), 0.5),

    // Football over a gap: two half-pitches joined by a narrow bridge. Punt
    // the ball across or carry it over the choke point.
    Bridge: () => new Level3D("Bridge", new ArraySchema<Box3D>(
        new Box3D(-2600, W - 500, -1100, 2200, 750, 2200),                  // West island
        new Box3D(400, W - 500, -1100, 2200, 750, 2200),                    // East island
        new Box3D(-400, W - 350, -350, 800, 600, 700),                      // The bridge, same top height
        new Box3D(-2600, W + 250, -1100, 320, 500, 2200, "goal", Constants.TEAM1),
        new Box3D(2280, W + 250, -1100, 320, 500, 2200, "goal", Constants.TEAM2),
    ), new Box3D(-1600, W + 350, -900, 3200, 300, 1800), 0.5),

    // A big highland valley for Capture the Flag: rolling terrain with a
    // flattened meadow plateau at each end carrying the team bases.
    Highlands: () => {
        const terrain = makeIslandTerrain("hitbox-highlands", 76, 48, 100, 480, [
            { x: -2650, z: 0, radius: 1200, height: 280 },
            { x: 2650, z: 0, radius: 1200, height: 280 },
            { x: 0, z: 0, radius: 900, height: 140 },
        ]);
        return new Level3D("Highlands", new ArraySchema<Box3D>(
            new Box3D(-3100, W + 270, -450, 900, 100, 900, "platform", Constants.TEAM1),
            new Box3D(2200, W + 270, -450, 900, 100, 900, "platform", Constants.TEAM2),
            ...scatterProps(terrain, 23, 7, 3)
        ), new Box3D(-1200, W + 900, -1200, 2400, 400, 2400), 0.5, 1, terrain);
    },

    // CTF in a volcano: bases on the high rim, a lake sunk in the middle.
    Crater: () => {
        const terrain = makeIslandTerrain("hitbox-crater", 60, 60, 100, 420, [
            { x: -1900, z: 0, radius: 900, height: 330 },
            { x: 1900, z: 0, radius: 900, height: 330 },
            { x: 0, z: 0, radius: 750, height: -90 },
        ], { shape: "crater" });
        return new Level3D("Crater", new ArraySchema<Box3D>(
            new Box3D(-2300, W + 320, -400, 800, 100, 800, "platform", Constants.TEAM1),
            new Box3D(1500, W + 320, -400, 800, 100, 800, "platform", Constants.TEAM2),
            ...scatterProps(terrain, 29, 5, 0)
        ), new Box3D(-1000, W + 900, -1000, 2000, 400, 2000), 0.5, 1, terrain);
    },

    Spleef: () => new Level3D("Spleef", new ArraySchema<Box3D>(
        ...spleefPads(450, 150, 2, W + 250)
    ), new Box3D(-1100, W + 1100, -1100, 2200, 300, 2200), 0.5),

    // Tighter pads, higher stakes, three storeys.
    SkySpleef: () => new Level3D("SkySpleef", new ArraySchema<Box3D>(
        ...spleefPads(340, 200, 3, W + 350)
    ), new Box3D(-1000, W + 1600, -1000, 2000, 300, 2000), 0.5),

    // The Flood: a small launch island; the mode spawns pads upward forever.
    Flood: () => new Level3D("Flood", new ArraySchema<Box3D>(
        new Box3D(-800, W - 500, -800, 1600, 750, 1600),
        new Box3D(-1300, W + 500, -200, 400, 70, 400, "pad"),
        new Box3D(900, W + 500, -200, 400, 70, 400, "pad"),
        new Box3D(-200, W + 600, -1300, 400, 70, 400, "pad"),
        new Box3D(-200, W + 600, 900, 400, 70, 400, "pad"),
    ), new Box3D(-700, W + 350, -700, 1400, 300, 1400), 0.5),
};
