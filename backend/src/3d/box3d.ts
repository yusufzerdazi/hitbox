import { Schema, type } from "@colyseus/schema";

// Axis-aligned box defined by its minimum corner and extents.
// y is up: topY() is the walkable surface.
class Box3D extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("number") z: number;
    @type("number") width: number;   // x extent
    @type("number") height: number;  // y extent
    @type("number") depth: number;   // z extent
    @type("string") type: string;
    @type("string") colour: string;
    @type("number") durability: number;

    constructor(x: number, y: number, z: number, width: number, height: number, depth: number,
            type: string = "platform", colour: string = null){
        super();
        this.x = x;
        this.y = y;
        this.z = z;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.type = type;
        this.colour = colour;
        this.durability = 100;
    }

    leftX(){ return this.x; }
    rightX(){ return this.x + this.width; }
    bottomY(){ return this.y; }
    topY(){ return this.y + this.height; }
    backZ(){ return this.z; }
    frontZ(){ return this.z + this.depth; }

    containsXZ(x: number, z: number){
        return x >= this.leftX() && x <= this.rightX() && z >= this.backZ() && z <= this.frontZ();
    }
}

export default Box3D;
