import Constants from "../constants";
import CompositeShape from "./compositeShape";
import Square from "./square";

class House extends CompositeShape {
    constructor(x: number, y: number, width: number, height: number, type: string = "platform", colour: string = null){
        super(x, y, width, height, type, colour);
        var doorWidth = Constants.PLAYERWIDTH + 30;
        var doorHeight = Constants.PLAYERHEIGHT + 30;
        this.components.push(
            new Square(x - width / 2, y - height, width, height, 'house', '#dfdfdf'),
            new Square(x - doorWidth / 2, y - doorHeight, doorWidth, doorHeight, 'house', '#a6231f'),
            new Square(x - 3 * width / 8, y - 3 * height / 8, width / 4, height / 4, 'house', '#E4F6F8'),
            new Square(x + 1 * width / 8, y - 3 * height / 8, width / 4, height / 4, 'house', '#E4F6F8'),
            new Square(x - 3 * width / 8, y - 7 * height / 8, width / 4, height / 4, 'house', '#E4F6F8'),
            new Square(x + 1 * width / 8, y - 7 * height / 8, width / 4, height / 4, 'house', '#E4F6F8'),
            new Square(x - (width + doorWidth) / 2, y - height - 2 * doorHeight, (width + doorWidth), 2 * doorHeight, 'roof', '#a6231f'),
        );
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

export default House;