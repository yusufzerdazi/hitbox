var Constants = require('../constants');

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
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.ducked = false;
        this.left = false;
        this.right = false;
        this.health = 100;
        this.alive = true;
        this.invincibility = 0;
        this.boostCooldown = 100;
    }

    isCollision(player) {
        var xCollision = Math.abs((this.x + this.xVelocity) - (player.x + player.xVelocity)) <= Constants.PLAYERSIZE;
        var yCollision = Math.abs((this.y + this.yVelocity) - (player.y + player.yVelocity)) <= Constants.PLAYERSIZE - 10;
        var duckedYCollision = (Math.abs((this.y + this.yVelocity) - (player.y + player.yVelocity)) <= Constants.PLAYERSIZE * Constants.DUCKEDHEIGHT) ||
            player.y + player.yVelocity > Constants.PLATFORMHEIGHT;
    
        return (!this.ducked && xCollision && yCollision) || (this.ducked && xCollision && duckedYCollision);
    }

    speed(){
        return Math.sqrt(Math.pow(this.xVelocity, 2) + Math.pow(this.yVelocity, 2));
    }
}

module.exports = Player;