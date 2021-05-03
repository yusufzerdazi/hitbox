import Player from './player';
import Constants from '../constants';

class Flag extends Player {
    initialX: number;
    initialY: number;

    constructor(colour: string, x: number, y: number){
        super(colour, "", x, y, true);
        this.initialX = x;
        this.initialY = y;
        this.type = "flag";
        this.name = colour + " flag";
        this.it = false;
        this.width = Constants.PLAYERWIDTH;
        this.height = Constants.PLAYERHEIGHT;
        this.clientId = this.colour + " flag";
    }

    respawn(){
        this.reset(this.initialX, this.initialY);
    }
}

export default Flag;