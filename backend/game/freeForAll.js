var GameMode = require('./gameMode');
var Utils = require('../utils');
var Constants = require('../constants');

class FreeForAll extends GameMode {
    constructor(clients, level, startingTicks){
        super(clients, level, true);
        this.gameLength = 5000;
        this.killToWin = 5;
        this.title = "Free for All";
        this.subtitle = this.killToWin + " lives each!";
        this.startingTicks = startingTicks;
    }

    endCondition(ticks){
        var winner = this.clients.filter(c => c.player.lives > 0);
        if(winner.length === 1 && this.clients.length > 1){
            return {end: true, winner: winner[0]};
        }
        if(winner.length === 0 && this.clients.length > 0){
            return {end: true};
        }
        return {end: false};
    }

    updateClients(clients){
        this.clients = clients;
    }

    onCollision(client1, client2){
        // console.log(client1.player.health);
        // console.log(client2.player.health)
        // if(client1.player.health === 0 && client2.player.health === 0){
        //     return;
        // }
        // if(client1.player.health === 0){
        //     client2.player.kills += 1;
        // }
        // if(client2.player.health === 0){
        //     client1.player.kills += 1;
        // }
    }

    onPlayerDeath(client){
        var newPosition;
        var anyCollision = true
        var onLand = false;
        var playerLives = client.player.lives - 1;
        client.player.lives = playerLives;
        if(playerLives === 0){
            return;
        }
        setTimeout(() => {
            while(anyCollision || !onLand){
                anyCollision = false;
    
                newPosition = {
                    x: -1000 + Utils.getRandomInt(2000 + Constants.WIDTH - Constants.PLAYERWIDTH),
                    y: -1000 + Constants.PLAYERHEIGHT + Utils.getRandomInt(1000 + Constants.PLATFORMHEIGHT - Constants.PLAYERHEIGHT)
                };
    
                for(var i = 0; i < this.clients.length; i++){
                    var xCollision = Math.abs((newPosition.x) - (this.clients[i].player.x)) <= Constants.PLAYERWIDTH + 20;
                    var yCollision = Math.abs((newPosition.y) - (this.clients[i].player.y)) <= Constants.PLAYERHEIGHT + 20;
                    if(xCollision && yCollision){
                        anyCollision = true;
                        break;
                    }
                };
    
                onLand = false;
                for(var i = 0; i < this.level.length; i++){
                    var xCollision = newPosition.x <= this.level[i].rightX() + 20 && newPosition.x >= (this.level[i].leftX() - Constants.PLAYERWIDTH) - 20;
                    var yCollision = newPosition.y >= this.level[i].topY() - 20 && newPosition.y <= (this.level[i].bottomY() + Constants.PLAYERHEIGHT) + 20;
                    if((xCollision && yCollision) || this.level[i].border && newPosition.y <= this.level[i].topY()){
                        anyCollision = true;
                        break;
                    }
                    if(xCollision && newPosition.y <= this.level[i].topY()){
                        onLand = true;
                    }
                };
            }
            client.player.reset(newPosition.x, newPosition.y);
            client.player.lives = playerLives;
        }, 1000);
    }
}

module.exports = FreeForAll;