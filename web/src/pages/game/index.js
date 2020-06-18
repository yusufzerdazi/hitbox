
import React from 'react';
import io from 'socket.io-client';
import styles from './styles.module.css';
import * as THREE from 'three';

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
    this.onPlayFabResponse = this.onPlayFabResponse.bind(this);
    this.onSignIn = this.onSignIn.bind(this);
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
      lastWinner: null
    };
  }

  millis(){
    var d = new Date();
    return d.getTime();
  }

  onMousedown(e) {
    if (e.which === 1) {
      if(document.pointerLockElement === this.canvas ||
        document.mozPointerLockElement === this.canvas) {
          this.socket.emit('click');
      } else {
        this.canvas.requestPointerLock();
      }
    } else if (e.which === 3) {
      if(document.pointerLockElement === this.canvas ||
        document.mozPointerLockElement === this.canvas) {
          // right click
      }
    }
  }

  componentWillMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
    clearInterval(this.interval);
  }

  componentDidMount() {
    var $this = this;
    setTimeout(function(){ 
      window.gapi.signin2.render('g-signin2', {
        'scope': 'profile email',
        'theme': 'dark',
        'onsuccess': this.onSignIn
      });
      window.gapi.load('auth2', async () => {
        var authInstance = await window.gapi.auth2.getAuthInstance();
        var signedIn = authInstance.isSignedIn.get()
        if (signedIn) {
          $this.onSignIn();
        }
     })
    }, 500)
    

    this.socket = io(process.env.REACT_APP_SERVER);

    this.canvas = document.getElementsByTagName('canvas')[0];
    this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
    this.canvas.mozRequestPointerLock ||
    this.canvas.webkitRequestPointerLock;

    this.canvas.addEventListener('mousedown', this.onMousedown);
    
    this.socket.on('allPlayers', players => {
      this.setState({players: players})
    })

    this.socket.on('collision', () => this.state.soundEnabled ? this.playSound('click.mp3') : () => {});

    this.socket.on('winner', (winner) => {
      this.setState({lastWinner: winner});
    })

    this.socket.on('win', () => {
      console.log('win');
      window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerWins",
        GeneratePlayStreamEvent: true
      });
    })

    this.socket.on('loss', () => {
      console.log('loss');
      window.PlayFabClientSDK.ExecuteCloudScript({
        FunctionName: "playerLoses",
        GeneratePlayStreamEvent: true
      });
    })

    setInterval(() => {
      if(this.mounted) this.draw();
    }, 1000 / 60);

    document.addEventListener("keydown", e => {
      var a;
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
      };
      e.keyCode === 32 ? this.socket.emit('space', true) :
      e.keyCode === 83 ? this.socket.emit('down', true) : a = 1;
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
    this.state.players.forEach(player => this.drawPlayer(player));
  }

  clearCanvas(){
    const ctx = this.refs.canvas.getContext("2d");
    ctx.clearRect(0, 0, 960, 540);
  }

  drawBackground(){
    const ctx = this.refs.canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.rect(0, 0, 960, 540);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "grey";
    ctx.rect(0, 400, 960, 540);
    ctx.fill();
  }

  drawPlayer(player){
    if(player.alive && player.invincibility != 0 && (Math.round(this.millis() / 10)) % 2 == 0) return;
    const ctx = this.refs.canvas.getContext("2d");
    if(!player.alive) ctx.globalAlpha = 0.3;
    var currentPlayerHeight = player.ducked ? this.state.playerSize / 5 : this.state.playerSize;
    var currentPlayerWidth = player.ducked ? this.state.playerSize * 1.5 : this.state.playerSize;
    var xOffset = player.ducked ? - 0.25 * this.state.playerSize : 0;

    ctx.beginPath();
    ctx.fillStyle = player.colour;
    ctx.rect(player.x + xOffset, player.y, currentPlayerWidth, - currentPlayerHeight);
    ctx.fill();

    ctx.fillStyle = player.colour;
    ctx.lineWidth = 6;
    if(player.name){
      ctx.fillText(player.name, player.x + xOffset, player.y - currentPlayerHeight - 3);
    }

    if(!player.alive){
      ctx.globalAlpha = 1;
      return;
    }

    ctx.fillStyle = "black";
    ctx.beginPath();
    if(player.alive) ctx.rect(player.x + currentPlayerWidth / 2 + xOffset, player.y - currentPlayerHeight, currentPlayerWidth / 2, (currentPlayerHeight * (100 - player.health) / 100));
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = 'white';
    ctx.rect(player.x + xOffset, player.y, currentPlayerWidth / 2, -(currentPlayerHeight * player.boostCooldown / 100));
    ctx.fill();
    
    ctx.beginPath();
    ctx.strokeStyle = player.colour;
    ctx.rect(player.x + 3 + xOffset, player.y - 3, currentPlayerWidth - 6, - currentPlayerHeight + 6);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
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
    if(this.state.name){
      console.log(this.state.name);
      this.socket.emit('play', {name: this.state.name});
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
    if(this.state.name && this.state.playFab){
      window.PlayFabClientSDK.UpdateUserTitleDisplayName({
        DisplayName: this.state.name
      }, () => this.setState({playFab: {DisplayName: this.state.name}}));
    }
  }

  onSignIn(){
    // Retrieve access token
    var user = window.gapi.auth2.getAuthInstance().currentUser.get();
    this.setState({accessToken: user.getAuthResponse(true).access_token});
    
    window.PlayFabClientSDK.LoginWithGoogleAccount({
        AccessToken: this.state.accessToken,
        CreateAccount : true,
        TitleId: "B15E8",
    }, this.onPlayFabResponse);
  }

  onPlayFabResponse(response, error) {
    if (response)
      window.PlayFabClientSDK.GetPlayerProfile({
        ProfileConstraints:
        {
          ShowDisplayName: true
        },
        PlayFabId: response.data.PlayFabId
      }, (response) => {
        if(response.data.PlayerProfile.DisplayName){
          this.setState({name:response.data.PlayerProfile.DisplayName });
        }
        this.setState({playFab: response.data.PlayerProfile});
      });
      
    if (error)
      console.log("Error: " + JSON.stringify(error));
  }

  render() {
    const scores = 
    <div className={styles.scores}>
      <p className={styles.scoresContainer}>{this.state.players.map((d, i) => <span className={styles.score} style={{color: d.colour}} key={i}>{d.name + ':\u00A0' + d.score}</span>)}</p>
    </div>;
    return (
      <>
        <canvas ref="canvas" width={960} height={540} />
        <div className={styles.addAi}>
          {!this.state.playFab?.DisplayName ? 
            <span className={this.state.nameClass}><input onChange={this.handleChange} placeholder="Enter name" className={this.state.nameInputClass} type="text"></input></span> : 
            <span className={styles.playFabName}><b>Name:</b> {this.state.playFab.DisplayName}</span>
          }
          {!this.state.playFab?.DisplayName ? <span onClick={this.setName} className={styles.addAiButton}>Set Name</span> : null}
          <span onClick={this.play} className={styles.addAiButton}>Play</span>
          <span onClick={this.addAi} className={styles.addAiButton}>+AI</span>
          <span onClick={this.removeAi} className={styles.addAiButton}>-AI</span>
          <span onClick={this.quit} className={styles.addAiButton}>Quit</span>
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
        </div>
        <div className={styles.loginText}>
          <div className={styles.logInDescription}>
            <span className={styles.logInDescriptionText}>Log in to be added to the leaderboard.</span>
          </div>
          <div className={styles.signInButton} id="g-signin2"></div>
        </div>
      </>
    );
  }
}

export default Game;