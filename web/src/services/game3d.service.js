import GameService from './game.service';
import Utils from '../utils';

// Service for Hitbox 3D. Reuses all of GameService (sounds, room message
// listeners, HUD plumbing) but joins the Game3D room and translates input
// into camera-relative world-space movement vectors.
class Game3DService extends GameService {
    constructor(){
        super();
        // Pressed state for the four movement directions (camera space).
        this.held = { forward: false, back: false, left: false, right: false };
        this.lastTap = { forward: 0, back: 0, left: 0, right: 0 };
        this.moveInterval = null;
        this.lastSent = { x: 0, z: 0 };
    }

    async reconnect(room) {
        if (this.room) {
            this.cleanupListeners();
        }

        const urlParams = new URLSearchParams(window.location.search);

        this.room = await this.client.joinOrCreate("Game3D", {
            gameMode: urlParams.get('gameMode'),
            map: urlParams.get('map'),
            room: urlParams.get('room')
        });

        this.addListeners();

        this.room.onStateChange((newState) => {
            if (this.mounted && this.canvasRef.current) {
                this.canvasRef.current.draw(newState, this.name, this.lastWinner, this.showGui);

                if (this.hudRef.current && this.name) {
                    const currentPlayer = Array.from(newState.players.values()).find(p => p.name === this.name);
                    if (currentPlayer) {
                        this.hudRef.current.updatePlayerStats(currentPlayer);
                    }
                }
            }
        });
    }

    addListeners(){
        super.addListeners();

        // Replace the 2D keyboard handling with camera-relative movement.
        document.removeEventListener("keydown", this.keydownListener);
        document.removeEventListener("keyup", this.keyupListener);

        const directionForKey = (keyCode) => {
            switch (keyCode) {
                case 87: case 38: return "forward";  // W / Up
                case 83: case 40: return "back";     // S / Down
                case 65: case 37: return "left";     // A / Left
                case 68: case 39: return "right";    // D / Right
                default: return null;
            }
        };

        this.keydownListener = (e) => {
            const direction = directionForKey(e.keyCode);
            if (direction) {
                if (!this.held[direction]) {
                    const now = Utils.millis();
                    if (now - this.lastTap[direction] < 500) {
                        this.boostDirection(direction);
                    }
                    this.lastTap[direction] = now;
                }
                this.held[direction] = true;
                this.sendMove();
            }

            if (e.keyCode === 32) { // Space: jump
                e.preventDefault();
                if (!e.repeat) {
                    this.jump(true);
                }
            }

            if ((e.keyCode === 16 || e.keyCode === 67) && !e.repeat) { // Shift / C: crouch or dive
                this.crouch(true);
            }

            if (e.keyCode === 72) { // H
                this.toggleGui();
            }

            if (e.keyCode === 187) { // +
                this.addAi();
            }

            if (e.keyCode === 189) { // -
                this.removeAi();
            }
        };

        this.keyupListener = (e) => {
            const direction = directionForKey(e.keyCode);
            if (direction) {
                this.held[direction] = false;
                this.sendMove();
            }

            if (e.keyCode === 32) {
                this.jump(false);
            }

            if (e.keyCode === 16 || e.keyCode === 67) {
                this.crouch(false);
            }
        };

        document.addEventListener("keydown", this.keydownListener);
        document.addEventListener("keyup", this.keyupListener);

        // The camera can orbit while keys are held, so re-project the held
        // input into world space a few times a second.
        this.moveInterval = setInterval(() => {
            if (this.held.forward || this.held.back || this.held.left || this.held.right) {
                this.sendMove();
            }
        }, 100);
    }

    cleanupListeners(){
        super.cleanupListeners();
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
    }

    // Camera basis on the XZ plane, provided by the 3D canvas.
    cameraBasis(){
        const forward = (this.canvasRef && this.canvasRef.current && this.canvasRef.current.getForward())
            || { x: 0, z: -1 };
        return {
            forward,
            right: { x: -forward.z, z: forward.x }
        };
    }

    inputVector(){
        const strafe = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
        const ahead = (this.held.forward ? 1 : 0) - (this.held.back ? 1 : 0);
        const { forward, right } = this.cameraBasis();
        const x = forward.x * ahead + right.x * strafe;
        const z = forward.z * ahead + right.z * strafe;
        const magnitude = Math.hypot(x, z);
        return magnitude > 0 ? { x: x / magnitude, z: z / magnitude } : { x: 0, z: 0 };
    }

    sendMove(){
        if (!this.room) return;
        const move = this.inputVector();
        if (move.x !== this.lastSent.x || move.z !== this.lastSent.z) {
            this.lastSent = move;
            this.room.send('move', move);
        }
    }

    boostDirection(direction){
        if (!this.room) return;
        const { forward, right } = this.cameraBasis();
        const vectors = {
            forward: forward,
            back: { x: -forward.x, z: -forward.z },
            left: { x: -right.x, z: -right.z },
            right: right
        };
        this.room.send('boost', vectors[direction]);
    }

    // Gamepad sticks and mobile analog: camera-space axes in -1..1.
    setMoveAxes(strafe, ahead){
        if (!this.room) return;
        const { forward, right } = this.cameraBasis();
        const x = forward.x * ahead + right.x * strafe;
        const z = forward.z * ahead + right.z * strafe;
        const magnitude = Math.hypot(x, z);
        const move = magnitude > 1 ? { x: x / magnitude, z: z / magnitude } : { x, z };
        this.lastSent = move;
        this.room.send('move', move);
    }

    // Compatibility with the shared HUD's mobile controls and gamepad bindings:
    // left/right become strafing, boosts dash sideways relative to the camera.
    moveRight(enabled = true) {
        this.held.right = enabled === true || enabled > 0;
        this.sendMove();
    }

    moveLeft(enabled = true) {
        this.held.left = enabled === true || enabled > 0;
        this.sendMove();
    }

    boostRight(enabled = true) {
        if (enabled) this.boostDirection("right");
    }

    boostLeft(enabled = true) {
        if (enabled) this.boostDirection("left");
    }

    boostForward(enabled = true) {
        if (enabled) this.boostDirection("forward");
    }
}

export default Game3DService;
