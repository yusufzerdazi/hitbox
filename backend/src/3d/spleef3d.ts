import { Room } from "colyseus";
import BattleRoyale3D from './battleRoyale3d';
import Levels3D from './levels3d';
import Box3D from './box3d';
import Player3D from './player3d';
import Constants from '../constants';
import { Hitbox3DRoomState } from './roomState3d';

class Spleef3D extends BattleRoyale3D {
    constructor(roomRef: Room<Hitbox3DRoomState>){
        super(roomRef);
        this.damageEnabled = false;
        this.possibleLevels = [Levels3D.Spleef, Levels3D.SkySpleef];
        this.roomRef.state.level = this.getLevel();
        this.title = "Spleef";
        this.subtitle = "Don't fall through!";
    }

    onLanding(platform: Box3D, player: Player3D) {
        if(platform.type != "pad"){
            return;
        }
        // Hard landings smash the pad outright; standing erodes it.
        if(player.yVelocity < -1.5 * Constants.TERMINAL){
            platform.durability = 0;
        } else {
            platform.durability -= 10;
        }
    }
}

export default Spleef3D;
