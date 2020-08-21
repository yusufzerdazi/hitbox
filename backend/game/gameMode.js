class GameMode {
    constructor(clients, damageEnabled) {
        this.clients = clients;
        this.damageEnabled = damageEnabled;
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