import SimpleAi from '../players/simpleAi';
import CleverAi from '../players/cleverAi';
import Player from '../players/player';
import Levels from '../level/levels';
import Level from '../level/level';
import Constants from '../constants';
import Utils from '../utils';
import { Room } from "colyseus";
import { HitboxRoomState } from "../rooms/schema/HitboxRoomState";
import EndStatus from '../ranking/endStatus';

const state = {
    STARTED: "started",
    STARTING: "starting"
};

class GameMode {
    damageEnabled: boolean;
    playerDamage: number;
    possibleLevels: (() => Level)[];
    state: string;
    title: string;
    subtitle: string;
    roomRef: Room<HitboxRoomState>;
    teamBased: boolean;

    constructor(roomRef: Room<HitboxRoomState>) {
        this.state = state.STARTING;
        var keys = Object.keys(Levels);
        this.possibleLevels = [Levels.Space, Levels.Complex, Levels.Towers, Levels.Island, Levels.Maze];
        this.roomRef = roomRef;
    }

    getLevel(){
        return this.possibleLevels[Math.floor(this.possibleLevels.length * Math.random())]();
    }

    setModeSpecificPlayers() {
        this.roomRef.state.players.forEach((player, clientId) => {
            if(player.ai){
                var newAI = Math.random() > 0.5 ? 
                    new SimpleAi(player.colour, player.name) :
                    new CleverAi(player.colour, player.name)
                newAI.score = player.score;
                newAI.clientId = player.clientId;
                this.roomRef.state.players.set(clientId, newAI);
            }
        });
    }

    addAiPlayer(){
        var newAI = Math.random() > 1 ? 
            new SimpleAi(Utils.randomColor(),Utils.generateName()) :
            new CleverAi(Utils.randomColor(), Utils.generateName())
        newAI.clientId = Utils.uuidv4();
        this.roomRef.state.players.set(newAI.clientId, newAI);
        this.onPlayerJoin();
        newAI.respawn(Array.from(this.roomRef.state.players.values()), this.roomRef.state.level, this.teamBased);
    }

    allocateTeams(){
        var team1Count = 0;
        var team2Count = 0;
        this.roomRef.state.players.forEach(p => {
            var teamToChoose = team1Count < team2Count ? Constants.TEAM1 : Constants.TEAM2;
            if(!p.team && !p.type) {
                p.team = teamToChoose;
            } 
            if (!p.type){
                team1Count += (p.team == Constants.TEAM1 ? 1 : 0);
                team2Count += (p.team == Constants.TEAM2 ? 1 : 0);
            }
        });
    }

    onGameStart(){
        this.roomRef.broadcast('newGame', Array.from(this.roomRef.state.players.values()));
    }

    endCondition(): EndStatus {
        return new EndStatus(false);
    }

    onCollision(player1: Player, player2: Player, players: Player[] = []){

    }

    onPlayerDeath(player: Player, players: Player[] = [], level: Level = null){

    }

    onPlayerJoin(){

    }

    onTick(){
        
    }
}

export default GameMode;