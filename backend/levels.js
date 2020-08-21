
var Square = require('./square');
var Constants = require('./constants');
var Level = require('./level');

module.exports = {
    Basic: new Level([
        new Square(-1000, -Constants.HEIGHT / 2, 500, 3 * Constants.HEIGHT / 2),
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2, 500, 3 * Constants.HEIGHT / 2),
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2),
        new Square(-1000, -Constants.HEIGHT / 2 - 500, 2000 + Constants.WIDTH, 500, true)
    ], null, 1),
    Complex: new Level([
        new Square(-1000, -Constants.HEIGHT / 2, 500, 500),
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2, 500, 500),
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2),
        new Square(-150, -600, 700, 100),
        new Square(400, -175, 700, 100),
        new Square(-2000, -1500, 500, 1500 + Constants.HEIGHT, true),
        new Square(1500 + Constants.WIDTH, -1500, 500, 1500 + Constants.HEIGHT, true),
        new Square(-2000, -1500, 4000 + Constants.WIDTH, 500, true)
    ], null, 1),
    DeathWall: new Level([
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2)
    ], 0.5, 0.5),
    Towers: new Level([
        new Square(-2000, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(Constants.WIDTH / 2, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(2000 + Constants.WIDTH, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2)
    ], 0.5, 0.5)
}