handlers.playerWins = function (args) {
    var updateStatistics = server.UpdatePlayerStatistics({
        PlayFabId: currentPlayerId,
        Statistics: [{
          "StatisticName": "wins",
          "Value": 1
        }]
    });
};
handlers.playerLoses = function (args) {
    var updateStatistics = server.UpdatePlayerStatistics({
        PlayFabId: currentPlayerId,
        Statistics: [{
          "StatisticName": "losses",
          "Value": 1
        }]
    });
};
handlers.playerKills = function (args) {
    var updateStatistics = server.UpdatePlayerStatistics({
        PlayFabId: currentPlayerId,
        Statistics: [{
          "StatisticName": "kills",
          "Value": 1
        }]
    });
};
handlers.playerDies = function (args) {
    var updateStatistics = server.UpdatePlayerStatistics({
        PlayFabId: currentPlayerId,
        Statistics: [{
          "StatisticName": "deaths",
          "Value": 1
        }]
    });
};
handlers.playerBeaten = function (args) {
    var updateStatistics = server.UpdatePlayerStatistics({
        PlayFabId: currentPlayerId,
        Statistics: [{
          "StatisticName": "beaten",
          "Value": args
        }]
    });
};
handlers.playerRankUpdated = function (args) {
    var updateStatistics = server.UpdatePlayerStatistics({
        PlayFabId: currentPlayerId,
        Statistics: [{
          "StatisticName": "rank",
          "Value": args
        }]
    });
};