// Per-game-mode observation builders. Each mode highlights different signals
// (e.g. CTF cares about flags & goals; Football about the ball; DeathWall
// about the wall position). Keeping the input size identical across modes
// would force the net to learn what to ignore; making them mode-specific
// keeps networks compact and learns faster.

import Player from '../../players/player';
import Level from '../../level/level';
import Shape from '../../level/shape';
import Constants from '../../constants';

// Game world scale for normalising raw coordinates into roughly [-1, 1].
const POS_SCALE = 1 / 2000;
const VEL_SCALE = 1 / 50;

// Raycast directions and max distance for the level-geometry features. 8
// rays at 45° spacing give a coarse "what's around me" map without exploding
// input size. Distances are normalised against RAY_MAX so the brain doesn't
// have to learn the world scale.
const RAY_COUNT = 8;
const RAY_MAX = 2000;
const RAY_DIRS: { dx: number; dy: number }[] = Array.from(
    { length: RAY_COUNT },
    (_, i) => {
        const a = (i * 2 * Math.PI) / RAY_COUNT;
        return { dx: Math.cos(a), dy: Math.sin(a) };
    }
);

// Action vector layout (the brain emits a fixed-size vector regardless of
// mode). Each entry is a sigmoid-thresholded boolean.
export const ACTIONS = {
    LEFT: 0,
    RIGHT: 1,
    SPACE: 2,
    DOWN: 3,
    BOOST_LEFT: 4,
    BOOST_RIGHT: 5,
    CLICK: 6, // mid-air directional boost (the "click" input)
} as const;
export const ACTION_COUNT = 7;

export interface ObservationContext {
    self: Player;
    others: Player[];
    level: Level;
    serverTime: number;
    mode: string;
}

// Used to pad observations when there are fewer opponents than slots.
const ZERO_OPP = {
    dx: 0, dy: 0, vx: 0, vy: 0, alive: 0, team: 0, role: 0,
    boost: 0, ducked: 0, it: 0,
};

