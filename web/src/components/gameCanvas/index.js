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
                x: (WIDTH / 2),
                y: (HEIGHT / 2),
                xEased: 0,
                yEased: 0
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

        window.addEventListener('resize', ()  => {
            if($this.state.fullScreen){
                $this.fullScreen();
            }
        });

        this.canvasRef.current.addEventListener('mousedown', function (event) {
            $this.setState({mouseDown: true});
        }, false);

        this.canvasRef.current.addEventListener('mousemove', function (event) {
            if($this.state.mouseDown){
                $this.setState({
                    camera:{
                        x: $this.state.camera.x - (event.movementX / $this.state.scale),
                        y: $this.state.camera.y - (event.movementY / $this.state.scale),
                        xEased: $this.state.camera.xEased,
                        yEased: $this.state.camera.yEased
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
                scale: Math.min(Math.max(0.2, $this.state.scale - event.deltaY * 0.0005), 1.5)
            });
            $this.ctx.setTransform($this.state.scale, 0, 0, $this.state.scale, $this.ctx.canvas.width / 2, $this.ctx.canvas.height / 2);
        }, false);
    }

    draw(players, level, name, lastWinner) {
        if(this.state.cameraType == cameraType.FOLLOWING){
            var you = players.filter(p => p.name === name && p.alive);
            if(you.length == 0){
                you = players.filter(p => p.alive);
            }
            if(you.length > 0){
                var xDelta = you[0].xVelocity * 5;
                var yDelta = you[0].yVelocity * 5;
                var xEased = 0.1 * xDelta + 0.9 * this.state.camera.xEased;
                var yEased = 0.1 * yDelta + 0.9 * this.state.camera.yEased;
                this.setState(
                    {camera:{
                        x: you[0].x + xEased,
                        y: you[0].y + yEased - 100,
                        xEased: xEased,
                        yEased: yEased
                    }}
                );
            }
        }
        this.drawBackground();
        level.forEach(l => {
            if(!l.border){
                this.drawLevel(l);
            }
        });
        this.drawLevelPlatform({x: -2000, y:HEIGHT, width:4000 + WIDTH, height: 1000 + HEIGHT / 2}, "red")
        this.draw3DSection(-2000, HEIGHT, 2000 + WIDTH, HEIGHT, 480, 410, WIDTH / 2, -900, "grey")
        players
            .filter(p => p.y > 400)
            .forEach(player => this.drawPlayer(player));
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
        this.drawScores(players, lastWinner);
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
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    drawBackground() {
        this.ctx.fillStyle = "white";
        this.ctx.beginPath();
        this.ctx.rect(-this.ctx.canvas.width/this.state.scale, -this.ctx.canvas.height/this.state.scale, 
            2*this.ctx.canvas.width/this.state.scale, 2*this.ctx.canvas.height/this.state.scale);
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

    drawLine(x1, y1, xLength, yLength){
        this.ctx.beginPath();
        this.ctx.moveTo(x1 - this.state.camera.x, y1 - this.state.camera.y);
        this.ctx.lineTo(x1 + xLength - this.state.camera.x, y1 + yLength - this.state.camera.y);
        this.ctx.stroke();
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
        this.ctx.font = Math.max(13,(13*(1/this.state.scale))) + "px Consolas";
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

    drawPlayerHealth(player, width, height, xOffset, heightMultiplier) {
        this.ctx.strokeStyle = "black";
        this.ctx.lineCap = "round";
        if(player.health < 90){
            this.drawLine(player.x + xOffset, player.y - height, 6, 10 * heightMultiplier);
            this.drawLine(player.x + xOffset + 6, player.y - height + 10 * heightMultiplier, 8, 2 * heightMultiplier);
            this.drawLine(player.x + xOffset + 6, player.y - height + 10 * heightMultiplier, 2, 5 * heightMultiplier);
        }
        if(player.health < 80){
            this.drawLine(player.x + xOffset, player.y, 12, -8 * heightMultiplier);
            this.drawLine(player.x + xOffset + 12, player.y -8 * heightMultiplier, 7, 2 * heightMultiplier);
            this.drawLine(player.x + xOffset + 12, player.y -8 * heightMultiplier, 2, -5 * heightMultiplier);
        }
        if(player.health < 70){
            this.drawLine(player.x + xOffset + width, player.y - height, -7, 4 * heightMultiplier);
            this.drawLine(player.x + xOffset + width -7, player.y - height + 4 * heightMultiplier, -1, 5 * heightMultiplier);
        }
        if(player.health < 60){
            this.drawLine(player.x + xOffset + width, player.y, -5, -10 * heightMultiplier);
            this.drawLine(player.x + xOffset + width-5, player.y-10 * heightMultiplier, -3, 5 * heightMultiplier);
            this.drawLine(player.x + xOffset + width-5, player.y-10 * heightMultiplier, -4, -5 * heightMultiplier);
        }
        if(player.health < 50){
            this.drawLine(player.x + xOffset + width -7, player.y - height + 4 * heightMultiplier, -10, 2 * heightMultiplier);
            this.drawLine(player.x + xOffset + width -17, player.y - height + 6 * heightMultiplier, -5, 3 * heightMultiplier);
        }
        if(player.health < 40){
            this.drawLine(player.x + xOffset + 14, player.y -13 * heightMultiplier, 10, -5 * heightMultiplier);
            this.drawLine(player.x + xOffset + 14, player.y -13 * heightMultiplier, -4, -8 * heightMultiplier);
        }
        if(player.health < 30){
            this.drawLine(player.x + xOffset + width -8, player.y - height + 9 * heightMultiplier, -12, 6 * heightMultiplier);
            this.drawLine(player.x + xOffset + width -8, player.y - height + 9 * heightMultiplier, 2, 7 * heightMultiplier);
        }
        if(player.health < 20){
            this.drawLine(player.x + xOffset + 14, player.y - height + 12 * heightMultiplier, 1, 9 * heightMultiplier);
            this.drawLine(player.x + xOffset + 14, player.y - height + 12 * heightMultiplier, 8, -2 * heightMultiplier);
        }
        if(player.health < 10){
            this.drawLine(player.x + xOffset + width-9, player.y-15 * heightMultiplier, -13, 4 * heightMultiplier);
            this.drawLine(player.x + xOffset + width-9, player.y-15 * heightMultiplier, -2, -12 * heightMultiplier);
        }
    }

    drawPlayerStamina(player, width, height, xOffset) {
        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        var cooldownPercent = (100 - player.boostCooldown) / 100;
        this.drawRectangle(
            player.x + xOffset + cooldownPercent * width / 2,
            player.y - cooldownPercent * height / 2,
            width - cooldownPercent * width,
            -height + cooldownPercent * height
        );
        this.ctx.fill();
    }

    drawScores(players, lastWinner){
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.font = Math.max(15,(15*(1/this.state.scale))) + "px Consolas";
        this.ctx.textAlign = "left";

        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        this.ctx.shadowBlur = 1;

        var scores = [];

        players.forEach(p => {
            scores.push({
                name: p.name, 
                colour: p.colour, 
                score: p.score,
                alive: p.alive
            });
        });
        scores.sort((score1, score2) => {
            if(score1.score > score2.score){
                return -1;
            }
            else if(score1.score === score2.score && score1.name < score2.name){
                return -1;
            }
            return 1;
        })
        scores.forEach((s, i) => {
            this.ctx.fillStyle = s.colour;
            this.ctx.fillText(
                (!s.alive ? "☠ " : "") + s.name + ": " + s.score + (lastWinner?.name == s.name ? " [WINNER]" : ""), 
                (-this.ctx.canvas.width / 2 + 10) / this.state.scale, 
                (-this.ctx.canvas.height / 2 + 20 * (1+i)) / this.state.scale
            );
        })
        this.ctx.restore();
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

        this.drawPlayerStamina(player, currentPlayerWidth, currentPlayerHeight, xOffset);
        this.drawPlayerOutline(player, currentPlayerWidth, currentPlayerHeight, xOffset);
        this.drawPlayerHealth(player, currentPlayerWidth, currentPlayerHeight, xOffset, currentPlayerHeight / this.state.playerSize);
        this.ctx.globalAlpha = 1;
    }

    drawStartingTimer() {
        this.ctx.save()
        this.ctx.fillStyle = 'black';
        this.ctx.font = (50/this.state.scale)+"px Consolas";
        this.ctx.shadowColor = "white";
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        this.ctx.shadowBlur = 1;
        this.ctx.textAlign = "center";
        var timerText = Math.round(this.state.countdown / 20);
        if (timerText === 0 && this.state.countdown) {
            timerText = "Go!"
        } else if (!this.state.countdown) {
            timerText = ""
        }
        this.ctx.fillText(timerText, 0, 0);
        this.ctx.restore()
    }

    countdown(timer) {
        this.setState({ countdown: timer });
    }

    fullScreen(fullScreen) {
        if(fullScreen != undefined){
            this.setState({ 
                fullScreen: fullScreen ? styles.fullScreen : ''
            })
        }
        this.ctx.canvas.width = fullScreen || this.state.fullScreen ? window.innerWidth : WIDTH;
        this.ctx.canvas.height = fullScreen || this.state.fullScreen ? window.innerHeight : HEIGHT;
        this.ctx.setTransform(this.state.scale, 0, 0, this.state.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
    }

    render() {
        return (
            <canvas className={this.state.fullScreen} ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
        );
    }
}
export default GameCanvas;