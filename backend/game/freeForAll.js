var GameMode = require('./gameMode');
var Utils = require('../utils');
var Constants = require('../constants');
var Levels = require('../levels');

class FreeForAll extends GameMode {
    constructor(clients, startingTicks){
        super(clients, true);
        var possibleLevels = [Levels.Complex, Levels.Towers, Levels.Island, Levels.Maze];
        if(clients.length < 10){
            possibleLevels.push(Levels.Basic);
        }
        this.level = possibleLevels[Math.floor(possibleLevels.length * Math.random())];
        this.gameLength = 5000;
        this.killToWin = 5;
        this.playerDamage = 100;
        this.title = "Free for All";
        this.subtitle = this.killToWin + " lives each!";
        this.startingTicks = startingTicks;
        this.finished = false;
        this.clients.forEach(c => {
            c.player.lives = 5;
        });
    }

    endCondition(ticks){
        var winner = this.clients.filter(c => c.player.lives > 0);
        if(winner.length === 1 && this.clients.length > 1){
            this.finished = true;
            return {end: true, winner: winner[0]};
        }
        if(winner.length === 0 && this.clients.length > 0){
            this.finished = true;
            return {end: true};
        }
        return {end: false};
    }

    updateClients(clients){
        this.clients = clients;
    }

    onCollision(client1, client2){
    }

    onPlayerDeath(client){
        var playerLives = client.player.lives - 1;
        client.player.lives = playerLives;
        if(playerLives === 0){
            return;
        }
        setTimeout(() => {
            if(!this.finished){
                client.player.respawn(this.clients, this.level);
                client.player.lives = playerLives;
            }
        }, 1000);
    }

    onTick(){
        
    }
}

module.exports = FreeForAll;