// Find up to `count` nearest opponents to `self`, returning their relative
// kinematics and role flags. Always returns `count` entries; padded with
// zeros if not enough opponents exist. Dead non-special players are excluded
// — they sit motionless at their death position until respawn and were
// causing brains to home in on corpses.
function nearestOpponents(self: Player, others: Player[], count: number) {
    const scored = others
        .filter((p) => p !== self && (p.alive || !!p.type))
        .map((p) => ({
            p,
            d: (p.x - self.x) ** 2 + (p.y - self.y) ** 2,
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, count);
    const out: typeof ZERO_OPP[] = [];
    for (let i = 0; i < count; i++) {
        const o = scored[i];
        if (!o) {
            out.push(ZERO_OPP);
            continue;
        }
        const p = o.p;
        out.push({
            dx: (p.x - self.x) * POS_SCALE,
            dy: (p.y - self.y) * POS_SCALE,
            vx: (p.xVelocity || 0) * VEL_SCALE,
            vy: (p.yVelocity || 0) * VEL_SCALE,
            alive: p.alive ? 1 : 0,
            team: p.team === self.team ? 1 : p.team ? -1 : 0,
            role: p.it ? 1 : p.orb ? 0.5 : p.type === 'flag' ? -0.5 : p.type === 'ball' ? -1 : 0,
            // Opponent combat state — boost cooldown tells the brain whether
            // an enemy is about to dash, ducked means they're immune to side
            // hits and will bounce back boosters, "it" is the Tag flag.
            boost: (p.boostCooldown || 0) / 100,
            ducked: p.ducked ? 1 : 0,
            it: p.it ? 1 : 0,
        });
    }
    return out;
}

// Ray-AABB intersection (slab method). Returns the t value (parametric
// distance along the ray) of the first hit, or +Infinity if none in
// [0, maxT]. Origin-inside-box returns 0 so the brain still senses contact.
function rayBox(
    sx: number, sy: number, dx: number, dy: number,
    minX: number, minY: number, maxX: number, maxY: number,
    maxT: number
): number {
    let tmin = -Infinity, tmax = Infinity;
    if (dx !== 0) {
        const tx1 = (minX - sx) / dx;
        const tx2 = (maxX - sx) / dx;
        tmin = Math.max(tmin, Math.min(tx1, tx2));
        tmax = Math.min(tmax, Math.max(tx1, tx2));
    } else if (sx < minX || sx > maxX) return Infinity;
    if (dy !== 0) {
        const ty1 = (minY - sy) / dy;
        const ty2 = (maxY - sy) / dy;
        tmin = Math.max(tmin, Math.min(ty1, ty2));
        tmax = Math.min(tmax, Math.max(ty1, ty2));
    } else if (sy < minY || sy > maxY) return Infinity;
    if (tmax < 0 || tmin > tmax || tmin > maxT) return Infinity;
    return tmin > 0 ? tmin : 0;
}

// 8 directional rays from the player centre, returning normalised distance
// to the nearest collidable platform (1.0 = no hit within RAY_MAX). Slopes
// are treated as their AABB which slightly over-reports distance to the
// nearest surface but is good enough for path-planning awareness.
//
// Broad-phase cull: each level can have ~50 platforms but only ~5-10 are
// within ray range at any time. We pre-filter by computing the squared
// distance from the player to each platform's bbox and skip anything beyond
// RAY_MAX. That filter happens once for all 8 rays per tick instead of 8x
// over, so it's strictly cheaper than per-ray testing every platform.
const RAY_MAX_SQ = RAY_MAX * RAY_MAX;
function levelRays(self: Player, level: Level): number[] {
    const sx = self.x + self.width / 2;
    const sy = self.y - self.height / 2;
    // Build a per-tick shortlist of in-range, collidable platforms.
    const candidates: { leftX: number; topY: number; rightX: number; bottomY: number }[] = [];
    for (let j = 0; j < level.platforms.length; j++) {
        const p = level.platforms[j];
        const t = (p as any).type;
        if (t === 'hillfill' || t === 'goal' || t === 'trunk' || t === 'leaves' || t === 'backgroundleaves') continue;
        if (((p as any).durability ?? 100) <= 0) continue;
        const lx = p.leftX();
        const rx = p.rightX();
        const ty = p.topY();
        const by = p.bottomY();
        // Squared distance from (sx, sy) to the AABB (0 if inside).
        const dx = sx < lx ? lx - sx : sx > rx ? sx - rx : 0;
        const dy = sy < ty ? ty - sy : sy > by ? sy - by : 0;
        if (dx * dx + dy * dy > RAY_MAX_SQ) continue;
        candidates.push({ leftX: lx, topY: ty, rightX: rx, bottomY: by });
    }
    const out: number[] = new Array(RAY_COUNT).fill(1);
    for (let i = 0; i < RAY_COUNT; i++) {
        const dir = RAY_DIRS[i];
        let best = RAY_MAX;
        for (let j = 0; j < candidates.length; j++) {
            const c = candidates[j];
            const hit = rayBox(sx, sy, dir.dx, dir.dy, c.leftX, c.topY, c.rightX, c.bottomY, best);
            if (hit < best) best = hit;
        }
        out[i] = best / RAY_MAX;
    }
    return out;
}

// Self-state features common to every mode.
function selfFeatures(self: Player): number[] {
    return [
        self.x * POS_SCALE,
        self.y * POS_SCALE,
        (self.xVelocity || 0) * VEL_SCALE,
        (self.yVelocity || 0) * VEL_SCALE,
        self.onSurface ? 1 : 0,
        (self.health || 0) / 100,
        (self.boostCooldown || 0) / 100,
        self.ducked ? 1 : 0,
        self.it ? 1 : 0,
        self.team === Constants.TEAM1 ? 1 : self.team === Constants.TEAM2 ? -1 : 0,
    ];
}

// Find the nearest entity of a given test, return relative coords + carrier
// flag for things like flags. The test usually keys on `it`/`type`/`orb`
// which already screens out plain dead corpses; we still extra-filter dead
// non-special players for safety.
function nearestSpecial(
    self: Player,
    others: Player[],
    test: (p: Player) => boolean
): number[] {
    const matches = others.filter((p) => (p.alive || !!p.type) && test(p));
    if (!matches.length) return [0, 0, 0, 0, 0];
    matches.sort(
        (a, b) =>
            (a.x - self.x) ** 2 + (a.y - self.y) ** 2 -
            ((b.x - self.x) ** 2 + (b.y - self.y) ** 2)
    );
    const m = matches[0];
    return [
        (m.x - self.x) * POS_SCALE,
        (m.y - self.y) * POS_SCALE,
        (m.xVelocity || 0) * VEL_SCALE,
        (m.yVelocity || 0) * VEL_SCALE,
        m.attachedToPlayer ? 1 : 0,
    ];
}

// Encode the centre + extent of the goal owned by `team`, relative to self.
// Returns zeros if no such goal exists.
function goalFeatures(self: Player, level: Level, team: string): number[] {
    const goal = level.platforms.find((p) => (p as any).type === 'goal' && (p as any).colour === team);
    if (!goal) return [0, 0, 0];
    const gx = goal.leftX() + goal.width / 2;
    const gy = goal.topY() + goal.height / 2;
    return [(gx - self.x) * POS_SCALE, (gy - self.y) * POS_SCALE, 1];
}

// Each observation builder returns a Float32Array of normalised features.
// Length is fixed per mode (consumers must match BRAIN_SHAPES below).
export type ObservationBuilder = (ctx: ObservationContext) => Float32Array;

// Combat-state fields appended to every opponent slot — boost cooldown,
// ducked flag (immune to side hits), it flag (Tag halo). Spread these into
// each per-mode builder along with mode-specific fields.
const COMBAT_FIELDS = (o: typeof ZERO_OPP) => [o.boost, o.ducked, o.it];

const battleRoyale: ObservationBuilder = (ctx) => {
    const feats: number[] = [
        ...selfFeatures(ctx.self),
        ...nearestOpponents(ctx.self, ctx.others, 3).flatMap((o) => [
            o.dx, o.dy, o.vx, o.vy, o.alive,
            ...COMBAT_FIELDS(o),
        ]),
        ctx.others.filter((p) => p.alive && !p.type).length / 6,
        ...levelRays(ctx.self, ctx.level),
        1, // bias
    ];
    return new Float32Array(feats);
};

const tag: ObservationBuilder = (ctx) => {
    const feats: number[] = [
        ...selfFeatures(ctx.self),
        ...nearestOpponents(ctx.self, ctx.others, 3).flatMap((o) => [
            o.dx, o.dy, o.vx, o.vy, o.role,
            ...COMBAT_FIELDS(o),
        ]),
        // Where is the "it" player relative to me?
        ...nearestSpecial(ctx.self, ctx.others, (p) => !!p.it).slice(0, 4),
        ctx.self.it ? 1 : 0,
        ...levelRays(ctx.self, ctx.level),
        1,
    ];
    return new Float32Array(feats);
};

const collectTheBoxes: ObservationBuilder = (ctx) => {
    const feats: number[] = [
        ...selfFeatures(ctx.self),
        ...nearestOpponents(ctx.self, ctx.others, 3).flatMap((o) => [
            o.dx, o.dy, o.vx, o.vy, o.role,
            ...COMBAT_FIELDS(o),
        ]),
        ...nearestSpecial(ctx.self, ctx.others, (p) => !!p.orb).slice(0, 4),
        (ctx.self.lives || 0) / 5,
        ...levelRays(ctx.self, ctx.level),
        1,
    ];
    return new Float32Array(feats);
};

const deathWall: ObservationBuilder = (ctx) => {
    // Find the closest platform ahead of and behind the player so the brain
    // has some idea of what to jump to.
    const platforms = ctx.level.platforms;
    let nextAhead: any = null;
    let nextBehind: any = null;
    let aheadDist = Infinity;
    let behindDist = Infinity;
    for (const p of platforms) {
        if ((p as any).type === 'border' || (p as any).type === 'hillfill') continue;
        const cx = p.leftX() + p.width / 2;
        const d = cx - ctx.self.x;
        if (d > 0 && d < aheadDist) {
            aheadDist = d;
            nextAhead = p;
        } else if (d < 0 && -d < behindDist) {
            behindDist = -d;
            nextBehind = p;
        }
    }
    const platformFeat = (pl: any) =>
        pl
            ? [
                  (pl.leftX() + pl.width / 2 - ctx.self.x) * POS_SCALE,
                  (pl.topY() - ctx.self.y) * POS_SCALE,
                  pl.width * POS_SCALE,
              ]
            : [0, 0, 0];
    const feats: number[] = [
        ...selfFeatures(ctx.self),
        ...platformFeat(nextAhead),
        ...platformFeat(nextBehind),
        ((ctx.level.deathWallX || 0) - ctx.self.x) * POS_SCALE,
        // Death Wall is path-planning-heavy: which gaps are jumpable, where's
        // the next foothold? Rays give the brain a coarse but useful sense.
        ...levelRays(ctx.self, ctx.level),
        1,
    ];
    return new Float32Array(feats);
};

const football: ObservationBuilder = (ctx) => {
    const ball = ctx.others.find((p) => p.type === 'ball');
    const ballFeats = nearestSpecial(ctx.self, ctx.others, (p) => p.type === 'ball');
    const enemyTeam = ctx.self.team === Constants.TEAM1 ? Constants.TEAM2 : Constants.TEAM1;
    // Ball-to-opponent-goal vector tells the brain WHICH WAY to hit the ball.
    const oppGoal = ctx.level.platforms.find((p) => (p as any).type === 'goal' && (p as any).colour === enemyTeam);
    const ballToGoal = ball && oppGoal
        ? [
              (oppGoal.leftX() + oppGoal.width / 2 - ball.x) * POS_SCALE,
              (oppGoal.topY() + oppGoal.height / 2 - ball.y) * POS_SCALE,
          ]
        : [0, 0];
    const feats: number[] = [
        ...selfFeatures(ctx.self),
        ...nearestOpponents(ctx.self, ctx.others, 3).flatMap((o) => [
            o.dx, o.dy, o.vx, o.vy, o.team,
            ...COMBAT_FIELDS(o),
        ]),
        ...ballFeats.slice(0, 4),
        ...ballToGoal,
        // Goal targets — opponent goal positive reward, own goal to avoid.
        ...goalFeatures(
            ctx.self,
            ctx.level,
            enemyTeam
        ),
        ...goalFeatures(ctx.self, ctx.level, ctx.self.team || Constants.TEAM1),
        ...levelRays(ctx.self, ctx.level),
        1,
    ];
    return new Float32Array(feats);
};

const captureTheFlag: ObservationBuilder = (ctx) => {
    const enemyTeam = ctx.self.team === Constants.TEAM1 ? Constants.TEAM2 : Constants.TEAM1;
    const myFlag = nearestSpecial(
        ctx.self,
        ctx.others,
        (p) => p.type === 'flag' && p.colour === ctx.self.team
    );
    const enemyFlag = nearestSpecial(
        ctx.self,
        ctx.others,
        (p) => p.type === 'flag' && p.colour === enemyTeam
    );
    const carryingEnemy = ctx.others.find(
        (p) => p.type === 'flag' && p.colour === enemyTeam && p.attachedToPlayer === ctx.self.name
    );
    const feats: number[] = [
        ...selfFeatures(ctx.self),
        ...nearestOpponents(ctx.self, ctx.others, 3).flatMap((o) => [
            o.dx, o.dy, o.vx, o.vy, o.team,
            ...COMBAT_FIELDS(o),
        ]),
        ...myFlag, // 5
        ...enemyFlag, // 5
        carryingEnemy ? 1 : 0,
        ...goalFeatures(ctx.self, ctx.level, enemyTeam),
        ...goalFeatures(ctx.self, ctx.level, ctx.self.team || Constants.TEAM1),
        ...levelRays(ctx.self, ctx.level),
        1,
    ];
    return new Float32Array(feats);
};

const spleef: ObservationBuilder = (ctx) => {
    // Similar to battle royale but the brain also benefits from knowing how
    // much platform is left below it; we approximate by looking at the
    // nearest platform's durability.
    let dur = 0;
    let bestDy = Infinity;
    for (const p of ctx.level.platforms) {
        if ((p as any).type === 'border' || (p as any).type === 'hillfill') continue;
        if (ctx.self.x >= p.leftX() && ctx.self.x <= p.rightX()) {
            const dy = p.topY() - ctx.self.y;
            if (dy >= 0 && dy < bestDy) {
                bestDy = dy;
                dur = (p as any).durability || 0;
            }
        }
    }
    const feats: number[] = [
        ...selfFeatures(ctx.self),
        ...nearestOpponents(ctx.self, ctx.others, 3).flatMap((o) => [
            o.dx, o.dy, o.vx, o.vy, o.alive,
            ...COMBAT_FIELDS(o),
        ]),
        dur / 100,
        isFinite(bestDy) ? bestDy * POS_SCALE : 0,
        ...levelRays(ctx.self, ctx.level),
        1,
    ];
    return new Float32Array(feats);
};

export const OBSERVATION_BUILDERS: Record<string, ObservationBuilder> = {
    'Battle Royale': battleRoyale,
    Tag: tag,
    'Collect the Boxes': collectTheBoxes,
    'Death Wall': deathWall,
    Football: football,
    'Capture The Flag': captureTheFlag,
    Spleef: spleef,
};

// Input size per mode — derived once so the trainer can pick a Brain shape.
export const OBSERVATION_SIZES: Record<string, number> = (() => {
    const sizes: Record<string, number> = {};
    const dummyLevel: any = { platforms: [], deathWallX: 0 };
    const dummySelf: any = {
        x: 0, y: 0, xVelocity: 0, yVelocity: 0, onSurface: false, health: 100,
        boostCooldown: 0, ducked: false, it: false, team: 'red', alive: true,
        lives: 0, name: 's',
    };
    Object.entries(OBSERVATION_BUILDERS).forEach(([mode, fn]) => {
        sizes[mode] = fn({
            self: dummySelf as Player,
            others: [] as Player[],
            level: dummyLevel as Level,
            serverTime: 0,
            mode,
        }).length;
    });
    return sizes;
})();
