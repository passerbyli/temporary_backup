using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using System;
using System.IO;
using System.Net.Http;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using dotnetCore.Manager;
using dotnetCore.Middleware;
using dotnetCore.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Options;

namespace dotnetCore
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        public string ApiName { get; set; } = "dotnetCore";

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            var features = Configuration.GetSection("Features");
            // 1) 绑定 Security 节点到 Options
            services.Configure<SecurityOptions>(Configuration.GetSection("Security"));

            services.Configure<AppConfig>(Configuration.GetSection("AppConfig"));
            services.Configure<IISServerOptions>(options =>
            {
                options.MaxRequestBodySize = 10 * 1024; // 10KB
            });

            services.Configure<KestrelServerOptions>(options =>
            {
                options.Limits.MaxRequestBodySize = 10 * 1024; // 10KB
            });


            services.AddControllers(options => { options.Filters.Add<CustomerExceptionFilter>(); })
                .AddJsonOptions(o =>
                {
                    // 响应出站的 HTML 编码（降低反射型 XSS 风险）
                    o.JsonSerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
                    // 也可以改为 HtmlEncoder.Default 根据需要
                });
            if (features.GetValue<bool>("EnableApiBehavior"))
            {
                services.Configure<ApiBehaviorOptions>(opt =>
                {
                    opt.InvalidModelStateResponseFactory = ctx =>
                    {
                        var result = new
                        {
                            status = 500,
                            error = "params error"
                        };

                        // 固定返回 200
                        return new OkObjectResult(result)
                        {
                            ContentTypes = { "application/json" }
                        };
                    };
                });
            }

            if (features.GetValue("EnableSwagger", true))
            {
                services.AddSwaggerGen(c =>
                {
                    c.SwaggerDoc("V1", new OpenApiInfo
                    {
                        // {ApiName} 定义成全局变量，方便修改
                        Version = "V1",
                        Title = $"{ApiName} 接口文档――Netcore 3.0",
                        Description = $"{ApiName} HTTP API V1",
                        Contact = new OpenApiContact
                            { Name = ApiName, Email = "dotnetCore@xxx.com", Url = new Uri("https://www.baidu.com") },
                        License = new OpenApiLicense { Name = ApiName, Url = new Uri("https://www.baidu.com") }
                    });
                    c.OrderActionsBy(o => o.RelativePath);
                    c.OperationFilter<SingleJsonContentOperationFilter>();

                    var xmlPath = Path.Combine(AppContext.BaseDirectory, $"dotnetCore.xml");
                    c.IncludeXmlComments(xmlPath, true);


                    c.AddServer(new OpenApiServer() { Url = "http://localhost:5001", Description = "本地" });
                    c.CustomOperationIds(api =>
                    {
                        // 控制器名
                        var ctrl = api.ActionDescriptor.RouteValues.TryGetValue("controller", out var vCtrl)
                            ? vCtrl
                            : "Unknown";
                        // Action 名或显式 Name（优先路由 Name）
                        var action = api.ActionDescriptor.RouteValues.TryGetValue("action", out var vAct) ? vAct : null;
                        var http = api.HttpMethod?.ToLowerInvariant() ?? "http";

                        // 路径里可能有 {id} 等，带上可增强唯一性（可选）
                        var path = api.RelativePath // e.g. "users/{id}"
                            ?.Replace("/", "_")
                            ?.Replace("{", "")
                            ?.Replace("}", "")
                            ?.Replace("-", "_");

                        // 你可以按需裁剪：常见是 Controller + Http + Action
                        // 为确保唯一，这里再拼上规范化后的 path
                        var baseId = $"{ctrl}_{http}_{(action ?? "op")}_{path}".TrimEnd('_');

                        // 清理非法字符，转驼峰/蛇形都行
                        var opId = Regex.Replace(baseId, @"[^A-Za-z0-9_]", "_");
                        return opId;
                    });


                    #region Token绑定到ConfigureServices

                    c.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
                    {
                        Description = "JWT授权(数据将在请求头中进行传输) 直接在下框中输入Bearer {token}（注意两者之间是一个空格）\"",
                        Name = "Authorization", //jwt默认的参数名称
                        In = ParameterLocation.Header, //jwt默认存放Authorization信息的位置(请求头中)
                        Type = SecuritySchemeType.ApiKey
                    });

                    #endregion
                });
            }

            // HtmlEncoder 供中间件使用（简单清洗时）
            services.AddSingleton(HtmlEncoder.Default);

            /********/
            services.Configure<ParamAuthOptions>(Configuration.GetSection("ParamAuth"));

            services.AddHttpClient("ParamAuthClient", (sp, c) =>
                {
                    var opt = sp.GetRequiredService<IOptionsMonitor<ParamAuthOptions>>().CurrentValue;
                    c.BaseAddress = new Uri(opt.AuthServiceBaseUrl ?? "https://authz.example.com");
                    c.Timeout = TimeSpan.FromSeconds(5);
                })
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                {
                    SslProtocols = System.Security.Authentication.SslProtocols.Tls12
                });
            var ignoreSsl = Configuration.GetValue<bool>("Security:IgnoreSsl");

            services.AddHttpClient("default").ConfigureHttpMessageHandlerBuilder(builder =>
            {
                builder.PrimaryHandler = new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = ignoreSsl
                        ? (m, c, ch, e) => true
                        : null // 使用默认验证
                };
            });

            services.AddScoped<IParamAuthorizer, HttpParamAuthorizer>();

            services.AddControllers(options =>
            {
                // 全局注册唯一过滤器
                options.Filters.Add<ParamAuthGlobalFilter>();
            });
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseSwagger();

            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint($"/swagger/V1/swagger.json", $"{ApiName} V1");

                //路径配置，设置为空，表示直接在根域名（localhost:8001）访问该文件,注意localhost:8001/swagger是访问不到的，去launchSettings.json把launchUrl去掉，如果你想换一个路径，直接写名字即可，比如直接写c.RoutePrefix = "doc";
                c.RoutePrefix = "";
            });

            app.UseHttpsRedirection();


            app.UseSecurityPipeline(); // 一行启用安全管道

            // 顺序：大小限制 > XSS 过滤 > 路由
            // app.UseMiddleware<RequestSizeLimitMiddleware>();
            // app.UseMiddleware<XssRequestFilterMiddleware>();

            app.UseRouting();

            app.UseAuthorization();

            app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
        }
    }
}