import Levels from '../level/levels';
import Square from '../level/square';
import { Room } from 'colyseus';
import { HitboxRoomState } from '../rooms/schema/HitboxRoomState';
import BattleRoyale from './battleRoyale';
import Player from '../players/player';
import Constants from '../constants';
import EndStatus from '../ranking/endStatus';

class Spleef extends BattleRoyale {
    winner: any;

    constructor(roomRef: Room<HitboxRoomState>){
        super(roomRef);
        this.damageEnabled = false;
        this.possibleLevels = [Levels.Spleef];
        this.roomRef.state.level = this.getLevel();
        this.title = "Spleef";
    }

    onLanding(platform: Square, player: Player) {
        if(player.yVelocity > 1.5 * Constants.TERMINAL){
            platform.durability = 0;
        } else {
            platform.durability -= 10;
        }
        if(platform.durability <= 0){
            this.roomRef.state.level.platforms = this.roomRef.state.level.platforms.filter(p => p != platform);
        }
    }
}

export default Spleef;