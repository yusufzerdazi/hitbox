import Player3D from './player3d';
import Constants from '../constants';
import Level3D from './level3d';

// The football: a big bouncy sphere players knock around.
class Ball3D extends Player3D {
    constructor(){
        super("white", "", true);
        this.type = "ball";
        this.width = Constants.BALLWIDTH;
        this.height = Constants.BALLWIDTH;
        this.depth = Constants.BALLWIDTH;
        this.clientId = "ball";
    }

    respawn(players: Player3D[], level: Level3D, keepTeam: boolean = false){
        // Drop into the centre circle.
        this.reset(0, level.spawnArea.topY(), 0);
    }
}

export default Ball3D;
