class Player {
    constructor(colour, name, x, y, ai = false){
        this.colour = colour;
        this.name = name;
        this.x = x;
        this.y = y;
        this.ai = ai;
        this.ducked = false;
        this.left = false;
        this.right = false;

        this.xVelocity = 0;
        this.yVelocity = 0;
        this.health = 100;
        this.score = 0;
        this.alive = true;
        this.invincibility = 0;
        this.boostCooldown = 100;
        this.score = 0;
    }

    reset(x, y){
        this.x = x;
        this.y = y;
        this.ducked = false;
        this.left = false;
        this.right = false;
        this.health = 100;
        this.alive = true;
        this.invincibility = 0;
        this.boostCooldown = 100;
    }
}

module.exports = Player;