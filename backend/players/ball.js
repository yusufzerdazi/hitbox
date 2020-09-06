var Player = require('./player');
var Constants = require('../constants');

class Ball extends Player {
    constructor(colour, name, x, y){
        super("red", name, x, y, true);
        this.type = "ball";
    }
}

module.exports = CleverAi;