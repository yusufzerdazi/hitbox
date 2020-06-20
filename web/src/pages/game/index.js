
import React from 'react';
import io from 'socket.io-client';
import { connect } from "react-redux";
import { store } from '../../redux/store';
import styles from './styles.module.css';
import * as THREE from 'three';
import { USERNAME_UPDATED } from '../../constants/actionTypes';

const mapStateToProps = state => {
  return {
    user: state.logIn.user
  }
};

const mapDispatchToProps = dispatch => ({
  updateName: x => dispatch({
    type: USERNAME_UPDATED,
    name: x
  })
});

class Game extends React.Component {
  constructor(props){
    super(props);
    this.listener = new THREE.AudioListener();

    this.addAi = this.addAi.bind(this);
    this.removeAi = this.removeAi.bind(this);
    this.play = this.play.bind(this);
    this.quit = this.quit.bind(this);
    this.toggleSound = this.toggleSound.bind(this);
    this.toggleAi = this.toggleAi.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.onMousedown = this.onMousedown.bind(this);
    this.setName = this.setName.bind(this);

    this.state = {
      nameClass: styles.name,
      nameInputClass: styles.nameInput,
      playerSize: 50,
      players: [],
      soundEnabled: false,
      eMillis: 0,
      ePressed: false,
      aMillis: 0,
      aPressed: false,
      lastWinner: null,
      countdown: ""
    };

    this.canvasRef = React.createRef();
  }

  millis(){
    var d = new Date();
    return d.getTime();
  }

  onMousedown(e) {
    var mouseLocked = document.pointerLockElement === this.canvas ||
      document.mozPointerLockElement === this.canvas;
    if (e.which === 1) {
      if(mouseLocked) {
          this.socket.emit('click');
      } else {
        this.canvas.requestPointerLock();
      }
    } else if (e.which === 3) {
      if(mouseLocked) {
          // right click
      }
    }
  }

  componentWillUnmount() {
    this.socket.emit('quit');
    this.mounted = false;
  }

