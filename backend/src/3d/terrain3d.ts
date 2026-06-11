import SimplexNoise from 'simplex-noise';
import Level3D from './level3d';

// Smooth rolling terrain: a simplex-noise heightfield with a radial island
// mask so the land rises out of the sea and dips back under at the edges.
// Heights are stored row-major heights[ix * rows + iz] at world position
// (originX + ix * element, originZ + iz * element).

export interface TerrainDef {
    heights: number[];
    cols: number;
    rows: number;
    element: number;
    x: number;
    z: number;
}

function fbm(noise: SimplexNoise, x: number, z: number, octaves: number){
    let total = 0, amplitude = 1, frequency = 1, max = 0;
    for(let o = 0; o < octaves; o++){
        total += noise.noise2D(x * frequency, z * frequency) * amplitude;
        max += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return total / max;
}

export interface TerrainOpts {
    // island: one central landmass. ring: a donut with a lagoon. twins: two
    // landmasses with a bar between. canyon: an island split by a water ravine.
    // crater: a high rim around a sunken bowl.
    shape?: "island" | "ring" | "twins" | "canyon" | "crater";
    frequency?: number;
    sharpness?: number;   // >1 spikes the rolling noise into distinct humps
}

export function makeIslandTerrain(seed: string, cols: number, rows: number, element: number,
        peak: number, flatSpots: { x: number, z: number, radius: number, height: number }[] = [],
        opts: TerrainOpts = {}): TerrainDef {
    const noise = new SimplexNoise(seed);
    const shape = opts.shape || "island";
    const frequency = opts.frequency || 0.00045;
    const sharpness = opts.sharpness || 1;
    const originX = -(cols - 1) * element / 2;
    const originZ = -(rows - 1) * element / 2;
    const heights: number[] = new Array(cols * rows);
    const halfW = (cols - 1) * element / 2;
    const halfD = (rows - 1) * element / 2;

    for(let ix = 0; ix < cols; ix++){
        for(let iz = 0; iz < rows; iz++){
            const wx = originX + ix * element;
            const wz = originZ + iz * element;
            const nx = wx / halfW, nz = wz / halfD;
            const r = Math.sqrt(nx * nx + nz * nz);

            // Landmass mask: 1 on land, dropping below the sea elsewhere.
            let mask: number;
            switch(shape){
                case "ring":
                    mask = 1 - Math.pow(Math.min(1, Math.abs(r - 0.58) * 2.6), 2.2);
                    break;
                case "twins": {
                    const d1 = Math.hypot(nx - 0.45, nz) / 0.62;
                    const d2 = Math.hypot(nx + 0.45, nz) / 0.62;
                    // The bar between the twins keeps a walkable land bridge.
                    const bridge = Math.max(0, 1 - Math.abs(nz) * 6) * Math.max(0, 1 - Math.abs(nx) * 1.4) * 0.85;
                    mask = Math.max(1 - Math.pow(Math.min(1, Math.min(d1, d2)), 2.2), bridge);
                    break;
                }
                case "canyon": {
                    mask = 1 - Math.pow(Math.min(1, r), 2.6);
                    const ravine = Math.max(0, 1 - Math.abs(nx) * 5.5);
                    mask -= Math.pow(ravine, 1.6) * 1.1;
                    break;
                }
                case "crater": {
                    mask = 1 - Math.pow(Math.min(1, r), 2.6);
                    const bowl = Math.max(0, 1 - r / 0.55);
                    mask -= Math.pow(bowl, 1.4) * 1.05;
                    break;
                }
                default:
                    mask = 1 - Math.pow(Math.min(1, r), 2.6);
                    break;
            }

            let rolling = fbm(noise, wx * frequency, wz * frequency, 4) * 0.5 + 0.5;
            rolling = Math.pow(rolling, sharpness);
            let h = -260 + mask * (180 + rolling * peak);

            // Flatten gameplay areas (bases, spawn meadows) into the hills.
            flatSpots.forEach(spot => {
                const d = Math.hypot(wx - spot.x, wz - spot.z) / spot.radius;
                if(d < 1){
                    const blend = Math.pow(1 - d, 2) * (3 - 2 * (1 - d)); // smooth
                    h = h * (1 - blend) + spot.height * blend;
                }
            });
            heights[ix * rows + iz] = h;
        }
    }
    return { heights, cols, rows, element, x: originX, z: originZ };
}

// Bilinear lookup on a raw TerrainDef, for placing props at level-build time.
export function heightOnDef(def: TerrainDef, x: number, z: number): number | null {
    const fx = (x - def.x) / def.element;
    const fz = (z - def.z) / def.element;
    if(fx < 0 || fz < 0 || fx > def.cols - 1 || fz > def.rows - 1) return null;
    const ix = Math.min(Math.floor(fx), def.cols - 2);
    const iz = Math.min(Math.floor(fz), def.rows - 2);
    const tx = fx - ix, tz = fz - iz;
    const h = (i: number, j: number) => def.heights[i * def.rows + j];
    return h(ix, iz) * (1 - tx) * (1 - tz)
         + h(ix + 1, iz) * tx * (1 - tz)
         + h(ix, iz + 1) * (1 - tx) * tz
         + h(ix + 1, iz + 1) * tx * tz;
}

// Bilinear height lookup; null outside the grid (open sea).
export function terrainHeightAt(level: Level3D, x: number, z: number): number | null {
    if(!level || !level.terrainCols) return null;
    const fx = (x - level.terrainX) / level.terrainElement;
    const fz = (z - level.terrainZ) / level.terrainElement;
    if(fx < 0 || fz < 0 || fx > level.terrainCols - 1 || fz > level.terrainRows - 1) return null;
    const ix = Math.min(Math.floor(fx), level.terrainCols - 2);
    const iz = Math.min(Math.floor(fz), level.terrainRows - 2);
    const tx = fx - ix, tz = fz - iz;
    const h = (i: number, j: number) => level.terrain[i * level.terrainRows + j];
    return h(ix, iz) * (1 - tx) * (1 - tz)
         + h(ix + 1, iz) * tx * (1 - tz)
         + h(ix, iz + 1) * (1 - tx) * tz
         + h(ix + 1, iz + 1) * tx * tz;
}
