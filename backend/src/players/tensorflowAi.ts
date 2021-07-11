import Player from './player';
import Utils from '../utils';
import Level from '../level/level';
import * as tf from '@tensorflow/tfjs-node-gpu'
import Archiver from '../ai/archiver';

const actionMapping = {
    0: "none",
    1: "jump",
    2: "down",
    3: "boostLeft",
    4: "boostRight",
    5: "left",
    6: "right",
}

class TensorflowAi extends Player {
    playerId: number;
    model: tf.LayersModel;
    archiver: Archiver;

    constructor(colour: string, name: string, x: number = null, y: number = null){
        var playerId = Utils.getHashCode(name);
        super(colour, name, x, y, true);
        this.playerId = playerId;
        this.archiver = new Archiver();
        tf.loadLayersModel('file:///Code/HitboxBackend/src/ai/model/model.json').then(m => {
            this.model = m;
        })
    }

    indexOfMax(arr: number[]) {
        if (arr.length === 0) {
            return -1;
        }
    
        var max = arr[0];
        var maxIndex = 0;
    
        for (var i = 1; i < arr.length; i++) {
            if (arr[i] > max) {
                maxIndex = i;
                max = arr[i];
            }
        }
    
        return maxIndex;
    }

    resetInputs(){
        this.right = false;
        this.left = false;
        this.space = false;
        this.down = false;
        this.boostLeft = false;
        this.boostRight = false;
    }

    move(players: Player[], ticks: number, level: Level){
        if(this.model){
            var prediction = this.model.predict(tf.tensor([this.archiver.calculateState(this, players, level).slice(0,12)]));
            var action = actionMapping[this.indexOfMax(prediction.dataSync())];
            // if(action == "none"){
            //     action = actionMapping[Math.floor(Math.random() * 7)]
            // }
            switch(action){
                case "right":
                    this.resetInputs();
                    this.right = true;
                    break;
                case "left":
                    this.resetInputs();
                    this.left = true;
                    break;
                case "jump":
                    this.resetInputs();
                    this.space = true;
                    break;
                case "down":
                    this.resetInputs();
                    this.down = true;
                    break;
                case "boostLeft":
                    this.boostLeft = true;
                    break;
                case "boostRight":
                    this.boostRight = true;
                    break;
                default:
                    this.resetInputs();
            }
        }
    }
}

export default TensorflowAi;