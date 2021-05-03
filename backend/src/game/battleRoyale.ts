import GameMode from './gameMode';
import Levels from '../levels';
import { Room } from "colyseus";
import { HitboxRoomState } from "../rooms/schema/HitboxRoomState";

class BattleRoyale extends GameMode {
    title: string;
    subtitle: string;

    constructor(roomRef: Room<HitboxRoomState>){
        super(true, roomRef);
        if(this.roomRef.state.players.size < 10){
            this.possibleLevels.push(Levels.Basic);
        }
        this.roomRef.state.level = this.getLevel();
        this.title = "Battle Royale";
        this.subtitle = "Be the last one standing!";
        this.setModeSpecificPlayers();
    }

    endCondition() {
        var alivePlayers = Array.from(this.roomRef.state.players.values()).filter(c => c.alive);
        var alive = alivePlayers.length;
        if(alive > 1 || this.roomRef.state.players.size < 2){
            if(!(this.roomRef.state.players.size == 1 && alive == 0)){
                return { end: false };
            }
        }
        if(alive == 1){
            return { winner: alivePlayers[0], end: true };
        }
        if(alive == 0){
            return { end: true };
        }
        return { end: false };
    }
}

export default BattleRoyale;