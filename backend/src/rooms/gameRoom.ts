import { Room, Client, generateId, Delayed } from '@colyseus/core';
import Player from '../players/player';
import Utils from '../utils';
import { HitboxRoomState } from "./schema/HitboxRoomState";
import { matchMaker } from "colyseus";
import Game from '../game';
import https from 'https';

import { DefaultAzureCredential } from '@azure/identity';
import { AppServicePlan, AppServicePlanPatchResource, SkuDescription, WebSiteManagementClient } from '@azure/arm-appservice';
import { PlayFabServer } from 'playfab-sdk';
let appInsights = require("applicationinsights");

// Initialize AppInsights with proper configuration
if (!appInsights.defaultClient) {
    appInsights.setup()
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true)
        .setUseDiskRetryCaching(true)
        .start();
}

const subscriptionId = '4b89f88e-13f2-4990-bf5f-3ab2e4d5301f';
const resourceGroupName = 'hitbox';
const appServiceName = 'hitbox';

const credential = new DefaultAzureCredential();
const client = new WebSiteManagementClient(credential, subscriptionId);

PlayFabServer.settings.titleId = '5B7C3';
PlayFabServer.settings.developerSecretKey = process.env.PLAYFAB_KEY;

async function getAppServicePlanDetails() {
    // Get the App Service details to find its App Service Plan
    const appService = await client.webApps.get(resourceGroupName, appServiceName);

    // The App Service Plan ID is in the serverFarmId property of the App Service
    const appServicePlanId = appService.serverFarmId;
    const appServicePlanResourceGroupName = appServicePlanId.split('/')[4];
    const appServicePlanName = appServicePlanId.split('/')[8];
    
    // Get the App Service Plan details
    const appServicePlan = await client.appServicePlans.get(appServicePlanResourceGroupName, appServicePlanName);

    return appServicePlan.sku;
}

export class GameRoom extends Room<HitboxRoomState> {
    game: Game;
    delayedInterval!: Delayed;

    async onCreate(options: any) {
        
        // start the clock ticking
        this.clock.start();

        // Set an interval and store a reference to it
        // so that we may clear it later
        this.delayedInterval = this.clock.setInterval(() => {
            // Track current connected players count
            const playerCount = matchMaker.stats.local.ccu || 0;
            appInsights.defaultClient.trackMetric({name: "OnlinePlayers", value: playerCount});
            
            // Track detailed information for debugging
            appInsights.defaultClient.trackTrace({
                message: `Player count tracking: ${playerCount} players online`,
                severity: appInsights.Contracts.SeverityLevel.Information,
                properties: {
                    roomId: this.roomId,
                    playerCount: playerCount,
                    timestamp: new Date().toISOString()
                }
            });
        }, 10000);
        
        this.maxClients = 100;

        this.setState(new HitboxRoomState());

        this.setPatchRate(1000 / 60);

        this.state.map = options.map;
        this.game = new Game();
        if(options.gameMode){
            this.game.gameModes.forEach(g => {
                if(g.name.toLowerCase() == options.gameMode.toLowerCase()){
                    this.game.gameModes = [g];
                }
            });
        }
        
        this.onMessage('right', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).right = request;
        });

        this.onMessage('left', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).left = request;
        });

        this.onMessage('space', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).space = request;
        });

        this.onMessage('down', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).down = request;
        });

        this.onMessage('boostLeft', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).boostLeft = request;
        });

        this.onMessage('boostRight', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).boostRight = request;
        });

        this.onMessage('play', async (client, request) => {
            if ((await getAppServicePlanDetails()).tier == "Basic")
            {
                return;
            }

            if(Array.from(this.state.players.values()).filter(p => !p.ai).length == 0){
                this.game.gameMode.addAiPlayer();
            } else {
                this.removeAiPlayer();
            }
            this.onPlay(client, request);
        });

        this.onMessage('addAi', () => {
            this.game.gameMode.addAiPlayer();
        });

        this.onMessage('removeAi', () => {
            this.removeAiPlayer();
        });

        this.onMessage('quit', (client) => {
            this.onQuit(client);
            this.removeAiPlayer();
        });

        this.onMessage('nameChange', (client, name) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).name = name;
        });

        this.onMessage('changeAvatar', (client, avatar) => {
            this.broadcast('changeAvatar', avatar);
        });

        this.setSimulationInterval(async dt => {
            this.state.serverTime += dt;
            await this.game.gameLoop(this);
        });

        if ((await getAppServicePlanDetails()).tier != "Basic") {
            this.state.scaledUp = true;
            this.broadcast('isScaled', false);
            // Track server scale status
            appInsights.defaultClient.trackMetric({name: "ServerScaledUp", value: 1});
            appInsights.defaultClient.trackEvent({
                name: "ServerScaled", 
                properties: { 
                    status: "up",
                    tier: (await getAppServicePlanDetails()).tier,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            for(var i = 0; i<5; i++) {
                this.game.gameMode.addAiPlayer();
            }
            // Track server scale status
            appInsights.defaultClient.trackMetric({name: "ServerScaledUp", value: 0});
            appInsights.defaultClient.trackEvent({
                name: "ServerScaled", 
                properties: { 
                    status: "down",
                    tier: "Basic",
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async onJoin(client: Client, options: any) {
        // Send scaled status to the joining client
        if (this.state.scaledUp) {
            client.send('isScaled', true);
        }
        
        // Log player join event
        const playerCount = matchMaker.stats.local.ccu || 0;
        appInsights.defaultClient.trackMetric({name: "OnlinePlayers", value: playerCount});
        appInsights.defaultClient.trackEvent({
            name: "PlayerJoined", 
            properties: { 
                clientId: client.id,
                playerCount: playerCount,
                timestamp: new Date().toISOString()
            }
        });
    }

    async onLeave(client: Client, consented: boolean) {
        this.state.players.delete(client.sessionId);
        // Update player count immediately when a player leaves
        const playerCount = matchMaker.stats.local.ccu || 0;
        appInsights.defaultClient.trackMetric({name: "OnlinePlayers", value: playerCount});
        appInsights.defaultClient.trackEvent({
            name: "PlayerLeft", 
            properties: { 
                clientId: client.id,
                consented: consented,
                playerCount: playerCount,
                timestamp: new Date().toISOString()
            }
        });
    }

    async onDispose () {
        // Explicitly set player count to 0 when room is disposed
        appInsights.defaultClient.trackMetric({name: "OnlinePlayers", value: 0});
        appInsights.defaultClient.trackEvent({
            name: "RoomDisposed", 
            properties: { 
                roomId: this.roomId,
                timestamp: new Date().toISOString()
            }
        });
        console.log("Room disposed, player count set to 0");
    }

    removeAiPlayer(){
        var deleted = false;
        this.state.players.forEach(p => {
            if(p.ai && !p.type && !deleted){
                this.state.players.delete(p.clientId);
                deleted = true;
            }
        });
    }

    onPlay(client: Client, options: any){
        let newPlayer = new Player(Utils.randomColor(),
                options.user.name, null, null, false,
                options.user.id,
                options.rank).assign({
            clientId: client.id,
            sessionId: client.sessionId,
        });
        this.state.players.set(client.sessionId, newPlayer);
        this.game.gameMode.onPlayerJoin();
        newPlayer.respawn(Array.from(this.state.players.values()), this.state.level, this.game.gameMode.teamBased);
        https.get('https://maker.ifttt.com/trigger/hitbox_player_joined/json/with/key/' + process.env.IFTTT_KEY);
    }

    onQuit(client: Client){
        this.state.players.delete(client.sessionId);
    }
}
