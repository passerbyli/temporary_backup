using dotnetCore.Model;

namespace dotnetCore.Middleware;

using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public class OriginValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<OriginValidationMiddleware> _logger;
    private readonly SecurityOptions _options;

    public OriginValidationMiddleware(
        RequestDelegate next,
        ILogger<OriginValidationMiddleware> logger,
        IOptions<SecurityOptions> options)
    {
        _next = next;
        _logger = logger;
        _options = options.Value ?? new SecurityOptions();
    }

    public async Task Invoke(HttpContext context)
    {
        if (!_options.EnableOriginValidation)
        {
            await _next(context);
            return;
        }

        var origin = context.Request.Headers["Origin"].FirstOrDefault();

        // 1. 不携带
        if (origin == null)
        {
            _logger.LogWarning("Request rejected: missing Origin header. Path: {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsync("Missing Origin header.");
            return;
        }

        // 2. 为空
        if (string.IsNullOrWhiteSpace(origin))
        {
            _logger.LogWarning("Request rejected: empty Origin header. Path: {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsync("Empty Origin header.");
            return;
        }

        // 3. 不在白名单
        if (_options.AllowedOrigins == null || _options.AllowedOrigins.Length == 0)
        {
            _logger.LogWarning("Request rejected: no allowed origins configured. Path: {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync("Origin not allowed.");
            return;
        }

        var comparison = _options.OriginIgnoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        var matched = _options.AllowedOrigins.Any(allowed =>
            string.Equals(allowed.Trim(), origin.Trim(), comparison));

        if (!matched)
        {
            _logger.LogWarning("Request rejected: invalid Origin {Origin}. Path: {Path}", origin, context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync("Invalid Origin.");
            return;
        }

        // 通过
        await _next(context);
    }
}