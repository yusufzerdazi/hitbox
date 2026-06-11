import { Schema, type, MapSchema } from "@colyseus/schema";
import Player3D from './player3d';
import Level3D from './level3d';

export class Hitbox3DRoomState extends Schema {
    @type("number") serverTime = 0;
    @type({ map: Player3D }) players = new MapSchema<Player3D>();
    @type(Level3D) level: Level3D;
    @type("string") map: string;
}
