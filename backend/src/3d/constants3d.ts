// 3D-specific constants. Everything that has a 2D equivalent keeps the same
// value as src/constants.ts so the two modes share one set of "rules";
// only genuinely new dimensions (depth axis, water plane) live here.
export default Object.freeze({
    WATERLEVEL: 0,        // y of the water surface (y is up in 3D)
    DROWNDEPTH: 150,      // how far below the surface a player drowns
    PLAYERDEPTH: 50,      // matches PLAYERWIDTH so the hitbox is a square prism
    INVINCIBILITYDECAY: 20,
});
