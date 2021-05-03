import React from 'react';
import { connect } from 'react-redux';
import Utils from '../../utils';
import styles from './styles.module.css';
import ball from '../../assets/images/football.png';
import grass from '../../assets/images/grass.svg';
import { RunningForward, RunningBackward, Standing, BigCollision, Collision, Splash, WhooshRight, WhooshLeft, WhooshDown, Landing } from './animation';
import { FOLLOWING } from '../../constants/cameraTypes';
import { PLAYERS } from '../../constants/actionTypes';

const FONT = "'Roboto Mono'";
const HEIGHT = 540;
const WIDTH = 960;

const BALL = new Image();
BALL.src = ball;
const GRASS = new Image();
GRASS.src = grass;

const PLATFORMRADIUS = 25;
const ANIMATIONLENGTH = 500;
const SPLASHANIMATIONLENGTH = 800;
const WHOOSHANIMATIONLENGTH = 300;
const HIDDENEVENTS = ["collision", "boost", "hit"];

const mapDispatchToProps = dispatch => ({
    updatePlayers: x => dispatch({
        type: PLAYERS,
        players: x
    })
});

const mapStateToProps = state => {
    return {
        cameraType: state.options.cameraType,
        players: state.stats.players
    }
};

class GameCanvas extends React.Component {
    constructor(props) {
        super(props);

        this.drawCollision = this.drawCollision.bind(this);
        this.drawBoost = this.drawBoost.bind(this);
        this.drawDeath = this.drawDeath.bind(this);
        this.drawLanding = this.drawLanding.bind(this);
        this.canvasRef = React.createRef();

        this.playerSize = 50;
        this.joining = false;
        this.countdown = "";
        this.zoomRate = 1;
        this.scale = 1;
        this.camera = {
            x: (WIDTH / 2),
            y: (HEIGHT / 2),
            xEased: 0,
            yEased: 0
        };
        this.players = {};
        this.events = [];
        this.animations = [];
        this.scores = {
            team1: 0,
            team2: 0
        }
        this.gameMode = {title:null,subtitle:null};
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext("2d");
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
        this.fullScreen();

        var $this = this;

        window.addEventListener('resize', ()  => {
            $this.fullScreen();
        });

        this.canvasRef.current.addEventListener('mousedown', function (event) {
            $this.mouseDown = true;
        }, false);

        this.canvasRef.current.addEventListener('mousemove', function (event) {
            if($this.mouseDown){
                $this.camera = {
                    x: $this.camera.x - (event.movementX / $this.scale),
                    y: $this.camera.y - (event.movementY / $this.scale),
                    xEased: $this.camera.xEased,
                    yEased: $this.camera.yEased
                };
            }
        }, false);

        this.canvasRef.current.addEventListener('mouseup', function (event) {
            $this.mouseDown = false;
        }, false);

        this.canvasRef.current.addEventListener('wheel', function (event) {
            event.preventDefault();
            $this.scale = Math.min(Math.max(0.2, $this.scale - event.deltaY * 0.0005), 1.5);
            $this.ctx.setTransform($this.scale, 0, 0, $this.scale, $this.ctx.canvas.width / 2, $this.ctx.canvas.height / 2);
        }, false);
    }

    analogScale(axisChange){
        this.zoomRate = (50 + axisChange)/50;
    }

