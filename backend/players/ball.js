var Player = require('./player');
var Constants = require('../constants');
const { PLAYERWIDTH, PLAYERHEIGHT, BALLWIDTH } = require('../constants');

class Ball extends Player {
    constructor(x, y){
        super("red", "", x, y, true);
        this.type = "ball";
        this.width = Constants.BALLWIDTH;
        this.height = Constants.BALLWIDTH;
        this.angularVelocity = 0;
        this.angle = 0;
    }

    isCollision(player) {
        var playerX = player.x + player.xVelocity;
        var playerY = player.y + player.yVelocity;
        var playerVertices = [
            {x: playerX, y: playerY}, 
            {x: playerX + PLAYERWIDTH, y: playerY}, 
            {x: playerX, y: playerY + PLAYERHEIGHT}, 
            {x: playerX + PLAYERWIDTH, y: playerY + PLAYERHEIGHT}
        ];

        var ballX = this.x + this.xVelocity;
        var ballY = this.y + this.yVelocity - 100;

        var isCollision = false;
        playerVertices.forEach(v => {
            if(v.x >= ballX && v.x <= ballX + BALLWIDTH && v.y >= ballY && v.y <= ballY + BALLWIDTH){
                isCollision = true;
            }
        });
        if(isCollision){
            this.angularVelocity = 0.5 * (Math.random() - 0.5);
        }
        return isCollision;
    }

    respawn(clients, level){
        Player.prototype.respawn.call(this, clients, level);
        this.x = Constants.WIDTH / 2;
        this.angularVelocity = 0;
    }

    move(players, ticks){
    }
}

module.exports = Ball;