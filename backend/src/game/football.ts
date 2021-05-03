import GameMode from './gameMode';
import Levels from '../levels';
import Ball from '../players/ball';
import Constants from '../constants';
import { HitboxRoomState } from '../rooms/schema/HitboxRoomState';
import { Room } from 'colyseus';
import Player from '../players/player';
import Square from '../square';

class Football extends GameMode {
    finished: boolean;
    scores: any;

    constructor(roomRef: Room<HitboxRoomState>){
        super(true, roomRef);
        this.possibleLevels = [Levels.LongIsland];
        this.roomRef.state.level = this.getLevel();
        
        this.finished = false;
        this.title = "Football";
        this.subtitle = "First team to 3 goals!";
        this.teamBased = true;
        
        this.allocateTeams();
        this.setModeSpecificPlayers();

        this.scores = {
            team1: 0,
            team2: 0
        }
    }

    setModeSpecificPlayers() {
        super.setModeSpecificPlayers();
        var ball = new Ball(0, -500);
        this.roomRef.state.players.set(ball.clientId, ball);
    }
    
    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        var winningTeam = this.scores.team1 == 3 ? Constants.TEAM1 : this.scores.team2 === 3 ? Constants.TEAM2 : null
        if(!winningTeam){
            return {end: false};
        }
        this.finished = true;
        var winningPlayers = players.filter(c => c.team == winningTeam && c.type == null);
        var losingPlayers = players.filter(c => c.team != winningTeam && c.type == null);
        
        return { end: true, winners: winningPlayers, losers: losingPlayers, winningTeam: winningTeam };
    }

    onGameStart(){
        this.allocateTeams();
    }

    onPlayerJoin(){
        this.allocateTeams();
    }

    onPlayerDeath(player: Player){
        var players = Array.from(this.roomRef.state.players.values());
        if(player.type == "ball"){
            player.respawn(players, this.roomRef.state.level, this.teamBased);
            return;
        }
        setTimeout(() => {
            if(!this.finished){
                player.respawn(players, this.roomRef.state.level, this.teamBased);
            }
        }, 1000);
    }

    onTick(){
        var players = Array.from(this.roomRef.state.players.values());
        players.filter(client => client.type === "ball").forEach(player => {
            this.roomRef.state.level.platforms.filter(x => x.type == "goal").forEach((goal: Square) => {
                if(player.x >= goal.leftX() && player.x + player.width <= goal.rightX() &&
                    player.y >= goal.topY() && player.y + player.height <= goal.bottomY()){
                        var scorerColour = goal.colour === Constants.TEAM1 ? "team2" : "team1";
                        this.scores[scorerColour] += 1;
                        this.roomRef.broadcast("event", {
                            type: "goal",
                            colour: goal.colour
                        });
                        player.respawn(players, this.roomRef.state.level);
                   }
            });
        });
    }
}

export default Football;