import GameMode from './gameMode';
import Levels from '../levels';
import Flag from '../players/flag';
import Constants from '../constants';
import Player from '../players/player';
import Level from '../level';
import Square from '../square';
import { Room } from "colyseus";
import { HitboxRoomState } from "../rooms/schema/HitboxRoomState";
import EndStatus from '../ranking/endStatus';

class CaptureTheFlag extends GameMode {
    team1Flag: Flag;
    team2Flag: Flag;
    finished: boolean;
    winningTeam: string;

    constructor(roomRef: Room<HitboxRoomState>){
        super(true, roomRef);
        this.possibleLevels = [Levels.LongIsland, Levels.Mountain];
        this.roomRef.state.level = this.getLevel();

        this.finished = false;
        this.title = "Capture The Flag";
        this.subtitle = "Steal the other team's flag";
        this.teamBased = true;

        var team1Goal = this.roomRef.state.level.platforms.filter(l => l.colour == Constants.TEAM1)[0];
        var team2Goal = this.roomRef.state.level.platforms.filter(l => l.colour == Constants.TEAM2)[0];
        this.team1Flag = new Flag(Constants.TEAM1, team1Goal.x + team1Goal.width / 2 - Constants.PLAYERWIDTH / 2, Constants.HEIGHT / 2);
        this.team2Flag = new Flag(Constants.TEAM2, team2Goal.x + team2Goal.width / 2 - Constants.PLAYERWIDTH / 2, Constants.HEIGHT / 2);

        this.setModeSpecificPlayers();
        this.allocateTeams();
    }

    setModeSpecificPlayers() {
        super.setModeSpecificPlayers();
        this.roomRef.state.players.set(this.team1Flag.clientId, this.team1Flag);
        this.roomRef.state.players.set(this.team2Flag.clientId, this.team2Flag);
    }

    endCondition(){
        if(!this.winningTeam){
            return new EndStatus(false);
        }
        this.finished = true;
        var players = Array.from(this.roomRef.state.players.values());
        var winningPlayers = players.filter(c => c.team == this.winningTeam && c.type == null);
        var losingPlayers = players.filter(c => c.team != this.winningTeam && c.type == null);
        return new EndStatus(true, null, winningPlayers, losingPlayers, this.winningTeam);
    }

    onCollision(client1: Player, client2: Player){
        var flag = client1.type == "flag" ? client1 : client2.type == "flag" ? client2 : null;
        var player = !client1.type ? client1 : !client2.type ? client2 : null;
        if(flag && player){
            if(flag.colour != player.team){
                flag.attachedToPlayer = player.name;
            } else {
                flag.respawn();
            }
        }
    }

    onPlayerDeath(player: Player, players: Player[], level: Level){
        setTimeout(() => {
            if(!this.finished){
                player.respawn(players, level, this.teamBased);
            }
        }, player.type == "flag" ? 0 : 1000);
    }

    onGameStart(){
        this.allocateTeams();
    }

    onPlayerJoin(){
        this.allocateTeams();
    }

    onTick(){
        var players = Array.from(this.roomRef.state.players.values());
        players.filter(player => player.type === "flag").forEach(player => {
            this.roomRef.state.level.platforms.filter(x => x.type == "goal").forEach((goal: Square) => {
                if(player.x >= goal.leftX() && player.x + player.width <= goal.rightX() &&
                    player.y >= goal.topY() && player.y + player.height <= goal.bottomY() &&
                    player.colour != goal.colour){
                        this.roomRef.broadcast("event", {
                            type: "capture",
                            colour: goal.colour
                        });
                        this.winningTeam = goal.colour;
                   }
            });
        });
    }
}

export default CaptureTheFlag;