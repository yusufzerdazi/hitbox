import { Schema, type, MapSchema } from "@colyseus/schema";

class Square extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("number") width: number;
    @type("number") height: number;
    @type("string") type: string;
    @type("string") colour: string;
    
    constructor(x: number, y: number, width: number, height: number, type: string = "platform", colour: string = null){
        super();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.colour = colour;
    }

    leftX(){
        return this.x;
    }

    rightX(){
        return this.x + this.width;
    }

    topY(){
        return this.y;
    }

    bottomY(){
        return this.y + this.height;
    }
}

export default Square;