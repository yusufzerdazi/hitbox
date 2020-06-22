var Player = require('./player');
var SimplexNoise = require('simplex-noise');

const PLATFORMHEIGHT = 400;
const SIMPLEX = new SimplexNoise();

class CleverAi extends Player {
    constructor(colour, name, x, y){
        var playerId = name.hashCode();
        super(colour, "<CLEVER"+Math.abs(playerId) % 1000+">", x, y, true);
        this.playerId = playerId;
        this.xBoostDistanceThreshold = 120;
        this.yBoostDistanceThreshold = 100;
        this.duckingCooldown = 0;
        this.ticksScaling = 0.01;
        this.alwaysHigher = this.playerId % 2 == 0;
    }

    duckBoostingPlayers(players){
        players.forEach(p => {
            var playerMovingTowardsMe = this.x < p.x && p.xVelocity < 0 || this.x > p.x && p.xVelocity > 0;
            var playerFasterThanMe = Math.abs(p.xVelocity) > Math.abs(this.xVelocity);
            var playerCloseToMe = Math.abs(p.x - this.x) < this.xBoostDistanceThreshold && Math.abs(p.y - this.y) < this.yBoostDistanceThreshold;

            if(playerMovingTowardsMe && playerFasterThanMe && playerCloseToMe){
                this.down = true;
                this.duckingCooldown = 50;
            } else if (this.duckingCooldown > 0) {
                this.down = true;
                this.duckingCooldown -= 1;
            } else {
                this.down = false;
            }
        });
    }

    jumpDuckingPlayers(players){
        players.forEach(p => {
            if(p.ducked && this.y == PLATFORMHEIGHT){
                this.space = true;
            }
        });
    }

    poundPlayersBelow(players){
        players.forEach(p => {
            var playerBelowMe = this.y < p.y;
            var playerCloseToMe = Math.abs(p.x - this.x) < 100;

            if(playerBelowMe && playerCloseToMe){
                this.down = true;
            }
            else {
                this.down = false;
            }
        });
    }

    followFirstPlayer(players, ticks){
        if(players[0] && players[0].x < this.x){
            var playerCloseToMeVertically = Math.abs(players[0].y - this.y) < this.yBoostDistanceThreshold;
            if(playerCloseToMeVertically || (this.y > players[0].y && this.x > 480)){
                this.boostLeft = true;
            }
            this.left = true;
            this.right = false;
        } else if (players[0]) {
            var playerCloseToMeVertically = Math.abs(players[0].y - this.y) < this.yBoostDistanceThreshold;
            if(playerCloseToMeVertically || (this.y > players[0].y && this.x <= 480)){
                this.boostRight = true;
            }
            this.left = false;
            this.right = true;
        }

        if(players[0] && players[0].y <= this.y){
            if(this.y == PLATFORMHEIGHT){
                this.space = true
            } else if(this.alwaysHigher) {
                this.space = true;
            }
        } else {
            this.space = false;
        }
    }

    dontFallToDeath(){
        if(this.y > PLATFORMHEIGHT) {
            this.space = true;
        }
    }

    move(players, ticks){
        this.duckBoostingPlayers(players);
        this.jumpDuckingPlayers(players);
        this.poundPlayersBelow(players);
        this.followFirstPlayer(players, ticks);
        this.dontFallToDeath();
    }
}

module.exports = CleverAi;