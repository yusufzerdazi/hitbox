import React from 'react';
import Utils from '../../utils';
import styles from './styles.module.css';

class GameCanvas extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            playerSize: 50,
            countdown: ""
        };

        this.canvasRef = React.createRef();
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext("2d");
    }

    draw(players) {
        this.drawBackground();
        this.drawWalls();
        players
            .filter(p => p.y > 400)
            .forEach(player => this.drawPlayer(player));
        this.drawPlatform();
        players = players.concat();
        players.sort((player1, player2) => {
            if (Math.abs(player2.y - player1.y) > this.state.playerSize) {
                return Math.abs(player2.y) - Math.abs(player1.y);
            }
            return Math.abs(player2.x - 480) - Math.abs(player1.x - 480);
        })
        players.filter(p => p.y <= 400).forEach(player => this.drawPlayer(player));
        this.drawStartingTimer();
    }

    clearCanvas() {
        const ctx = this.canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, 960, 540);
    }

    drawPlatform() {
        var xVanishingPoint = 960 / 2;
        var yVanishingPoint = -500;

        this.draw3DSection(100, 400, 860, 400, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);

        this.ctx.beginPath();
        this.ctx.fillStyle = "black";
        this.ctx.rect(100, 400, 760, 540);
        this.ctx.fill();
    }

    drawWalls() {
        var xVanishingPoint = 960 / 2;
        var yVanishingPoint = -500;

        this.draw3DSection(0, 600, 0, 0, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
        this.draw3DSection(960, 600, 960, 0, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    }

    drawBackground() {
        this.ctx.fillStyle = "white";
        this.ctx.beginPath();
        this.ctx.rect(0, 0, 960, 540);
        this.ctx.fill();
    }

    draw3DSection(x1, y1, x2, y2, centerX, centerY, xVanishingPoint, yVanishingPoint, colour, useCenterPoint = true, length = 10) {
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
        var trPointX = x2 + cubeLength * Math.cos(angle2);

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
        var xVanishingPoint = 960 / 2;
        var yVanishingPoint = -500;

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
        this.ctx.rect(player.x + xOffset, player.y, width, - height);
        this.ctx.fill();
    }

    drawPlayerOutline(player, width, height, xOffset) {
        this.ctx.save();
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.strokeStyle = player.colour;
        this.ctx.rect(
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
                player.x + this.state.playerSize / 2,
                player.y - height - 1
            );
        }
        this.ctx.shadowColor = "";
        this.ctx.restore();
    }

    drawPlayerHealth(player, width, height, xOffset) {
        this.ctx.fillStyle = "black";
        this.ctx.beginPath();
        if (player.alive) {
            this.ctx.rect(
                player.x + width / 2 + xOffset,
                player.y - height, width / 2,
                (height * (100 - player.health) / 100)
            );
        }
        this.ctx.fill();
    }

    drawPlayerStamina(player, width, height, xOffset) {
        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        this.ctx.rect(
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
            <canvas className={this.state.fullScreen} ref={this.canvasRef} width={960} height={540} />
        );
    }
}

export default GameCanvas;