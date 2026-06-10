// Tiny dense MLP used as the policy network for evolved agents.
// One hidden layer with tanh, sigmoid outputs (each output is a boolean action).
// Weights are flat Float32Arrays so they can be cheaply cloned, mutated, and
// serialized to JSON for checkpointing.

export interface BrainShape {
    inputSize: number;
    hiddenSize: number;
    outputSize: number;
}

export interface BrainJSON {
    shape: BrainShape;
    weights: number[];
    biases: number[];
}

export class Brain {
    shape: BrainShape;
    // Layer 1: inputSize x hiddenSize, layer 2: hiddenSize x outputSize.
    private w1: Float32Array;
    private b1: Float32Array;
    private w2: Float32Array;
    private b2: Float32Array;
    private h: Float32Array;
    private out: Float32Array;

    constructor(shape: BrainShape) {
        this.shape = shape;
        this.w1 = new Float32Array(shape.inputSize * shape.hiddenSize);
        this.b1 = new Float32Array(shape.hiddenSize);
        this.w2 = new Float32Array(shape.hiddenSize * shape.outputSize);
        this.b2 = new Float32Array(shape.outputSize);
        this.h = new Float32Array(shape.hiddenSize);
        this.out = new Float32Array(shape.outputSize);
    }

    static random(shape: BrainShape, scale = 0.5): Brain {
        const b = new Brain(shape);
        // Xavier-ish initialization keeps activations centred even with tanh.
        const s1 = scale / Math.sqrt(shape.inputSize);
        const s2 = scale / Math.sqrt(shape.hiddenSize);
        for (let i = 0; i < b.w1.length; i++) b.w1[i] = randn() * s1;
        for (let i = 0; i < b.w2.length; i++) b.w2[i] = randn() * s2;
        return b;
    }

    forward(input: Float32Array | number[]): Float32Array {
        const { inputSize, hiddenSize, outputSize } = this.shape;
        const h = this.h;
        for (let j = 0; j < hiddenSize; j++) {
            let s = this.b1[j];
            const base = j * inputSize;
            for (let i = 0; i < inputSize; i++) s += this.w1[base + i] * input[i];
            // tanh — small lookup-free poly approximation isn't worth the loss
            // of accuracy here; Math.tanh in V8 is already fast.
            h[j] = Math.tanh(s);
        }
        const out = this.out;
        for (let k = 0; k < outputSize; k++) {
            let s = this.b2[k];
            const base = k * hiddenSize;
            for (let j = 0; j < hiddenSize; j++) s += this.w2[base + j] * h[j];
            // Sigmoid → action probability; thresholded by caller.
            out[k] = 1 / (1 + Math.exp(-s));
        }
        return out;
    }

    clone(): Brain {
        const b = new Brain(this.shape);
        b.w1.set(this.w1);
        b.b1.set(this.b1);
        b.w2.set(this.w2);
        b.b2.set(this.b2);
        return b;
    }

    // Gaussian mutation. `rate` is the probability of touching any given
    // weight; `sigma` is the per-touched-weight perturbation scale.
    mutate(rate = 0.1, sigma = 0.1): void {
        const tweak = (arr: Float32Array) => {
            for (let i = 0; i < arr.length; i++) {
                if (Math.random() < rate) arr[i] += randn() * sigma;
            }
        };
        tweak(this.w1);
        tweak(this.b1);
        tweak(this.w2);
        tweak(this.b2);
    }

    // Uniform per-weight crossover with another brain.
    static crossover(a: Brain, b: Brain): Brain {
        const child = new Brain(a.shape);
        const pick = (out: Float32Array, ax: Float32Array, bx: Float32Array) => {
            for (let i = 0; i < out.length; i++) {
                out[i] = Math.random() < 0.5 ? ax[i] : bx[i];
            }
        };
        pick(child.w1, a.w1, b.w1);
        pick(child.b1, a.b1, b.b1);
        pick(child.w2, a.w2, b.w2);
        pick(child.b2, a.b2, b.b2);
        return child;
    }

    toJSON(): BrainJSON {
        return {
            shape: this.shape,
            weights: [
                ...Array.from(this.w1),
                ...Array.from(this.w2),
            ],
            biases: [
                ...Array.from(this.b1),
                ...Array.from(this.b2),
            ],
        };
    }

    static fromJSON(json: BrainJSON): Brain {
        const b = new Brain(json.shape);
        const w1Len = json.shape.inputSize * json.shape.hiddenSize;
        const b1Len = json.shape.hiddenSize;
        for (let i = 0; i < w1Len; i++) b.w1[i] = json.weights[i];
        for (let i = 0; i < b.w2.length; i++) b.w2[i] = json.weights[w1Len + i];
        for (let i = 0; i < b1Len; i++) b.b1[i] = json.biases[i];
        for (let i = 0; i < b.b2.length; i++) b.b2[i] = json.biases[b1Len + i];
        return b;
    }
}

// Box-Muller normal sample.
export function randn(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
