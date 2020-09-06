var GameMode = require('./gameMode');
var Levels = require('../levels');
var Orb = require('../players/orb');

class CollectTheBoxes extends GameMode {
    constructor(clients, startingTicks, emitToAllClients){
        super(clients, true, emitToAllClients);
        var possibleLevels = [Levels.Space, Levels.Complex, Levels.Towers, Levels.Island, Levels.Maze];
        this.level = possibleLevels[Math.floor(possibleLevels.length * Math.random())];
        this.title = "Collect the Boxes";
        this.subtitle = "First to 10!";
        this.finished = false;
        this.clients.forEach(c => {
            c.player.lives = 0;
        });
        var orb = new Orb();
        orb.respawn(this.clients, this.level);
        this.orb = {player:orb};
        this.clients.push(this.orb);
    }

    endCondition(ticks){
        var winner = this.clients.filter(c => c.player.lives === 10);
        if(winner.length === 1){
            this.finished = true;
            return {end: true, winner: this.clients.filter(c => !c.player.orb).length > 1 ? winner[0] : null};
        }
        return {end: false}
    }

    updateClients(clients){
        this.clients = clients;
    }

    onCollision(client1, client2){
        if(client1.player.orb){
            client2.player.lives += 1;
            client1.player.respawn(this.clients, this.level);
            this.emitToAllClients("event", {
                type: "box",
                player: {
                    name: client2.player.name,
                    colour: client2.player.colour
                }
            });
        } else if(client2.player.orb){
            client1.player.lives += 1;
            client2.player.respawn(this.clients, this.level);
            this.emitToAllClients("event", {
                type: "box",
                player: {
                    name: client1.player.name,
                    colour: client1.player.colour
                }
            });
        }
    }

    onPlayerDeath(client){
        var playerLives = client.player.lives;
        setTimeout(() => {
            if(!this.finished){
                client.player.respawn(this.clients, this.level);
                client.player.lives = playerLives;
            }
        }, 1000);
    }

    onTick(){
        this.orb.player.xVelocity = 0;
        this.orb.player.yVelocity = 0;
    }
}

module.exports = CollectTheBoxes;