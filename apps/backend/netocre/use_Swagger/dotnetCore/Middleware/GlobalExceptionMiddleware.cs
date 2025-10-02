namespace dotnetCore.Middleware;

using System;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task Invoke(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // 统一日志：避免打印整个 Body/原始入参（DoS 风险 & 敏感信息泄露）
            _logger.LogError(ex, "Unhandled exception. Path: {Path}", context.Request?.Path.Value);

            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json; charset=utf-8";

            var payload = new
            {
                traceId = context.TraceIdentifier,
                error = "Internal server error."
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
        }
    }
}