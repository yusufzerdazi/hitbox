import { Schema, type, ArraySchema } from "@colyseus/schema";
import Box3D from "./box3d";
import Constants3D from "./constants3d";

class Level3D extends Schema {
    @type([Box3D]) platforms: ArraySchema<Box3D>;
    @type("string") name: string;
    @type("number") inAirBoostCooldown: number;
    @type("number") gravity: number;
    @type("number") waterLevel: number;
    @type(Box3D) spawnArea: Box3D;
    // Optional rolling terrain (see terrain3d.ts): heights[ix * rows + iz].
    @type(["number"]) terrain: ArraySchema<number>;
    @type("number") terrainCols: number;
    @type("number") terrainRows: number;
    @type("number") terrainElement: number;
    @type("number") terrainX: number;
    @type("number") terrainZ: number;

    constructor(name: string, platforms: ArraySchema<Box3D>, spawnArea: Box3D,
            inAirBoostCooldown: number = null, gravity: number = 1,
            terrain: { heights: number[], cols: number, rows: number, element: number, x: number, z: number } = null){
        super();
        this.name = name;
        this.platforms = platforms;
        this.spawnArea = spawnArea;
        this.inAirBoostCooldown = inAirBoostCooldown;
        this.gravity = gravity;
        this.waterLevel = Constants3D.WATERLEVEL;
        this.terrain = new ArraySchema<number>();
        if(terrain){
            terrain.heights.forEach(h => this.terrain.push(Math.round(h)));
            this.terrainCols = terrain.cols;
            this.terrainRows = terrain.rows;
            this.terrainElement = terrain.element;
            this.terrainX = terrain.x;
            this.terrainZ = terrain.z;
        }
    }
}

export default Level3D;
