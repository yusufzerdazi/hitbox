
import React from 'react';
import Gamepad from 'react-gamepad';
import { connect } from "react-redux";
import { store } from '../../redux/store';

import GameCanvas from '../../components/gameCanvas';
import GameService from '../../services/game.service';
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
    constructor(props) {
        super(props);
        this.bindFunctions();
        let search = window.location.search;
        let params = new URLSearchParams(search);
        let room = params.get('room');
        this.state = {
            editingUsername: true,
            soundEnabled: true,
            room: room,
            playing: false,
            name: null,
            ai: 0,
            avatar: null
        };
        this.canvasRef = React.createRef();
        this.gameService = new GameService();
    }

    componentWillUnmount() {
        this.gameService.setMounted(false);
        this.gameService.quit();
        this.mounted = false;
    }

    getUsername() {
        var state = store.getState();
        if(state.logIn?.user?.name && state.logIn.user.name !== this.state.name){
            this.gameService.changeName(state.logIn.user.name);
            this.setState({name: state.logIn.user.name});
        }
        if(state.logIn?.user?.name && !this.state.playing && state.options?.playing){
            window.PlayFabClientSDK.GetPlayerStatistics({
                StatisticNames: ["rank"]
            }).then(s => {
                var rank = s.data?.Statistics[0]?.Value || 1000;
                this.gameService.play(state.logIn.user, this.state.room, rank);
                this.setState({playing: true, name: state.logIn.user.name});
            });
        }
        if(state.logIn?.user?.image && state.logIn?.user?.image !== this.avatar){
            this.setState({avatar: state.logIn?.user?.image});
            this.gameService.changeAvatar(state.logIn?.user?.image, state.logIn?.user?.name);
        }
        if(!state.options?.playing && this.state.playing){
            this.gameService.quit();
            this.setState({playing: false});
        }
        if(this.state.ai !== undefined && state.options.ai > this.state.ai){
            this.gameService.addAi();
            this.setState({ai: state.options.ai});
        }
        if(this.state.ai !== undefined && state.options.ai < this.state.ai){
            this.gameService.removeAi();
            this.setState({ai: state.options.ai});
        }
    }

    componentDidMount() {
        this.mounted = true;

        store.subscribe(() => {
            this.getUsername();
        });
        
        this.gameService
            .setCanvas(this.canvasRef)
            .setMounted(true);
        
        this.gameService.spectate(this.state.room);

        document.addEventListener("keydown", e => {
            if (this.mounted){
                if (e.keyCode === 27) {
                    this.canvasRef.current.fullScreen(false);
                }
            }
        });
    }

    buttonUp(buttonName) {
        switch (buttonName) {
            case 'A':
                this.gameService.jump(false);
                break;
            case 'RT':
            case 'RB':
                this.gameService.boostRight(false);
                break;
            case 'LT':
            case 'LB':
                this.gameService.boostLeft(false);
                break;
            case 'X':
                this.gameService.crouch(false);
                break;
            default:
                break;
        }
    }

    jump(enabled){
        this.gameService.jump(enabled);
    }

    boostRight(enabled){
        this.gameService.boostRight(enabled);
    }

    boostLeft(enabled){
        this.gameService.boostLeft(enabled);
    }

    crouch(enabled){
        this.gameService.crouch(enabled);
    }

    axisChange(axisName, value, previousValue) {
        switch (axisName) {
            case ('LeftStickX'):
                if (value >= 0.75) {
                    this.gameService.moveRight();
                    this.gameService.moveLeft(false);
                }
                else if (value > 0.1) {
                    this.gameService.moveRight(value);
                    this.gameService.moveLeft(false);
                }
                else if (value >= -0.1) {
                    this.gameService.moveRight(false);
                    this.gameService.moveLeft(false);
                }
                else if (value > -0.75) {
                    this.gameService.moveLeft(-value);
                    this.gameService.moveRight(false);
                }
                else {
                    this.gameService.moveLeft();
                    this.gameService.moveRight(false);
                }
                break;
            case ('LeftStickY'): {
                if (value > -0.75 && previousValue <= -0.75) {
                    this.gameService.crouch(false);
                }
                break;
            }
            case ('RightStickY'): {
                if(Math.abs(value) > 0.2){
                    this.canvasRef.current.analogScale(value);
                } else {
                    this.canvasRef.current.analogScale(0);
                }
                break;
            }
            default:
                break;
        }
    }

    render() {
        return (
            <>
                <GameCanvas ref={this.canvasRef} />
                <Gamepad
                    onA={this.jump}
                    onRT={this.boostRight}
                    onLT={this.boostLeft}
                    onRB={this.boostRight}
                    onLB={this.boostLeft}
                    onX={this.crouch}
                    onButtonUp={this.buttonUp}
                    onAxisChange={this.axisChange}>
                    <p></p>
                </Gamepad>
            </>
        );
    }

    bindFunctions(){
        this.getUsername = this.getUsername.bind(this);
        this.buttonUp = this.buttonUp.bind(this);
        this.axisChange = this.axisChange.bind(this);
        this.jump = this.jump.bind(this);
        this.boostRight = this.boostRight.bind(this);
        this.boostLeft = this.boostLeft.bind(this);
        this.boostRight = this.boostRight.bind(this);
        this.boostLeft = this.boostLeft.bind(this);
        this.crouch = this.crouch.bind(this);
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Game);