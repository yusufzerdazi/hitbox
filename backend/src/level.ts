import Square from "./square";
import { Schema, type, ArraySchema } from "@colyseus/schema";

class Level extends Schema {
    @type([Square]) platforms: ArraySchema<Square>;
    @type("number")inAirBoostCooldown: number;
    @type("number") scale: number;
    @type(Square) spawnArea: Square;
    @type("number") gravity: number;
    @type("number") maxDistance: number;

    constructor(platforms: ArraySchema<Square>, spawnArea: Square, inAirBoostCooldown: number, scale: number, gravity: number = 1){
        super();
        this.platforms = platforms;
        this.inAirBoostCooldown = inAirBoostCooldown;
        this.scale = scale;
        this.spawnArea = spawnArea;
        this.gravity = gravity;
        this.maxDistance = 0;
    }
}

export default Level;