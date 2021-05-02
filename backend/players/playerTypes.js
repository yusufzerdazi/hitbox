class PlayerTypes {
    static players = (clients) => { return clients.filter(c => !c.player.orb && !["ball","flag"].includes(c.player.type)) }
    static humanPlayers = (clients) => { return clients.filter(c => c.player && !c.player.ai) }
    static aiPlayers = (clients) => { return clients.filter(c => c.player.ai && !c.player.orb && !["ball","flag"].includes(c.player.type)) }
    static livingPlayers = (clients) => { return clients.filter(c => c.player.alive); }
    static movingPlayers = (clients) => { return this.livingPlayers(clients).filter(c => !c.player.ducked && !c.player.attachedToPlayer); }
    static attachedPlayers = (clients) => { return this.livingPlayers(clients).filter(c => c.player.attachedToPlayer); }
    static vulnerablePlayers = (clients) => { return this.livingPlayers(clients).filter(c => c.player.invincibility == 0 && !c.player.attachedToPlayer); }
    static invulnerablePlayers = (clients) => { return this.livingPlayers(clients).filter(c => c.player.invincibility > 0); }
}

module.exports = PlayerTypes;