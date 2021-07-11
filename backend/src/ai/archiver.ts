import constants from "../constants";
import Level from "../level/level";
import Player from "../players/player";
import FileSystem from 'fs';
const CLOSEDISTANCE = 300;
const CLOSEOPPDISTANCE = 100;

class Archiver {
    data: any;

    constructor(){
       this.data = {};
    }

    replaceAll(str : string, find: string, replace : string) {
        return str.replace(new RegExp(find, 'g'), replace);
    }

    saveToFile(winner: Player){
        FileSystem.mkdirSync("./src/ai/data/", { recursive: true });
        var winnerData = this.data[winner.clientId];
        var winnerDataByAction : any = {};
        winnerData.forEach((d: any) => {
            if(winnerDataByAction[d[d.length - 1]]){
                winnerDataByAction[d[d.length - 1]].push([d]);
            } else {
                winnerDataByAction[d[d.length - 1]] = [[d]];
            }
        });
        var minData = null;
        for(var key of Object.keys(winnerDataByAction)){
            minData = Math.min(minData || 10000, winnerDataByAction[key].length);
        }
        console.log(minData);
        var finalData = [];
        for(var key of Object.keys(winnerDataByAction)){
            for(var d of winnerDataByAction[key].slice(0,minData)){
                finalData.push([d]);
            }
        }
        let csvContent = finalData.map(e => e.join(",")).join("\n") + "\n";
        if(!FileSystem.existsSync(`./src/ai/data/data.csv`)){
            FileSystem.appendFile(`./src/ai/data/data.csv`, "playersCloseLeft,playersCloseRight,playersCloseTop,playersCloseBottom,playersLeft,playersRight,playersTop,playersBottom,platformCloseLeft,platformCloseRight,platformCloseTop,platformCloseBottom,playerAction\n", (error) => {
                if (error) throw error;
            });
        }
        FileSystem.appendFile(`./src/ai/data/data.csv`, csvContent, (error) => {
            if (error) throw error;
        });
    }

    calculateAndSave(player: Player, players: Player[], level: Level){
        var state = this.calculateState(player, players, level);
        if(!this.data[player.clientId]){
            this.data[player.clientId] = [];
        }
        this.data[player.clientId].push(state);
    }

    calculateState(player: Player, players: Player[], level: Level) : any {
        var otherPlayers = players.filter(p => p.clientId != player.clientId);

        var playersCloseLeft = otherPlayers.filter(p => (this.playerX(p) < this.playerX(player)) && (Math.abs(this.playerX(p) - this.playerX(player)) < CLOSEDISTANCE) && (Math.abs(this.playerY(p) - this.playerY(player)) < CLOSEOPPDISTANCE)).length > 0;
        var playersCloseRight = otherPlayers.filter(p => (this.playerX(p) > this.playerX(player)) && (Math.abs(this.playerX(p) - this.playerX(player)) < CLOSEDISTANCE) && (Math.abs(this.playerY(p) - this.playerY(player)) < CLOSEOPPDISTANCE)).length > 0;
        var playersCloseTop = otherPlayers.filter(p => (this.playerY(p) < this.playerY(player)) && (Math.abs(this.playerY(p) - this.playerY(player)) < CLOSEDISTANCE) && (Math.abs(this.playerX(p) - this.playerX(player)) < CLOSEOPPDISTANCE)).length > 0;
        var playersCloseBottom = otherPlayers.filter(p => (this.playerY(p) > this.playerY(player)) && (Math.abs(this.playerY(p) - this.playerY(player)) < CLOSEDISTANCE) && (Math.abs(this.playerX(p) - this.playerX(player)) < CLOSEOPPDISTANCE)).length > 0;

        var playersLeft = otherPlayers.filter(p => (this.playerX(p) < this.playerX(player))).length > 0;
        var playersRight = otherPlayers.filter(p => (this.playerX(p) > this.playerX(player))).length > 0;
        var playersTop = otherPlayers.filter(p => (this.playerY(p) < this.playerY(player))).length > 0;
        var playersBottom = otherPlayers.filter(p => (this.playerY(p) > this.playerY(player))).length > 0;

        var platformCloseLeft = level.platforms.filter(p => (p.rightX() < this.playerX(player)) && (Math.abs(p.rightX() - this.playerX(player)) < CLOSEDISTANCE) && (p.topY() < this.playerY(player)) && (p.bottomY() > this.playerY(player))).length > 0;
        var platformCloseRight = level.platforms.filter(p => (p.leftX() > this.playerX(player)) && (Math.abs(p.leftX() - this.playerX(player)) < CLOSEDISTANCE) && (p.topY() < this.playerY(player)) && (p.bottomY() > this.playerY(player))).length > 0;
        var platformCloseTop = level.platforms.filter(p => (p.bottomY() < this.playerY(player)) && (Math.abs(p.bottomY() - this.playerY(player)) < CLOSEDISTANCE) && (p.leftX() < this.playerX(player)) && (p.rightX() > this.playerX(player))).length > 0;
        var platformCloseBottom = level.platforms.filter(p => (p.topY() > this.playerY(player)) && (Math.abs(p.topY() - this.playerY(player)) < CLOSEDISTANCE) && (p.leftX() < this.playerX(player)) && (p.rightX() > this.playerX(player))).length > 0;

        var playerAction = this.getPlayerAction(player);

        return [
            +playersCloseLeft,
            +playersCloseRight,
            +playersCloseTop,
            +playersCloseBottom,
            +playersLeft,
            +playersRight,
            +playersTop,
            +playersBottom,
            +platformCloseLeft,
            +platformCloseRight,
            +platformCloseTop,
            +platformCloseBottom,
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