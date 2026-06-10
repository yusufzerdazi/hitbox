import Player from '../../players/player';
import Level from '../../level/level';
import { Brain } from './network';
import {
    OBSERVATION_BUILDERS,
    ACTIONS,
    ObservationBuilder,
} from './observation';

// Live-game / sim AI that picks actions via a trained Brain. The mode is
// passed in so the right observation encoder is used; if no encoder is
// registered (unknown mode) the player just stands still.

export default class NeuralAi extends Player {
    brain: Brain;
    mode: string;
    private observe: ObservationBuilder | null;

    constructor(
        colour: string,
        name: string,
        brain: Brain,
        mode: string,
        x: number | null = null,
        y: number | null = null
    ) {
        super(colour, name, x, y, true);
        this.brain = brain;
        this.mode = mode;
        this.observe = OBSERVATION_BUILDERS[mode] || null;
    }

    move(players: Player[], _serverTime: number, level: Level): void {
        if (!this.observe || !this.alive) return;
        const obs = this.observe({
            self: this,
            others: players,
            level,
            serverTime: _serverTime,
            mode: this.mode,
        });
        // Defensive: observation size could mismatch brain shape if the mode's
        // encoder evolved across training runs.
        if (obs.length !== this.brain.shape.inputSize) return;

        const out = this.brain.forward(obs);
        this.left = out[ACTIONS.LEFT] > 0.5;
        this.right = out[ACTIONS.RIGHT] > 0.5;
        this.space = out[ACTIONS.SPACE] > 0.5;
        this.down = out[ACTIONS.DOWN] > 0.5;
        this.boostLeft = out[ACTIONS.BOOST_LEFT] > 0.6;
        this.boostRight = out[ACTIONS.BOOST_RIGHT] > 0.6;
        this.clicked = out[ACTIONS.CLICK] > 0.7;
        // Boost-down is rolled into `down` already in the original physics
        // when in air; nothing further to set.
    }
}