    setScale(scale){
        if(scale){
            this.scale = Math.min(Math.max(0.2, scale), 1.5);
            this.ctx.setTransform(this.scale, 0, 0, this.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
        }
    }

    draw(players, level, name, lastWinner) {
        if(this.drawing) {
            return;
        }
        this.drawing = true;
        if(this.props.cameraType === FOLLOWING){
            var you = players.filter(p => p.name === name && !p.orb && p.alive);
            if(you.length === 0 && this.gameMode.title === "Death Wall"){
                you = players.filter(p => !p.orb && p.alive);
            }
            if(you.length > 0){
                var xDelta = you[0].xVelocity * 5;
                var yDelta = you[0].yVelocity * 5;
                var xEased = 0.1 * xDelta + 0.9 * this.camera.xEased;
                var yEased = 0.1 * yDelta + 0.9 * this.camera.yEased;
                this.camera = {
                    x: you[0].x + xEased,
                    y: you[0].y + yEased - 100,
                    xEased: xEased,
                    yEased: yEased
                };
            }
        }
        if(this.scale !== Math.min(Math.max(0.2, this.scale * this.zoomRate), 1.5)) {
            this.setScale(this.scale * this.zoomRate);
        }
        this.drawBackground();
        if(level.platforms){
            level.platforms.forEach(l => this.drawLevelPlatform(l));
        }
        this.drawWater();

        this.drawDeathWall(level);
        players.filter(p => p.type !== "ball").forEach(player => this.drawPlayer(player, name));
        players.filter(p => p.type === "ball").forEach(player => this.drawBall(player));
        players.filter(p => p.name === name).forEach(player => {
            this.drawPlayerScore(player);
            this.drawPlayerStats(player);
        });

        this.animations = this.animations.filter(c => Utils.millis() - c.animationLength < c.timestamp);
        this.animations.forEach(c => c.drawAnimation(c, c.name ? players.filter(p => p.name === c.name)[0] : undefined));
        this.drawStartingTimer();
        this.drawGameCountdown();
        this.drawGameMode(lastWinner);
        this.drawEvents();
        this.drawFootballScores();
        if(players.filter(p => p.name === name).length === 0 && this.joining){
            this.drawNotification();
        }
        setTimeout(() => {
            this.drawing = false;
        }, 1);
    }

    newGame(players){
        this.props.updatePlayers(players);
    }

    drawNotification(){
        var yPosition = 100;
        var fontSize = 30/this.scale;
        this.ctx.save()
        this.ctx.fillStyle = 'black';
        this.ctx.font = "bold " + fontSize+"px " + FONT;
        this.ctx.shadowColor = "white";
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        this.ctx.shadowBlur = 1;
        this.ctx.textAlign = "center";
        this.ctx.font = "bold " + fontSize+"px " + FONT;
        this.ctx.fillText("You'll be added at the\nstart of the next round." || "", 0, yPosition / this.scale);
        this.ctx.restore()
    }

    drawWater(){
        var grd = this.ctx.createLinearGradient(0, HEIGHT - this.camera.y, 0, 7 * HEIGHT - this.camera.y);
        grd.addColorStop(0, "#064273");
        grd.addColorStop(1, "#00022e");
        this.ctx.fillStyle = grd;

        this.drawLevelPlatform({
            x: -((this.ctx.canvas.width) / 2)/this.scale + this.camera.x,
            y:HEIGHT,
            width:this.ctx.canvas.width/this.scale,
            height: ((this.ctx.canvas.height) / 2)/this.scale + this.camera.y
        }, "#064273", true);

        var grd2 = this.ctx.createLinearGradient(0, HEIGHT * 2 - this.camera.y / 0.8, 0, 9 * HEIGHT - this.camera.y / 0.8);
        grd2.addColorStop(0, "#002138");
        grd2.addColorStop(1, "#00022e");
        this.ctx.fillStyle = grd2;
        this.drawPolygon({x:0, y: 0}, [
            {x: -((this.ctx.canvas.width) / 2)/this.scale, y: HEIGHT * 2 - this.camera.y / 0.8},
            {x: (this.ctx.canvas.width / 2)/this.scale, y: -20 + HEIGHT * 2 - this.camera.y / 0.8},
            {x: (this.ctx.canvas.width / 2)/this.scale, y: HEIGHT * 10 + ((this.ctx.canvas.height) / 2)/this.scale},
            {x: -((this.ctx.canvas.width) / 2)/this.scale, y: HEIGHT * 10 + ((this.ctx.canvas.height) / 2)/this.scale}
        ], 0, 0, "#002138", false, true);
    }

    drawDeathWall(level){
        if(level.deathWallX){
            this.drawLevelPlatform({x: level.deathWallX, y:-(this.ctx.canvas.height / 2)/this.scale + this.camera.y,
                width: -(((this.ctx.canvas.width) / 2)/this.scale) + this.camera.x - level.deathWallX, height: this.ctx.canvas.height / this.scale}, "#f0af00")
        }
        if(level.maxDistance){
            this.ctx.save()
            this.ctx.fillStyle = 'black';
            this.ctx.globalCompositeOperation = "difference";
            this.ctx.font = "bold " + (20/this.scale)+"px " + FONT;
            this.ctx.shadowColor = "white";
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
            this.ctx.shadowBlur = 1;
            this.ctx.textAlign = "left";
            this.ctx.fillText(Math.round(level.currentDistance / 50) + "m  (Max: " + Math.round(level.maxDistance / 50) + "m)", -(this.ctx.canvas.width / 2 - 10) / this.scale, -(this.ctx.canvas.height / 2 - 80) / this.scale);
            this.ctx.restore()
        }
    }

    drawFootballScores() {
        if(this.gameMode.title === "Football" && this.scores){
            this.ctx.font = "bold " + (20/this.scale)+"px " + FONT;
            this.ctx.save()
            this.ctx.textAlign = "left";
            var text = [];
            text.push({text: this.scores.team1, fillStyle: "red"});
            text.push({text: "-", fillStyle: "black"});
            text.push({text: this.scores.team2, fillStyle: "slateblue"});
            Utils.fillMixedText(this.ctx, text, - (this.ctx.canvas.width - 68) / (2 * this.scale), - (this.ctx.canvas.height / 2 - 80) / this.scale);
            this.ctx.restore()
        }
    }

    updateGameCountdown(gameCountdown){
        this.gameCountdown = gameCountdown;
    }

    drawLevelPlatform(level, colour, useExistingFillStyle = false){
        this.ctx.save();
        if(!useExistingFillStyle){
            this.ctx.fillStyle = colour || "#1a1001";
        }
        if(level.type === "goal"){
            this.ctx.fillStyle = level.colour;
            this.ctx.globalAlpha = 0.3;
        }
        this.ctx.beginPath();
        Utils.roundRect(this.ctx, level.x - this.camera.x, level.y - this.camera.y, level.width, level.height, useExistingFillStyle ? 0 : PLATFORMRADIUS, true, false);
        this.ctx.fill();

        if(!colour && level.type !== "goal" && !useExistingFillStyle){
            this.ctx.beginPath();
            this.ctx.fillStyle = colour || "green";
            Utils.roundRect(this.ctx, level.x - 5 - this.camera.x, level.y - this.camera.y, level.width + 10, 30, 8, true, false);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    clearCanvas() {
        const ctx = this.canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    drawBackground() {
        var grd = this.ctx.createLinearGradient(0, -this.ctx.canvas.height/this.scale, 0, 0);
        grd.addColorStop(0, "#b9d7fd");
        grd.addColorStop(1, "#ebf0fe");

        this.ctx.fillStyle = grd;
        this.ctx.beginPath();
        this.ctx.rect(-this.ctx.canvas.width/this.scale, -this.ctx.canvas.height/this.scale,
            2*this.ctx.canvas.width/this.scale, 2*this.ctx.canvas.height/this.scale);
        this.ctx.fill();

        this.ctx.fillStyle = "#fbff91";
        this.ctx.beginPath();
        Utils.roundRect(this.ctx, -200 - this.camera.x / 4, -1000 - this.camera.y / 4,
            400, 400, PLATFORMRADIUS, true, false);
        this.ctx.fill();

        this.drawHills();
        this.drawClouds();
    }

    drawHills(){
        var hillRepeatDistance = 16000;
        this.ctx.fillStyle = "#4fefb8";
        this.ctx.beginPath();

        // Background hills
        this.drawPolygon({x: - ((this.camera.x + 2 * hillRepeatDistance) / 4) % hillRepeatDistance + hillRepeatDistance / 2, y: -this.camera.y / 4}, [
            {x: - WIDTH * 3.8, y: + 55},
            {x: - WIDTH * 2.5, y: 0},
            {x: - WIDTH * 1.5, y: - 50},
            {x: 0, y: - 75},
            {x: + WIDTH * 1.5, y: - 50},
            {x: + WIDTH * 2.5, y: 0},
            {x: + WIDTH * 3.8, y: + 55},
        ], 0, 0, "#4fefb8", false)

        this.drawPolygon({x: - ((this.camera.x) / 4) % hillRepeatDistance + hillRepeatDistance / 2, y: - this.camera.y / 4}, [
            {x: - WIDTH * 3.8, y: + 55},
            {x: - WIDTH * 2.5, y: 0},
            {x: - WIDTH * 1.5, y: - 50},
            {x: 0, y: - 75},
            {x: + WIDTH * 1.5, y: - 50},
            {x: + WIDTH * 2.5, y: 0},
            {x: + WIDTH * 3.8, y: + 55},
        ], 0, 0, "#4fefb8", false)

        this.ctx.rect(-this.ctx.canvas.width/this.scale, -this.camera.y / 4 + 50,
            2*this.ctx.canvas.width/this.scale, this.ctx.canvas.height/this.scale);

        this.ctx.fill();

        // Foreground hills
        var foregroundHillsOffset = 181;
        this.ctx.fillStyle = "#44db6c";
        this.ctx.beginPath();

        this.drawPolygon({x: - ((this.camera.x + 2 * hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2, y: - this.camera.y / 2}, [
            {x: - WIDTH * 3.8, y: 105 + foregroundHillsOffset},
            {x: - WIDTH * 2.5, y: foregroundHillsOffset},
            {x: - WIDTH * 1.5, y: - 100 + foregroundHillsOffset},
            {x: 0, y: - 150 + foregroundHillsOffset},
            {x:   WIDTH * 1.5, y: - 100 + foregroundHillsOffset},
            {x:   WIDTH * 2.5, y: foregroundHillsOffset},
            {x:   WIDTH * 3.8, y: 105 + foregroundHillsOffset},
        ], 0, 0, "#44db6c", false)

        this.drawPolygon({x: - ((this.camera.x + hillRepeatDistance) / 2) % hillRepeatDistance + hillRepeatDistance / 2, y: - this.camera.y / 2}, [
            {x: - WIDTH * 3.8, y: 105 + foregroundHillsOffset},
            {x: - WIDTH * 2.5, y: foregroundHillsOffset},
            {x: - WIDTH * 1.5, y: - 100 + foregroundHillsOffset},
            {x: 0, y: - 150 + foregroundHillsOffset},
            {x:   WIDTH * 1.5, y: - 100 + foregroundHillsOffset},
            {x:   WIDTH * 2.5, y: foregroundHillsOffset},
            {x:   WIDTH * 3.8, y: 105 + foregroundHillsOffset},
        ], 0, 0, "#44db6c", false)

        this.ctx.rect(-this.ctx.canvas.width/this.scale, -this.camera.y / 2 + foregroundHillsOffset + 100,
            2 * this.ctx.canvas.width/this.scale, this.ctx.canvas.height/this.scale);

        this.ctx.fill();

    }

    drawClouds(){
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillStyle = "white";
        this.ctx.beginPath();
        var cloudRepeatDistance = 15000;
        Utils.roundRect(this.ctx, - ((this.camera.x + cloudRepeatDistance) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH * 2.5, -this.camera.y / 2 - 2200,
            900, 400, PLATFORMRADIUS, true, false);
        Utils.roundRect(this.ctx, - ((this.camera.x + cloudRepeatDistance) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH, -this.camera.y / 2 - 1200,
            900, 400, PLATFORMRADIUS, true, false);
        Utils.roundRect(this.ctx, - ((this.camera.x + cloudRepeatDistance) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 + WIDTH + 4, -this.camera.y / 2 - 2200,
            900, 400, PLATFORMRADIUS, true, false);

        Utils.roundRect(this.ctx, - ((this.camera.x) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH * 2.5, -this.camera.y / 2 - 1200,
            900, 400, PLATFORMRADIUS, true, false);
        Utils.roundRect(this.ctx, - ((this.camera.x) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 - WIDTH, -this.camera.y / 2 - 2200,
            900, 400, PLATFORMRADIUS, true, false);
        Utils.roundRect(this.ctx, - ((this.camera.x) / 2) % cloudRepeatDistance + cloudRepeatDistance / 2 + WIDTH + 4, -this.camera.y / 2 - 1200,
            900, 400, PLATFORMRADIUS, true, false);

        this.ctx.fill(); 
        this.ctx.restore();
    }

    drawPulsingOrb(player, xOffset, yOffset){
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.fillStyle = "red";
        this.ctx.globalAlpha = 0.4;
        var pulse = 8 * (1.2 + Math.sin((0.001 * Utils.millis())));
        this.drawRectangle(player.x - pulse + xOffset, player.y + pulse + yOffset, 50 + 2 * pulse, - 50 - 2 * pulse);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawPlayerCube(player, width, height, xOffset, yOffset) {
        this.ctx.save();

        var playerX = player.x + xOffset;
        var playerY = player.y + yOffset;

        this.ctx.beginPath();
        this.ctx.fillStyle = player.colour;
        
        this.applyRotation(player, playerX, playerY, width);

        if(player.ducked){
            this.drawRectangle(playerX, playerY, width, - height);
            this.ctx.fill();
        }
        else {
            if(!(player.name in this.players) || player.health === 100 || !this.players[player.name].damage){
                this.players[player.name] = {damage: [{x: 0, y: 0},{x: width, y: 0},{x: width, y: -height}, {x: 0, y: -height}], image: this.players[player.name]?.image};
            }
            while((this.players[player.name].damage.length - 4) < (100 - player.health) / 2){
                var newPolygon = this.addDamageVertices(this.players[player.name].damage);
                this.players[player.name].damage = newPolygon;
            }
            this.drawPolygon(player, this.players[player.name].damage, xOffset, yOffset, player.team);
            this.ctx.clip();

            if(player.team && this.players[player.name].image && !this.players[player.name].image.src.includes('.svg')){
                this.ctx.globalAlpha = 0.5;
            }
            
            if(!this.players[player.name].image && !player.id && player.type != "flag"){
                const playerImage = new Image();
                playerImage.src = "https://hitbox.blob.core.windows.net/options/" + Math.floor(Math.random() * 40 + 1) + ".svg";
                this.players[player.name].image = playerImage
            }
            if(this.players[player.name]?.image && this.players[player.name]?.image.height !== 0){
                this.ctx.drawImage(this.players[player.name].image, playerX - this.camera.x, playerY - height - this.camera.y, width, height);
            }
        }
        
        this.ctx.restore()
    }

    drawPolygon(player, polygon, xOffset, yOffset, colour = null, addCamera = true, useExistingFillStyle = false){
        if(!useExistingFillStyle){
            this.ctx.fillStyle = colour|| player.colour;
        }
        this.ctx.beginPath();
        var cameraX = (addCamera ? this.camera.x : 0);
        var cameraY = (addCamera ? this.camera.y : 0);
        this.ctx.moveTo(player.x + polygon[0].x + xOffset - cameraX, player.y + yOffset + polygon[0].y - cameraY);
        polygon.forEach((p,i) => {
            if(i > 0){
                this.ctx.lineTo(player.x + p.x + xOffset - cameraX, player.y + yOffset + p.y - cameraY);
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
            x - this.camera.x,
            y - this.camera.y,
            width,
            height
        );
    }

    drawPlayerName(player, height, xOffset, yOffset) {
        this.ctx.save();
        var healthProportion = 255 * (player.health / 100);
        var nameColour = 'rgb(255,' + healthProportion + ',' + healthProportion + ')';
        this.ctx.fillStyle = nameColour;
        this.ctx.font = "bold " + Math.max(12,(12*(1/this.scale))) + "px " + FONT;
        this.ctx.textAlign = "center";

        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 0.7;
        this.ctx.shadowOffsetY = 0.7;
        this.ctx.shadowBlur = 1;
        if (player.name) {
            this.ctx.fillText(
                player.name,
                player.x + this.playerSize / 2 - this.camera.x,
                player.y - height - 1 - this.camera.y + yOffset
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
        var polygon = this.players[player.name].damage;
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
        this.ctx.fillStyle = 'black';
        this.ctx.globalAlpha = 0.7;
        this.ctx.rect((this.ctx.canvas.width / 2 - 225) / this.scale,
            (this.ctx.canvas.height / 2 - 55) / this.scale,
            210 / this.scale,
            40 / this.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = 'lightblue';
        this.ctx.rect((this.ctx.canvas.width / 2 - 220) / this.scale,
            (this.ctx.canvas.height / 2 - 50) / this.scale,
            (200 - 2 * player.boostCooldown) / this.scale,
            30 / this.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = "white"
        this.ctx.font = "bold " + 15*(1/this.scale) + "px " + FONT;
        this.ctx.fillText(
            "Stamina",
            (this.ctx.canvas.width / 2 - 210) / this.scale,
            (this.ctx.canvas.height / 2 - 29) / this.scale
        );
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.fillStyle = 'black';
        this.ctx.rect((this.ctx.canvas.width / 2 - 450) / this.scale,
            (this.ctx.canvas.height / 2 - 55) / this.scale,
            210 / this.scale,
            40 / this.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = 'red';
        this.ctx.rect((this.ctx.canvas.width / 2 - 445) / this.scale,
            (this.ctx.canvas.height / 2 - 50) / this.scale,
            (2 * player.health) / this.scale,
            30 / this.scale);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fillStyle = "white"
        this.ctx.font = "bold " + 15*(1/this.scale) + "px " + FONT;
        this.ctx.fillText(
            "Health",
            (this.ctx.canvas.width / 2 - 435) / this.scale,
            (this.ctx.canvas.height / 2 - 29) / this.scale
        );
        this.ctx.fill();
        this.ctx.restore();
    }

    applyRotation(player, playerX, playerY, width){
        if(!player.ducked && player.alive){
            this.ctx.translate(playerX + width / 2 - this.camera.x, playerY - this.camera.y);              //translate to center of shape
            this.ctx.rotate(player.xVelocity * 0.01);  //rotate 25 degrees.
            this.ctx.translate(-(playerX + width / 2 - this.camera.x), -(playerY - this.camera.y));            //translate center back to 0,0
        }
    }

    drawEvents(){
        this.events = this.events.filter(d => !HIDDENEVENTS.includes(d.type) && Utils.millis() < d.timestamp + 5000);

        this.ctx.save();
        this.ctx.font = "bold " + 15*(1/this.scale) + "px " + FONT;
        this.ctx.textAlign = "right";

        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 0.7;
        this.ctx.shadowOffsetY = 0.7;
        this.ctx.shadowBlur = 1;

        this.events.sort((ev1, ev2) => {
            if(ev1.timestamp > ev2.timestamp){
                return -1;
            }
            return 1;
        })
        
        this.events.forEach((d, i) => {
            if(i >= 10){
                return;
            }
            var text = [];
            if(d.type === "death"){
                if(!d.killer){
                    text.push({text: d.method, fillStyle: d.colour || "red"});
                }
                text.push({text: d.killed.name, fillStyle: d.killed.colour});
                if(d.killer){
                    text.push({text: d.method, fillStyle: d.colour || "red"});
                    text.push({text: d.killer.name, fillStyle: d.killer.colour});
                }
            }
            if(d.type === "halo"){
                text.push({text: d.from.name, fillStyle: d.from.colour});
                text.push({text: " took the halo from " , fillStyle: "yellow"});
                text.push({text: d.to.name, fillStyle: d.to.colour});
            }
            if(d.type === "box"){
                text.push({text: " collected a box", fillStyle: "yellow"});
                text.push({text: d.player.name, fillStyle: d.player.colour});
            }
            if(d.type === "goal"){
                text.push({text: d.colour + " team conceded a goal.", fillStyle: d.colour});
            }
            Utils.fillMixedText(this.ctx, text, (this.ctx.canvas.width / 2 - 15) / this.scale, (this.ctx.canvas.height / 2 - 60 - 20 * (1+i)) / this.scale);
        })
        this.ctx.restore();
    }

    drawScores(players, lastWinner){
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.font = "bold " + 15*(1/this.scale) + "px " + FONT;
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
            var lastWinnerText = (lastWinner?.name === s.name ? " [WINNER]" : "");
            var livesText = (this.gameMode.title === "Free for All" || this.gameMode.title === "Collect the Boxes") ? " (" + s.lives + ")" : "";

            this.ctx.fillText(
                aliveText + s.name + ": " + s.score + livesText + lastWinnerText,
                (-this.ctx.canvas.width / 2 + 10) / this.scale,
                (-this.ctx.canvas.height / 2 + 20 * (1+i)) / this.scale
            );
        })
        this.ctx.restore();
    }

    drawPlayerLegs(player, breathingOffset){
        var yOffset = -30;
        var frame = 0.02 * Utils.millis() % 8;
        if(player.xVelocity !== 0){
            if(Math.abs(player.xVelocity) > 10){
                frame = (frame * 2) % 8;
            }
            frame = Math.floor(frame);
            var direction = Math.sign(player.xVelocity);
            var runningImg = direction > 0 ? RunningBackward[frame] : RunningForward[frame];
            this.ctx.drawImage(runningImg, player.x - this.camera.x, player.y + yOffset - 3 - this.camera.y, 50, 33);
        }
        else {
            frame = 0.005 * Utils.millis() % 3;
            if(Math.abs(player.health) < 30){
                frame = (frame * 2) % 3;
            }
            frame = Math.floor(frame);
            var standingImg = Standing[frame];
            this.ctx.drawImage(standingImg, player.x - this.camera.x, player.y + yOffset + breathingOffset - 3 - this.camera.y, 50, 33 - breathingOffset);
        }
    }

    drawFlag(player){
        this.ctx.beginPath();
        this.ctx.fillStyle = player.colour;
        this.drawRectangle(player.x, player.y - player.height, 5, player.height);
        this.ctx.fill();
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

    drawCollision(collision){
        this.ctx.save();
        this.ctx.beginPath();

        var time = (Utils.millis() - collision.timestamp) / ANIMATIONLENGTH;
        var transparency = 1 - Math.pow(time,4);
        var sizeProportion = 1 + 0.5 * time;
        var maxSize = 2 * collision.speed * (collision.speed > 30 ? 1.3 : 1);
        var collisionImage = collision.speed < 30 ? 
            Collision[Math.min(Math.floor(time * Collision.length), Collision.length - 1)] : 
            BigCollision[Math.min(Math.floor(time * BigCollision.length), BigCollision.length - 1)];
        
        this.ctx.globalAlpha = transparency;
        this.ctx.drawImage(collisionImage, collision.location.x - (sizeProportion * maxSize / 2) - this.camera.x, 
            collision.location.y - (sizeProportion * maxSize / 2) - this.camera.y, sizeProportion * maxSize, sizeProportion * maxSize);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawDeath(death){
        this.ctx.save();
        var time = (Utils.millis() - death.timestamp) / SPLASHANIMATIONLENGTH;
        var splashImage = Splash[Math.min(Math.floor(time * Splash.length), Splash.length - 1)];
        
        this.ctx.drawImage(splashImage, death.location.x - 231 - this.camera.x, HEIGHT - 145 - this.camera.y, 
            512, 198);

        this.ctx.restore();
    }

    drawBoost(boost, player){
        if(!player){
            return;
        }
        this.ctx.save();
        var time = (Utils.millis() - boost.timestamp) / WHOOSHANIMATIONLENGTH;
        var transparency = 0.7 * (1 - Math.pow(time,4));
        this.ctx.globalAlpha = transparency;
        var whooshAnimation = boost.direction === 'right' ? WhooshRight : boost.direction === 'left' ? WhooshLeft : WhooshDown;
        var image = whooshAnimation[Math.min(Math.floor(time * whooshAnimation.length), whooshAnimation.length - 1)];
        var imageWidth = 302;
        var imageHeight = 100;
        var xOffset = 0;
        var yOffset = - 25;
        switch(boost.direction){
            case 'right':
                if(player.xVelocity <= 10){
                    this.ctx.restore();
                    return;
                }
                xOffset = - imageWidth - 15;
                break;
            case 'left':
                if(player.xVelocity >= 10){
                    this.ctx.restore();
                    return;
                }
                xOffset = player.width + 15;
                break;
            case 'down':
                if(player.yVelocity <= 10){
                    this.ctx.restore();
                    return;
                }
                xOffset = - 28;
                yOffset = - imageWidth - 25;
                imageWidth = [imageHeight, imageHeight = imageWidth][0];
                break;
            default:
                this.ctx.restore();
                return;
        }

        this.ctx.drawImage(image, player.x + xOffset - this.camera.x, player.y - player.height + yOffset - this.camera.y, 
            imageWidth, imageHeight);

        this.ctx.restore();
    }

    drawLanding(landing){
        this.ctx.save();
        var time = (Utils.millis() - landing.timestamp) / ANIMATIONLENGTH;
        var image = Landing[Math.min(Math.floor(time * Landing.length), Landing.length - 1)];
        if(landing.hitType === 'floor' && landing.speed > 10){
            this.ctx.drawImage(image, landing.location.x - 90 + landing.size.width / 2 - this.camera.x, landing.location.y - 74 - this.camera.y, 
                194, 82);
        }

        this.ctx.restore();
    }

    drawPlayer(player, name) {
        // If player is invincible make them flash.
        if (player.alive && player.invincibility !== 0 && (Math.round(Utils.millis() / 10)) % 2 === 0) return;

        // If player is dead, make them transparent.
        if (!player.alive) this.ctx.globalAlpha = 0.3;


        var currentPlayerHeight = player.ducked ? this.playerSize / 5 : this.playerSize;
        var currentPlayerWidth = player.ducked ? this.playerSize * 1.5 : this.playerSize;
        var xOffset = player.ducked ? - 0.25 * this.playerSize : 0;
        var breathingOffset = (player.xVelocity === 0 && player.yVelocity === 0) && player.type !== "flag" ? 3 * Math.sin((0.01 * Utils.millis())) : 0;
        var yOffset = player.ducked ? 0 : -30 + breathingOffset;

        if(player.orb){
            this.drawPulsingOrb(player, xOffset, yOffset);
        }
        if(player.it){
            this.drawPlayerIsIt(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset);
        }
        if(!player.ducked && player.alive && !player.orb && player.type !== "flag"){
            this.drawPlayerLegs(player, breathingOffset);
        }
        if(player.type == "flag"){
            this.drawFlag(player);
        }
        this.drawPlayerCube(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset);
        this.drawPlayerName(player, currentPlayerHeight, xOffset, yOffset);

        
        // If player is dead, don't draw the rest.
        if (!player.alive) {
            this.ctx.globalAlpha = 1;
            return;
        }
        if(!player.ducked && player.boostCooldown !== 0){
            this.drawPlayerStamina(player, currentPlayerWidth, currentPlayerHeight, xOffset, yOffset, name);
        }
        this.ctx.globalAlpha = 1;
    }

    drawBall(player) {
        this.ctx.save();
        this.ctx.translate(player.x + player.width/2 - this.camera.x, player.y - player.height/2 - this.camera.y);              //translate to center of shape
        this.ctx.rotate(player.angle);  //rotate 25 degrees.
        this.ctx.translate(-(player.x  + player.width/2 - this.camera.x), -(player.y - player.height/2 - this.camera.y));            //translate center back to 0,0

        this.ctx.drawImage(BALL, player.x - this.camera.x, player.y - 200 - this.camera.y, 200, 200);
        this.ctx.restore();
    }

    drawStartingTimer() {
        this.ctx.save()
        this.ctx.globalCompositeOperation = "difference";
        this.ctx.fillStyle = 'white';
        this.ctx.font = "bold " + (50/this.scale)+"px " + FONT;
        this.ctx.textAlign = "center";
        var timerText = Math.round(this.countdown / 20);
        if (timerText === 0 && this.countdown) {
            timerText = "Go!"
        } else if (!this.countdown) {
            timerText = ""
        }
        this.ctx.fillText(timerText, 0, 35 / this.scale);
        this.ctx.restore()
    }

    drawGameCountdown(){
        if(this.gameCountdown){
            this.ctx.save()
            this.ctx.globalCompositeOperation = "difference";
            this.ctx.fillStyle = 'white';
            this.ctx.font = "bold " + (20/this.scale)+"px " + FONT;
            this.ctx.textAlign = "left";
            this.ctx.fillText((this.gameCountdown / 60).toFixed(2), -(this.ctx.canvas.width / 2 - 10) / this.scale, -(this.ctx.canvas.height / 2 - 80) / this.scale);
            this.ctx.restore()
        }
    }

    drawPlayerScore(player){
        if(this.gameMode.title === "Collect the Boxes"){
            this.ctx.save()
            this.ctx.globalCompositeOperation = "difference";
            this.ctx.fillStyle = 'white';
            this.ctx.font = "bold " + (20/this.scale)+"px " + FONT;
            this.ctx.textAlign = "center";
            this.ctx.fillText(player.lives, -(this.ctx.canvas.width / 2 - 16) / this.scale, -(this.ctx.canvas.height / 2 - 80) / this.scale);
            this.ctx.restore()
        }
    }

    drawGameMode(lastWinner){
        var titleFontSize = 25/this.scale;
        var subtitleFontSize = 20/this.scale;
        var centerTitle = this.countdown;
        var showWinner = this.countdown > 60;
        
        var yPosition = centerTitle ? - 100 : -(this.ctx.canvas.height / 2 - 30);
        var xPosition = centerTitle ? 0 : -(this.ctx.canvas.width - 20) / (2 * this.scale);
        var subtitleDiff = centerTitle ? 30 : 25;
        this.ctx.save();
        this.ctx.globalCompositeOperation = "difference";
        if(centerTitle){
            titleFontSize = 60/this.scale;
            subtitleFontSize = 40/this.scale;
            subtitleDiff = 60;
            this.ctx.textAlign = "center";
        } else {
            this.ctx.textAlign = "left";
        }
        this.ctx.fillStyle = 'white';
        this.ctx.font = "bold " + titleFontSize+"px " + FONT;
        
        if(centerTitle && showWinner && lastWinner){
            this.ctx.fillText(lastWinner.name + " won!" || "", 0, (yPosition + subtitleDiff) / this.scale);
        } else {
            this.ctx.fillText(this.gameMode.title || "", xPosition, (yPosition) / this.scale);
            this.ctx.font = "bold " + subtitleFontSize+"px " + FONT;
            this.ctx.fillText(this.gameMode.subtitle || "", xPosition, (yPosition + subtitleDiff) / this.scale);
        }
        
        this.ctx.restore();
    }

    setCountdown(timer) {
        this.countdown = timer;
    }

    setGameMode(gameMode){
        this.gameMode = gameMode;
    }

    event(event){
        event.timestamp = Utils.millis();
        this.events.push(event);

        switch(event.type){
            case("collision"):
                event.animationLength = ANIMATIONLENGTH;
                event.drawAnimation = this.drawCollision;
                this.animations.push(event);
                break;
            case("death"):
                if(event.causeOfDeath === "water"){
                    event.animationLength = SPLASHANIMATIONLENGTH;
                    event.drawAnimation = this.drawDeath;
                    this.animations.push(event);
                }
                break;
            case("boost"):
                event.animationLength = WHOOSHANIMATIONLENGTH;
                event.drawAnimation = this.drawBoost;
                this.animations.push(event);
                break;
            case("hit"):
                event.animationLength = ANIMATIONLENGTH;
                event.drawAnimation = this.drawLanding;
                this.animations.push(event);
                break;
            case("goal"):
                this.scores = event.scores;
                break;
            default:
                break;
        }
    }

    changeAvatar(avatar){
        var image = new Image();
        image.src = Utils.updateQueryStringParameter(avatar.url, 'etag', Utils.uuidv4());
        this.players[avatar.name] = {
            ...this.players[avatar.name],
            image: image
        };
    }

    fullScreen() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
    }

    render() {
        return (
            <canvas className={styles.fullScreen} ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
        );
    }
}
export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef:true})(GameCanvas);