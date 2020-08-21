var GameMode = require('./gameMode');
var Levels = require('../levels');
var possibleLevels = [Levels.Complex, Levels.Towers];

class BattleRoyale extends GameMode {
    constructor(clients){
        super(clients, true);
        this.level = possibleLevels[Math.floor(possibleLevels.length * Math.random())];
        this.title = "Battle Royale";
        this.subtitle = "Be the last one standing!";
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
            return {winner:alivePlayers[0], end:true};
        }
        if(alive == 0){
            return {end:true};
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
        
    }
}

module.exports = BattleRoyale;