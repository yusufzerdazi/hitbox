import constants from "../constants";
import Level from "../level/level";
import Player from "../players/player";
import {BlobServiceClient, ContainerClient} from '@azure/storage-blob';
import GameMode from "../game/gameMode";

const CLOSEDISTANCE = 300;
const CSVHEADER = "y,xVelocity,yVelocity,stamina,health,closestPlayerXDistance,closestPlayerYDistance,playersLeft,playersRight,playersTop,playersBottom,platformBelow,platformBelowRight,platformBelowLeft,platformLeft,platformRight,platformAbove,playerAction\n";

class Archiver {
    data: any;
    blobServiceClient: BlobServiceClient;
    containerClient: ContainerClient;

    constructor(){
        this.data = {};
        this.blobServiceClient = BlobServiceClient.fromConnectionString("DefaultEndpointsProtocol=https;AccountName=hitbox;AccountKey=/jPP0NL4UzS/+0VBso2FzWKEqM8Md0I0I5O91q6rE8fis7rLrrlRwXd3KS7yaQv5y9rqU3VguIa1y+NN3NxUTA==;EndpointSuffix=core.windows.net");
        this.containerClient = this.blobServiceClient.getContainerClient('history');
        this.containerClient.createIfNotExists();
    }

    replaceAll(str : string, find: string, replace : string) {
        return str.replace(new RegExp(find, 'g'), replace);
    }

    async saveToBlob(winner: Player, gameMode: GameMode){
        var winnerData = this.data[winner.clientId];
        var winnerDataByAction : any = {};
        winnerData.forEach((d: any) => {
            if(winnerDataByAction[d[d.length - 1]]){
                winnerDataByAction[d[d.length - 1]].push([d]);
            } else {
                winnerDataByAction[d[d.length - 1]] = [[d]];
            }
        });
        let csvContent = CSVHEADER + this.data[winner.clientId].map((e: any) => e.join(",")).join("\n") + "\n";
        var fileName = `${gameMode.constructor.name}/${gameMode.roomRef.state.level.name}/${winner.name}/${this.replaceAll(new Date().toISOString(), ":", "-")}.csv`;
        var blobClient = this.containerClient.getBlobClient(fileName);
        await blobClient.getBlockBlobClient().upload(csvContent, csvContent.length);
    }

    calculateAndSave(player: Player, players: Player[], level: Level){
        var state = this.calculateState(player, players, level);
        if(!this.data[player.clientId]){
            this.data[player.clientId] = [];
        }
        this.data[player.clientId].push(state);
    }

    normaliseToUnit(number: number){
        return (Math.exp(number / 500) - 1) / (Math.exp(number / 500) + 1);
    }

    calculateState(player: Player, players: Player[], level: Level) : any {
        var otherPlayers = players.filter(p => p.clientId != player.clientId);
        var closestPlayer : Player = null;
        var closestDistance = 10000;
        otherPlayers.forEach(p => {
            var distance = Math.sqrt(Math.pow(p.x - player.x, 2) + Math.pow(p.y - player.y, 2));
            if(distance < closestDistance){
                closestDistance = distance;
                closestPlayer = p;
            }
        });

        var closestPlayerXDistance = closestPlayer ? player.x - closestPlayer.x : 0;
        var closestPlayerYDistance = closestPlayer ? player.y - closestPlayer.y : 0;

        var playersLeft = otherPlayers.filter(p => (this.playerX(p) < this.playerX(player))).length;
        var playersRight = otherPlayers.filter(p => (this.playerX(p) > this.playerX(player))).length;
        var playersTop = otherPlayers.filter(p => (this.playerY(p) < this.playerY(player))).length;
        var playersBottom = otherPlayers.filter(p => (this.playerY(p) > this.playerY(player))).length;

        var platformBelow = level.platforms.filter(p => (p.topY() > this.playerY(player)) && (Math.abs(p.topY() - this.playerY(player)) < CLOSEDISTANCE) && (p.leftX() < this.playerX(player)) && (p.rightX() > this.playerX(player))).length > 0;
        var platformBelowRight = level.platforms.filter(p => (p.topY() > this.playerY(player)) && (Math.abs(p.topY() - this.playerY(player)) < CLOSEDISTANCE) && (p.leftX() < (this.playerX(player) + 100)) && (p.rightX() > (this.playerX(player) + 100))).length > 0;
        var platformBelowLeft = level.platforms.filter(p => (p.topY() > this.playerY(player)) && (Math.abs(p.topY() - this.playerY(player)) < CLOSEDISTANCE) && (p.leftX() < (this.playerX(player) - 100)) && (p.rightX() > (this.playerX(player) - 100))).length > 0;
        var platformLeft = level.platforms.filter(p => (p.rightX() < this.playerX(player)) && (Math.abs(p.rightX() - this.playerX(player)) < CLOSEDISTANCE) && (p.topY() < this.playerY(player)) && (p.bottomY() > this.playerY(player))).length > 0;
        var platformRight = level.platforms.filter(p => (p.leftX() > this.playerX(player)) && (Math.abs(p.leftX() - this.playerX(player)) < CLOSEDISTANCE) && (p.topY() < this.playerY(player)) && (p.bottomY() > this.playerY(player))).length > 0;
        var platformAbove = level.platforms.filter(p => (p.bottomY() < this.playerY(player)) && (Math.abs(p.bottomY() - this.playerY(player)) < CLOSEDISTANCE) && (p.leftX() < this.playerX(player)) && (p.rightX() > this.playerX(player))).length > 0;

        var playerAction = this.getPlayerAction(player);

        return [
            this.normaliseToUnit(player.y),
            player.xVelocity / constants.TERMINAL,
            player.yVelocity / constants.TERMINAL,
            player.boostCooldown / 100,
            player.health / 100,
            this.normaliseToUnit(closestPlayerXDistance),
            this.normaliseToUnit(closestPlayerYDistance),
            +playersLeft,
            +playersRight,
            +playersTop,
            +playersBottom,
            +platformBelow,
            +platformBelowRight,
            +platformBelowLeft,
            +platformLeft,
            +platformRight,
            +platformAbove,
            playerAction
        ];
    }

    getPlayerAction(player: Player) {
        if(player.space){
            return 1; //"jump";;
        }
        if(player.down){
            return 2;//"down";
        }
        if(player.boostLeft && !(player.boostLeft && player.boostRight)){
            return 3;//"boostLeft";
        }
        if(player.boostRight && !(player.boostLeft && player.boostRight)){
            return 4;//"boostRight";
        }
        if(player.left && !(player.left && player.right)){
            return 5;//"left";
        }
        if(player.right && !(player.left && player.right)){
            return 6;//"right";
        }
        return 0;//"none";
    }

    playerX(player: Player) : number {
        return player.x + constants.PLAYERWIDTH / 2;
    }

    playerY(player: Player) : number {
        return player.y + constants.PLAYERHEIGHT / 2;
    }
}

export default Archiver;