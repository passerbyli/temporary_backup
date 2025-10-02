namespace dotnetCore.Middleware;

using Microsoft.AspNetCore.Builder;

public static class SecurityMiddlewareExtensions
{
    public static IApplicationBuilder UseSecurityPipeline(this IApplicationBuilder app)
    {
        // 统一顺序：异常 → Origin → 大请求 → XSS → 响应头
        app.UseMiddleware<GlobalExceptionMiddleware>();
        app.UseMiddleware<OriginValidationMiddleware>();
        app.UseMiddleware<RequestSizeLimitMiddleware>();
        // app.UseMiddleware<XssRequestFilterMiddleware>();
        app.UseMiddleware<XssEscapeMiddleware>();
        app.UseMiddleware<SecurityHeadersMiddleware>();

        return app;
    }
}