import Player from './player';
import Constants from '../constants';

class Orb extends Player {
    constructor(){
        super("yellow", "", 0, 0, true);
        this.orb = true;
        this.type = "orb";
        this.width = Constants.PLAYERWIDTH;
        this.height = Constants.PLAYERHEIGHT;
        this.clientId = "orb";
    }
}

export default Orb;