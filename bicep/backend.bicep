@description('Specifies the environment of the container apps.')
@allowed  ([
  'test'
  'dev'
  'qa'
  'prod'
])
param env string

@description('Specify the app name')
@allowed([
  'frontend'
  'backend'
])
param appName string 

@description('Name of the App Service')
var webAppName = 'hitbox-${appName}-${env}'

@description('Spcify the SKU type')
var sku = 'P2v3'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Name of the App Service Plan')
var appServicePlanName = 'hitbox-${env}'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  tags: {
    env: env
  }
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
  tags: {
    env: env
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~21'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
    }
    publicNetworkAccess: 'Enabled'
  }
}
