import { Room } from "colyseus";
import GameMode3D from './gameMode3d';
import Levels3D from './levels3d';
import Flag3D from './flag3d';
import Player3D from './player3d';
import Constants from '../constants';
import Level3D from './level3d';
import EndStatus from '../ranking/endStatus';
import { Hitbox3DRoomState } from './roomState3d';

class CaptureTheFlag3D extends GameMode3D {
    team1Flag: Flag3D;
    team2Flag: Flag3D;
    finished: boolean;
    winningTeam: string;

    constructor(roomRef: Room<Hitbox3DRoomState>){
        super(roomRef);
        this.damageEnabled = true;
        this.possibleLevels = [Levels3D.Highlands, Levels3D.Crater];
        this.roomRef.state.level = this.getLevel();

        this.finished = false;
        this.title = "Capture The Flag";
        this.subtitle = "Steal the other team's flag";
        this.teamBased = true;

        var team1Base = this.roomRef.state.level.platforms.filter(l => l.colour == Constants.TEAM1)[0];
        var team2Base = this.roomRef.state.level.platforms.filter(l => l.colour == Constants.TEAM2)[0];
        this.team1Flag = new Flag3D(Constants.TEAM1,
            team1Base.leftX() + team1Base.width / 2, team1Base.topY(), team1Base.backZ() + team1Base.depth / 2);
        this.team2Flag = new Flag3D(Constants.TEAM2,
            team2Base.leftX() + team2Base.width / 2, team2Base.topY(), team2Base.backZ() + team2Base.depth / 2);

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
        return new EndStatus(true, null, winningPlayers as any, losingPlayers as any, this.winningTeam);
    }

    onCollision(player1: Player3D, player2: Player3D, players: Player3D[]){
        var flag = player1.type == "flag" ? player1 : player2.type == "flag" ? player2 : null;
        var player = !player1.type ? player1 : !player2.type ? player2 : null;
        if(flag && player){
            if(flag.colour != player.team){
                flag.attachedToPlayer = player.name;
            } else {
                (flag as Flag3D).respawn();
            }
        } else if (!player1.type && !player2.type && (player1.attachedPlayers || player2.attachedPlayers)){
            // A hard enough hit thwacks the flag off the carrier.
            if(player1.speed() >= Constants.THWACKSPEED){
                Array.from(this.roomRef.state.players.values()).filter(p => p.attachedToPlayer == player2.name)
                    .forEach(p => {
                        p.attachedToPlayer = null;
                        p.invincibility = 1000;
                    });
            }
            if(player2.speed() >= Constants.THWACKSPEED){
                Array.from(this.roomRef.state.players.values()).filter(p => p.attachedToPlayer == player1.name)
                    .forEach(p => {
                        p.attachedToPlayer = null;
                        p.invincibility = 1000;
                    });
            }
        }
    }

    onPlayerDeath(player: Player3D, players: Player3D[], level: Level3D){
        if(player.type == "flag"){
            (player as Flag3D).respawn();
            return;
        }
        setTimeout(() => {
            if(!this.finished){
                player.respawn(players, level, this.teamBased);
            }
        }, 1000);
    }

    onGameStart(){
        super.onGameStart();
        this.allocateTeams();
    }

    onPlayerJoin(){
        this.allocateTeams();
    }

    onTick(){
        var players = Array.from(this.roomRef.state.players.values());
        players.filter(p => p.type === "flag").forEach(flag => {
            this.roomRef.state.level.platforms.filter(x => x.colour && x.colour != flag.colour).forEach(base => {
                if(base.containsXZ(flag.x, flag.z) &&
                    flag.y >= base.topY() - 10 && flag.y <= base.topY() + 600){
                        this.roomRef.broadcast("event", {
                            type: "capture",
                            colour: base.colour
                        });
                        this.winningTeam = base.colour;
                   }
            });
        });
    }
}

export default CaptureTheFlag3D;
