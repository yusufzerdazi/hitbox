
import React from 'react';
import io from 'socket.io-client';
import ReactTooltip from "react-tooltip";
import { connect } from "react-redux";
import { store } from '../../redux/store';
import styles from './styles.module.css';
import * as THREE from 'three';
import { USERNAME_UPDATED } from '../../constants/actionTypes';
import hit from '../../assets/sounds/hit.mp3';
import wall from '../../assets/sounds/wall.mp3';

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

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class Game extends React.Component {
  constructor(props){
    super(props);
    this.listener = new THREE.AudioListener();

    this.addAi = this.addAi.bind(this);
    this.addCleverAi = this.addCleverAi.bind(this);
    this.removeAi = this.removeAi.bind(this);
    this.play = this.play.bind(this);
    this.quit = this.quit.bind(this);
    this.toggleSound = this.toggleSound.bind(this);
    this.toggleAi = this.toggleAi.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.onMousedown = this.onMousedown.bind(this);
    this.setName = this.setName.bind(this);
    this.editName = this.editName.bind(this);
    this.cancelNameChange = this.cancelNameChange.bind(this);
    this.getUsername = this.getUsername.bind(this);
    this.goFullscreen = this.goFullscreen.bind(this);
    this.customIdLogin = this.customIdLogin.bind(this);

    this.state = {
      nameClass: styles.name,
      nameInputClass: styles.nameInput,
      playerSize: 50,
      players: [],
      soundEnabled: true,
      eMillis: 0,
      ePressed: false,
      aMillis: 0,
      aPressed: false,
      lastWinner: null,
      countdown: "",
      editingUsername: true
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

  getUsername(){
    var state = store.getState();
    if(state.logIn.user?.name && this.state.user?.name != state.logIn.user.name){
      this.setState({
        user: {
          name: state.logIn.user.name
        },
        editingUsername: false
      })
    } else {
      var customId = localStorage.getItem("customId");
      if(customId){
        window.PlayFabClientSDK.LoginWithCustomID({
          CreateAccount : true,
          TitleId: "B15E8",
          CustomId: customId
        }, (response) => {
          window.PlayFabClientSDK.GetPlayerProfile({
            ProfileConstraints:
            {
              ShowDisplayName: true
            },
            PlayFabId: response.data.PlayFabId
          }, (response) => {
            if(response?.data?.PlayerProfile?.DisplayName){
              this.props.updateName(response.data.PlayerProfile.DisplayName);
              this.setState({
                user: {
                  name: response.data.PlayerProfile.DisplayName
                },
                editingUsername: false
              });
            }
          });
        });
      }
    }
  }

  componentDidMount() {
    this.mounted = true;
    this.ctx = this.canvasRef.current.getContext("2d");
    this.getUsername();
    store.subscribe(() => {
      this.getUsername();
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

    this.socket.on('collision', () => {
      if(this.state.soundEnabled && this.mounted){
        this.playSound(hit);
      }
    });
    this.socket.on('hitWall', () => {
      if(this.state.soundEnabled && this.mounted){
        this.playSound(wall);
      }
    });

    this.socket.on('winner', (winner) => {
      if(this.mounted) this.setState({lastWinner: winner});
    });

    this.socket.on('starting', (timer) => {
      if(this.mounted) this.setState({countdown: timer ? timer : ""});
    })

    this.socket.on('win', () => {
      if(this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerWins",
        GeneratePlayStreamEvent: true
      });
    });
    
    this.socket.on('beaten', beaten => {
      if(this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerBeaten",
        FunctionParameter: beaten,
        GeneratePlayStreamEvent: true
      });
    });

    this.socket.on('kill', () => {
      if(this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerKills",
        GeneratePlayStreamEvent: true
      });
    })

    this.socket.on('loss', () => {
      if(this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerLoses",
        GeneratePlayStreamEvent: true
      });
    });

    setInterval(() => {
      if(this.mounted) this.draw();
    }, 1000 / 60);

    document.addEventListener("keydown", e => {
      if(e.keyCode === 27){
        this.setState({fullScreen: ''})
      }

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
      if(e.keyCode === 32 || e.keyCode == 87){
        if(e.keyCode == 32){
          e.preventDefault();
        }
        this.socket.emit('space', true);
      }
      if(e.keyCode === 83) this.socket.emit('down', true);
    });

    document.addEventListener("keyup", e => {
      var a;
      if(e.keyCode === 68){
        this.setState({ePressed: false});
        this.socket.emit('right', false)
      }
      if(e.keyCode === 65){
        this.setState({aPressed: false});
        this.socket.emit('left', false)
      }
      e.keyCode === 32 || e.keyCode == 87 ? this.socket.emit('space', false) :
      e.keyCode === 83 ? this.socket.emit('down', false) :
      e.keyCode === 69 ? this.socket.emit('boostRight', false) : a = 1;
    });
  }

  kill = () => {
    this.setState({end: true});
  }

  draw = () => {
    this.drawBackground();
    this.drawWalls();
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
    
    this.draw3DSection(100, 400, 860, 400, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    
    this.ctx.beginPath();
    this.ctx.fillStyle = "black";
    this.ctx.rect(100, 400, 760, 540);
    this.ctx.fill();
  }

  drawWalls(){
    var xVanishingPoint = 960 / 2;
    var yVanishingPoint = -500;
    
    this.draw3DSection(0, 600, 0, 0, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
    this.draw3DSection(960, 600, 960, 0, 480, 410, xVanishingPoint, yVanishingPoint, "grey", false);
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
    this.ctx.save();
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.strokeStyle = player.colour;
    this.ctx.rect(player.x + 3 + xOffset, player.y - 3, width - 6, - height + 6);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawPlayerName(player, height, xOffset){
    this.ctx.save();
    this.ctx.fillStyle = 'white';
    this.ctx.font = "10px Consolas";
    this.ctx.textAlign = "center";
    
    this.ctx.shadowColor = "black";
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;
    this.ctx.shadowBlur = 1;
    if(player.name){
      this.ctx.fillText(player.name, player.x + this.state.playerSize / 2, player.y - height - 1);
    }
    this.ctx.shadowColor = "";
    this.ctx.restore();
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
    var timerText = Math.round(this.state.countdown / 20);
    if(timerText == 0 && this.state.countdown){
      timerText = "Go!"
    } else if(this.state.countdown == 0){
      timerText = ""
    }
    this.ctx.fillText(timerText, 480, 270);
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

  customIdLogin(){
    if(this.state.name && !this.props.user?.name){
      var customId = localStorage.getItem("customId");
      if(!customId){
        customId = uuidv4();
        localStorage.setItem("customId", customId);
      }
      window.PlayFabClientSDK.LoginWithCustomID({
        CreateAccount : true,
        TitleId: "B15E8",
        CustomId: customId
      }, () => {
        this.setName();
      });
    }
  }

  play(){
    this.customIdLogin();
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
  
  addCleverAi(){
    this.socket.emit('addCleverAi');
  }

  handleChange(event) {
    this.setState({name: event.target.value});
  }

  editName() {
    this.setState({editingUsername: true});
  }

  cancelNameChange() {
    this.setState({
      name: "",
      editingUsername: false
    });
  }

  setName() {
    if(this.state.name){
      window.PlayFabClientSDK.UpdateUserTitleDisplayName({
        DisplayName: this.state.name
      }, () => {
        this.setState({editingUsername: false});
        this.props.updateName(this.state.name);
        this.socket.emit("nameChange", this.state.name);
      });
    }
  }

  goFullscreen(){
    this.setState({fullScreen: styles.fullScreen});
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
          <span style={{display: this.props.user?.name ? 'inline-block' : 'none'}} className={styles.playFabName}><b>Name:</b> {this.props.user?.name}</span>
          <span style={{display: this.state.editingUsername ? 'inline-block' : 'none'}} className={this.state.nameClass}><input onChange={this.handleChange} placeholder="Enter name" className={this.state.nameInputClass} type="text"></input></span>
          <span data-tip="Edit username" style={{display: this.props.user && !this.state.editingUsername ? 'inline-block' : 'none'}} onClick={this.editName} className={styles.addAiButton}><i className="fas fa-pencil"></i></span>
          <span data-tip="Confirm username" style={{display: this.props.user && this.state.editingUsername ? 'inline-block' : 'none'}} onClick={this.setName} className={styles.addAiButton}><i className="fas fa-check"></i></span>
          <span data-tip="Cancel name change" style={{display: this.props.user && this.state.editingUsername ? 'inline-block' : 'none'}} onClick={this.cancelNameChange} className={styles.addAiButton}><i className="fas fa-times"></i></span>
          <span data-tip="Join game" onClick={this.play} className={styles.addAiButton}><i className="fas fa-gamepad-alt"></i></span>
          <span data-tip="Quit game" onClick={this.quit} className={styles.addAiButton}><i style={{color: 'red'}} className="fas fa-ban"></i></span>
          <span style={{display: this.state.soundEnabled ? 'inline-block' : 'none'}} data-tip="Mute audio" onClick={this.toggleSound} className={styles.addAiButton}><i className="fas fa-volume-mute"></i></span>
          <span style={{display: !this.state.soundEnabled ? 'inline-block' : 'none'}} data-tip="Enable audio" onClick={this.toggleSound} className={styles.addAiButton}><i className="fas fa-volume"></i></span>
          <span data-tip="Add AI" onClick={this.addAi} className={styles.addAiButton}><i className="fas fa-robot"></i></span>
          <span data-tip="Add Clever AI" onClick={this.addCleverAi} className={styles.addAiButton}><i className="fas fa-head-side-brain"></i></span>
          <span data-tip="Delete AI" onClick={this.removeAi} className={styles.addAiButton}><i style={{color: 'red'}} className="fas fa-robot"></i></span>
          <span data-tip="Fullscreen" onClick={this.goFullscreen} className={styles.addAiButton}><i className="fas fa-expand"></i></span>
        </div>
        {this.state.lastWinner ?
          <div className={styles.winnerContainer}>
            <span style={{color: this.state.lastWinner.colour}} className={styles.winner}>{this.state.lastWinner.name + ' won the last game.'}</span>
          </div> : null
        }
        {scores}
        <ReactTooltip />
      </>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Game);