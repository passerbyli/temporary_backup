using dotnetCore.Model;

namespace dotnetCore.Middleware;

using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public class RequestSizeLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestSizeLimitMiddleware> _logger;
    private readonly SecurityOptions _options;

    public RequestSizeLimitMiddleware(
        RequestDelegate next,
        ILogger<RequestSizeLimitMiddleware> logger,
        IOptions<SecurityOptions> options)
    {
        _next = next;
        _logger = logger;
        _options = options.Value ?? new SecurityOptions();
    }

    public async Task Invoke(HttpContext context)
    {
        if (_options.EnableRequestSizeLimit && _options.MaxRequestBodySizeBytes > 0)
        {
            var len = context.Request.ContentLength;
            if (len.HasValue && len.Value > _options.MaxRequestBodySizeBytes)
            {
                _logger.LogWarning("Request rejected due to Content-Length {Len} > {Limit}. Path: {Path}",
                    len.Value, _options.MaxRequestBodySizeBytes, context.Request.Path);

                context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
                await context.Response.WriteAsync("Payload too large.");
                return;
            }
        }

        await _next(context);
    }
}