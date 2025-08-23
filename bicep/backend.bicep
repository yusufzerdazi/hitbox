@description('Name of the App Service')
var webAppName = 'hitbox'

@description('Location for all resources.')
param location string = resourceGroup().location

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: webAppName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

resource hostingPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'hitboxfunctions'
  location: 'UK South'
  sku: {
    name: 'Y1'
    tier: 'Consumption'
  }
  properties: {
    reserved: true
  }
}

resource blobStorage 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: 'hitbox'
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'hitboxfunctions'
  location: 'UK South'
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|8.0'
      cors: {
        allowedOrigins:[
          'http://localhost:3000'
          'https://www.hitbox.online'
          'https://hitbox.online'
          'https://portal.azure.com'
        ]
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${blobStorage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${blobStorage.listKeys().keys[0].value}'
        }
        {
          name: 'StorageAccountConnectionString'
          value: 'DefaultEndpointsProtocol=https;AccountName=${blobStorage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${blobStorage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${blobStorage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${blobStorage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: 'ticketslick'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsights.properties.InstrumentationKey
        }
      ]
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}
