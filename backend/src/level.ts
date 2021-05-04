import Square from "./square";
import { Schema, type, ArraySchema } from "@colyseus/schema";

class Level extends Schema {
    @type([Square]) platforms: ArraySchema<Square>;
    @type("string") name: string;
    @type("number") inAirBoostCooldown: number;
    @type("number") scale: number;
    @type(Square) spawnArea: Square;
    @type("number") gravity: number;
    @type("number") currentDistance: number;
    @type("number") maxDistance: number;
    @type("number") deathWallX: number;

    constructor(name: string, platforms: ArraySchema<Square>, spawnArea: Square, inAirBoostCooldown: number, scale: number, gravity: number = 1){
        super();
        this.name = name;
        this.platforms = platforms;
        this.inAirBoostCooldown = inAirBoostCooldown;
        this.scale = scale;
        this.spawnArea = spawnArea;
        this.gravity = gravity;
        this.currentDistance = 0;
        this.maxDistance = 0;
    }
}

export default Level;