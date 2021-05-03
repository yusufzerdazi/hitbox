import Player from './player';
import Constants from '../constants';
import Level from '../level';

class Ball extends Player {
    angularVelocity: number;

    constructor(x: number, y: number){
        super("red", "", x, y, true);
        this.type = "ball";
        this.width = Constants.BALLWIDTH;
        this.height = Constants.BALLWIDTH;
        this.angularVelocity = 0;
        this.angle = 0;
        this.clientId = "ball";
    }

    isCollision(player: Player) {
        var playerX = player.x + player.xVelocity;
        var playerY = player.y + player.yVelocity;
        var playerVertices = [
            {x: playerX, y: playerY}, 
            {x: playerX + Constants.PLAYERWIDTH, y: playerY}, 
            {x: playerX, y: playerY + Constants.PLAYERHEIGHT}, 
            {x: playerX + Constants.PLAYERWIDTH, y: playerY + Constants.PLAYERHEIGHT}
        ];

        var ballX = this.x + this.xVelocity;
        var ballY = this.y + this.yVelocity - 100;

        var isCollision = false;
        playerVertices.forEach(v => {
            if(v.x >= ballX && v.x <= ballX + Constants.BALLWIDTH && v.y >= ballY && v.y <= ballY + Constants.BALLWIDTH){
                isCollision = true;
            }
        });
        if(isCollision){
            this.angularVelocity = 0.5 * (Math.random() - 0.5);
        }
        return isCollision;
    }

    respawn(clients: Player[], level: Level){
        Player.prototype.respawn.call(this, clients, level);
        this.x = Constants.WIDTH / 2;
        this.angularVelocity = 0;
    }
}

export default Ball;