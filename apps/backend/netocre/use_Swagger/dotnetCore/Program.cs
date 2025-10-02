using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using NLog.Web;

namespace dotnetCore
{
    public class Program
    {
        public static void Main(string[] args)
        {
            // 确认内容根为 DLL 所在目录（避免找不到 appsettings.json）
            var contentRoot = AppContext.BaseDirectory;
            CreateHostBuilder(args, contentRoot).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args,string contentRoot) =>
            Host.CreateDefaultBuilder(args)
                .UseContentRoot(contentRoot)
                .ConfigureAppConfiguration((ctx, cfg) =>
                {
                    // 清掉默认以当前工作目录为准的源，重新按 DLL 目录加载
                    cfg.Sources.Clear();

                    var env = ctx.HostingEnvironment;

                    cfg
                        .SetBasePath(contentRoot)
                        .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                        .AddJsonFile($"appsettings.{env.EnvironmentName}.json", optional: true, reloadOnChange: true)
                        .AddEnvironmentVariables()
                        .AddCommandLine(args ?? Array.Empty<string>());

                    // 可选：输出当前使用的环境名，便于排查
                    Console.WriteLine($"Environment: {env.EnvironmentName}");
                    Console.WriteLine($"ContentRoot: {contentRoot}");
                })
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                }).UseNLog();
    }
}
