using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;

namespace CatalogueApi.Services;

public class AwsS3Service
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly ILogger<AwsS3Service> _logger;

    public bool IsConfigured { get; }

    public AwsS3Service(IConfiguration configuration, ILogger<AwsS3Service> logger)
    {
        _logger = logger;
        _bucketName = configuration["AWS:BucketName"] ?? "pfsa";
        var accessKey = configuration["AWS:AccessKey"];
        var secretKey = configuration["AWS:SecretKey"];
        IsConfigured = !string.IsNullOrWhiteSpace(accessKey) && !string.IsNullOrWhiteSpace(secretKey);
        _s3Client = IsConfigured
            ? new AmazonS3Client(accessKey, secretKey, RegionEndpoint.USEast1)
            : new AmazonS3Client(new AmazonS3Config { RegionEndpoint = RegionEndpoint.USEast1 });
    }

    public async Task<string> UploadAsync(Stream stream, string key, string contentType)
    {
        var request = new TransferUtilityUploadRequest
        {
            InputStream = stream,
            Key = key,
            BucketName = _bucketName,
            ContentType = contentType,
            CannedACL = S3CannedACL.PublicRead,
        };
        using var xfer = new TransferUtility(_s3Client);
        await xfer.UploadAsync(request);
        return PublicUrl(key);
    }

    public string PublicUrl(string key) =>
        $"https://{_bucketName}.s3.amazonaws.com/{key}";
}
