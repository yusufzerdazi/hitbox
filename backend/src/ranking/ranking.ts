import { Room } from 'colyseus';
import { PlayFabClient } from 'playfab-sdk';
import { HitboxRoomState } from '../rooms/schema/HitboxRoomState';
import EndStatus from './endStatus';
var EloRating = require('elo-rating');

PlayFabClient.settings.titleId = 'B15E8';
PlayFabClient.settings.developerSecretKey = "***REMOVED***";

class Ranking {
    calculateRank(endStatus: EndStatus, roomRef: Room<HitboxRoomState>) {
        if(endStatus.winner) {
            this.calculateIndividualRank(endStatus, roomRef);
        } else if(endStatus.winners){
            this.calculateTeamRank(endStatus, roomRef);
        }
    }

    private calculateIndividualRank(endStatus: EndStatus, roomRef: Room<HitboxRoomState>){
        if(!this.anyAiPlayers(roomRef)){
            var eloRatingChanges: any = {};
            roomRef.state.players.forEach(p => {
                if(p.clientId != endStatus.winner.clientId && !p.type){
                    var newElo = EloRating.calculate(endStatus.winner.rank || 1000, p.rank || 1000);
                    eloRatingChanges[endStatus.winner.clientId] = (eloRatingChanges[endStatus.winner.clientId] || 0) + (newElo.playerRating - (endStatus.winner.rank || 1000));
                    eloRatingChanges[p.clientId] = (newElo.opponentRating - p.rank || 1000);
                    roomRef.clients.filter(c => c.id == p.clientId)[0].send("loss");
                }
            })

            for(var key in eloRatingChanges){
                var player = roomRef.state.players.get(key);
                player.rank = (player.rank || 1000) + eloRatingChanges[key];
                roomRef.clients.filter(c => c.id == player.clientId)[0].send("rank", player.rank);
            }
        }
        endStatus.winner.score += 1;
        roomRef.broadcast('winner', endStatus.winner);
    }

    private calculateTeamRank(endStatus: EndStatus, roomRef: Room<HitboxRoomState>){
        if(!this.anyAiPlayers(roomRef)){
            var eloRatingChanges: any = {};
            endStatus.winners.forEach(w => {
                endStatus.losers.forEach(l => {
                    var newElo = EloRating.calculate(w.rank || 1000, l.rank || 1000);
                    eloRatingChanges[w.clientId] = (eloRatingChanges[w.clientId] || 0) + (newElo.playerRating - (w.rank || 1000));
                    eloRatingChanges[l.clientId] = (eloRatingChanges[l.clientId] || 0) + (newElo.opponentRating - (l.rank || 1000));
                });
            });
            endStatus.winners.forEach(w => {
                w.rank = (w.rank || 1000) + eloRatingChanges[w.clientId] / endStatus.losers.length;
                roomRef.clients.filter(c => c.id == w.clientId)[0].send("rank", w.rank);
                roomRef.clients.filter(c => c.id == w.clientId)[0].send("win");
            });
            endStatus.losers.forEach(l => {
                l.rank = (l.rank || 1000) + eloRatingChanges[l.clientId] / endStatus.winners.length;
                roomRef.clients.filter(c => c.id == l.clientId)[0].send("rank", l.rank);
                roomRef.clients.filter(c => c.id == l.clientId)[0].send("loss");
            });
        }
        endStatus.winners.forEach(w => {
            w.score += 1;
        });
        roomRef.broadcast('winner', {name: endStatus.winningTeam + " team"});
    }

    private anyAiPlayers(roomRef: Room<HitboxRoomState>){
        var aiPlayers = false;
        roomRef.state.players.forEach(p => {
            if(p.ai && !p.type){
                aiPlayers = true;
            }
        })
        return aiPlayers;
    }
}

export default Ranking