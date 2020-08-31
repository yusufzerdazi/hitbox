class GameMode {
    constructor(clients, damageEnabled, emitToAllClients) {
        this.clients = clients;
        this.damageEnabled = damageEnabled;
        this.emitToAllClients = emitToAllClients;
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