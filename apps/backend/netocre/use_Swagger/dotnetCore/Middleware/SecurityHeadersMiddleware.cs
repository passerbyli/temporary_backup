using dotnetCore.Model;

namespace dotnetCore.Middleware;

using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly SecurityOptions _options;

    public SecurityHeadersMiddleware(RequestDelegate next, IOptions<SecurityOptions> options)
    {
        _next = next;
        _options = options.Value ?? new SecurityOptions();
    }

    public async Task Invoke(HttpContext context)
    {
        if (_options.EnableSecurityHeaders)
        {
            var headers = context.Response.Headers;

            // 禁止 MIME 类型嗅探
            headers["X-Content-Type-Options"] = "nosniff";
            // 防止 iframe 嵌套攻击
            headers["X-Frame-Options"] = "DENY";
            // 开启浏览器 XSS 保护
            headers["X-XSS-Protection"] = "1; mode=block";
            // HSTS (仅 HTTPS)
            if (context.Request.IsHttps)
                headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            // 基本 CSP 策略
            headers["Content-Security-Policy"] =
                "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';";
            // Referrer Policy
            headers["Referrer-Policy"] = "no-referrer";
        }

        await _next(context);
    }
}