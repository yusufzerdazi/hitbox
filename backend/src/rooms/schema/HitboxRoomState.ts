import { Schema, type, MapSchema } from "@colyseus/schema";
import Player from '../../players/player';
import Level from '../../level';

export class HitboxRoomState extends Schema {
    @type("number") serverTime = 0;
    @type("number") runningPlayers = 0;
    @type("number") maxDistance = 0;
    @type({ map: Player }) players = new MapSchema<Player>();
    @type(Level) level: Level;
}