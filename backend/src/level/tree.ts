import Constants from "../constants";
import CompositeShape from "./compositeShape";
import Square from "./square";

class Tree extends CompositeShape {
    constructor(x: number, y: number, width: number, height: number, type: string = "platform", colour: string = null){
        super(x, y, width, height, type, colour);
        this.components.push(
            new Square(x - Constants.PLAYERWIDTH / 2, y - height / 2, Constants.PLAYERWIDTH, height / 2, 'trunk', '#725c42'),
            new Square(x - width / 2, y - height, width, height / 2, 'leaves', '#5ca904'),
            new Square(x - width / 3 + (width / 4) * (Math.random() - 0.5), y - height - (width / 4) * (Math.random()), width / 1.5, width / 1.5, 'backgroundleaves', '#5ca904'),
            new Square(x - width / 3 + (width / 4) * (Math.random() - 0.5), y - height - (width / 4) * (Math.random()), width / 1.5, width / 1.5, 'backgroundleaves', '#5ca904'),
            new Square(x - width / 3 + (width / 4) * (Math.random() - 0.5), y - height - (width / 4) * (Math.random()), width / 1.5, width / 1.5, 'backgroundleaves', '#5ca904')
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

export default Tree;