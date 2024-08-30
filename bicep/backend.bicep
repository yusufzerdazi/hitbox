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
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid('b24988ac-6180-42a0-ab88-20f7382dd24c', appServicePlan.id, 'Contributor') // Role ID for 'Contributor' is predefined by Azure
  scope: appServicePlan
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor Role ID
    principalId: appService.identity.principalId
  }
}
