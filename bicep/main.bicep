resource blobStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  name: 'hitbox'
  location: 'northeurope'
  tags: {}
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
    allowSharedKeyAccess: true
    networkAcls: {
      ipv6Rules: []
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

resource cdn 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: 'hitbox'
  location: 'Global'
  tags: {}
  sku: {
    name: 'Standard_Microsoft'
  }
  properties: {}
}


@description('Generated from /subscriptions/4b89f88e-13f2-4990-bf5f-3ab2e4d5301f/resourceGroups/hitbox/providers/Microsoft.Cdn/profiles/hitbox/endpoints/hitbox')
resource endpoint 'Microsoft.Cdn/profiles/endpoints@2023-05-01' = {
  parent: cdn
  name: 'hitbox'
  location: 'Global'
  tags: {}
  properties: {
    originHostHeader: 'hitbox.z16.web.core.windows.net'
    contentTypesToCompress: [
      'application/eot'
      'application/font'
      'application/font-sfnt'
      'application/javascript'
      'application/json'
      'application/opentype'
      'application/otf'
      'application/pkcs7-mime'
      'application/truetype'
      'application/ttf'
      'application/vnd.ms-fontobject'
      'application/xhtml+xml'
      'application/xml'
      'application/xml+rss'
      'application/x-font-opentype'
      'application/x-font-truetype'
      'application/x-font-ttf'
      'application/x-httpd-cgi'
      'application/x-javascript'
      'application/x-mpegurl'
      'application/x-opentype'
      'application/x-otf'
      'application/x-perl'
      'application/x-ttf'
      'font/eot'
      'font/ttf'
      'font/otf'
      'font/opentype'
      'image/svg+xml'
      'text/css'
      'text/csv'
      'text/html'
      'text/javascript'
      'text/js'
      'text/plain'
      'text/richtext'
      'text/tab-separated-values'
      'text/xml'
      'text/x-script'
      'text/x-component'
      'text/x-java-source'
    ]
    isCompressionEnabled: true
    isHttpAllowed: true
    isHttpsAllowed: true
    queryStringCachingBehavior: 'IgnoreQueryString'
    origins: [
      {
        name: 'hitbox-z16-web-core-windows-net'
        properties: {
          hostName: 'hitbox.z16.web.core.windows.net'
          enabled: true
        }
      }
    ]
    deliveryPolicy: {
      rules: [
        {
          name: 'HTTPS'
          actions: [
            {
              name: 'UrlRedirect'
              parameters: {
                redirectType: 'PermanentRedirect'
                typeName: 'DeliveryRuleUrlRedirectActionParameters'
                destinationProtocol:'Https'
              }
            }
          ]
          order: 1
          conditions: [
            {
              name: 'RequestScheme'
              parameters: {
                operator: 'Equal'
                typeName: 'DeliveryRuleRequestSchemeConditionParameters'
                matchValues: [
                  'HTTP'
                ]
                negateCondition:false
                transforms: []
              }
            }
          ]
        }
      ]
    }
    originGroups: []
    geoFilters: []
    urlSigningKeys: []
  }
}
