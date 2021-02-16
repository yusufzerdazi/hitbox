var GameMode = require('./gameMode');
var Levels = require('../levels');
var Ball = require('../players/ball');
var Constants = require('../constants');

class Football extends GameMode {
    constructor(clients, ticks, emitToAllClients){
        super(clients, true, emitToAllClients);
        var possibleLevels = [Levels.LongIsland];
        this.level = possibleLevels[Math.floor(possibleLevels.length * Math.random())];
        
        this.finished = false;
        this.title = "Football";
        this.subtitle = "First team to 3 goals!";
        
        var ball = new Ball(0, -500);
        ball.respawn(this.clients, this.level);
        this.orb = {player:ball};
        this.clients.push(this.orb);

        this.allocateTeams();

        this.scores = {
            team1: 0,
            team2: 0
        }
    }

    allocateTeams(){
        while(this.clients.filter(c => c.player.type == null && c.player.team == null) != 0){
            var unselectedPlayers = this.clients.filter(c => c.player.type == null && c.player.team == null);
            var team1Players = this.clients.filter(c => c.player.team == Constants.TEAM1);
            var team2Players = this.clients.filter(c => c.player.team == Constants.TEAM2);
            var teamToChoose = team1Players.length < team2Players.length ? Constants.TEAM1 : Constants.TEAM2;
            var randomPlayer = Math.floor(Math.random() * unselectedPlayers.length);
            unselectedPlayers[randomPlayer].player.team = teamToChoose;
        }
    }

    endCondition(ticks){
        var winningTeam = this.scores.team1 == 3 ? Constants.TEAM1 : this.scores.team2 === 3 ? Constants.TEAM2 : null
        if(!winningTeam){
            return {end: false};
        }
        this.finished = true;
        var winningPlayers = this.clients.filter(c => c.player.team == winningTeam && c.player.type == null);
        var losingPlayers = this.clients.filter(c => c.player.team != winningTeam && c.player.type == null);
        
        return {end: true, winners: winningPlayers, losers: losingPlayers, winningTeam: winningTeam};
    }

    updateClients(clients){
        this.clients = clients;
        if(this.clients.filter(c => c.player.type == null && c.player.team == null).length > 0){
            this.allocateTeams();
        }
    }

    onCollision(client1, client2){
    }

    onPlayerDeath(client){
        if(client.player.type == "ball"){
            client.player.respawn(this.clients, this.level);
            return;
        }
        setTimeout(() => {
            if(!this.finished){
                client.player.respawn(this.clients, this.level);
            }
        }, 1000);
    }

    onTick(){
        this.clients.filter(client => client.player.type === "ball").forEach(client => {
            this.level.platforms.filter(x => x.type == "goal").forEach(goal => {
                if(client.player.x >= goal.leftX() && client.player.x + client.player.width <= goal.rightX() &&
                    client.player.y >= goal.topY() && client.player.y + client.player.height <= goal.bottomY()){
                        var scorerColour = goal.colour === Constants.TEAM1 ? "team2" : "team1";
                        this.scores[scorerColour] += 1;
                        this.emitToAllClients("event", {
                            type: "goal",
                            colour: goal.colour,
                            scores: this.scores
                        });
                        client.player.respawn(this.clients, this.level);
                   }
            });
        });
    }
}

module.exports = Football;