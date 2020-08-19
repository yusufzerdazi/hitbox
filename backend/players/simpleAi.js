var Player = require('./player');
var SimplexNoise = require('simplex-noise');

const SIMPLEX = new SimplexNoise();

class SimpleAi extends Player {
    constructor(colour, name, x, y){
        super(colour, name, x, y, true);
        this.randomMovementThreshold = Math.random();//0.8;
        this.doNothingThreshold = Math.random(); //0.6;
        this.boostThreshold = Math.random(); //0.99;
        this.randomBoostThreshold = Math.random(); //0.995;
        this.randomJumpThreshold = Math.random(); //0.99;
        this.jumpThreshold = 0.3;
        this.duckThreshold = -0.5;
        this.poundThreshold = 0.9;
        this.ticksScaling = 0.01;
    }

    move(players, ticks){
        var playerId = this.name.hashCode();
        
        var playersOnLeft = 0;
        var playersOnRight = 0;
        var playersAbove = 0;
        var playersBelow = 0;

        // Calculate how many players on right and left.
        players.forEach(player => {
            if(player.x > this.x){
                playersOnRight ++;
            }
            if(player.x < this.x){
                playersOnLeft ++;
            }
        });

        // Follow living players, with a bit of randomness thrown in.
        if(playersOnLeft > playersOnRight){
            this.left = SIMPLEX.noise2D(2 * playerId, ticks * this.ticksScaling) < this.doNothingThreshold;
            this.right = SIMPLEX.noise2D(2 * playerId, ticks * this.ticksScaling) > this.randomMovementThreshold;
            this.boostLeft = Math.random() > this.boostThreshold;
        } 
        else if(playersOnLeft < playersOnRight){
            this.left = SIMPLEX.noise2D(2 * playerId, ticks * this.ticksScaling) > this.randomMovementThreshold;
            this.right = SIMPLEX.noise2D(2 * playerId, ticks * this.ticksScaling) < this.doNothingThreshold;
            this.boostRight = Math.random() > this.boostThreshold;
        } 
        else {
            this.left = SIMPLEX.noise2D(2 * playerId, ticks * this.ticksScaling) > 0.33;
            this.right = SIMPLEX.noise2D(2 * playerId, ticks * this.ticksScaling) < -0.33;
            this.boostRight = Math.random() > this.randomBoostThreshold;
            this.boostLeft = Math.random() > this.randomBoostThreshold;
        }

        // Calculate players above and below.
        players.forEach(player => {
            if(player.y >= this.y){
                playersBelow ++;
            }
            if(player.y < this.y){
                playersAbove ++;
            }
        });

        // Jump to follow players, with a bit of randomness.
        if((playersAbove > playersBelow && Math.random() < this.jumpThreshold) || Math.random() > this.randomJumpThreshold){
            this.space = true;
        } 
        else {
            this.space = false;
            this.boostDown = Math.random() < this.poundThreshold;
        }
        
        // Randomly duck every once in a while.
        this.down = SIMPLEX.noise2D(playerId, ticks * this.ticksScaling) < this.duckThreshold;
    }
}

module.exports = SimpleAi;