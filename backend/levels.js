
var Square = require('./square');
var Constants = require('./constants');

module.exports = {
    'basic': [
        new Square(-1000, -Constants.HEIGHT / 2, 500, 3 * Constants.HEIGHT / 2),
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2, 500, 3 * Constants.HEIGHT / 2),
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2),
        new Square(-1000, -Constants.HEIGHT / 2 - 500, 2000 + Constants.WIDTH, 500, true)
    ],
    'complex': [
        new Square(-1000, -Constants.HEIGHT / 2, 500, 3 * Constants.HEIGHT / 2),
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2, 500, 3 * Constants.HEIGHT / 2),
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2),
        new Square(-150, -250, 400, 200),
        new Square(600, -175, 500, 100),
        new Square(-2000, -1500, 500, 1500 + Constants.HEIGHT, true),
        new Square(1500 + Constants.WIDTH, -1500, 500, 1500 + Constants.HEIGHT, true),
        new Square(-2000, -1500, 4000 + Constants.WIDTH, 500, true)
    ]
}