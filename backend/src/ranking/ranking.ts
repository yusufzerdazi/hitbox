import { Room } from 'colyseus';
import { PlayFabServer } from 'playfab-sdk';
import { HitboxRoomState } from '../rooms/schema/HitboxRoomState';
import EndStatus from './endStatus';
var EloRating = require('elo-rating');

PlayFabServer.settings.titleId = 'B15E8';
PlayFabServer.settings.developerSecretKey = "***REMOVED***";

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
            PlayFabServer.UpdatePlayerStatistics({
                Statistics: [
                    {
                        StatisticName: "wins",
                        Value: 1
                    }
                ],
                PlayFabId: endStatus.winner.id
            }, () => {});
            
            roomRef.state.players.forEach(p => {
                if(p.clientId != endStatus.winner.clientId && !p.type){
                    var newElo = EloRating.calculate(endStatus.winner.rank || 1000, p.rank || 1000);
                    eloRatingChanges[endStatus.winner.clientId] = (eloRatingChanges[endStatus.winner.clientId] || 0) + (newElo.playerRating - (endStatus.winner.rank || 1000));
                    eloRatingChanges[p.clientId] = (newElo.opponentRating - p.rank || 1000);
                    PlayFabServer.UpdatePlayerStatistics({
                        Statistics: [
                            {
                                StatisticName: "losses",
                                Value: 1
                            }
                        ],
                        PlayFabId: p.id
                    }, () => {});
                }
            })

            for(var key in eloRatingChanges){
                var player = roomRef.state.players.get(key);
                player.rank = (player.rank || 1000) + eloRatingChanges[key];
                PlayFabServer.UpdatePlayerStatistics({
                    Statistics: [
                        {
                            StatisticName: "rank",
                            Value: player.rank
                        }
                    ],
                    PlayFabId: player.id
                }, () => {});
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
                PlayFabServer.UpdatePlayerStatistics({
                    Statistics: [
                        {
                            StatisticName: "rank",
                            Value: w.rank
                        },
                        {
                            StatisticName: "wins",
                            Value: 1
                        }
                    ],
                    PlayFabId: w.id
                }, () => {});
            });
            endStatus.losers.forEach(l => {
                l.rank = (l.rank || 1000) + eloRatingChanges[l.clientId] / endStatus.winners.length;
                PlayFabServer.UpdatePlayerStatistics({
                    Statistics: [
                        {
                            StatisticName: "rank",
                            Value: l.rank
                        },
                        {
                            StatisticName: "losses",
                            Value: 1
                        }
                    ],
                    PlayFabId: l.id
                }, () => {});
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