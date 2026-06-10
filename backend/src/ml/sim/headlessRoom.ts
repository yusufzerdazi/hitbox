import { MapSchema } from "@colyseus/schema";

import Player from "../../players/player";
import Level from "../../level/level";

// Minimal stand-in for Colyseus `Room<HitboxRoomState>`. Only implements the
// fields/methods that `Game`, `GameMode`, and `Physics` actually read or
// mutate (we grep'd for `roomRef.` / `this.roomRef.` to find them all). The
// goal here is to drive the real game classes through the same code paths
// they run in production, just without a network or a Colyseus runtime.

type BroadcastListener = (type: string, payload: any) => void;

export class HeadlessRoomState {
    serverTime = 0;
    runningPlayers = 0;
    maxDistance = 0;
    players: MapSchema<Player> = new MapSchema<Player>();
    level!: Level;
    map: string = "";
    scaledUp = false;
}

export class HeadlessRoom {
    state: HeadlessRoomState;
    private listeners: BroadcastListener[] = [];
    // Public events from this game (collected so the trainer / UI can replay
    // them). Cleared by callers when consumed.
    events: { type: string; payload: any }[] = [];
    // Signals to the game-mode constructors that this is a training run, so
    // they should NOT re-roll AI players into SimpleAi/CleverAi/etc. The real
    // Colyseus Room doesn't have this property, so the live game keeps its
    // existing mode-switch behavior.
    training = true;

    constructor() {
        this.state = new HeadlessRoomState();
    }

    broadcast(type: string, payload?: any): void {
        // Real Colyseus rooms send these to clients; in headless mode we
        // collect them for fitness shaping and optional UI replay.
        this.events.push({ type, payload });
        for (const l of this.listeners) l(type, payload);
    }

    onBroadcast(listener: BroadcastListener): void {
        this.listeners.push(listener);
    }

    consumeEvents(): { type: string; payload: any }[] {
        const out = this.events;
        this.events = [];
        return out;
    }
}
