var Constants = require('../constants');
var Utils = require('../utils');

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
        this.onSurface = [];
        this.lives = 0;

        this.xVelocity = 0;
        this.yVelocity = 0;
        this.health = 100;
        this.score = 0;
        this.alive = true;
        this.invincibility = 0;
        this.boostCooldown = 20;
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
        this.boostCooldown = 20;
        this.onSurface = [];
        this.it = false;
        this.lives = 0;
    }

    respawn(clients, level){
        var newPosition;
        var anyCollision = true
        var onLand = false;
        while(anyCollision || !onLand){
            anyCollision = false;

            newPosition = {
                x: level.spawnArea.leftX() + Utils.getRandomInt(level.spawnArea.width),
                y: level.spawnArea.topY() + Constants.PLAYERHEIGHT + Utils.getRandomInt(level.spawnArea.height)
            };

            for(var i = 0; i < clients.length; i++){
                var xCollision = Math.abs((newPosition.x) - (clients[i].player.x)) <= Constants.PLAYERWIDTH + 20;
                var yCollision = Math.abs((newPosition.y) - (clients[i].player.y)) <= Constants.PLAYERHEIGHT + 20;
                if(xCollision && yCollision){
                    anyCollision = true;
                    break;
                }
            };

            onLand = false;
            for(var i = 0; i < level.platforms.length; i++){
                var xCollision = newPosition.x <= level.platforms[i].rightX() + 20 && newPosition.x >= (level.platforms[i].leftX() - Constants.PLAYERWIDTH) - 20;
                var yCollision = newPosition.y >= level.platforms[i].topY() - 20 && newPosition.y <= (level.platforms[i].bottomY() + Constants.PLAYERHEIGHT) + 20;
                if((xCollision && yCollision) || level.platforms[i].border && newPosition.y <= level.platforms[i].topY()){
                    anyCollision = true;
                    break;
                }
                if(xCollision && newPosition.y <= level.platforms[i].topY()){
                    onLand = true;
                }
            };
        }
        this.reset(newPosition.x, newPosition.y);
    }

    isCollision(player) {
        var xCollision = Math.abs((this.x + this.xVelocity) - (player.x + player.xVelocity)) <= Constants.PLAYERWIDTH;
        var yCollision = Math.abs((this.y + this.yVelocity) - (player.y + player.yVelocity)) <= Constants.PLAYERHEIGHT;
        var duckedYCollision = (Math.abs((this.y + this.yVelocity) - (player.y + player.yVelocity)) <= Constants.PLAYERHEIGHT * Constants.DUCKEDHEIGHT) ||
            player.y + player.yVelocity > Constants.PLATFORMHEIGHT;
    
        return (!this.ducked && xCollision && yCollision) || (this.ducked && xCollision && duckedYCollision);
    }

    speed(){
        return Math.sqrt(Math.pow(this.xVelocity, 2) + Math.pow(this.yVelocity, 2));
    }
}

module.exports = Player;