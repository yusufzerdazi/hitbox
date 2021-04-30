var GameMode = require('./gameMode');
var Levels = require('../levels');
var Flag = require('../players/flag');
var Constants = require('../constants');

class CaptureTheFlag extends GameMode {
    constructor(clients, ticks, emitToAllClients){
        super(clients, true, emitToAllClients);
        var possibleLevels = [Levels.LongIsland];
        this.level = possibleLevels[Math.floor(possibleLevels.length * Math.random())];
        
        this.finished = false;
        this.title = "Capture The Flag";
        this.subtitle = "Steal the other team's flag";
        
        this.blueFlag = new Flag(Constants.TEAM1, -2750, Constants.HEIGHT / 2);
        this.redFlag = new Flag(Constants.TEAM2, 3250 + Constants.WIDTH / 2 - Constants.PLAYERWIDTH, Constants.HEIGHT / 2);
        this.clients.push({player: this.blueFlag});
        this.clients.push({player: this.redFlag});

        this.allocateTeams();
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
        if(!this.winningTeam){
            return {end: false};
        }
        this.finished = true;
        var winningPlayers = this.clients.filter(c => c.player.team == this.winningTeam && c.player.type == null);
        var losingPlayers = this.clients.filter(c => c.player.team != this.winningTeam && c.player.type == null);
        return {end: true, winners: winningPlayers, losers: losingPlayers, winningTeam: this.winningTeam};
    }

    updateClients(clients){
        this.clients = clients;
        if(this.clients.filter(c => c.player.type == null && c.player.team == null).length > 0){
            this.allocateTeams();
        }
    }

    onCollision(client1, client2){
        var flag = client1.player.type == "flag" ? client1 : client2.player.type == "flag" ? client2 : null;
        var player = !client1.player.type ? client1 : !client2.player.type ? client2 : null;
        if(flag && player){
            flag.player.attachedToPlayer = player.player.name;
        }
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
        this.clients.filter(client => client.player.type === "flag").forEach(client => {
            this.level.platforms.filter(x => x.type == "goal").forEach(goal => {
                if(client.player.x >= goal.leftX() && client.player.x + client.player.width <= goal.rightX() &&
                    client.player.y >= goal.topY() && client.player.y + client.player.height <= goal.bottomY() &&
                    client.player.colour != goal.colour){
                        this.emitToAllClients("event", {
                            type: "capture",
                            colour: goal.colour
                        });
                        this.winningTeam = goal.colour;
                   }
            });
        });
    }
}

module.exports = CaptureTheFlag;