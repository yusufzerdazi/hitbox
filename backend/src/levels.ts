
import Square from './square';
import Constants from './constants';
import Level from './level';
import { ArraySchema } from '@colyseus/schema';

export default {
    Basic: new Level(new ArraySchema<Square>(
        new Square(-1500, -Constants.HEIGHT / 2 - 1000, 500, 3 * Constants.HEIGHT / 2 + 1000, "border"), // Left wall
        new Square(Constants.WIDTH + 1000, -Constants.HEIGHT / 2 - 1000, 500, 3 * Constants.HEIGHT / 2 + 1000, "border"), // Right wall
        new Square(-450, Constants.HEIGHT / 2, Constants.WIDTH + 900, Constants.HEIGHT / 2), // Standing platform
        new Square(-1500, -Constants.HEIGHT / 2 - 1000, 3000 + Constants.WIDTH, 500, "border") // Roof
    ), new Square(-1000, -Constants.HEIGHT / 2 - 500, 2000 + Constants.WIDTH, 500 + Constants.HEIGHT), null, null),
    Complex: new Level(new ArraySchema<Square>(
        new Square(-1000, -Constants.HEIGHT / 2, 500, 500), // Left square
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2, 500, 500), // Right square
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2), // Main platform
        new Square(-150, -600, 700, 100), // Left floater
        new Square(400, -175, 700, 100), // Right floater
        new Square(-2000, -1500, 500, 1500 + Constants.HEIGHT, "border"), // Left wall
        new Square(1500 + Constants.WIDTH, -1500, 500, 1500 + Constants.HEIGHT, "border"), // Right wall
        new Square(-2000, -1500, 4000 + Constants.WIDTH, 500, "border"), // Roof
    ), new Square(-1500, -1000, 3000 + Constants.WIDTH, 1000 + Constants.HEIGHT), null, null),
    DeathWall: new Level(new ArraySchema<Square>(
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2)
    ), new Square(-200, -3000, Constants.WIDTH + 400, 3000 + Constants.HEIGHT / 2), 0.5, 0.2),
    Towers: new Level(new ArraySchema<Square>(
        new Square(-2000, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(Constants.WIDTH / 2, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(2000 + Constants.WIDTH, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2)
    ), new Square(-2000, - 3 * Constants.HEIGHT, 4000 + 2 * Constants.WIDTH, 2 * Constants.HEIGHT), 0.5, null),
    Maze: new Level(new ArraySchema<Square>(
        new Square(-1000, Constants.HEIGHT / 2, Constants.WIDTH + 2000, Constants.HEIGHT / 2), // Ground
        new Square(-1000, -Constants.HEIGHT / 2, Constants.WIDTH / 2 + 800, 200), // Layer 1
        new Square(Constants.WIDTH / 2 + 200, -Constants.HEIGHT / 2, Constants.WIDTH / 2 + 800, 200),
        new Square(Constants.WIDTH / 4 - 400, -3 * Constants.HEIGHT / 2, Constants.WIDTH / 2 + 800, 200), // Layer 2
        new Square(-1000, -3 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(3 * Constants.WIDTH / 4 + 800, -3 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(-1000, - 5 * Constants.HEIGHT / 2, Constants.WIDTH / 2 + 800, 200), // Layer 3
        new Square(Constants.WIDTH / 2 + 200, -5 *Constants.HEIGHT / 2, Constants.WIDTH / 2 + 800, 200),
        new Square(Constants.WIDTH / 4 - 400, -7 * Constants.HEIGHT / 2, Constants.WIDTH / 2 + 800, 200), // Layer 4
        new Square(-1000, -7 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(3 * Constants.WIDTH / 4 + 800, -7 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(-2000, -9 * Constants.HEIGHT / 2 - 500, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(Constants.WIDTH + 1500, -9 * Constants.HEIGHT / 2 - 500, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(-2000, -9 * Constants.HEIGHT / 2 - 500, Constants.WIDTH + 4000, 500, "border"),
    ), new Square(-1000, -9 * Constants.HEIGHT / 2, Constants.WIDTH + 2000, 5 * Constants.HEIGHT), null, null),
    Island: new Level(new ArraySchema<Square>(
        new Square(-1000, Constants.HEIGHT / 2, Constants.WIDTH + 2000, Constants.HEIGHT / 2), // Ground
    ), new Square(-1000, -3 * Constants.HEIGHT / 2, Constants.WIDTH + 2000, 2 * Constants.HEIGHT), 0.5, 0.5),
    Space: new Level(new ArraySchema<Square>(
        new Square(-1500, 2 * Constants.HEIGHT, Constants.WIDTH + 3000, Constants.HEIGHT / 2), // Ground
        new Square(-2000, -9 * Constants.HEIGHT / 2 - 500, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(Constants.WIDTH + 1500, -9 * Constants.HEIGHT / 2 - 500, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(-2000, -9 * Constants.HEIGHT / 2 - 500, Constants.WIDTH + 4000, 500, "border"),
    ), new Square(-1500, -3 * Constants.HEIGHT / 2, Constants.WIDTH + 3000, 2 * Constants.HEIGHT), null, null, 0.6),
    LongIsland: new Level(new ArraySchema<Square>(
        new Square(-3000, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM1),
        new Square(Constants.WIDTH + 2500, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM2),
        new Square(-3000, Constants.HEIGHT / 2, Constants.WIDTH + 6000, Constants.HEIGHT / 2), 
    ), new Square(-2500, -3 * Constants.HEIGHT / 2, Constants.WIDTH + 5000, 2 * Constants.HEIGHT), 0.5, null),
    Mountain: new Level(new ArraySchema<Square>(
        new Square(-4000, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM1),
        new Square(Constants.WIDTH + 3500, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM2),
        new Square(-4000, Constants.HEIGHT / 2, Constants.WIDTH + 8000, Constants.HEIGHT / 2), 
        new Square(-3000, - Constants.HEIGHT / 2, Constants.WIDTH + 6000, 3 * Constants.HEIGHT / 2), 
        new Square(-2000, - 3 * Constants.HEIGHT / 2, Constants.WIDTH + 4000, 2 * Constants.HEIGHT), 
        new Square(-1000, - 5 * Constants.HEIGHT / 2, Constants.WIDTH + 2000, 2 * Constants.HEIGHT), 
        new Square(0, - 7 * Constants.HEIGHT / 2, Constants.WIDTH, 2 * Constants.HEIGHT), 
    ), new Square(-3500, -7 * Constants.HEIGHT / 2, Constants.WIDTH + 7000, 4 * Constants.HEIGHT), 0.5, null)
}