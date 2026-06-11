import { Room } from "colyseus";
import GameMode3D from './gameMode3d';
import Levels3D from './levels3d';
import Constants from '../constants';
import EndStatus from '../ranking/endStatus';
import { Hitbox3DRoomState } from './roomState3d';

// 3D adaptation of Death Wall: instead of a wall chasing you sideways, the
// ocean itself rises. Climb or drown — last one dry wins.
class DeathWall3D extends GameMode3D {
    winner: any;
    waterSpeed: number;

    constructor(roomRef: Room<Hitbox3DRoomState>){
        super(roomRef);
        this.damageEnabled = false;
        this.possibleLevels = [Levels3D.Towers, Levels3D.Islands, Levels3D.Pyramid, Levels3D.Hills,
            Levels3D.Steps, Levels3D.Canyon];
        this.roomRef.state.level = this.getLevel();
        this.title = "Rising Water";
        this.subtitle = "Don't touch the water!";
        this.waterSpeed = 0.5;
        this.winner = null;
        this.setModeSpecificPlayers();
    }

    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        var alivePlayers = players.filter(c => c.alive);
        var alive = alivePlayers.length;
        if(alive > 1 || players.length < 2){
            if(!(players.length == 1 && alive == 0)){
                return new EndStatus(false);
            }
        }
        if(alive == 1){
            this.winner = alivePlayers[0];
        }
        if(alive == 0){
            return new EndStatus(true, this.winner);
        }
        return new EndStatus(false);
    }

    onGameStart(){
        super.onGameStart();
        this.roomRef.state.level.waterLevel = 0;
        this.waterSpeed = 0.5;
    }

    onTick(){
        var players = Array.from(this.roomRef.state.players.values());
        this.waterSpeed = Math.min(Constants.TERMINAL / 4, this.waterSpeed * 1.001);
        if(players.length > 0){
            this.roomRef.state.level.waterLevel += this.waterSpeed;
        } else {
            this.roomRef.state.level.waterLevel = 0;
            this.waterSpeed = 0.5;
        }
    }
}

export default DeathWall3D;
