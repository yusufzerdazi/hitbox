import { type, ArraySchema } from "@colyseus/schema";
import Shape from "./shape";
import Square from "./square";

class CompositeShape extends Shape {
    @type([Square]) components: ArraySchema<Square>;
    
    constructor(x: number, y: number, width: number, height: number, type: string = "platform", colour: string = null){
        super(x, y, width, height, type, colour);
        this.components = new ArraySchema();
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

export default CompositeShape;