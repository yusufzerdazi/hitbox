import React from 'react';
import Utils from '../../utils';
import styles from './styles.module.css';

const HEIGHT = 540;
const WIDTH = 960;

const cameraType = {
    STATIC: "static",
    FOLLOWING: "following",
    DRAG: "drag"
}

class GameCanvas extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            playerSize: 50,
            countdown: "",
            camera: {
                x: WIDTH / 2,
                y: HEIGHT / 2
            },
            scale: 1,
            cameraType: cameraType.FOLLOWING
        };

        this.canvasRef = React.createRef();
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext("2d");
        this.ctx.setTransform(this.state.scale, 0, 0, this.state.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);

        var $this = this;
        this.canvasRef.current.addEventListener('mousedown', function (event) {
            $this.setState({mouseDown: true});
        }, false);

        this.canvasRef.current.addEventListener('mousemove', function (event) {
            if($this.state.mouseDown){
                $this.setState({
                    camera:{
                        x: $this.state.camera.x - (event.movementX / $this.state.scale),
                        y: $this.state.camera.y - (event.movementY / $this.state.scale),
                    }
                });
            }
        }, false);

        this.canvasRef.current.addEventListener('mouseup', function (event) {
            $this.setState({mouseDown: false});
        }, false);

        this.canvasRef.current.addEventListener('wheel', function (event) {
            event.preventDefault();
            $this.setState({
                scale: Math.max(0.2, $this.state.scale - event.deltaY * 0.0005)
            });
            $this.ctx.setTransform($this.state.scale, 0, 0, $this.state.scale, $this.ctx.canvas.width / 2, $this.ctx.canvas.height / 2);
        }, false);
    }

    draw(players, level) {
        this.drawBackground();
        level.forEach(l => {
            if(!l.border){
                this.drawLevel(l);
            }
        });
        this.drawLevelPlatform({x: -5000, y:HEIGHT, width:10000+WIDTH, height: 1000}, "red")
        this.draw3DSection(-5000, HEIGHT, 5000+WIDTH, HEIGHT, 480, 410, WIDTH / 2, -900, "grey")
        players
            .filter(p => p.y > 400)
            .forEach(player => this.drawPlayer(player));
        if(players[0]){
            if(this.state.cameraType == cameraType.FOLLOWING){
                this.updateCamera((players[0].x + players[0].xVelocity * 5) * 0.3 + this.state.camera.x * 0.7,  
                    (players[0].y + players[0].yVelocity * 5 - 100) * 0.3 + this.state.camera.y * 0.7);
            }
        }
        players = players.concat();
        players.sort((player1, player2) => {
            if (Math.abs(player2.y - player1.y) > this.state.playerSize) {
                return Math.abs(player2.y) - Math.abs(player1.y);
            }
            return Math.abs(player2.x - 480) - Math.abs(player1.x - 480);
        })
        players.filter(p => p.y <= 400).forEach(player => this.drawPlayer(player));
        level.forEach(l => this.drawLevelPlatform(l));
        this.drawStartingTimer();
    }

    drawLevel(level){
        var xVanishingPoint = 0;
        var yVanishingPoint = -900;
        this.draw3DSection(level.x, level.y, level.x, level.y + level.height, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
        this.draw3DSection(level.x, level.y, level.x + level.width, level.y, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
        this.draw3DSection(level.x + level.width, level.y, level.x + level.width, level.y + level.height, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    }

    drawLevelPlatform(level, colour = "black"){
        this.ctx.save();
        this.ctx.fillStyle = colour;
        this.ctx.beginPath();
        this.drawRectangle(level.x, level.y, level.width, level.height);
        this.ctx.fill();
        this.ctx.restore();
    }

    clearCanvas() {
        const ctx = this.canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
    }

    drawBackground() {
        this.ctx.fillStyle = "white";
        this.ctx.beginPath();
        this.ctx.rect(-WIDTH/this.state.scale, -HEIGHT/this.state.scale, 2*WIDTH/this.state.scale, 2*HEIGHT/this.state.scale);
        this.ctx.fill();
    }

    draw3DSection(x1, y1, x2, y2, centerX, centerY, xVanishingPoint, yVanishingPoint, colour, useCenterPoint = true, length = 10) {
        x1 = x1 - this.state.camera.x;
        x2 = x2 - this.state.camera.x;
        y1 = y1 - this.state.camera.y;
        y2 = y2 - this.state.camera.y;

        var isHorizontal = y1 === y2;

        var cubeLength = 20;

        var angle1 = Math.atan(((useCenterPoint ? centerY : y1) - yVanishingPoint) / ((useCenterPoint ? centerX : x1) - xVanishingPoint));
        if ((useCenterPoint ? centerX : x1) > xVanishingPoint) {
            angle1 += Math.PI;
        }

        var brPointY = y1 - length;
        var brPointX = x1 + cubeLength * Math.cos(angle1);

        var angle2 = Math.atan(((useCenterPoint ? centerY : y2) - yVanishingPoint) / ((useCenterPoint ? centerX : x2) - xVanishingPoint));
        if ((useCenterPoint ? centerX : x2) > xVanishingPoint) {
            angle2 += Math.PI;
        }

        var trPointY = y2 - length;
        var trPointX = x2 + cubeLength * Math.cos(isHorizontal ? angle2 : angle1);

        this.ctx.fillStyle = colour;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(brPointX, brPointY);
        this.ctx.lineTo(trPointX, trPointY);
        this.ctx.lineTo(x2, y2);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawPlayerCube(player, width, height, xOffset) {
        var xVanishingPoint = this.state.camera.x;
        var yVanishingPoint = -900 + this.state.camera.y;

        var rightX = (player.x + xOffset + width);
        var leftX = (player.x + xOffset);
        var topY = (player.y - height);
        var bottomY = (player.y);
        var centerX = (player.x + xOffset + (width / 2));
        var centerY = (player.y - (height / 2));

        this.draw3DSection(rightX, bottomY, rightX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'black');
        this.draw3DSection(leftX, bottomY, leftX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'black');
        this.draw3DSection(leftX, topY, rightX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'grey');

        this.ctx.beginPath();
        this.ctx.fillStyle = player.colour;
        this.drawRectangle(player.x + xOffset, player.y, width, - height);
        this.ctx.fill();
    }

    drawRectangle(x, y, width, height){
        this.ctx.rect(
            x - this.state.camera.x,
            y - this.state.camera.y,
            width,
            height
        );
    }

    drawPlayerOutline(player, width, height, xOffset) {
        this.ctx.save();
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.strokeStyle = player.colour;
        this.drawRectangle(
            player.x + 3 + xOffset,
            player.y - 3,
            width - 6,
            - height + 6
        );
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawPlayerName(player, height, xOffset) {
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.font = "10px Consolas";
        this.ctx.textAlign = "center";

        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        this.ctx.shadowBlur = 1;
        if (player.name) {
            this.ctx.fillText(
                player.name,
                player.x + this.state.playerSize / 2 - this.state.camera.x,
                player.y - height - 1 - this.state.camera.y
            );
        }
        this.ctx.shadowColor = "";
        this.ctx.restore();
    }

    drawPlayerHealth(player, width, height, xOffset) {
        this.ctx.fillStyle = "black";
        this.ctx.beginPath();
        if (player.alive) {
            this.drawRectangle(
                player.x + width / 2 + xOffset,
                player.y - height, 
                width / 2,
                (height * (100 - player.health) / 100)
            );
        }
        this.ctx.fill();
    }

    drawPlayerStamina(player, width, height, xOffset) {
        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        this.drawRectangle(
            player.x + xOffset,
            player.y,
            width / 2,
            -(height * player.boostCooldown / 100)
        );
        this.ctx.fill();
    }

    drawPlayer(player) {
        // If player is invincible make them flash.
        if (player.alive && player.invincibility !== 0 && (Math.round(Utils.millis() / 10)) % 2 === 0) return;

        // If player is dead, make them transparent.
        if (!player.alive) this.ctx.globalAlpha = 0.3;


        var currentPlayerHeight = player.ducked ? this.state.playerSize / 5 : this.state.playerSize;
        var currentPlayerWidth = player.ducked ? this.state.playerSize * 1.5 : this.state.playerSize;
        var xOffset = player.ducked ? - 0.25 * this.state.playerSize : 0;

        this.drawPlayerCube(player, currentPlayerWidth, currentPlayerHeight, xOffset);
        this.drawPlayerName(player, currentPlayerHeight, xOffset);

        // If player is dead, don't draw the rest.
        if (!player.alive) {
            this.ctx.globalAlpha = 1;
            return;
        }

        this.drawPlayerHealth(player, currentPlayerWidth, currentPlayerHeight, xOffset);
        this.drawPlayerStamina(player, currentPlayerWidth, currentPlayerHeight, xOffset);
        this.drawPlayerOutline(player, currentPlayerWidth, currentPlayerHeight, xOffset);
        this.ctx.globalAlpha = 1;
    }

    updateCamera(x, y){
        // x = Math.max(WIDTH / 2 - 100, x);
        // x = Math.min(WIDTH / 2 + 100, x);
        // y = Math.max(HEIGHT / 2, y);
        // y = Math.min(HEIGHT / 2, y);
        this.setState(
            {camera:{x:x,y:y}}
        );
    }

    drawStartingTimer() {
        this.ctx.fillStyle = 'black';
        this.ctx.font = "50px Consolas";
        this.ctx.textAlign = "center";
        var timerText = Math.round(this.state.countdown / 20);
        if (timerText === 0 && this.state.countdown) {
            timerText = "Go!"
        } else if (!this.state.countdown) {
            timerText = ""
        }
        this.ctx.fillText(timerText, 480, 270);
    }

    countdown(timer) {
        this.setState({ countdown: timer });
    }

    fullScreen(fullScreen) {
        this.setState({ fullScreen: fullScreen ? styles.fullScreen : '' })
    }

    render() {
        return (
            <canvas className={this.state.fullScreen} ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
        );
    }
}

export default GameCanvas;