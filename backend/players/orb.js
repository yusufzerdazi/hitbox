var Player = require('./player');
var Constants = require('../constants');

class Orb extends Player {
    constructor(){
        super("yellow", "", 0, 0, true);
        this.orb = true;
    }

    move(players, ticks){
    }
}

module.exports = Orb;