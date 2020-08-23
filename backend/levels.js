
var Square = require('./square');
var Constants = require('./constants');
var Level = require('./level');

module.exports = {
    Basic: new Level([
        new Square(-1000, -Constants.HEIGHT / 2 - 500, 500, 3 * Constants.HEIGHT / 2 + 500), // Left wall
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2 - 500, 500, 3 * Constants.HEIGHT / 2 + 500), // Right wall
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2), // Standing platform
        new Square(-1000, -Constants.HEIGHT / 2 - 500, 2000 + Constants.WIDTH, 500, true), // Roof
    ], new Square(-500, -Constants.HEIGHT / 2, 100 + Constants.WIDTH, 3 * Constants.HEIGHT / 2), null, 1),
    Complex: new Level([
        new Square(-1000, -Constants.HEIGHT / 2, 500, 500), // Left square
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2, 500, 500), // Right square
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2), // Main platform
        new Square(-150, -600, 700, 100), // Left floater
        new Square(400, -175, 700, 100), // Right floater
        new Square(-2000, -1500, 500, 1500 + Constants.HEIGHT, true), // Left wall
        new Square(1500 + Constants.WIDTH, -1500, 500, 1500 + Constants.HEIGHT, true), // Right wall
        new Square(-2000, -1500, 4000 + Constants.WIDTH, 500, true), // Roof
    ], new Square(-1500, -1000, 3000 + Constants.WIDTH, 1000 + Constants.HEIGHT), null, 0.5),
    DeathWall: new Level([
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2)
    ], new Square(-200, -3000, Constants.WIDTH + 400, 3000 + Constants.HEIGHT / 2), 0.5, 0.2),
    Towers: new Level([
        new Square(-2000, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(Constants.WIDTH / 2, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(2000 + Constants.WIDTH, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2)
    ], new Square(-2000, - 3 * Constants.HEIGHT, 4000 + 2 * Constants.WIDTH, 2 * Constants.HEIGHT), 0.5, 0.5)
}