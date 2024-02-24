import Player from "./player"

class PlayerTypes {
    static players = (players: Player[]): Player[] => { return players.filter(p => !p.orb && !["ball","flag"].includes(p.type)) }
    static humanPlayers = (players: Player[]): Player[] => { return players.filter(p => p && !p.ai) }
    static aiPlayers = (players: Player[]): Player[] => { return players.filter(p => p.ai && !p.orb && !["ball","flag"].includes(p.type)) }
    static livingPlayers = (players: Player[]): Player[] => { return players.filter(p => p.alive); }
    static movingPlayers = (players: Player[]): Player[] => { return PlayerTypes.livingPlayers(players).filter(p => !p.ducked && !p.attachedToPlayer); }
    static attachedPlayers = (players: Player[]): Player[] => { return PlayerTypes.livingPlayers(players).filter(p => p.attachedToPlayer); }
    static vulnerablePlayers = (players: Player[]): Player[] => { return PlayerTypes.livingPlayers(players).filter(p => p.invincibility == 0 && !p.attachedToPlayer); }
    static invulnerablePlayers = (players: Player[]): Player[] => { return PlayerTypes.livingPlayers(players).filter(p => p.invincibility > 0); }
}

export default PlayerTypes;