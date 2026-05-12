
import Square from './square';
import Slope from './slope';
import Shape from './shape';
import Constants from '../constants';
import Level from './level';
import { ArraySchema } from '@colyseus/schema';
import Tree from './tree';
import House from './house';

// Build a rolling hill from a cosine profile: gentle at the foot, steep at the
// flank, gentle at the peak. Each segment becomes a Slope; a Square is added
// underneath any non-bottom segment so the hill reads as a solid mass rather
// than floating triangles.
function makeHill(
    startX: number,
    width: number,
    peakHeight: number,
    floorTop: number,
    segments: number = 8
): Shape[] {
    // Fills are emitted before slopes so they render *behind* the slope's
    // green strip — otherwise the fill would cover the strip's natural
    // overhang past the slope's bbox.
    const fills: Shape[] = [];
    const slopes: Shape[] = [];
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = startX + t * width;
        const y = floorTop - peakHeight * (1 - Math.cos(2 * Math.PI * t)) / 2;
        points.push({ x, y });
    }
    for (let i = 0; i < segments; i++) {
        const a = points[i];
        const b = points[i + 1];
        const w = b.x - a.x;
        if (Math.abs(a.y - b.y) < 0.5) continue;
        if (a.y > b.y) {
            // Going up-right: y decreases with x.
            slopes.push(new Slope(a.x, b.y, w, a.y - b.y, "up-right"));
            if (a.y < floorTop) {
                fills.push(new Square(a.x, a.y, w, floorTop - a.y, "hillfill"));
            }
        } else {
            // Going down-right: y increases with x.
            slopes.push(new Slope(a.x, a.y, w, b.y - a.y, "up-left"));
            if (b.y < floorTop) {
                fills.push(new Square(a.x, b.y, w, floorTop - b.y, "hillfill"));
            }
        }
    }
    return [...fills, ...slopes];
}

