var GameMode = require('./gameMode');
var Levels = require('../levels');
var Constants = require('../constants');
var Square = require('../square');

class DeathWall extends GameMode {
    constructor(clients, ticks){
        super(clients, false);
        this.level = Levels.DeathWall;
        this.title = "Death Wall";
        this.subtitle = "Don't touch the wall!";
        this.startingTicks = ticks;
        this.jumpDistance = 2 * ((2 * Constants.JUMPSPEED) / Constants.VERTICALACCELERATION) * Constants.TERMINAL;
        this.deathWallX = - 1500;
        this.maxDistance = 0;
        this.deathWallSpeed = 5;
        this.level.maxDistance = this.level.maxDistance || 0;
        this.winner = null;
    }

    endCondition(ticks){
        var alivePlayers = this.clients.filter(c => c.player.alive)
        var alive = alivePlayers.length;
        if(alive > 1 || this.clients.length < 2){
            if(!(this.clients.length == 1 && alive == 0)){
                return {end:false};
            }
        }
        if(alive == 1){
            if(this.clients.filter(x => x.player.ai).length == 0){
                this.clients.forEach(client => {
                    if(client == alivePlayers[0]){
                        client.emit('win');
                        client.emit('beaten', this.clients.filter(c => c.player).length - 1);
                    } else if(this.clients.filter(c => c.player).length >= 2){
                        client.emit('loss');
                    }
                })
            }
            this.winner = alivePlayers[0];
        }
        if(alive == 0){
            return {end:true, winner: this.winner};
        }
        return {end:false};
    }

    updateClients(clients){
        this.clients = clients;
    }

    onCollision(client1, client2){
    }

    onPlayerDeath(){
    }

    onTick(){
        var farthestRigthPlatformX = Math.max.apply(Math, this.level.platforms.map((platform) => platform.rightX()));
        var farthestRightPlayer = Math.max.apply(Math, this.clients.map(c => c.player.x));
        this.deathWallSpeed = Math.min(Constants.TERMINAL, this.deathWallSpeed * 1.001);
        this.deathWallX += this.deathWallSpeed;
        this.level.maxDistance = Math.max(farthestRightPlayer, this.level.maxDistance);
        this.maxDistance = Math.max(farthestRightPlayer, this.maxDistance);
        this.clients.forEach(c => {
            if(c.player.x < this.deathWallX){
                c.player.health = 0;
            }
        })
        if(farthestRightPlayer + 4000 < farthestRigthPlatformX){
            return false;
        }
        var newPlatformX = farthestRigthPlatformX + this.jumpDistance * Math.random();
        var newPlatformY = Constants.HEIGHT / 2 - Math.random() * 1000;
        var newPlatformWidth = 200 + Math.random() * 1000;
        var newPlatformHeight = 200;

        this.level.platforms.push(new Square(newPlatformX, newPlatformY, newPlatformWidth, newPlatformHeight));
        return true;
    }
}

module.exports = DeathWall;