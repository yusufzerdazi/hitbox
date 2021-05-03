import GameMode from "../game/gameMode";
import Level from "../level";
import Player from "../players/player";
import Calculation from "./calculation";

import Speed from "./speed";
import Movement from "./movement";
import Collision from "./collision";

class Physics {
    calculations: Calculation[];
    constructor(){
        this.calculations = [
            new Speed(),
            new Movement(),
            new Collision()
        ]
    }

    calculate(players: Player[], level: Level, gameMode: GameMode){
        var messages: any[] = []
        this.calculations.forEach(calculation => {
            messages = messages.concat(calculation.calculate(players, level, gameMode));
        });
        return messages;
    }
}

export default Physics;