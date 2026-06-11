import Player3D from './player3d';

class Flag3D extends Player3D {
    initialX: number;
    initialY: number;
    initialZ: number;

    constructor(colour: string, x: number, y: number, z: number){
        super(colour, colour + " flag", true);
        this.initialX = x;
        this.initialY = y;
        this.initialZ = z;
        this.type = "flag";
        this.clientId = colour + " flag";
        this.reset(x, y, z);
    }

    respawn(){
        this.reset(this.initialX, this.initialY, this.initialZ);
        this.attachedToPlayer = null;
    }
}

export default Flag3D;
