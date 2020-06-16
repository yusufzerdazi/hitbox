
import React from 'react';
import io from 'socket.io-client';
import styles from './styles.module.css';

class Game extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      playerSize: 50,
      players: []
    };
  }

  componentDidMount() {
    this.socket = io('http://localhost:3001');

    // this.socket.on('playerDetails', player => {
    //   player.currentUser = true;
    //   const players = this.state.players;
    //   players.push(player);
    //   this.setState({players: players});
    // })

    this.socket.on('allPlayers', players => {
      this.setState({players: players})
    })

    setInterval(() => {
      this.update();
      this.draw();
    }, 1000 / 60);

    document.addEventListener("keydown", e =>
      e.keyCode === 68 ? this.socket.emit('right', true) : 
      e.keyCode === 65 ? this.socket.emit('left', true) : 
      e.keyCode === 32 ? this.socket.emit('space', true) :
      e.keyCode === 83 ? this.socket.emit('down', true) : null
    );

    document.addEventListener("keyup", e =>
      e.keyCode === 68 ? this.socket.emit('right', false) : 
      e.keyCode === 65 ? this.socket.emit('left', false) : 
      e.keyCode === 32 ? this.socket.emit('space', false) :
      e.keyCode === 83 ? this.socket.emit('down', false) : null
    );
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
    ctx.rect(0, 320, 960, 540);
    ctx.fill();
  }

  drawPlayer(player){
    const ctx = this.refs.canvas.getContext("2d");
    // change this colour to change the colour of your 
    // "pen" in the canvas 

    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.rect(player.x, player.y, this.state.playerSize, (100 - player.health)/2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = player.colour;
    ctx.rect(player.x, player.y + (100 - player.health)/2, this.state.playerSize, player.health/2);
    ctx.fill();
  }

  render() {
    return (
      <>
        <canvas ref="canvas" width={960} height={540} />
      </>
    );
  }
}

export default Game;