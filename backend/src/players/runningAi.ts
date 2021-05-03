import Player from './player';
import Constants from '../constants';
import Level from '../level';
import Utils from '../utils';

class RunningAi extends Player {
    abovePlatformThreshold: number;
    yVelocityThreshold: number;
    justJumped: boolean;
    
    constructor(colour: string, name: string, x: number = null, y: number = null){
        super(colour, name, x, y, true);
        this.abovePlatformThreshold = Math.random() * 2000;
        this.yVelocityThreshold = Math.random() * 20;
    }

    move(players: Player[], ticks: number, level: Level){
        if(this.onSurface){
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

export default RunningAi;