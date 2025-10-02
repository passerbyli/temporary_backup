



using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace MySecureApi
{
    public class Startup
    {
        public IConfiguration Configuration { get; }

        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers(options =>
            {
                options.Filters.Add<XssActionFilter>();
            });
            services.AddControllers();
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            // ===== 单一总开关：开启则统一添加所有安全头 =====
            var enabled = Configuration.GetValue<bool>("SecurityHeaders:Enabled");
            if (enabled)
            {
                app.Use(async (context, next) =>
                {
                    // 核心：CSP（建议生产中用 nonce/hash 管理脚本，而不是放开 inline）
                    context.Response.Headers["Content-Security-Policy"] =
                        "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'";

                    // 防点击劫持
                    context.Response.Headers["X-Frame-Options"] = "DENY";

                    // 禁止 MIME 嗅探
                    context.Response.Headers["X-Content-Type-Options"] = "nosniff";

                    // 控制 Referer 泄露
                    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

                    // 仅 HTTPS 生效；开发环境通常不建议加
                    if (context.Request.IsHttps && !env.IsDevelopment())
                    {
                        context.Response.Headers["Strict-Transport-Security"] =
                            "max-age=31536000; includeSubDomains; preload";
                    }

                    // 限制浏览器敏感能力（按需增减）
                    context.Response.Headers["Permissions-Policy"] =
                        "geolocation=(), microphone=(), camera=()";

                    // 避免敏感接口被缓存
                    context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
                    context.Response.Headers["Pragma"] = "no-cache";
                    context.Response.Headers["Expires"] = "0";

                    await next();
                });
            }

            app.UseRouting();
            app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
        }
    }
}