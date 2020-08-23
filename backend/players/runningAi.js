var Player = require('./player');
var Constants = require('../constants');

class RunningAi extends Player {
    constructor(colour, name, x, y){
        super(colour, name, x, y, true);
        this.abovePlatformThreshold = Math.random() * 2000;
        this.yVelocityThreshold = Math.random() * 20;
    }

    move(players, ticks, level){
        if(this.onSurface.includes(true)){
            this.justJumped = true;
            this.right = true;

            var platformsAbove = level.platforms.filter(p => {
                if(this.x >= p.leftX() && this.x <= p.rightX() + Constants.PLAYERWIDTH && p.topY() - this.y >= 0){
                    return p;
                }
            });

            if(platformsAbove[0] == undefined || platformsAbove[0].rightX() - this.x < 100){
                this.space = true;
            }
        } else {
            var platformsAbove = level.platforms.filter(p => {
                if(this.x >= p.leftX() && this.x <= p.rightX() && p.topY() - this.y >= 0 && p.topY() - this.y < this.abovePlatformThreshold && this.yVelocity > 0){
                    return p;
                }
            });
            if(platformsAbove.length > 0 && !this.justJumped && this.boostCooldown > 20){
                this.right = false;
                this.space = false;
            }
            if(platformsAbove.length == 0 && this.yVelocity > this.yVelocityThreshold){
                this.justJumped = false;
                this.right = true;
                this.space = true;
            }
        }
    }
}

module.exports = RunningAi;