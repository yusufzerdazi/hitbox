import React from 'react';
import { connect } from 'react-redux';
import Utils from '../../utils';
import styles from './styles.module.css';
import ball from '../../assets/images/football.png';
import grass from '../../assets/images/grass.svg';
import { RunningForward, RunningBackward, Standing, BigCollision, Collision, Splash, WhooshRight, WhooshLeft, WhooshDown, Landing } from './animation';
import { FOLLOWING } from '../../constants/cameraTypes';
import { PLAYERS } from '../../constants/actionTypes';

const FONT = "'Roboto'";
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
        this.state = {
            isScaled: false
        };

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

    draw(state, name, lastWinner, showGui) {
        var players = Array.from(state.players.values());
        var level = state.level;
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
        if(this.scale !== Math.min(this.scale * this.zoomRate, 1.5)) {
            this.setScale(this.scale * this.zoomRate);
        }
        this.drawBackground();
        if(level.platforms){
            level.platforms.forEach(l => this.drawLevelPlatform(l));
        }
        this.drawWater();

        
        players.filter(p => p.type !== "ball").forEach(player => this.drawPlayer(player, name, showGui));
        players.filter(p => p.type === "ball").forEach(player => this.drawBall(player));
        
        this.drawDeathWall(level);
        
        this.animations = this.animations.filter(c => Utils.millis() - c.animationLength < c.timestamp);
        this.animations.forEach(c => c.drawAnimation(c, c.name ? players.filter(p => p.name === c.name)[0] : undefined));
        
        if(players.filter(p => p.name === name).length === 0 && this.joining){
            this.drawNotification();
        }
        setTimeout(() => {
            this.drawing = false;
        }, 1);
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

    newGame(players){
        this.props.updatePlayers(players);
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
    }

    updateGameCountdown(gameCountdown){
        this.gameCountdown = gameCountdown;
    }

    drawLevelPlatform(level, colour, useExistingFillStyle = false){
        this.ctx.save();
        if(!useExistingFillStyle){
            this.ctx.fillStyle = level.colour || colour || "#1a1001";
        }
        if(['goal', 'backgroundleaves'].includes(level.type)){
            this.ctx.fillStyle = level.colour;
            this.ctx.globalAlpha = 0.3;
        }
        if(level.durability && level.durability !== 100){
            this.ctx.globalAlpha = level.durability / 100;
        }
        this.ctx.beginPath();
        Utils.roundRect(this.ctx, level.x - this.camera.x, level.y - this.camera.y, level.width, level.height, (useExistingFillStyle || ['border', 'trunk', 'house'].includes(level.type)) ? 0 : PLATFORMRADIUS, true, false);
        this.ctx.fill();

        if(!colour && !['trunk', 'leaves', 'goal', 'border', 'backgroundleaves', 'house', 'roof'].includes(level.type) && !useExistingFillStyle){
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

    applyRotation(player, playerX, playerY, width){
        if(!player.ducked && player.alive){
            this.ctx.translate(playerX + width / 2 - this.camera.x, playerY - this.camera.y);              //translate to center of shape
            this.ctx.rotate(player.xVelocity * 0.01);  //rotate 25 degrees.
            this.ctx.translate(-(playerX + width / 2 - this.camera.x), -(playerY - this.camera.y));            //translate center back to 0,0
        }
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
        return {
            ...collision,
            timestamp: Utils.millis(),
            animationLength: ANIMATIONLENGTH,
            drawAnimation: (event) => {
                var fade = (Utils.millis() - event.timestamp) / ANIMATIONLENGTH;
                var x = event.location ? event.location.x : event.x;
                var y = event.location ? event.location.y : event.y;
                Collision(this.ctx, x - this.camera.x, y - this.camera.y, 1 - fade, this.scale, collision.type === 'player' ? event.colour : 'green');
                if(collision.type === 'player' && collision.speed >= 30){
                    BigCollision(this.ctx, x - this.camera.x, y - this.camera.y, 1 - fade, this.scale, event.colour);
                }
            }
        };
    }

    drawDeath(death){
        return {
            ...death,
            timestamp: Utils.millis(),
            animationLength: SPLASHANIMATIONLENGTH,
            drawAnimation: (event) => {
                if(event.causeOfDeath === "water"){
                    var fade = (Utils.millis() - event.timestamp) / SPLASHANIMATIONLENGTH;
                    var x = event.location ? event.location.x : event.x;
                    var y = event.location ? event.location.y : event.y;
                    Splash(this.ctx, x - this.camera.x, y - this.camera.y, 1 - fade, this.scale, event.colour);
                }
            }
        };
    }

    drawBoost(boost, player){
        return {
            ...boost,
            timestamp: Utils.millis(),
            animationLength: WHOOSHANIMATIONLENGTH,
            drawAnimation: (event, p) => {
                var fade = (Utils.millis() - event.timestamp) / WHOOSHANIMATIONLENGTH;
                if(p && event.direction === "down"){
                    WhooshDown(this.ctx, p.x - this.camera.x + this.playerSize / 2, p.y - this.camera.y - 20, fade, this.scale);
                }
                else if(p && event.direction === "right"){
                    WhooshRight(this.ctx, p.x - this.camera.x + this.playerSize / 2, p.y - this.camera.y - 20, fade, this.scale);
                }
                else if(p && event.direction === "left"){
                    WhooshLeft(this.ctx, p.x - this.camera.x + this.playerSize / 2, p.y - this.camera.y - 20, fade, this.scale);
                }
            }
        };
    }

    drawLanding(landing){
        return {
            ...landing,
            timestamp: Utils.millis(),
            animationLength: ANIMATIONLENGTH,
            drawAnimation: (event) => {
                var fade = (Utils.millis() - event.timestamp) / ANIMATIONLENGTH;
                var x = event.location ? event.location.x : event.x;
                var y = event.location ? event.location.y : event.y;
                Landing(this.ctx, x - this.camera.x, y - this.camera.y, 1 - fade, this.scale, event.colour);
            }
        };
    }

    drawPlayer(player, name, showGui) {
        var breathingOffset = Math.sin(0.002 * Utils.millis()) * 2;
        var width = player.ducked ? this.playerSize * 1.3 : this.playerSize;
        var height = player.ducked ? this.playerSize * 0.6 : this.playerSize;
        var xOffset = 0;
        var yOffset = 0;
        if(player.orb){
            this.drawPulsingOrb(player, xOffset, yOffset);
        }
        else {
            if(showGui){
                this.drawPlayerName(player, height, xOffset, yOffset);
                if(player.lives <= 1 && this.gameMode.title === "Free for All"){
                    this.drawPlayerStamina(player, width, height, xOffset, yOffset, name);
                }
            }
            this.drawPlayerCube(player, width, height, xOffset, yOffset - breathingOffset * !player.ducked);
            this.drawPlayerLegs(player, breathingOffset);
            if(player.it && this.gameMode.title === "Tag"){
                this.drawPlayerIsIt(player, width, height, xOffset, yOffset);
            }
            else if(player.flag){
                this.drawFlag(player);
            }
        }
    }

    drawBall(player) {
        this.ctx.drawImage(BALL, player.x - this.camera.x, player.y - this.camera.y, player.radius * 2, player.radius * 2);
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
            this.ctx.fillText((this.gameCountdown / 60).toFixed(2), -(this.ctx.canvas.width / 2 - 10) / this.scale, -(this.ctx.canvas.height / 2 - 105) / this.scale);
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
            this.ctx.fillText(player.lives, -(this.ctx.canvas.width / 2 - 16) / this.scale, -(this.ctx.canvas.height / 2 - 105) / this.scale);
            this.ctx.restore()
        }
    }

    drawGameMode(level, lastWinner){
        if (!this.state.isScaled) {
            return;
        }
        
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
            var titleText = [];
            var subtitleText = [];
            var mapText = [];
            if(!centerTitle){
                titleText.push({text: "Game: ", fillStyle: "grey"});
                subtitleText.push({text: "Goal: ", fillStyle: "grey"});
                mapText.push({text: "Map: ", fillStyle: "grey"});
                mapText.push({text: level.name, fillStyle: "white"});
            }
            titleText.push({text: this.gameMode.title || "", fillStyle: "white"});
            subtitleText.push({text: this.gameMode.subtitle || "", fillStyle: "white"});


            Utils.fillMixedText(this.ctx, titleText, xPosition, (yPosition) / this.scale, 1);
            this.ctx.font = "bold " + subtitleFontSize+"px " + FONT;
            Utils.fillMixedText(this.ctx, subtitleText, xPosition, (yPosition + subtitleDiff) / this.scale, 1);
            Utils.fillMixedText(this.ctx, mapText, xPosition, (yPosition + 2 * subtitleDiff) / this.scale, 1);
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
        if(event.timestamp){
            event.timestamp = Utils.millis();
        }
        switch(event.type){
            case "collision":
                this.animations.push(this.drawCollision(event));
                break;
            case "boost":
                this.animations.push(this.drawBoost(event));
                break;
            case "hit":
                this.animations.push(this.drawCollision(event));
                break;
            case "death":
                this.animations.push(this.drawDeath(event));
                break;
            case "landing":
                this.animations.push(this.drawLanding(event));
                break;
            case "goal":
                this.scores = event.scores;
                this.events.push(event);
                break;
            default:
                this.events.push(event);
                break;
        }
    }

    changeAvatar(avatar){
        if(avatar.url && avatar.name){
            if(!this.players[avatar.name]){
                this.players[avatar.name] = {}
            }
            const playerImage = new Image();
            playerImage.src = avatar.url;
            this.players[avatar.name].image = playerImage;
        }
    }

    fullScreen() {
        if (this.canvasRef && this.canvasRef.current && this.ctx) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.ctx.canvas.width = width;
            this.ctx.canvas.height = height;
            this.scale = Math.min(width / WIDTH, height / HEIGHT);
            this.ctx.setTransform(this.scale, 0, 0, this.scale, width / 2, height / 2);
            this.setState({ isScaled: this.scale > 0.8 });
        }
    }

    resetCamera() {
        this.camera = {
            x: (WIDTH / 2),
            y: (HEIGHT / 2),
            xEased: 0,
            yEased: 0
        };
        this.scale = 1;
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
    }

    render() {
        return (
            <canvas className={styles.fullScreen} ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
        );
    }
}
export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef:true})(GameCanvas);