var GameMode = require('./gameMode');
var Utils = require('../utils');
var Constants = require('../constants');

class Tag extends GameMode {
    constructor(clients, level, startingTicks){
        super(clients, level, false);
        this.gameLength = 1000;
        this.startingTicks = startingTicks;
        this.title = "Tag";
        this.subtitle = "Keep the star!";
        if(this.clients.length > 0){
            this.clients[Math.floor(Math.random() * clients.length)].player.it = true;
        }
    }

    updateClients(clients){
        this.clients = clients;
        if(this.clients.length > 0 && this.clients.filter(c => c.player.it).length == 0){
            this.clients[Math.floor(Math.random() * clients.length)].player.it = true;
        }
    }

    endCondition(ticks){
        if(ticks > this.gameLength + this.startingTicks){
            var winner = this.clients.filter(c => c.player.it);
            return {end: true, winner: winner[0]};
        }
        return {end: false}
    }

    onCollision(client1, client2){
        var client1wasIt = client1.player.it;
        var client2wasIt = client2.player.it;
        if(client1wasIt){
            client2.player.it = true;
            client1.player.it = false;
            client2.player.invincibility = 1000;
        }
        if(client2wasIt){
            client2.player.it = false;
            client1.player.it = true;
            client1.player.invincibility = 1000;
        }
    }

    onPlayerDeath(client){
        var newPosition;
        var anyCollision = true
        var onLand = false;

        if(client.player.it){
            client.player.it = false;
            var possibleNewIt = this.clients.filter(c => c != client);
            possibleNewIt[Math.floor(Math.random() * possibleNewIt.length)].player.it = true;
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
        }, 1000);
    }
}

module.exports = Tag;