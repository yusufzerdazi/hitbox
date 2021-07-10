import Shape from "./shape";

class Square extends Shape {    
    constructor(x: number, y: number, width: number, height: number, type: string = "platform", colour: string = null){
        super(x, y, width, height, type, colour);
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