export default {
    Basic: () => new Level("Basic", new ArraySchema<Square>(
        new Square(-1500, -Constants.HEIGHT / 2 - 1000, 500, 3 * Constants.HEIGHT / 2 + 1000, "border"), // Left wall
        new Square(Constants.WIDTH + 1000, -Constants.HEIGHT / 2 - 1000, 500, 3 * Constants.HEIGHT / 2 + 1000, "border"), // Right wall
        new Square(-450, Constants.HEIGHT / 2, Constants.WIDTH + 900, Constants.HEIGHT / 2), // Standing platform
        new Square(-1500, -Constants.HEIGHT / 2 - 1000, 3000 + Constants.WIDTH, 500, "border") // Roof
    ), new Square(-1000, -Constants.HEIGHT / 2 - 500, 2000 + Constants.WIDTH, 500 + Constants.HEIGHT), null, null),
    Box: () => new Level("Box", new ArraySchema<Square>(
        new Square(-1500, -Constants.HEIGHT / 2 - 1000, 500, 3 * Constants.HEIGHT / 2 + 1000, "border"), // Left wall
        new Square(Constants.WIDTH + 1000, -Constants.HEIGHT / 2 - 1000, 500, 3 * Constants.HEIGHT / 2 + 1000, "border"), // Right wall
        new Square(-1000, Constants.HEIGHT / 2, Constants.WIDTH + 2000, Constants.HEIGHT / 2), // Standing platform
        new Square(-1500, -Constants.HEIGHT / 2 - 1000, 3000 + Constants.WIDTH, 500, "border") // Roof
    ), new Square(-1000, -Constants.HEIGHT / 2 - 500, 2000 + Constants.WIDTH, 500 + Constants.HEIGHT), null, null),
    Complex: () => new  Level("Complex", new ArraySchema<Square>(
        new Square(-1000, -Constants.HEIGHT / 2, 500, 500), // Left square
        new Square(Constants.WIDTH + 500, -Constants.HEIGHT / 2, 500, 500), // Right square
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2), // Main platform
        new Square(-150, -600, 700, 100), // Left floater
        new Square(400, -175, 700, 100), // Right floater
        new Square(-2000, -1000, 500, 1500 + Constants.HEIGHT, "border"), // Left wall
        new Square(1500 + Constants.WIDTH, -1000, 500, 1500 + Constants.HEIGHT, "border"), // Right wall
        new Square(-2000, -1500, 4000 + Constants.WIDTH, 500, "border"), // Roof
    ), new Square(-1500, -1000, 3000 + Constants.WIDTH, 1000 + Constants.HEIGHT), null, null),
    DeathWall: () => new Level("Infinity", new ArraySchema<Square>(
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2)
    ), new Square(-200, -3000, Constants.WIDTH + 400, 3000 + Constants.HEIGHT / 2), 0.5, 0.2),
    Towers: () => new Level("Towers", new ArraySchema<Square>(
        new Square(-2000, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(Constants.WIDTH / 2, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Square(2000 + Constants.WIDTH, - Constants.HEIGHT, Constants.WIDTH, Constants.HEIGHT * 2),
        new Tree(Constants.WIDTH, - Constants.HEIGHT, 400, 600)
    ), new Square(-2000, - 3 * Constants.HEIGHT, 4000 + 2 * Constants.WIDTH, 2 * Constants.HEIGHT), 0.5, null),
    Maze: () => new Level("Maze", new ArraySchema<Square>(
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
        new Square(-2000, -9 * Constants.HEIGHT / 2, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(Constants.WIDTH + 1500, -9 * Constants.HEIGHT / 2, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(-2000, -9 * Constants.HEIGHT / 2 - 500, Constants.WIDTH + 4000, 500, "border"),
    ), new Square(-1000, -9 * Constants.HEIGHT / 2, Constants.WIDTH + 2000, 5 * Constants.HEIGHT), null, null),
    Spleef: () => new Level("Spleef", new ArraySchema<Square>(
        new Square(-1000, -Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200), // Layer 1
        new Square(Constants.WIDTH / 4 - 400, -Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(Constants.WIDTH / 2 + 200, -Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(3 * Constants.WIDTH / 4 + 800, -Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(Constants.WIDTH / 4 - 400, -3 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200), // Layer 2
        new Square(-1000, -3 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(3 * Constants.WIDTH / 4 + 800, -3 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(Constants.WIDTH / 2 + 200, -3 *Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(-1000, - 5 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200), // Layer 3
        new Square(Constants.WIDTH / 4 - 400, -5 *Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(Constants.WIDTH / 2 + 200, -5 *Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(3 * Constants.WIDTH / 4 + 800, -5 *Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(Constants.WIDTH / 4 - 400, -7 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200), // Layer 4
        new Square(-1000, -7 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(Constants.WIDTH / 2 + 200, -7 *Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200),
        new Square(3 * Constants.WIDTH / 4 + 800, -7 * Constants.HEIGHT / 2, Constants.WIDTH / 4 + 200, 200)
    ), new Square(-1000, -9 * Constants.HEIGHT / 2, Constants.WIDTH + 2000, 5 * Constants.HEIGHT), 0.5, null),
    Island: () => new Level("Island", new ArraySchema<Square>(
        new Square(-1000, Constants.HEIGHT / 2, Constants.WIDTH + 2000, Constants.HEIGHT / 2), // Ground
        new Tree(3 * Constants.WIDTH / 2, Constants.HEIGHT / 2, 400, 500),
        new House(-200, Constants.HEIGHT / 2, 800, 500)
    ), new Square(-1000, -3 * Constants.HEIGHT / 2, Constants.WIDTH + 2000, 2 * Constants.HEIGHT), 0.5, 0.5),
    Space: () => new Level("Space", new ArraySchema<Square>(
        new Square(-1500, 2 * Constants.HEIGHT, Constants.WIDTH + 3000, Constants.HEIGHT / 2), // Ground
        new Square(-2000, -9 * Constants.HEIGHT / 2, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(Constants.WIDTH + 1500, -9 * Constants.HEIGHT / 2, 500, 11 * Constants.HEIGHT / 2 + 500, "border"),
        new Square(-2000, -9 * Constants.HEIGHT / 2 - 500, Constants.WIDTH + 4000, 500, "border"),
    ), new Square(-1500, -3 * Constants.HEIGHT / 2, Constants.WIDTH + 3000, 2 * Constants.HEIGHT), null, null, 0.6),
    LongIsland: () => new Level("Long Island", new ArraySchema<Square>(
        new Square(-3000, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM1),
        new Square(Constants.WIDTH + 2500, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM2),
        new Square(-3000, Constants.HEIGHT / 2, Constants.WIDTH + 6000, Constants.HEIGHT / 2)
    ), new Square(-2500, -3 * Constants.HEIGHT / 2, Constants.WIDTH + 5000, 2 * Constants.HEIGHT), 0.5, null),
    Mountain: () => new Level("Mountain", new ArraySchema<Square>(
        new Square(-4000, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM1),
        new Square(Constants.WIDTH + 3500, - Constants.HEIGHT, 500, 2 * Constants.HEIGHT, "goal", Constants.TEAM2),
        new Square(-4000, Constants.HEIGHT / 2, Constants.WIDTH + 8000, Constants.HEIGHT / 2),
        new Square(-3000, - Constants.HEIGHT / 2, Constants.WIDTH + 6000, 3 * Constants.HEIGHT / 2),
        new Square(-2000, - 3 * Constants.HEIGHT / 2, Constants.WIDTH + 4000, 2 * Constants.HEIGHT),
        new Square(-1000, - 5 * Constants.HEIGHT / 2, Constants.WIDTH + 2000, 2 * Constants.HEIGHT),
        new Square(0, - 7 * Constants.HEIGHT / 2, Constants.WIDTH, 2 * Constants.HEIGHT),
        new Tree(500, - 7 * Constants.HEIGHT / 2, 400, 500),
    ), new Square(-3500, -7 * Constants.HEIGHT / 2, Constants.WIDTH + 7000, 4 * Constants.HEIGHT), 0.5, null),
    Hills: () => new Level("Hills", new ArraySchema<Shape>(
        // Open ground floor — no border walls or roof, players fall off the sides.
        new Square(-500, Constants.HEIGHT / 2, 5500, Constants.HEIGHT / 2),
        // Five rolling hills with smooth cosine profiles and varied gradients.
        ...makeHill(50, 400, 70, Constants.HEIGHT / 2, 6),       // small mound
        ...makeHill(550, 850, 200, Constants.HEIGHT / 2, 8),     // big rolling hill
        ...makeHill(1500, 400, 90, Constants.HEIGHT / 2, 6),     // small hill
        ...makeHill(2050, 1200, 300, Constants.HEIGHT / 2, 10),  // tallest peak
        ...makeHill(3400, 700, 150, Constants.HEIGHT / 2, 8),    // medium hill
    ), new Square(-500, -1000, 5500, 1000 + Constants.HEIGHT), 0.5, null),
    Halfpipe: () => new Level("Halfpipe", new ArraySchema<Shape>(
        // Borders enclose the bowl
        new Square(-2500, -1500, 500, 1500 + Constants.HEIGHT, "border"),
        new Square(Constants.WIDTH + 2000, -1500, 500, 1500 + Constants.HEIGHT, "border"),
        new Square(-2500, -1500, 4500 + Constants.WIDTH, 500, "border"),
        // Flat floor in the middle
        new Square(-200, Constants.HEIGHT / 2, Constants.WIDTH + 400, Constants.HEIGHT / 2),
        // Visual fills below each ramp's bbox so the bowl reads as a solid
        // mass instead of a slope floating over sky. Listed before the slopes
        // so they render behind the green strip.
        new Square(-2000, Constants.HEIGHT / 2, 1800, Constants.HEIGHT / 2, "hillfill"),
        new Square(Constants.WIDTH + 200, Constants.HEIGHT / 2, 1800, Constants.HEIGHT / 2, "hillfill"),
        // Left ramp curving up to the wall
        new Slope(-2000, -Constants.HEIGHT / 2, 1800, Constants.HEIGHT, "up-left"),
        // Right ramp curving up to the wall
        new Slope(Constants.WIDTH + 200, -Constants.HEIGHT / 2, 1800, Constants.HEIGHT, "up-right"),
    ), new Square(-2000, -1000, 4000 + Constants.WIDTH, 1000 + Constants.HEIGHT), null, null),
    Pyramid: () => new Level("Pyramid", new ArraySchema<Shape>(
        new Square(-1500, -1500, 500, 1500 + Constants.HEIGHT, "border"),
        new Square(Constants.WIDTH + 1000, -1500, 500, 1500 + Constants.HEIGHT, "border"),
        new Square(-1500, -1500, 3000 + Constants.WIDTH, 500, "border"),
        // Ground
        new Square(-1000, Constants.HEIGHT / 2, 2000 + Constants.WIDTH, Constants.HEIGHT / 2),
        // Visual fill for the hollow interior between the two ramps so the
        // pyramid reads as a solid mass. Drawn before the slopes/top platform.
        new Square(Constants.WIDTH / 2 - 100, -200, 200, 470, "hillfill"),
        // Left ramp of pyramid
        new Slope(Constants.WIDTH / 2 - 600, -200, 500, 470, "up-right"),
        // Flat top platform (high ground)
        new Square(Constants.WIDTH / 2 - 100, -200, 200, 30),
        // Right ramp of pyramid
        new Slope(Constants.WIDTH / 2 + 100, -200, 500, 470, "up-left"),
    ), new Square(-1000, -1000, 2000 + Constants.WIDTH, 1000 + Constants.HEIGHT), null, null)
}