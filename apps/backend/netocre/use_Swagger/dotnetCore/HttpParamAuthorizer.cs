

using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;
using System.Linq;
using System;

public sealed class HttpParamAuthorizer : IParamAuthorizer
{
    private readonly IHttpClientFactory _factory;
    private readonly ILogger<HttpParamAuthorizer> _logger;
    public HttpParamAuthorizer(IHttpClientFactory f, ILogger<HttpParamAuthorizer> logger) { _factory = f; _logger = logger; }

    public async Task<IDictionary<string, bool>> AuthorizeBatchAsync(IEnumerable<string> values, string fwdAuth, CancellationToken ct)
    {
        var vals = values.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var result = vals.ToDictionary(v => v, v => false, StringComparer.OrdinalIgnoreCase);
        if (vals.Length == 0) return result;

        var cli = _factory.CreateClient("Authz"); // Startup 里配置 BaseAddress
        var req = new HttpRequestMessage(HttpMethod.Post, "/authz/check");
        if (!string.IsNullOrWhiteSpace(fwdAuth))
            req.Headers.TryAddWithoutValidation("Authorization", fwdAuth);

        req.Content = new StringContent(JsonSerializer.Serialize(new { values = vals }), Encoding.UTF8, "application/json");

        try
        {
            var resp = await cli.SendAsync(req, ct);
            var text = await resp.Content.ReadAsStringAsync();
            resp.EnsureSuccessStatusCode();

            // 假设返回 { "result": { "v1": true, "v2": false } }
            using var doc = JsonDocument.Parse(text);
            var map = doc.RootElement.GetProperty("result");
            foreach (var v in vals)
                result[v] = map.TryGetProperty(v, out var je) && je.ValueKind == JsonValueKind.True;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "外部鉴权服务调用失败，默认拒绝");
        }

        return result;
    }
}