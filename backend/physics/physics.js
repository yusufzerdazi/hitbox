const Speed = require("./speed");
const Movement = require("./movement");
const Collision = require("./collision");

class Physics {
    constructor(){
        this.calculations = [
            new Speed(),
            new Movement(),
            new Collision()
        ]
    }

    calculate(clients, level){
        var messages = []
        this.calculations.forEach(calculation => {
            messages = messages.concat(calculation.calculate(clients, level));
        });
        return messages;
    }
}

module.exports = Physics;