import { type } from "@colyseus/schema";
import Shape from "./shape";

// A right-triangle slope occupying the AABB (x, y, width, height).
//   "up-right": hypotenuse rises from bottom-left to top-right
//                (player walking right goes upward)
//   "up-left":  hypotenuse rises from bottom-right to top-left
//                (player walking left goes upward)
class Slope extends Shape {
    @type("string") direction: string;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        direction: "up-right" | "up-left" = "up-right",
        type: string = "slope",
        colour: string = null
    ) {
        super(x, y, width, height, type, colour);
        this.direction = direction;
    }

    vertices(): { x: number; y: number }[] {
        const left = this.x;
        const right = this.x + this.width;
        const top = this.y;
        const bottom = this.y + this.height;
        if (this.direction === "up-right") {
            return [
                { x: left, y: bottom },
                { x: right, y: bottom },
                { x: right, y: top },
            ];
        }
        return [
            { x: left, y: bottom },
            { x: right, y: bottom },
            { x: left, y: top },
        ];
    }
}

export default Slope;
