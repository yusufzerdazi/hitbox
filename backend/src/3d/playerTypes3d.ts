import Player3D from "./player3d";

class PlayerTypes3D {
    static players = (players: Player3D[]): Player3D[] => players.filter(p => !p.orb && !["ball", "flag"].includes(p.type));
    static humanPlayers = (players: Player3D[]): Player3D[] => players.filter(p => p && !p.ai);
    static aiPlayers = (players: Player3D[]): Player3D[] => players.filter(p => p.ai && !p.orb && !["ball", "flag"].includes(p.type));
    static livingPlayers = (players: Player3D[]): Player3D[] => players.filter(p => p.alive);
    static movingPlayers = (players: Player3D[]): Player3D[] => PlayerTypes3D.livingPlayers(players).filter(p => !p.ducked && !p.attachedToPlayer);
    static attachedPlayers = (players: Player3D[]): Player3D[] => PlayerTypes3D.livingPlayers(players).filter(p => p.attachedToPlayer);
    static vulnerablePlayers = (players: Player3D[]): Player3D[] => PlayerTypes3D.livingPlayers(players).filter(p => p.invincibility == 0 && !p.attachedToPlayer);
    static invulnerablePlayers = (players: Player3D[]): Player3D[] => PlayerTypes3D.livingPlayers(players).filter(p => p.invincibility > 0);
}

export default PlayerTypes3D;
