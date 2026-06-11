import React from 'react';
import Gamepad from 'react-gamepad';
import { connect } from "react-redux";
import { store } from '../../redux/store';
import { PlayFabClient } from 'playfab-sdk';

import GameCanvas3D from '../../components/gameCanvas3d';
import GameHUD from '../../components/hud';
import Game3DService from '../../services/game3d.service';
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
    }),
});

// Hitbox 3D: same lobby, HUD and rules as the 2D game, rendered in three
// dimensions. Mirrors pages/game but swaps in the 3D canvas and service.
class Game3D extends React.Component {
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
            avatar: null,
        };
        this.canvasRef = React.createRef();
        this.hudRef = React.createRef();
        this.gameService = new Game3DService();
        this.stickAxes = { x: 0, y: 0 };
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
            PlayFabClient.GetPlayerStatistics({
                StatisticNames: ["rank"]
            }, (error, s) => {
                var rank = s.data?.Statistics[0]?.Value || 1000;
                this.gameService.play(state.logIn.user, this.state.room, rank);
                this.setState({playing: true, name: state.logIn.user.name});
            });
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
            .setHUD(this.hudRef)
            .setMounted(true)
            .onToggleGui(this.props.toggleGui || (() => {}));

        this.gameService.spectate(this.state.room);
    }

    componentDidUpdate() {
        if (this.hudRef.current && this.gameService) {
            this.hudRef.current.setGameService(this.gameService);
        }
    }

    buttonUp(buttonName) {
        switch (buttonName) {
            case 'A':
                this.gameService.jump(false);
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

    boostForward(enabled){
        this.gameService.boostForward(enabled);
    }

    crouch(enabled){
        this.gameService.crouch(enabled);
    }

    axisChange(axisName, value, previousValue) {
        switch (axisName) {
            case ('LeftStickX'):
                this.stickAxes.x = Math.abs(value) > 0.1 ? value : 0;
                this.gameService.setMoveAxes(this.stickAxes.x, this.stickAxes.y);
                break;
            case ('LeftStickY'):
                this.stickAxes.y = Math.abs(value) > 0.1 ? value : 0;
                this.gameService.setMoveAxes(this.stickAxes.x, this.stickAxes.y);
                break;
            case ('RightStickX'): {
                if(this.canvasRef.current){
                    this.canvasRef.current.cameraYaw -= value * 0.05;
                }
                break;
            }
            case ('RightStickY'): {
                if(this.canvasRef.current){
                    this.canvasRef.current.analogScale(Math.abs(value) > 0.2 ? value : 0);
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
                <GameCanvas3D ref={this.canvasRef} />
                <GameHUD ref={this.hudRef} />
                <Gamepad
                    onA={this.jump}
                    onRT={this.boostForward}
                    onRB={this.boostForward}
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
        this.boostForward = this.boostForward.bind(this);
        this.crouch = this.crouch.bind(this);
    }
}

export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef : true})(Game3D);
