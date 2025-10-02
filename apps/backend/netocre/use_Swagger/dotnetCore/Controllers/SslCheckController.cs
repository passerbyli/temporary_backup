using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Security;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace dotnetCore.Controllers;


        [ApiController]
    [Route("_sslcheck")]
    public class SslCheckController : ControllerBase
    {
        private readonly ILogger<SslCheckController> _logger;
        public SslCheckController(ILogger<SslCheckController> logger) => _logger = logger;

       
                /// <summary>
        /// POST: /_sslcheck
        /// body:
        /// {
        ///   "url": "https://api.xxx.com/health",
        ///   "authorization": "Bearer abc123",
        ///   "params": { "id": "100", "type": "test" }
        /// }
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Check([FromBody] SslCheckRequest body)
        {
            if (string.IsNullOrWhiteSpace(body?.Url) || !Uri.TryCreate(body.Url, UriKind.Absolute, out var uri) || uri.Scheme != "https")
                return BadRequest(new { error = "url 参数必须是 https 绝对地址" });

            // 拼接 params
            string urlWithParams = body.Url;
            if (body.Params != null && body.Params.Any())
            {
                var query = string.Join("&", body.Params.Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));
                urlWithParams += (uri.Query.Length > 0 ? "&" : "?") + query;
            }

            var result = new SslProbeReport
            {
                Url = urlWithParams,
                UtcNow = DateTime.UtcNow,
                ContainerCertStats = GetContainerCertStats(),
            };

            // 步骤 1：默认
            result.Steps.Add(await ProbeOnce(urlWithParams, new HttpClientHandler(), "default", body.Authorization));

            // 步骤 2：强制 TLS1.2
            result.Steps.Add(await ProbeOnce(urlWithParams, new HttpClientHandler { SslProtocols = SslProtocols.Tls12 }, "force_tls12", body.Authorization));

            // 步骤 3：强制 HTTP/1.1
            var h1 = new HttpClientHandler { SslProtocols = SslProtocols.Tls12 };
            result.Steps.Add(await ProbeOnce(urlWithParams, h1, "force_http11", body.Authorization, forceHttp11: true));

            // 步骤 4：抓链信息
            var capture = new CertCapture();
            var hCapture = new HttpClientHandler
            {
                SslProtocols = SslProtocols.Tls12,
                ServerCertificateCustomValidationCallback = (msg, cert, chain, errors) =>
                {
                    capture.Fill(cert, chain, errors);
                    return false;
                }
            };
            result.Steps.Add(await ProbeOnce(urlWithParams, hCapture, "capture_chain_only", body.Authorization));

            result.InferredIssues = InferIssues(result);

            return Ok(result);
        }

        // —— 请求体 DTO —— //
        public class SslCheckRequest
        {
            public string Url { get; set; }
            public string Authorization { get; set; }
            public Dictionary<string, string> Params { get; set; } = new Dictionary<string, string>();
        }

        // —— ProbeOnce 改造，加 Header —— //
        private async Task<SslProbeStep> ProbeOnce(string url, HttpMessageHandler handler, string label, string authorization = null, bool forceHttp11 = false)
        {
            var step = new SslProbeStep { Label = label, StartUtc = DateTime.UtcNow };
            try
            {
                using (var client = new HttpClient(handler, disposeHandler: true))
                {
                    var req = new HttpRequestMessage(HttpMethod.Get, url);
                    if (forceHttp11) req.Version = System.Net.HttpVersion.Version11;

                    if (!string.IsNullOrWhiteSpace(authorization))
                        req.Headers.TryAddWithoutValidation("Authorization", authorization);

                    using var res = await client.SendAsync(req);
                    step.StatusCode = (int)res.StatusCode;
                    step.Success = res.IsSuccessStatusCode;
                    step.HttpVersion = res.Version?.ToString();
                }
            }
            catch (Exception ex)
            {
                step.Success = false;
                step.Exception = ex.GetType().FullName;
                step.ExceptionMessage = ex.Message;
                step.InnerException = ex.InnerException?.GetType().FullName;
                step.InnerExceptionMessage = ex.InnerException?.Message;
                step.Stack = ex.ToString();
            }
            finally
            {
                step.EndUtc = DateTime.UtcNow;
            }
            return step;
        }

        
        private static ContainerCertStats GetContainerCertStats()
        {
            var stats = new ContainerCertStats();
            try
            {
                // 常见 Linux 信任库位置
                string[] dirs =
                {
                    "/etc/ssl/certs",
                    "/usr/local/share/ca-certificates",
                    "/etc/pki/ca-trust/source/anchors"
                };

                foreach (var d in dirs.Distinct().Where(Directory.Exists))
                {
                    var files = Directory.GetFiles(d, "*.*", SearchOption.TopDirectoryOnly)
                                         .Where(f => Regex.IsMatch(f, @"\.(crt|pem)$", RegexOptions.IgnoreCase))
                                         .ToList();
                    stats.Details.Add(new CertDirInfo { Dir = d, FileCount = files.Count, Samples = files.Take(5).ToList() });
                    stats.TotalFiles += files.Count;
                }
            }
            catch { /* 容器最小权限可能拒绝列目录，忽略 */ }
            stats.OsDescription = System.Runtime.InteropServices.RuntimeInformation.OSDescription;
            return stats;
        }

        private static List<string> InferIssues(SslProbeReport report)
        {
            var issues = new List<string>();

            var def = report.Steps.FirstOrDefault(s => s.Label == "default");
            var tls12 = report.Steps.FirstOrDefault(s => s.Label == "force_tls12");
            var h11 = report.Steps.FirstOrDefault(s => s.Label == "force_http11");
            var cap = report.Steps.FirstOrDefault(s => s.Label == "capture_chain_only");

            // 证书链类（从 capture 步骤的异常信息进行关键词推断）
            if (cap != null && !cap.Success)
            {
                var em = (cap.ExceptionMessage ?? "") + " " + (cap.InnerExceptionMessage ?? "") + " " + (cap.Stack ?? "");
                if (Regex.IsMatch(em, "RemoteCertificateChainErrors|certificate verify failed|UntrustedRoot|unable to get local issuer", RegexOptions.IgnoreCase))
                    issues.Add("可能的证书信任/链错误（安装 ca-certificates 或导入公司根证书）");

                if (Regex.IsMatch(em, "RemoteCertificateNameMismatch|hostname", RegexOptions.IgnoreCase))
                    issues.Add("证书域名不匹配（SNI/Host 不一致，勿用 IP 访问）");

                if (Regex.IsMatch(em, "RemoteCertificateNotAvailable", RegexOptions.IgnoreCase))
                    issues.Add("服务端要求客户端证书（mTLS），需要加载 client.pfx");
            }

            // 协议类：TLS/HTTP2
            if (def != null && !def.Success && tls12 != null && tls12.Success)
                issues.Add("TLS 版本协商问题（强制 TLS1.2 后成功）");

            if (def != null && !def.Success && h11 != null && h11.Success)
                issues.Add("HTTP/2 兼容问题（强制 HTTP/1.1 后成功）");

            // 容器根证书缺失
            if (report.ContainerCertStats.TotalFiles <= 5)
                issues.Add("容器内系统根证书数量异常偏少（需安装 ca-certificates 并 update-ca-certificates）");

            // 兜底
            if (issues.Count == 0 && def != null && !def.Success)
                issues.Add("未知 SSL 失败（查看 Steps[*].Exception/Stack 细节进一步判断）");

            return issues.Distinct().ToList();
        }

        // —— DTO —— //
        public class SslProbeReport
        {
            public string Url { get; set; }
            public DateTime UtcNow { get; set; }
            public ContainerCertStats ContainerCertStats { get; set; } = new ContainerCertStats();
            public List<SslProbeStep> Steps { get; set; } = new List<SslProbeStep>();
            public List<string> InferredIssues { get; set; } = new List<string>();
        }

        public class SslProbeStep
        {
            public string Label { get; set; }
            public DateTime StartUtc { get; set; }
            public DateTime EndUtc { get; set; }
            public bool Success { get; set; }
            public int? StatusCode { get; set; }
            public string HttpVersion { get; set; }
            public string Exception { get; set; }
            public string ExceptionMessage { get; set; }
            public string InnerException { get; set; }
            public string InnerExceptionMessage { get; set; }
            public string Stack { get; set; }
        }

        public class ContainerCertStats
        {
            public string OsDescription { get; set; }
            public int TotalFiles { get; set; }
            public List<CertDirInfo> Details { get; set; } = new List<CertDirInfo>();
        }

        public class CertDirInfo
        {
            public string Dir { get; set; }
            public int FileCount { get; set; }
            public List<string> Samples { get; set; }
        }

        // 仅为“抓链信息”的载体（若需更详细可扩展）
        private class CertCapture
        {
            public void Fill(X509Certificate2 cert, X509Chain chain, SslPolicyErrors errors) { /* 可按需扩展持久化 */ }
        }
    }