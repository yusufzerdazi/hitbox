var Player = require('./player');
var Constants = require('../constants');

class Flag extends Player {
    constructor(colour, x, y){
        super(colour, "", x, y, true);
        this.type = "flag";
        this.name = colour + " flag";
        this.it = false;
        this.width = Constants.PLAYERWIDTH;
        this.height = Constants.PLAYERHEIGHT;
    }

    move(players, ticks){
    }
}

module.exports = Flag;