import Square from "./square";
import { Schema, type, ArraySchema } from "@colyseus/schema";
import Shape from "./shape";
import Tree from "./tree";
import CompositeShape from "./compositeShape";

class Level extends Schema {
    @type([Shape]) platforms: ArraySchema<Shape>;
    @type("string") name: string;
    @type("number") inAirBoostCooldown: number;
    @type("number") scale: number;
    @type(Square) spawnArea: Square;
    @type("number") gravity: number;
    @type("number") currentDistance: number;
    @type("number") maxDistance: number;
    @type("number") deathWallX: number;

    constructor(name: string, platforms: ArraySchema<Shape>, spawnArea: Square, inAirBoostCooldown: number, scale: number, gravity: number = 1){
        super();
        this.name = name;
        this.platforms = new ArraySchema<Shape>(...([] as Shape[]).concat.apply([], platforms.map(p => p instanceof Square ? [p] : (p instanceof CompositeShape ? Array.from(p.components.values()) : []))));
        this.inAirBoostCooldown = inAirBoostCooldown;
        this.scale = scale;
        this.spawnArea = spawnArea;
        this.gravity = gravity;
        this.currentDistance = 0;
        this.maxDistance = 0;
    }
}

export default Level;