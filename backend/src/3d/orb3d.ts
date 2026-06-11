import Player3D from './player3d';

// The golden box players race to collect.
class Orb3D extends Player3D {
    constructor(){
        super("yellow", "", true);
        this.orb = true;
        this.type = "orb";
        this.clientId = "orb";
    }
}

export default Orb3D;
