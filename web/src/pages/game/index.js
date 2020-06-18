
import React from 'react';
import io from 'socket.io-client';
import styles from './styles.module.css';
import * as THREE from 'three';
import hitbox from '../../assets/hitbox.svg';

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

  componentDidMount() {
    this.socket = io(process.env.REACT_APP_SERVER);

    this.socket.on('allPlayers', players => {
      this.setState({players: players})
    })

    this.socket.on('collision', () => this.state.soundEnabled ? this.playSound('click.mp3') : () => {});

    this.socket.on('winner', (winner) => {
      this.setState({lastWinner: winner});
    })

    setInterval(() => {
      this.update();
      this.draw();
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

  update = () => {
    
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
    const ctx = this.refs.canvas.getContext("2d");
    if(!player.alive) ctx.globalAlpha = 0.3;
    var currentPlayerHeight = player.ducked ? this.state.playerSize / 5 : this.state.playerSize;
    var currentPlayerWidth = player.ducked ? this.state.playerSize * 1.5 : this.state.playerSize;
    var xOffset = player.ducked ? - 0.25 * this.state.playerSize : 0;

    ctx.beginPath();
    ctx.fillStyle = player.colour;
    ctx.rect(player.x + xOffset, player.y, currentPlayerWidth, - currentPlayerHeight);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.beginPath();
    if(player.alive) ctx.rect(player.x + currentPlayerWidth / 2 + xOffset, player.y - currentPlayerHeight, currentPlayerWidth / 2, (currentPlayerHeight * (100 - player.health) / 100));
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = 'white';
    ctx.rect(player.x + xOffset, player.y, currentPlayerWidth / 2, -(currentPlayerHeight * player.boostCooldown / 100));
    ctx.fill();
    
    ctx.fillStyle = player.colour;
    ctx.strokeStyle = player.colour;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if(player.name){
      ctx.fillText(player.name, player.x + xOffset, player.y - currentPlayerHeight - 3);
    }
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

  render() {
    const scores = 
    <div className={styles.scores}>
      <p className={styles.scoresContainer}>{this.state.players.map((d, i) => <span className={styles.score} style={{color: d.colour}} key={i}>{d.name + ':\u00A0' + d.score}</span>)}</p>
    </div>;
    return (
      <>
        <div className={styles.titleContainer}>
          <img className={styles.title} src={hitbox}></img>
        </div>
        <canvas ref="canvas" width={960} height={540} />
        <div  className={styles.addAi}>
          <span className={this.state.nameClass}><input onChange={this.handleChange} placeholder="Enter name" className={this.state.nameInputClass} type="text"></input></span>
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
        <div className={styles.controls}>
          <span className={styles.control}><b>A:</b> Left (Double tap to boost)</span>
          <span className={styles.control}><b>S:</b> Duck/Pound</span>
          <span className={styles.control}><b>D:</b> Right (Double tap to boost)</span>
          <span className={styles.control}><b>Space:</b> Jump/Double jump</span>
        </div>
      </>
    );
  }
}

export default Game;