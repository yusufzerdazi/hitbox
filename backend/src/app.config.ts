import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import cors from "cors";

import { GameRoom } from './rooms/gameRoom';
import { PlayFabServer } from 'playfab-sdk';

PlayFabServer.settings.titleId = '5B7C3';
PlayFabServer.settings.developerSecretKey = process.env.PLAYFAB_KEY;


export default config({    
    getId: () => "Your Colyseus App",

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */

        gameServer.define('Game', GameRoom)
            .filterBy(['gameMode', 'map', 'room']);

    },

    initializeExpress: (app) => {
        app.use(cors({
            origin: ['http://localhost:3000', 'https://hitbox.online']
        }));

        /**
         * Bind your custom express routes here:
         */
        app.get("/", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        /**
         * Bind @colyseus/monitor
         * It is recommended to protect this route with a password.
         * Read more: https://docs.colyseus.io/tools/monitor/
         */
        app.use("/colyseus", monitor());

    }

});