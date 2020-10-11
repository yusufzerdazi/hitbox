using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Processing;

namespace Hitbox
{
    public static class UploadAvatar
    {
        [FunctionName("UploadAvatar")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a request.");
            string connectionString = Environment.GetEnvironmentVariable("StorageAccountConnectionString");

            // Create a BlobServiceClient object which will be used to create a container client
            BlobServiceClient blobServiceClient = new BlobServiceClient(connectionString);

            //Create a unique name for the container
            string containerName = "avatars";

            // Create the container and return a container client object
            BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient(containerName);

            var formData = await req.ReadFormAsync();
            var file = formData.Files.GetFile("file");
            var fileExtension = Path.GetExtension(file.FileName);

            formData.TryGetValue("playerId", out var playerId);

            try{
                var blob = containerClient.GetBlobClient($"{playerId.ToString()}.jpg");
                using(var stream = file.OpenReadStream()) {
                    using(Image<Rgba32> input = Image.Load<Rgba32>(stream, out IImageFormat format)){
                        ResizeImage(input, (30, 30));
                        MemoryStream resizedStream = new MemoryStream();
                        input.Save(resizedStream, format);
                        resizedStream.Position = 0;
                        await blob.UploadAsync(resizedStream, overwrite: true);
                    }
                }
            } catch (Exception ex){
                log.LogWarning(ex, "Invalid file uploaded.");
                return new BadRequestObjectResult(new {error = "The image was an invalid format. Please try again."});
            }
            
            return new OkResult();
        }

        public static void ResizeImage(Image<Rgba32> input, (int,int) dimensions)
        {
            input.Mutate(x => x.Resize(dimensions.Item1, dimensions.Item2));
        }
    }
}
