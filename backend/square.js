class Square {
    constructor(x, y, width, height, border = false){
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.border = border;
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

module.exports = Square;