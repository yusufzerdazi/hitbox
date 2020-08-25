class Level {
    constructor(platforms, spawnArea, inAirBoostCooldown, scale, gravity = 1){
        this.platforms = platforms;
        this.inAirBoostCooldown = inAirBoostCooldown;
        this.scale = scale;
        this.spawnArea = spawnArea;
        this.gravity = gravity;
        this.maxDistance = 8761 * 50;
    }
}

module.exports = Level;