var GameMode = require('./gameMode');
var Levels = require('../levels');

class BattleRoyale extends GameMode {
    constructor(clients){
        super(clients, true);
        var possibleLevels = [Levels.Space, Levels.Complex, Levels.Towers, Levels.Island, Levels.Maze];
        if(clients.length < 10){
            possibleLevels.push(Levels.Basic);
        }
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
            return { winner:alivePlayers[0], end:true };
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