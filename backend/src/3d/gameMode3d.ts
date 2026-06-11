import { Room } from "colyseus";
import Constants from '../constants';
import Utils from '../utils';
import EndStatus from '../ranking/endStatus';
import Levels3D from './levels3d';
import Level3D from './level3d';
import Player3D from './player3d';
import SimpleAi3D from './simpleAi3d';
import Box3D from './box3d';
import { Hitbox3DRoomState } from './roomState3d';

class GameMode3D {
    damageEnabled: boolean;
    playerDamage: number;
    possibleLevels: (() => Level3D)[];
    title: string;
    subtitle: string;
    roomRef: Room<Hitbox3DRoomState>;
    teamBased: boolean;

    constructor(roomRef: Room<Hitbox3DRoomState>) {
        this.possibleLevels = [Levels3D.Arena, Levels3D.Towers, Levels3D.Islands, Levels3D.Hills,
            Levels3D.Pyramid, Levels3D.Steps, Levels3D.Skyway, Levels3D.Donut, Levels3D.Twins,
            Levels3D.Moon, Levels3D.Canyon, Levels3D.Atoll];
        this.roomRef = roomRef;
    }

    getLevel(){
        var matchingLevels = this.possibleLevels.filter(l => l.name.toLowerCase() == this.roomRef.state?.map?.toLowerCase());
        matchingLevels = matchingLevels.length > 0 ? matchingLevels : this.possibleLevels;
        return matchingLevels[Math.floor(matchingLevels.length * Math.random())]();
    }

    setModeSpecificPlayers() {
        this.roomRef.state.players.forEach((player, clientId) => {
            if(player.ai && !player.type){
                var newAI = new SimpleAi3D(player.colour, player.name);
                newAI.score = player.score;
                newAI.clientId = player.clientId;
                this.roomRef.state.players.set(clientId, newAI);
            }
        });
    }

    addAiPlayer(){
        var newAI = new SimpleAi3D(Utils.randomColor(), Utils.generateName());
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

    onCollision(player1: Player3D, player2: Player3D, players: Player3D[] = []){

    }

    onPlayerDeath(player: Player3D, players: Player3D[] = [], level: Level3D = null){

    }

    onPlayerJoin(){

    }

    onTick(){

    }

    onLanding(platform: Box3D, player: Player3D) {

    }
}

export default GameMode3D;
