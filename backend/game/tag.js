var GameMode = require('./gameMode');
var Utils = require('../utils');
var Constants = require('../constants');
var Levels = require('../levels');

class Tag extends GameMode {
    constructor(clients, startingTicks){
        super(clients, false);
        var possibleLevels = [Levels.Complex, Levels.Towers, Levels.Island, Levels.Maze];
        if(clients.length < 10){
            possibleLevels.push(Levels.Basic);
        }
        this.level = possibleLevels[Math.floor(possibleLevels.length * Math.random())];
        this.gameLength = 1000;
        this.startingTicks = startingTicks;
        this.title = "Tag";
        this.subtitle = "Keep the halo!";
        if(this.clients.length > 0){
            this.clients[Math.floor(Math.random() * clients.length)].player.it = true;
        }
        this.finished = false;
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
            this.finished = true;
            return {end: true, winner: this.clients.length > 1 ? winner[0] : null};
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
        var stillHasStar = false;
        if(client.player.it && this.clients.length > 1){
            client.player.it = false;
            var possibleNewIt = this.clients.filter(c => c != client);
            possibleNewIt[Math.floor(Math.random() * possibleNewIt.length)].player.it = true;
        }
        else if(client.player.it){
            stillHasStar = true;
        }
        setTimeout(() => {
            if(!this.finished){
                client.player.respawn(this.clients, this.level);
                client.player.it = stillHasStar;
            }
        }, 1000);
    }

    onTick(){
        
    }
}

module.exports = Tag;