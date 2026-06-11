import { Room } from "colyseus";
import GameMode3D from './gameMode3d';
import Levels3D from './levels3d';
import Ball3D from './ball3d';
import Player3D from './player3d';
import Constants from '../constants';
import EndStatus from '../ranking/endStatus';
import { Hitbox3DRoomState } from './roomState3d';

class Football3D extends GameMode3D {
    finished: boolean;
    scores: any;

    constructor(roomRef: Room<Hitbox3DRoomState>){
        super(roomRef);
        this.damageEnabled = true;
        this.possibleLevels = [Levels3D.Pitch, Levels3D.Bridge];
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
        };
    }

    setModeSpecificPlayers() {
        super.setModeSpecificPlayers();
        var ball = new Ball3D();
        ball.respawn(Array.from(this.roomRef.state.players.values()), this.roomRef.state.level);
        this.roomRef.state.players.set(ball.clientId, ball);
    }

    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        var winningTeam = this.scores.team1 == 3 ? Constants.TEAM1 : this.scores.team2 === 3 ? Constants.TEAM2 : null;
        if(!winningTeam){
            return new EndStatus(false);
        }
        this.finished = true;
        var winningPlayers = players.filter(c => c.team == winningTeam && c.type == null);
        var losingPlayers = players.filter(c => c.team != winningTeam && c.type == null);
        return new EndStatus(true, null, winningPlayers as any, losingPlayers as any, winningTeam);
    }

    onGameStart(){
        super.onGameStart();
        this.allocateTeams();
        this.roomRef.broadcast("event", {
            type: "goal",
            scores: this.scores
        });
    }

    onPlayerJoin(){
        this.allocateTeams();
    }

    onPlayerDeath(player: Player3D){
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
        players.filter(p => p.type === "ball").forEach(ball => {
            this.roomRef.state.level.platforms.filter(x => x.type == "goal").forEach(goal => {
                const half = ball.width / 2;
                if(ball.x - half >= goal.leftX() && ball.x + half <= goal.rightX() &&
                    ball.z - half >= goal.backZ() && ball.z + half <= goal.frontZ() &&
                    ball.y >= goal.bottomY() && ball.y + ball.height <= goal.topY()){
                        var scorerColour = goal.colour === Constants.TEAM1 ? "team2" : "team1";
                        this.scores[scorerColour] += 1;
                        this.roomRef.broadcast("event", {
                            type: "goal",
                            colour: goal.colour,
                            scores: this.scores,
                            location: { x: ball.x, y: ball.y + ball.height / 2, z: ball.z }
                        });
                        ball.respawn(players, this.roomRef.state.level);
                   }
            });
        });
    }
}

export default Football3D;
