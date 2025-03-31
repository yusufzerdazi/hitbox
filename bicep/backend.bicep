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

resource functionRoleAssignmentResourceGroup 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid('b24988ac-6180-42a0-ab88-20f7382dd24c', 'function', resourceGroup().id, 'Reader') // Role ID for 'Reader' is predefined by Azure
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7') // Reader Role ID
    principalId: functionApp.identity.principalId
  }
}


@description('Generated from /subscriptions/4b89f88e-13f2-4990-bf5f-3ab2e4d5301f/resourceGroups/hitbox/providers/microsoft.insights/actiongroups/HitboxScaleDown')
resource HitboxScaleDown 'Microsoft.Insights/actionGroups@2024-10-01-preview' = {
  name: 'HitboxScaleDown'
  location: 'Global'
  properties: {
    groupShortName: 'ScaleDown'
    enabled: true
    emailReceivers: []
    smsReceivers: []
    webhookReceivers: []
    eventHubReceivers: []
    itsmReceivers: []
    azureAppPushReceivers: []
    automationRunbookReceivers: []
    voiceReceivers: []
    logicAppReceivers: []
    azureFunctionReceivers: [
      {
        name: 'ScaleDown'
        functionAppResourceId: functionApp.id
        functionName: 'ScaleDown'
        httpTriggerUrl: 'https://hitboxfunctions.azurewebsites.net/api/scaledown?code=${listKeys('${functionApp.id}/functions/ScaleDown', '2022-09-01').default}'
        useCommonAlertSchema: true
      }
    ]
    armRoleReceivers: []
  }
}


@description('Generated from /subscriptions/4b89f88e-13f2-4990-bf5f-3ab2e4d5301f/resourceGroups/hitbox/providers/microsoft.insights/actiongroups/HitboxScaleUp')
resource HitboxScaleUp 'Microsoft.Insights/actionGroups@2024-10-01-preview' = {
  name: 'HitboxScaleUp'
  location: 'Global'
  properties: {
    groupShortName: 'ScaleUp'
    enabled: true
    emailReceivers: []
    smsReceivers: []
    webhookReceivers: []
    eventHubReceivers: []
    itsmReceivers: []
    azureAppPushReceivers: []
    automationRunbookReceivers: []
    voiceReceivers: []
    logicAppReceivers: []
    azureFunctionReceivers: [
      {
        name: 'ScaleServerUp'
        functionAppResourceId: functionApp.id
        functionName: 'ScaleUp'
        httpTriggerUrl: 'https://hitboxfunctions.azurewebsites.net/api/scaleup?code=${listKeys('${functionApp.id}/functions/ScaleUp', '2022-09-01').default}'
        useCommonAlertSchema: true
      }
    ]
    armRoleReceivers: []
  }
}


@description('Generated from /subscriptions/4b89f88e-13f2-4990-bf5f-3ab2e4d5301f/resourceGroups/hitbox/providers/microsoft.insights/metricalerts/HitboxScaleDown')
resource HitboxScaleDownAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'HitboxScaleDown'
  location: 'global'
  tags: {}
  properties: {
    description: 'Scale down the server when no players are online for 5 minutes'
    severity: 3
    enabled: true
    scopes: [
      applicationInsights.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      allOf: [
        {
          threshold: json('0.0')
          name: 'Metric1'
          metricNamespace: 'Azure.ApplicationInsights'
          metricName: 'OnlinePlayers'
          operator: 'LessThanOrEqual'
          timeAggregation: 'Average'
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
      ]
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
    }
    autoMitigate: true
    targetResourceType: 'microsoft.insights/components'
    targetResourceRegion: 'northeurope'
    actions: [
      {
        actionGroupId: HitboxScaleDown.id
        webHookProperties: {}
      }
    ]
  }
}

// Additional scale down alert based on server state metric
resource HitboxServerStateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'HitboxServerStateAlert'
  location: 'global'
  tags: {}
  properties: {
    description: 'Scale down when the server has been scaled up but no players are online'
    severity: 3
    enabled: true
    scopes: [
      applicationInsights.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      allOf: [
        {
          threshold: json('1.0')
          name: 'Metric1'
          metricNamespace: 'Azure.ApplicationInsights'
          metricName: 'ServerScaledUp'
          operator: 'Equals'
          timeAggregation: 'Maximum'
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
        {
          threshold: json('0.0')
          name: 'Metric2'
          metricNamespace: 'Azure.ApplicationInsights'
          metricName: 'OnlinePlayers'
          operator: 'LessThanOrEqual'
          timeAggregation: 'Average'
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
      ]
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
    }
    autoMitigate: true
    targetResourceType: 'microsoft.insights/components'
    targetResourceRegion: 'northeurope'
    actions: [
      {
        actionGroupId: HitboxScaleDown.id
        webHookProperties: {}
      }
    ]
  }
}

@description('Generated from /subscriptions/4b89f88e-13f2-4990-bf5f-3ab2e4d5301f/resourceGroups/hitbox/providers/microsoft.insights/metricalerts/HitboxScaleUp')
resource HitboxScaleUpAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'HitboxScaleUp'
  location: 'global'
  tags: {}
  properties: {
    description: 'Scale up the server when at least one player is online'
    severity: 3
    enabled: true
    scopes: [
      applicationInsights.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT1M'
    criteria: {
      allOf: [
        {
          threshold: json('1.0')
          name: 'Metric1'
          metricNamespace: 'Azure.ApplicationInsights'
          metricName: 'OnlinePlayers'
          operator: 'GreaterThanOrEqual'
          timeAggregation: 'Maximum'
          skipMetricValidation: false
          criterionType: 'StaticThresholdCriterion'
        }
      ]
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
    }
    autoMitigate: true
    targetResourceType: 'microsoft.insights/components'
    targetResourceRegion: 'northeurope'
    actions: [
      {
        actionGroupId: HitboxScaleUp.id
        webHookProperties: {}
      }
    ]
  }
}
