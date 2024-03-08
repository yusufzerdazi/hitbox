@description('Name of the App Service')
var webAppName = 'hitbox'

@description('Spcify the SKU type')
var sku = 'P2v3'

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
      appCommandLine: 'pm2 start index.js'
    }
    publicNetworkAccess: 'Enabled'
  }
}