  componentDidMount() {
    this.mounted = true;
    this.ctx = this.canvasRef.current.getContext("2d");
    store.subscribe(() => {
      var state = store.getState();
      if(this.state.user?.name != state.logIn.user.name){
        this.setState({
          user: {
            name: state.logIn.user.name
          }
        })
      }
    });

    this.socket = io(process.env.REACT_APP_SERVER);

    this.canvas = document.getElementsByTagName('canvas')[0];
    this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
    this.canvas.mozRequestPointerLock ||
    this.canvas.webkitRequestPointerLock;

    this.canvas.addEventListener('mousedown', this.onMousedown);
    
    this.socket.on('allPlayers', players => {
      if(this.mounted) this.setState({players: players})
    })

    this.socket.on('collision', () => this.state.soundEnabled ? this.playSound('click.mp3') : () => {});

    this.socket.on('winner', (winner) => {
      this.setState({lastWinner: winner});
    });

    this.socket.on('starting', (timer) => {
      this.setState({countdown: timer ? timer : ""});
    })

    this.socket.on('win', () => {
      window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerWins",
        GeneratePlayStreamEvent: true
      });
    });

    this.socket.on('kill', () => {
      window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerKills",
        GeneratePlayStreamEvent: true
      });
    })

    this.socket.on('loss', () => {
      window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerLoses",
        GeneratePlayStreamEvent: true
      });
    });

    setInterval(() => {
      if(this.mounted) this.draw();
    }, 1000 / 60);

    document.addEventListener("keydown", e => {
      if(e.keyCode === 80) {
        this.setState({fullScreen: this.state.fullScreen ? '' : styles.fullScreen});
      }
      if(!(document.pointerLockElement === this.canvas || document.mozPointerLockElement === this.canvas)) return;
      if(e.keyCode === 68){
        if(!this.state.ePressed){
          const currentMillis = this.millis();
          if(currentMillis - this.state.eMillis < 500){
            this.socket.emit('boostRight', true);
          }
          this.setState({eMillis: currentMillis});
        }
        this.setState({ePressed: true});
        this.socket.emit('right', true)
      };
      if(e.keyCode === 65){
        if(!this.state.aPressed){
          const currentMillis = this.millis();
          if(currentMillis - this.state.aMillis < 500){
            this.socket.emit('boostLeft', true);
          }
          this.setState({aMillis: currentMillis});
        }
        this.setState({aPressed: true});
        this.socket.emit('left', true)
      }
      if(e.keyCode === 32){
        e.preventDefault();
        this.socket.emit('space', true);
      }
      if(e.keyCode === 83) this.socket.emit('down', true);
    });

    document.addEventListener("keyup", e => {
      if(!(document.pointerLockElement === this.canvas || document.mozPointerLockElement === this.canvas)) return;
      var a;
      if(e.keyCode === 68){
        this.setState({ePressed: false});
        this.socket.emit('right', false)
      }
      if(e.keyCode === 65){
        this.setState({aPressed: false});
        this.socket.emit('left', false)
      }
      e.keyCode === 32 ? this.socket.emit('space', false) :
      e.keyCode === 83 ? this.socket.emit('down', false) :
      e.keyCode === 69 ? this.socket.emit('boostRight', false) : a = 1;
    });
  }

  kill = () => {
    this.setState({end: true});
  }

  draw = () => {
    this.drawBackground();
    this.state.players.filter(p => p.y > 400).forEach(player => this.drawPlayer(player));
    this.drawPlatform();
    var players = this.state.players.concat();
    players.sort((player1, player2) => {
      if(Math.abs(player2.y - player1.y) > this.state.playerSize){
        return Math.abs(player2.y) - Math.abs(player1.y);
      }
      return Math.abs(player2.x - 480) - Math.abs(player1.x - 480);
    })
    players.filter(p => p.y <= 400).forEach(player => this.drawPlayer(player));
    this.drawStartingTimer();
  }

  clearCanvas(){
    const ctx = this.canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, 960, 540);
  }

  drawPlatform(){
    var xVanishingPoint = 960 / 2;
    var yVanishingPoint = -500;
    
    this.draw3DSection(0, 600, 0, 0, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    this.draw3DSection(960, 600, 960, 0, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    this.draw3DSection(100, 400, 860, 400, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    
    this.ctx.beginPath();
    this.ctx.fillStyle = "black";
    this.ctx.rect(100, 400, 760, 540);
    this.ctx.fill();
  }

  drawBackground(){
    this.ctx.fillStyle = "white";
    this.ctx.beginPath();
    this.ctx.rect(0, 0, 960, 540);
    this.ctx.fill();
  }

  draw3DSection(x1, y1, x2, y2, centerX, centerY, xVanishingPoint, yVanishingPoint, colour, useCenterPoint = true, length = 10){
    var cubeLength = 20;

    var angle1 = Math.atan(((useCenterPoint ? centerY : y1) - yVanishingPoint) / ((useCenterPoint ? centerX : x1) - xVanishingPoint));
    if((useCenterPoint ? centerX : x1) > xVanishingPoint) angle1 += Math.PI;

    var brPointY = y1 - length;
    var brPointX = x1 + cubeLength * Math.cos(angle1);

    var angle2 = Math.atan(((useCenterPoint ? centerY : y2) - yVanishingPoint) / ((useCenterPoint ? centerX : x2) - xVanishingPoint));
    if((useCenterPoint ? centerX : x2) > xVanishingPoint) angle2 += Math.PI;

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

  drawPlayerCube(player, width, height, xOffset){
    var xVanishingPoint = 960 / 2;
    var yVanishingPoint = -500;

    var rightX= (player.x + xOffset + width);
    var leftX = (player.x + xOffset);
    var topY = (player.y - height);
    var bottomY = (player.y);
    var centerX= (player.x + xOffset + (width / 2));
    var centerY = (player.y - (height / 2));

    this.draw3DSection(rightX, bottomY, rightX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'black');
    this.draw3DSection(leftX, bottomY, leftX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'black');
    this.draw3DSection(leftX, topY, rightX, topY, centerX, centerY, xVanishingPoint, yVanishingPoint, 'grey');

    this.ctx.beginPath();
    this.ctx.fillStyle = player.colour;
    this.ctx.rect(player.x + xOffset, player.y, width, - height);
    this.ctx.fill();
  }

  drawPlayerOutline(player, width, height, xOffset){
    this.ctx.beginPath();
    this.ctx.strokeStyle = player.colour;
    this.ctx.rect(player.x + 3 + xOffset, player.y - 3, width - 6, - height + 6);
    this.ctx.stroke();
  }

  drawPlayerName(player, height, xOffset){
    this.ctx.fillStyle = 'white';
    this.ctx.font = "10px Consolas";
    this.ctx.textAlign = "center";
    this.ctx.lineWidth = 6;
    if(player.name){
      this.ctx.fillText(player.name, player.x + xOffset + this.state.playerSize / 2, player.y - height - 1);
    }
  }

  drawPlayerHealth(player, width, height, xOffset){
    this.ctx.fillStyle = "black";
    this.ctx.beginPath();
    if(player.alive) this.ctx.rect(player.x + width / 2 + xOffset, player.y - height, width / 2, (height * (100 - player.health) / 100));
    this.ctx.fill();
  }

  drawPlayerStamina(player, width, height, xOffset){
    this.ctx.beginPath();
    this.ctx.fillStyle = 'white';
    this.ctx.rect(player.x + xOffset, player.y, width / 2, -(height * player.boostCooldown / 100));
    this.ctx.fill();
  }

  drawPlayer(player){
    // If player is invincible make them flash.
    if(player.alive && player.invincibility != 0 && (Math.round(this.millis() / 10)) % 2 == 0) return;
    
    // If player is dead, make them transparent.
    if(!player.alive) this.ctx.globalAlpha = 0.3;


    var currentPlayerHeight = player.ducked ? this.state.playerSize / 5 : this.state.playerSize;
    var currentPlayerWidth = player.ducked ? this.state.playerSize * 1.5 : this.state.playerSize;
    var xOffset = player.ducked ? - 0.25 * this.state.playerSize : 0;

    this.drawPlayerCube(player, currentPlayerWidth, currentPlayerHeight, xOffset);
    this.drawPlayerName(player, currentPlayerHeight, xOffset);

    // If player is dead, don't draw the rest.
    if(!player.alive){
      this.ctx.globalAlpha = 1;
      return;
    }

    this.drawPlayerHealth(player, currentPlayerWidth, currentPlayerHeight, xOffset);
    this.drawPlayerStamina(player, currentPlayerWidth, currentPlayerHeight, xOffset);
    this.drawPlayerOutline(player, currentPlayerWidth, currentPlayerHeight, xOffset);
    this.ctx.globalAlpha = 1;
  }

  drawStartingTimer(){
    this.ctx.fillStyle = 'black';
    this.ctx.font = "50px Consolas";
    this.ctx.textAlign = "center";
    this.ctx.fillText(this.state.countdown, 480, 270);
  }

  playSound(soundFile){
    var sound = new THREE.Audio( this.listener );
    var audioLoader = new THREE.AudioLoader();
    audioLoader.load(soundFile, function( buffer ) {
      sound.setBuffer( buffer );
      sound.play();
    });
  }

  addAi(){
    this.socket.emit('addAi');
  }

  removeAi(){
    this.socket.emit('removeAi');
  }

  play(){
    var name = this.props.user?.name || this.state.name;
    if(name){
      this.socket.emit('play', {name: name});
      this.state.nameClass = styles.name;
      this.state.nameInputClass = styles.nameInput;
    } else {
      this.state.nameClass = styles.name + ' ' + styles.red;
      this.state.nameInputClass = styles.nameInput + ' ' + styles.red;
    }
  }

  quit(){
    this.socket.emit('quit');
  }

  toggleSound(){
    this.setState({soundEnabled: !this.state.soundEnabled})
  }
  
  toggleAi(){
    this.socket.emit('toggleAi');
  }

  handleChange(event) {
    this.setState({name: event.target.value});
  }

  setName() {
    if(this.state.name && this.props.user){
      window.PlayFabClientSDK.UpdateUserTitleDisplayName({
        DisplayName: this.state.name
      }, () => this.props.updateName(this.state.name));
    }
  }

  render() {
    const scores = 
    <div className={styles.scores}>
      <p className={styles.scoresContainer}>{this.state.players.map((d, i) => <span className={styles.score} style={{color: d.colour}} key={i}>{d.name + ':\u00A0' + d.score}</span>)}</p>
    </div>;
    return (
      <>
        <canvas className={this.state.fullScreen} ref={this.canvasRef} width={960} height={540} />
        <div className={styles.addAi}>
          <span className={this.state.nameClass}><input onChange={this.handleChange} placeholder="Enter name" className={this.state.nameInputClass} type="text"></input></span>
          {this.props.user?.name ? <span className={styles.playFabName}><b>Name:</b> {this.props.user?.name}</span> : <></> }
          {this.props.user ? <span onClick={this.setName} className={styles.addAiButton}>Update Username</span> : <></> }
          <span onClick={this.play} className={styles.addAiButton + ' ' + styles.playButton}>Play</span>
          <span onClick={this.quit} className={styles.addAiButton + ' ' + styles.quitButton}>Quit</span>
          <span onClick={this.addAi} className={styles.addAiButton}>+AI</span>
          <span onClick={this.removeAi} className={styles.addAiButton}>-AI</span>
          <span onClick={this.toggleSound} className={styles.addAiButton}>Toggle Sound</span>
          <span onClick={this.toggleAi} className={styles.addAiButton}>Toggle AI</span>
        </div>
        {this.state.lastWinner ?
          <div className={styles.winnerContainer}>
            <span style={{color: this.state.lastWinner.colour}} className={styles.winner}>{this.state.lastWinner.name + ' won the last game.'}</span>
          </div> : null
        }
        {scores}
        <div className={styles.text}>
          <span className={styles.control}><b>A:</b> Left (Double tap to boost)</span>
          <span className={styles.control}><b>S:</b> Duck/Pound</span>
          <span className={styles.control}><b>D:</b> Right (Double tap to boost)</span>
          <span className={styles.control}><b>Space:</b> Jump/Double jump</span>
          <span className={styles.control}><b>Click:</b> Boost</span>
          <span className={styles.control}><b>P:</b> Toggle Fullscreen</span>
        </div>
      </>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Game);