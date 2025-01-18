@description('Name of the App Service')
var webAppName = 'hitbox'

@description('Spcify the SKU type')
var sku = 'B1'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Name of the App Service Plan')
var appServicePlanName = 'hitbox'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  properties: {
    reserved: true
  }
  sku: {
    name: sku
    capacity: 0
  }
  kind: 'linux'
  
}

resource appService 'Microsoft.Web/sites@2022-03-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~21'
        }
      ]
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'pm2 start build/index.js --no-daemon'
      cors:{
        allowedOrigins:[
          'http://localhost:3000'
          'https://www.hitbox.online'
        ]
      }
      alwaysOn: true
    }
    publicNetworkAccess: 'Enabled'
  }
  identity: {
    type: 'SystemAssigned'
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: webAppName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid('b24988ac-6180-42a0-ab88-20f7382dd24c', appServicePlan.id, 'Contributor') // Role ID for 'Contributor' is predefined by Azure
  scope: appServicePlan
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor Role ID
    principalId: appService.identity.principalId
  }
}

resource roleAssignmentSite 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid('b24988ac-6180-42a0-ab88-20f7382dd24c', appService.id, 'Contributor') // Role ID for 'Contributor' is predefined by Azure
  scope: appService
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor Role ID
    principalId: appService.identity.principalId
  }
}


resource hostingPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'hitboxfunctions'
  location: location
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
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    siteConfig: {
      linuxFxVersion: 'DOTNET|8.0'
      cors: {
        allowedOrigins:[
          'http://localhost:5173'
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
          value: 'dotnet'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsights.properties.InstrumentationKey
        }
        {
          name: 'FUNCTIONS_INPROC_NET8_ENABLED'
          value: '1'
        }
      ]
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}

resource functionRoleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid('b24988ac-6180-42a0-ab88-20f7382dd24c', 'function', appServicePlan.id, 'Contributor') // Role ID for 'Contributor' is predefined by Azure
  scope: appServicePlan
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor Role ID
    principalId: functionApp.identity.principalId
  }
}

resource functionRoleAssignmentSite 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid('b24988ac-6180-42a0-ab88-20f7382dd24c', 'function', appService.id, 'Contributor') // Role ID for 'Contributor' is predefined by Azure
  scope: appService
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor Role ID
    principalId: functionApp.identity.principalId
  }
}
