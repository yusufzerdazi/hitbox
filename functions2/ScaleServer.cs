using Azure.Core;
using Azure.Identity;
using Azure.ResourceManager;
using Azure.ResourceManager.AppService;
using Azure.ResourceManager.AppService.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Hitbox
{
    public class ScaleServer
    {
        private readonly ILogger<ScaleServer> _logger;
        private readonly AppServicePlanData _upSku;
        private readonly AppServicePlanData _downSku;

        public ScaleServer(ILogger<ScaleServer> logger)
        {
            _logger = logger;

            _upSku = new AppServicePlanData(AzureLocation.NorthEurope);
            _upSku.Kind = "app";
            _upSku.Sku = new AppServiceSkuDescription();
            _upSku.Sku.Name = "P0v3";
            _upSku.Sku.Tier = "Premium0V3";
            _upSku.Sku.Size = "P0v3";
            _upSku.Sku.Family = "Pv3";
            _upSku.Sku.Capacity = 1;

            _downSku = new AppServicePlanData(AzureLocation.NorthEurope);
            _downSku.Kind = "app";
            _downSku.Sku = new AppServiceSkuDescription();
            _downSku.Sku.Name = "B1";
            _downSku.Sku.Tier = "Basic";
            _downSku.Sku.Size = "B1";
            _downSku.Sku.Family = "B";
            _downSku.Sku.Capacity = 1;
        }

        [Function("ScaleServer")]
        public async Task<IActionResult> Run([HttpTrigger(AuthorizationLevel.Function, "get", "post")] HttpRequest req, [FromQuery] string scale)
        {
            if (scale != "up" && scale != "down")
            {
                return new BadRequestObjectResult(new
                {
                    message = "Invalid scale"
                });
            }

            var subscriptionId = "4b89f88e-13f2-4990-bf5f-3ab2e4d5301f";
            var resourceGroupName = "hitbox";
            var appServiceName = "hitbox";

            var client = new ArmClient(new DefaultAzureCredential());

            var subscription = client.GetSubscriptions().First(x => x.Data.SubscriptionId == subscriptionId);
            var resourceGroup = subscription.GetResourceGroup(resourceGroupName).Value;

            var appServices = resourceGroup.GetWebSites();
            var appService = appServices.Get(appServiceName).Value;

            var appServicePlanId = appService.Data.AppServicePlanId;
            var appServicePlanResourceGroupName = appServicePlanId.ResourceGroupName;
            var appServicePlanName = appServicePlanId.Name;

            var appServicePlan = resourceGroup.GetAppServicePlan(appServicePlanName).Value;

            AppServicePlanCollection collection = resourceGroup.GetAppServicePlans();

            var result = await collection.CreateOrUpdateAsync(
                waitUntil: Azure.WaitUntil.Completed,
                name: appServicePlanName,
                data: scale == "up" ? _upSku : _downSku
            );

            return new OkResult();
        }
    }
}
