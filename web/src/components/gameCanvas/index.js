import React from 'react';
import Utils from '../../utils';
import styles from './styles.module.css';
import actualise from '../../assets/images/actualise.png';
import { RunningForward, RunningBackward, Standing } from './animation';
import star from '../../assets/images/star.png';

const HEIGHT = 540;
const WIDTH = 960;
const ACTUALISE = new Image();
ACTUALISE.src = actualise;
const STAR = new Image();
STAR.src = star;

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
            cameraType: cameraType.FOLLOWING,
            gameMode: {title:null,subtitle:null},
            zoomRate: 1
        };

        this.canvasRef = React.createRef();
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext("2d");
        this.ctx.setTransform(this.state.scale, 0, 0, this.state.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
        this.fullScreen();

        var $this = this;

        window.addEventListener('resize', ()  => {
            $this.fullScreen();
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
    
    toggleCamera(){
        switch(this.state.cameraType){
            case(cameraType.FOLLOWING):
                this.setState({cameraType: cameraType.DRAG});
                break;
            case(cameraType.DRAG):
                this.setState({cameraType: cameraType.FOLLOWING});
                break;
        }
    }

    analogScale(axisChange){
        this.setState({zoomRate: ((50 + axisChange)/50)});
    }

    setScale(scale){
        if(scale){
            this.setState({scale: Math.min(Math.max(0.2, scale), 1.5)});
            this.ctx.setTransform(this.state.scale, 0, 0, this.state.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
        }
    }

    draw(players, level, name, lastWinner) {
        if(this.state.cameraType == cameraType.FOLLOWING){
            var you = players.filter(p => p.name === name && p.alive && !p.orb);
            if(you.length == 0){
                you = players.filter(p => p.alive && !p.orb);
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
        this.setScale(this.state.scale * this.state.zoomRate);
        this.drawBackground();
        level.forEach(l => {
            if(!l.border){
                this.drawLevel(l);
            }
        });
        this.drawWater();
        
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
        this.drawDeathWall();
        this.drawStartingTimer();
        this.drawGameMode();
        this.drawScores(players, lastWinner);
    }

    drawWater(){
        this.drawLevelPlatform({
            x: -((this.ctx.canvas.width) / 2)/this.state.scale + this.state.camera.x,
            y:HEIGHT,
            width:this.ctx.canvas.width/this.state.scale,
            height: ((this.ctx.canvas.height) / 2)/this.state.scale + this.state.camera.y
        }, 
        "#064273");

        this.drawLevelPlatform({
            x: -((this.ctx.canvas.width) / 2)/this.state.scale + this.state.camera.x,
            y:HEIGHT * 2,
            width:this.ctx.canvas.width/this.state.scale,
            height: ((this.ctx.canvas.height) / 2)/this.state.scale + this.state.camera.y
        }, 
        "#002138");

        this.draw3DSection(-((this.ctx.canvas.width) / 2)/this.state.scale + this.state.camera.x, HEIGHT, ((this.ctx.canvas.width) / 2)/this.state.scale + this.state.camera.x, HEIGHT, 480, 410, WIDTH / 2, -900, "grey")
    }

    drawDeathWall(){
        if(this.state.deathWallX){
            this.drawLevelPlatform({x: this.state.deathWallX, y:-(this.ctx.canvas.height / 2)/this.state.scale + this.state.camera.y, 
                width: -(((this.ctx.canvas.width) / 2)/this.state.scale) + this.state.camera.x - this.state.deathWallX, height: this.ctx.canvas.height / this.state.scale}, "#f0af00")
        }
        if(this.state.maxDistance){
            this.ctx.save()
            this.ctx.fillStyle = 'black';
            this.ctx.font = (30/this.state.scale)+"px Consolas";
            this.ctx.shadowColor = "white";
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
            this.ctx.shadowBlur = 1;
            this.ctx.textAlign = "center";
            this.ctx.fillText(Math.round(this.state.maxDistance / 50) + "m  (Max: " + Math.round(this.state.levelMaxDistance / 50) + "m)", 0, -(this.ctx.canvas.height / 2 - 80) / this.state.scale);
            this.ctx.restore()
        }
    }

    updateDeathWall(deathWall){
        this.setState({
            deathWallX: deathWall.deathWallX,
            maxDistance: deathWall.maxDistance,
            levelMaxDistance: deathWall.levelMaxDistance
        });
    }

    drawLevel(level){
        var xVanishingPoint = 0;
        var yVanishingPoint = -900;
        this.draw3DSection(level.x, level.y, level.x, level.y + level.height, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
        this.draw3DSection(level.x, level.y, level.x + level.width, level.y, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
        this.draw3DSection(level.x + level.width, level.y, level.x + level.width, level.y + level.height, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    }

    drawLevelPlatform(level, colour){
        this.ctx.save();
        this.ctx.fillStyle = colour || "#1a1001";
        this.ctx.beginPath();
        this.drawRectangle(level.x, level.y, level.width, level.height);
        this.ctx.fill();
        if(!colour){
            this.ctx.beginPath();
            this.ctx.fillStyle = colour || "green";
            this.drawRectangle(level.x - 5, level.y, level.width + 10, 20);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    clearCanvas() {
        const ctx = this.canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    drawBackground() {
        this.ctx.fillStyle = "#ebf0fe";
        this.ctx.beginPath();
        this.ctx.rect(-this.ctx.canvas.width/this.state.scale, -this.ctx.canvas.height/this.state.scale, 
            2*this.ctx.canvas.width/this.state.scale, 2*this.ctx.canvas.height/this.state.scale);
        this.ctx.fill();

        this.ctx.fillStyle = "#b9d7fd";
        this.ctx.beginPath();
        this.ctx.rect(-this.ctx.canvas.width/this.state.scale, -1500 - this.state.camera.y / 4, 
            2*this.ctx.canvas.width/this.state.scale, -this.ctx.canvas.height/this.state.scale);
        this.ctx.fill();
        
        this.drawClouds();
        this.drawHills();

        this.ctx.fillStyle = "#fbff91";
        this.ctx.beginPath();
        this.ctx.rect(-200 - this.state.camera.x / 4, -1000 - this.state.camera.y / 4, 
            400, 400);
        this.ctx.fill();
    }

    drawHills(){
        var hillRepeatDistance = 15000;
        this.ctx.fillStyle = "#4fefb8";
        this.ctx.beginPath();

        // Background hills
        this.ctx.rect(-this.ctx.canvas.width/this.state.scale, -this.state.camera.y / 4 + 50, 
            2*this.ctx.canvas.width/this.state.scale, this.ctx.canvas.height/this.state.scale);

        this.ctx.rect( - ((this.state.camera.x + 2 * hillRepeatDistance) / 4) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 4, 
            WIDTH * 5, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x + 2 * hillRepeatDistance) / 4) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 1.5, -this.state.camera.y / 4 - 50, 
            WIDTH * 3, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x + 2 * hillRepeatDistance) / 4) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH / 2, -this.state.camera.y / 4 - 100, 
            WIDTH, this.ctx.canvas.height/this.state.scale);

        this.ctx.rect( - ((this.state.camera.x) / 4) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 4, 
            WIDTH * 5, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x) / 4) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 1.5, -this.state.camera.y / 4 - 50, 
            WIDTH * 3, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x) / 4) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH / 2, -this.state.camera.y / 4 - 100, 
            WIDTH, this.ctx.canvas.height/this.state.scale);

        this.ctx.fill();

        // Foreground hills
        var foregroundHillsOffset = 181;
        this.ctx.fillStyle = "#28c91c";
        this.ctx.beginPath();

        this.ctx.rect(-this.ctx.canvas.width/this.state.scale, -this.state.camera.y / 2 + foregroundHillsOffset + 100, 
            2 * this.ctx.canvas.width/this.state.scale, this.ctx.canvas.height/this.state.scale);

        this.ctx.rect( - ((this.state.camera.x + 2 * hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 2 + foregroundHillsOffset, 
            WIDTH * 5, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x + 2 * hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 1.5, -this.state.camera.y / 2 - 100 + foregroundHillsOffset, 
            WIDTH * 3, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x + 2 * hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH / 2, -this.state.camera.y / 2 - 200 + foregroundHillsOffset, 
            WIDTH, this.ctx.canvas.height/this.state.scale);

        this.ctx.rect( - ((this.state.camera.x) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 2 + foregroundHillsOffset, 
            WIDTH * 5, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 1.5, -this.state.camera.y / 2 - 100 + foregroundHillsOffset, 
            WIDTH * 3, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH / 2, -this.state.camera.y / 2 - 200 + foregroundHillsOffset, 
            WIDTH, this.ctx.canvas.height/this.state.scale);

        this.ctx.fill();

    }

    drawClouds(){
        this.ctx.fillStyle = "white";
        this.ctx.beginPath();
        var cloudRepeatDistance = 15000;
        this.ctx.rect( - ((this.state.camera.x + 2 * cloudRepeatDistance) / 4) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 4 - 1200, 
            900, 400);
        this.ctx.rect( - ((this.state.camera.x + 2 * cloudRepeatDistance) / 4) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH, -this.state.camera.y / 4 - 2200, 
            900, 400);
        this.ctx.rect( - ((this.state.camera.x + 2 * cloudRepeatDistance) / 4) % cloudRepeatDistance + cloudRepeatDistance / 2 + WIDTH + 4, -this.state.camera.y / 4 - 1200, 
            900, 400);
        
        this.ctx.rect( - ((this.state.camera.x) / 4) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 4 - 1200, 
            900, 400);
        this.ctx.rect( - ((this.state.camera.x) / 4) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH, -this.state.camera.y / 4 - 2200, 
            900, 400);
        this.ctx.rect( - ((this.state.camera.x) / 4) % cloudRepeatDistance + cloudRepeatDistance / 2 + WIDTH + 4, -this.state.camera.y / 4 - 1200, 
            900, 400);
            
        this.ctx.fill();
    }

    draw3DSection(x1, y1, x2, y2, centerX, centerY, xVanishingPoint, yVanishingPoint, colour, useCenterPoint = true, length = 10) {
        return;
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

    drawPlayerCube(player, width, height, xOffset, yOffset) {
        this.ctx.save();
        var xVanishingPoint = this.state.camera.x;
        var yVanishingPoint = -900 + this.state.camera.y;

        var playerX = player.x + xOffset;
        var playerY = player.y + yOffset;

        var rightX = (playerX + width);
        var leftX = (playerX);
        var topY = (playerY - height);
        var bottomY = (playerY);
        var centerX = (playerX + (width / 2));
        var centerY = (playerY - (height / 2));

        this.draw3DSection(rightX, bottomY, rightX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'black');
        this.draw3DSection(leftX, bottomY, leftX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'black');
        this.draw3DSection(leftX, topY, rightX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'grey');

        this.ctx.beginPath();
        this.ctx.fillStyle = player.colour;
        this.applyRotation(player, playerX, playerY, width);

        this.drawRectangle(playerX, playerY, width, - height);
        this.ctx.fill();
        if(!player.ducked && (player.name === "yusuf" || player.name === "intrinsion")){
            this.ctx.globalAlpha = 0.5;
            this.ctx.drawImage(ACTUALISE, playerX - this.state.camera.x, playerY - height - this.state.camera.y, width, height);
        }

        this.ctx.restore()
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

    drawPath(x1, y1, x2, y2, lineWidth){
        this.ctx.save();
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x1 - this.state.camera.x, y1 - this.state.camera.y);
        this.ctx.lineTo(x2 - this.state.camera.x, y2 - this.state.camera.y);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawPlayerName(player, height, xOffset, yOffset) {
        this.ctx.save();
        var healthProportion = 255 * (player.health / 100);
        var nameColour = 'rgb(255,' + healthProportion + ',' + healthProportion + ')';
        this.ctx.fillStyle = nameColour;
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
                player.y - height - 1 - this.state.camera.y + yOffset
            );
        }
        this.ctx.shadowColor = "";
        this.ctx.restore();
    }

    drawPlayerHealth(player, width, height, xOffset, yOffset, heightMultiplier) {
        if(player.ducked){
            return;
        }
        this.ctx.save();
        this.ctx.strokeStyle = "white";
        this.ctx.lineCap = "round";
        this.ctx.lineWidth = 2;
        
        var playerX = player.x + xOffset;
        var playerY = player.y + yOffset;
        this.applyRotation(player, playerX, playerY, width);

        if(player.health < 90){
            this.drawLine(player.x + xOffset + 1, player.y + yOffset - height + 1, 5, 9);
            this.drawLine(player.x + xOffset + 6, player.y + yOffset - height + 10, 8, 2);
            this.drawLine(player.x + xOffset + 6, player.y + yOffset - height + 10, 2, 5);
        }
        if(player.health < 80){
            this.drawLine(player.x + xOffset + 1, player.y + yOffset - 1, 11, -7);
            this.drawLine(player.x + xOffset + 12, player.y + yOffset -8, 7, 2);
            this.drawLine(player.x + xOffset + 12, player.y + yOffset -8, 2, -5);
        }
        if(player.health < 70){
            this.drawLine(player.x + xOffset + width - 1, player.y + yOffset - height + 1, -6, 3);
            this.drawLine(player.x + xOffset + width -7, player.y + yOffset - height + 4, -1, 5);
        }
        if(player.health < 60){
            this.drawLine(player.x + xOffset + width - 1, player.y + yOffset - 1, -4, -9);
            this.drawLine(player.x + xOffset + width-5, player.y + yOffset-10, -3, 5);
            this.drawLine(player.x + xOffset + width-5, player.y + yOffset-10, -4, -5);
        }
        if(player.health < 50){
            this.drawLine(player.x + xOffset + width -7, player.y + yOffset - height + 4, -10, 2);
            this.drawLine(player.x + xOffset + width -17, player.y + yOffset - height + 6, -5, 3);
        }
        if(player.health < 40){
            this.drawLine(player.x + xOffset + 14, player.y + yOffset -13, 10, -5);
            this.drawLine(player.x + xOffset + 14, player.y + yOffset -13, -4, -8);
        }
        if(player.health < 30){
            this.drawLine(player.x + xOffset + width -8, player.y + yOffset - height + 9, -12, 6);
            this.drawLine(player.x + xOffset + width -8, player.y + yOffset - height + 9, 2, 7);
        }
        if(player.health < 20){
            this.drawLine(player.x + xOffset + 14, player.y + yOffset - height + 12, 1, 9);
            this.drawLine(player.x + xOffset + 14, player.y + yOffset - height + 12, 8, -2);
        }
        if(player.health < 10){
            this.drawLine(player.x + xOffset + width-9, player.y + yOffset-15, -13, 4);
            this.drawLine(player.x + xOffset + width-9, player.y + yOffset-15, -2, -12);
        }
        this.ctx.restore();
    }

    drawPlayerStamina(player, width, height, xOffset, yOffset) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        var playerX = player.x + xOffset;
        var playerY = player.y + yOffset;
        this.applyRotation(player, playerX, playerY, width);
        var cooldownPercent = 0.8 * (100 - player.boostCooldown) / 100 + 0.2;
        this.drawRectangle(
            player.x + xOffset + cooldownPercent * width / 2,
            player.y + yOffset - cooldownPercent * height / 2,
            width - cooldownPercent * width,
            -height + cooldownPercent * height
        );
        this.ctx.fill();
        this.ctx.restore();
    }

    applyRotation(player, playerX, playerY, width){
        if(!player.ducked && player.alive){
            this.ctx.translate(playerX + width / 2 - this.state.camera.x, playerY - this.state.camera.y);              //translate to center of shape
            this.ctx.rotate(player.xVelocity * 0.01);  //rotate 25 degrees.
            this.ctx.translate(-(playerX + width / 2 - this.state.camera.x), -(playerY - this.state.camera.y));            //translate center back to 0,0    
        }
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

        players.filter(p => !p.orb).forEach(p => {
            scores.push({
                name: p.name, 
                colour: p.colour, 
                score: p.score,
                alive: p.alive,
                lives: p.lives
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
            var aliveText = (!s.alive ? "☠ " : "");
            var lastWinnerText = (lastWinner?.name == s.name ? " [WINNER]" : "");
            var livesText = (this.state.gameMode.title == "Free for All" || this.state.gameMode.title == "Collect the Orbs") ? " (" + s.lives + ")" : "";
            var scoreText = 
            this.ctx.fillText(
                aliveText + s.name + ": " + s.score + livesText + lastWinnerText, 
                (-this.ctx.canvas.width / 2 + 10) / this.state.scale, 
                (-this.ctx.canvas.height / 2 + 20 * (1+i)) / this.state.scale
            );
        })
        this.ctx.restore();
    }

    drawPlayerLegs(player, breathingOffset){
        var xOffset = 25;
        var yOffset = -30;
        if(player.xVelocity !== 0){
            var frame = 0.02 * Utils.millis() % 8;
            if(Math.abs(player.xVelocity) > 10){
                frame = (frame * 2) % 8;
            }
            frame = Math.floor(frame);
            var direction = Math.sign(player.xVelocity);
            var img = direction > 0 ? RunningBackward[frame] : RunningForward[frame];
            this.ctx.drawImage(img, player.x - this.state.camera.x, player.y + yOffset - this.state.camera.y, 50, 30);
        }
        else {
            var frame = 0.005 * Utils.millis() % 3;
            if(Math.abs(player.health) < 30){
                frame = (frame * 2) % 3;
            }
            frame = Math.floor(frame);
            var img = Standing[frame];
            this.ctx.drawImage(img, player.x - this.state.camera.x, player.y + yOffset + breathingOffset - this.state.camera.y, 50, 30 - breathingOffset);
        }
    }

    drawPlayerIsIt(player, width, height, xOffset, yOffset){
        var haloWidth = 15;
        this.ctx.save();
        this.ctx.lineWidth = haloWidth;
        this.ctx.beginPath();
        this.ctx.strokeStyle = "yellow";
        this.applyRotation(player, player.x + xOffset, player.y + yOffset, width);
        this.drawRectangle(
            player.x - haloWidth / 2 + xOffset,
            player.y + haloWidth / 2 + yOffset,
            width + haloWidth,
            - height - haloWidth
        );
        this.ctx.stroke();
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
        var breathingOffset = (player.xVelocity ==- 0 && player.yVelocity === 0) ? 3 * Math.sin((0.01 * Utils.millis())) : 0;
        var yOffset = player.ducked ? 0 : -30 + breathingOffset;

        var rotation = player.xVelocity * 0.002 * !player.ducked;
        if(player.it){
            this.drawPlayerIsIt(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset);
        }
        if(!player.ducked && player.alive){
            this.drawPlayerLegs(player, breathingOffset);
        }
        this.drawPlayerCube(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset);

        // If player is dead, don't draw the rest.
        if (!player.alive) {
            this.ctx.globalAlpha = 1;
            return;
        }

        this.drawPlayerStamina(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset);
        this.drawPlayerHealth(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset, currentPlayerHeight / this.state.playerSize);
        this.drawPlayerName(player, currentPlayerHeight, xOffset, yOffset);
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

    drawGameMode(){
        this.ctx.save()
        this.ctx.fillStyle = 'black';
        this.ctx.font = (30/this.state.scale)+"px Consolas";
        this.ctx.shadowColor = "white";
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        this.ctx.shadowBlur = 1;
        this.ctx.textAlign = "center";
        var gameModeText = this.state.gameMode.title ? this.state.gameMode.title + ": " + this.state.gameMode.subtitle : "";
        this.ctx.fillText(gameModeText, 0, -(this.ctx.canvas.height / 2 - 40) / this.state.scale);
        this.ctx.restore()
    }

    countdown(timer) {
        this.setState({ countdown: timer });
    }

    gameMode(gameMode){
        this.setState({gameMode: gameMode});
    }

    fullScreen() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;
        this.ctx.setTransform(this.state.scale, 0, 0, this.state.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
    }

    render() {
        return (
            <canvas className={styles.fullScreen} ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
        );
    }
}
export default GameCanvas;