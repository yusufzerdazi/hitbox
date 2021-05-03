import Player from "../players/player";

class EndStatus {
    end: boolean;
    winner: Player;
    winners: Player[];
    losers: Player[];
    winningTeam: string;

    constructor(end: boolean, winner: Player = null, winners: Player[] = null,
            losers: Player[] = null, winningTeam: string = null){
        this.end = end;
        this.winner = winner;
        this.winners = winners;
        this.losers = losers;
        this.winningTeam = winningTeam;
    }
}

export default EndStatus