var SimpleAi = require('../players/simpleAi');
var CleverAi = require('../players/cleverAi');

class GameMode {
    constructor(clients, damageEnabled, emitToAllClients) {
        this.clients = clients;
        this.damageEnabled = damageEnabled;
        this.emitToAllClients = emitToAllClients;
        this.replacePlayers();
    }

    replacePlayers() {
        var aiPlayers = this.clients.filter(c => c.player.ai && !c.player.orb && !["ball","flag"].includes(c.player.type));
        for(var i = 0; i<aiPlayers.length; i++){
            var score = aiPlayers[i].player.score;
            if(Math.random() > 0.5){
                aiPlayers[i].player = new SimpleAi(aiPlayers[i].player.colour, aiPlayers[i].player.name)
            } else {
                aiPlayers[i].player = new CleverAi(aiPlayers[i].player.colour, aiPlayers[i].player.name)
            }
            aiPlayers[i].player.score = score;
        }
    }

    endCondition(ticks){

    }

    onCollision(player1, player2){
        
    }

    getLevel(){
        return this.level;
    }

    onTick(){
        
    }
}

module.exports = GameMode;