class Level {
    constructor(platforms, spawnArea, inAirBoostCooldown, scale){
        this.platforms = platforms;
        this.inAirBoostCooldown = inAirBoostCooldown;
        this.scale = scale;
        this.spawnArea = spawnArea;
    }
}

module.exports = Level;