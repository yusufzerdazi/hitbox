class GameMode {
    constructor(clients, level, damageEnabled) {
        this.clients = clients;
        this.level = level;
        this.damageEnabled = damageEnabled;
    }

    endCondition(ticks){

    }

    onCollision(player1, player2){
        
    }
}

module.exports = GameMode;