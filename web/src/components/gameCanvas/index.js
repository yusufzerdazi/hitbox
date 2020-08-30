import React from 'react';
import Utils from '../../utils';
import styles from './styles.module.css';
import actualise from '../../assets/images/actualise.png';
import { RunningForward, RunningBackward, Standing } from './animation';
import star from '../../assets/images/star.png';

const FONT = "FR73PixelW00-Regular";
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
            zoomRate: 1,
            players: {}
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
        level.forEach(l => this.drawLevelPlatform(l));
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
        this.drawDeathWall();
        players.filter(p => p.y <= 400).forEach(player => this.drawPlayer(player, name));
        players.filter(p => p.name === name).forEach(player => {
            this.drawPlayerStats(player);
            this.drawPlayerScore(player);
        });
        this.drawStartingTimer();
        this.drawGameCountdown();
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
    }

    drawDeathWall(){
        if(this.state.deathWallX){
            this.drawLevelPlatform({x: this.state.deathWallX, y:-(this.ctx.canvas.height / 2)/this.state.scale + this.state.camera.y,
                width: -(((this.ctx.canvas.width) / 2)/this.state.scale) + this.state.camera.x - this.state.deathWallX, height: this.ctx.canvas.height / this.state.scale}, "#f0af00")
        }
        if(this.state.maxDistance){
            this.ctx.save()
            this.ctx.fillStyle = 'black';
            this.ctx.font = (20/this.state.scale)+"px " + FONT;
            this.ctx.shadowColor = "white";
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
            this.ctx.shadowBlur = 1;
            this.ctx.textAlign = "center";
            this.ctx.fillText(Math.round(this.state.maxDistance / 50) + "m  (Max: " + Math.round(this.state.levelMaxDistance / 50) + "m)", 0, -(this.ctx.canvas.height / 2 - 100) / this.state.scale);
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

    updateGameCountdown(gameCountdown){
        this.setState({
            gameCountdown: gameCountdown
        });
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

        this.ctx.fillStyle = "#fbff91";
        this.ctx.beginPath();
        this.ctx.rect(-200 - this.state.camera.x / 4, -1000 - this.state.camera.y / 4,
            400, 400);
        this.ctx.fill();

        this.drawHills();
        this.drawClouds();
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
        this.ctx.fillStyle = "#44db6c";
        this.ctx.beginPath();

        this.ctx.rect(-this.ctx.canvas.width/this.state.scale, -this.state.camera.y / 2 + foregroundHillsOffset + 100,
            2 * this.ctx.canvas.width/this.state.scale, this.ctx.canvas.height/this.state.scale);

        this.ctx.rect( - ((this.state.camera.x + hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 2 + foregroundHillsOffset,
            WIDTH * 5, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x + hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH * 1.5, -this.state.camera.y / 2 - 100 + foregroundHillsOffset,
            WIDTH * 3, this.ctx.canvas.height/this.state.scale);
        this.ctx.rect( - ((this.state.camera.x + hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2 - WIDTH / 2, -this.state.camera.y / 2 - 200 + foregroundHillsOffset,
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
        this.ctx.rect( - ((this.state.camera.x + cloudRepeatDistance) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 2 - 2200,
            900, 400);
        this.ctx.rect( - ((this.state.camera.x + cloudRepeatDistance) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH, -this.state.camera.y / 2 - 1200,
            900, 400);
        this.ctx.rect( - ((this.state.camera.x + cloudRepeatDistance) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 + WIDTH + 4, -this.state.camera.y / 2 - 2200,
            900, 400);

        this.ctx.rect( - ((this.state.camera.x) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH * 2.5, -this.state.camera.y / 2 - 1200,
            900, 400);
        this.ctx.rect( - ((this.state.camera.x) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH, -this.state.camera.y / 2 - 2200,
            900, 400);
        this.ctx.rect( - ((this.state.camera.x) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 + WIDTH + 4, -this.state.camera.y / 2 - 1200,
            900, 400);

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

        this.ctx.beginPath();
        this.ctx.fillStyle = player.colour;
        this.applyRotation(player, playerX, playerY, width);

        if(player.ducked){
            this.drawRectangle(playerX, playerY, width, - height);
            this.ctx.fill();
        }
        else {
            if(!(player.name in this.state.players) || player.health === 100){
                var players = this.state.players;
                players[player.name] = [{x: 0, y: 0},{x: width, y: 0},{x: width, y: -height}, {x: 0, y: -height}];
                this.setState({players});
            }
            var players = this.state.players;
            while((players[player.name].length - 4) < (100 - player.health) / 2){
                var newPolygon = this.addDamageVertices(players[player.name]);
                players[player.name] = newPolygon;
                this.setState({players});
            }
            this.drawPolygon(player, this.state.players[player.name], xOffset, yOffset);
            this.ctx.clip();
            if(!player.ducked && (player.name === "yusuf" || player.name === "intrinsion")){
                this.ctx.globalAlpha = 0.5;
                this.ctx.drawImage(ACTUALISE, playerX - this.state.camera.x - 5, playerY - height - this.state.camera.y - 5, width + 10, height + 10);
            }
        }
        
        this.ctx.restore()
    }

    drawPolygon(player, polygon, xOffset, yOffset, colour = null){
        this.ctx.fillStyle = colour|| player.colour;
        this.ctx.beginPath();
        this.ctx.moveTo(player.x + polygon[0].x + xOffset - this.state.camera.x, player.y + yOffset + polygon[0].y - this.state.camera.y);
        polygon.forEach((p,i) => {
            if(i > 0){
                this.ctx.lineTo(player.x + p.x + xOffset - this.state.camera.x, player.y + yOffset + p.y - this.state.camera.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fill();
    }

    addDamageVertices(polygon){
        var newPolygon = [];
        polygon.forEach((p, i) => {
            newPolygon.push(p);
            newPolygon.push({
                x: (p.x + polygon[(i + 1) % polygon.length].x) / 2 + 5 * (Math.random() - 0.5),
                y: (p.y + polygon[(i + 1) % polygon.length].y) / 2 + 5 * (Math.random() - 0.5),
            });
        });
        return newPolygon;
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
        this.ctx.font = Math.max(12,(12*(1/this.state.scale))) + "px " + FONT;
        this.ctx.textAlign = "center";

        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 0.7;
        this.ctx.shadowOffsetY = 0.7;
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

    drawPlayerStamina(player, width, height, xOffset, yOffset, name) {
        this.ctx.save();
        this.ctx.beginPath();
        var playerX = player.x + xOffset;
        var playerY = player.y + yOffset;
        this.applyRotation(player, playerX, playerY, width);
        var boostPolygon = [];
        var polygon = this.state.players[player.name];
        polygon.forEach((p, i) => {
            if(p.y > - height + (100 - player.boostCooldown) / 2){
                boostPolygon.push({x: (p.x - width / 2) * 0.8 + width / 2, y: (p.y + height / 2) * 0.8 - height / 2});
                if(polygon[(i + 1) % polygon.length].y <= - height + (100 - player.boostCooldown) / 2){
                    boostPolygon.push({x: (p.x - width / 2) * 0.8 + width / 2, y: (- height / 2 + (100 - player.boostCooldown) / 2) * 0.8  - height / 2});
                }
            } else {
                if(polygon[(i + 1) % polygon.length].y > - height + (100 - player.boostCooldown) / 2){
                    boostPolygon.push({x: (p.x - width / 2) * 0.8 + width / 2, y: (- height / 2 + (100 - player.boostCooldown) / 2) * 0.8 - height / 2});
                }
            }
        });
        if(boostPolygon.length > 0){
            this.ctx.globalAlpha = player.boostCooldown / 200 + 0.5;
            this.drawPolygon(player, boostPolygon, xOffset, yOffset, 'white');
        }
        this.ctx.restore();
    }

    drawPlayerStats(player){
        this.ctx.save()
        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        this.ctx.rect((this.ctx.canvas.width / 2 - 225) / this.state.scale,
            (this.ctx.canvas.height / 2 - 55) / this.state.scale,
            210 / this.state.scale,
            40 / this.state.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = 'blue';
        this.ctx.rect((this.ctx.canvas.width / 2 - 220) / this.state.scale,
            (this.ctx.canvas.height / 2 - 50) / this.state.scale,
            (200 - 2 * player.boostCooldown) / this.state.scale,
            30 / this.state.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = "white"
        this.ctx.font = 15*(1/this.state.scale) + "px " + FONT;
        this.ctx.fillText(
            "Stamina",
            (this.ctx.canvas.width / 2 - 210) / this.state.scale,
            (this.ctx.canvas.height / 2 - 29) / this.state.scale
        );
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        this.ctx.rect((this.ctx.canvas.width / 2 - 450) / this.state.scale,
            (this.ctx.canvas.height / 2 - 55) / this.state.scale,
            210 / this.state.scale,
            40 / this.state.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = 'red';
        this.ctx.rect((this.ctx.canvas.width / 2 - 445) / this.state.scale,
            (this.ctx.canvas.height / 2 - 50) / this.state.scale,
            (2 * player.health) / this.state.scale,
            30 / this.state.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = "white"
        this.ctx.font = 15*(1/this.state.scale) + "px " + FONT;
        this.ctx.fillText(
            "Health",
            (this.ctx.canvas.width / 2 - 435) / this.state.scale,
            (this.ctx.canvas.height / 2 - 29) / this.state.scale
        );
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.textAlign = 'right'
        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 0.7;
        this.ctx.shadowOffsetY = 0.7;
        this.ctx.shadowBlur = 1;
        this.ctx.font = 15*(1/this.state.scale) + "px " + FONT;
        this.ctx.fillText(
            "Name: " + player.name,
            (this.ctx.canvas.width / 2 - 15) / this.state.scale,
            (this.ctx.canvas.height / 2 - 70) / this.state.scale
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
        this.ctx.font = 15*(1/this.state.scale) + "px " + FONT;
        this.ctx.textAlign = "left";

        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 0.7;
        this.ctx.shadowOffsetY = 0.7;
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
            var aliveText = (!s.alive ? "[DEAD] " : "");
            var lastWinnerText = (lastWinner?.name == s.name ? " [WINNER]" : "");
            var livesText = (this.state.gameMode.title == "Free for All" || this.state.gameMode.title == "Collect the Boxes") ? " (" + s.lives + ")" : "";
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
            this.ctx.drawImage(img, player.x - this.state.camera.x, player.y + yOffset - 3 - this.state.camera.y, 50, 33);
        }
        else {
            var frame = 0.005 * Utils.millis() % 3;
            if(Math.abs(player.health) < 30){
                frame = (frame * 2) % 3;
            }
            frame = Math.floor(frame);
            var img = Standing[frame];
            this.ctx.drawImage(img, player.x - this.state.camera.x, player.y + yOffset + breathingOffset - 3 - this.state.camera.y, 50, 33 - breathingOffset);
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
            player.y + haloWidth / 2 + yOffset - (player.ducked ? haloWidth : 0),
            width + haloWidth,
            - height - haloWidth + (player.ducked ? haloWidth : 0)
        );
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawPlayer(player, name) {
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
        this.drawPlayerName(player, currentPlayerHeight, xOffset, yOffset);

        // If player is dead, don't draw the rest.
        if (!player.alive) {
            this.ctx.globalAlpha = 1;
            return;
        }
        if(!player.ducked && player.boostCooldown != 0){
            this.drawPlayerStamina(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset, name);
        }
        this.ctx.globalAlpha = 1;
    }

    drawStartingTimer() {
        this.ctx.save()
        this.ctx.fillStyle = 'black';
        this.ctx.font = (50/this.state.scale)+"px " + FONT;
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
        this.ctx.fillText(timerText, 0, 35 / this.state.scale);
        this.ctx.restore()
    }

    drawGameCountdown(){
        if(this.state.gameCountdown){
            this.ctx.save()
            this.ctx.fillStyle = 'black';
            this.ctx.font = (20/this.state.scale)+"px " + FONT;
            this.ctx.shadowColor = "white";
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
            this.ctx.shadowBlur = 1;
            this.ctx.textAlign = "center";
            this.ctx.fillText((this.state.gameCountdown / 60).toFixed(2), 0, -(this.ctx.canvas.height / 2 - 100) / this.state.scale);
            this.ctx.restore()
        }
    }

    drawPlayerScore(player){
        if(this.state.gameMode.title == "Collect the Boxes"){
            this.ctx.save()
            this.ctx.fillStyle = 'black';
            this.ctx.font = (20/this.state.scale)+"px " + FONT;
            this.ctx.shadowColor = "white";
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
            this.ctx.shadowBlur = 1;
            this.ctx.textAlign = "center";
            this.ctx.fillText(player.lives, 0, -(this.ctx.canvas.height / 2 - 100) / this.state.scale);
            this.ctx.restore()
        }
    }

    drawGameMode(){
        var yOffset = 0;
        var titleFontSize = 30/this.state.scale;
        var subtitleFontSize = 20/this.state.scale;
        var centerTitle = this.state.countdown;
        var yPosition = centerTitle ? - 100 : -(this.ctx.canvas.height / 2 - 40)
        var subtitleDiff = 30;
        if(centerTitle){
            titleFontSize = 60/this.state.scale;
            subtitleFontSize = 40/this.state.scale;
            yOffset = (this.ctx.canvas.height / 4);
            var subtitleDiff = 60;
        }
        this.ctx.save()
        this.ctx.fillStyle = 'black';
        this.ctx.font = titleFontSize+"px " + FONT;
        this.ctx.shadowColor = "white";
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        this.ctx.shadowBlur = 1;
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.state.gameMode.title || "", 0, (yPosition) / this.state.scale);
        this.ctx.font = subtitleFontSize+"px " + FONT;
        this.ctx.fillText(this.state.gameMode.subtitle || "", 0, (yPosition + subtitleDiff) / this.state.scale);
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