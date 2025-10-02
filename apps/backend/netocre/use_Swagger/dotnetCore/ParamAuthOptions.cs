// Filters/ParamAuthGlobalFilter.cs
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;

public class ParamAuthOptions
{
    public bool Enabled { get; set; } = true;
    public List<string> FieldPaths { get; set; } = new List<string> { "businessId", "channelCode", "customerCode" };
    public string AuthServiceBaseUrl { get; set; }
}

/// <summary>
/// 全局参数鉴权过滤器：开启时对请求体中配置的字段做鉴权，不通过返回 403
/// </summary>
public sealed class ParamAuthGlobalFilter : IAsyncActionFilter
{
    private readonly IOptionsMonitor<ParamAuthOptions> _opt;
    private readonly IParamAuthorizer _authorizer;
    private readonly ILogger<ParamAuthGlobalFilter> _logger;

    public ParamAuthGlobalFilter(IOptionsMonitor<ParamAuthOptions> opt, IParamAuthorizer authorizer, ILogger<ParamAuthGlobalFilter> logger)
    {
        _opt = opt; _authorizer = authorizer; _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        var cfg = _opt.CurrentValue;

        // 仅 POST 且开启时才检查（你也可以改成所有方法都检查）
        if (!cfg.Enabled || !HttpMethods.IsPost(http.Request.Method))
        {
            await next(); return;
        }

        // 只处理 JSON 请求
        var ct = http.Request.ContentType ?? "";
        if (!ct.Contains("application/json", StringComparison.OrdinalIgnoreCase))
        {
            await next(); return;
        }

        // 读取 Body（不影响后续模型绑定）
        http.Request.EnableBuffering();
        string raw;
        using (var sr = new StreamReader(http.Request.Body, leaveOpen: true))
            raw = await sr.ReadToEndAsync();
        http.Request.Body.Position = 0;

        if (string.IsNullOrWhiteSpace(raw) || cfg.FieldPaths == null || cfg.FieldPaths.Count == 0)
        {
            await next(); return;
        }

        // 抽取字段值
        string[] values;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            values = cfg.FieldPaths
                .SelectMany(p => ExtractByPath(root, p))
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ParamAuth 解析请求 JSON 失败，放行以避免误杀");
            await next(); return;
        }

        if (values.Length == 0)
        {
            await next(); return;
        }

        // 透传 Authorization 给第三方
        var forwardAuth = http.Request.Headers["Authorization"].FirstOrDefault();

        // 调第三方鉴权（任一值不通过则拒绝）
        var map = await _authorizer.AuthorizeBatchAsync(values, forwardAuth, http.RequestAborted);
        var denied = values.Where(v => !map.TryGetValue(v, out var ok) || !ok).ToArray();

        if (denied.Length > 0)
        {
            _logger.LogWarning("ParamAuth 拒绝：{Denied} Path={Path} User={User}",
                string.Join(",", denied), http.Request.Path, http.User?.Identity?.Name ?? "anonymous");

            context.Result = new JsonResult(new
            {
                code = 403,
                message = "无权限访问请求参数",
                detail = denied
            })
            { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        await next();
    }

    // 支持 "a.b" / "items[].id"
    private static IEnumerable<string> ExtractByPath(JsonElement root, string path)
    {
        var segs = path.Split('.', StringSplitOptions.RemoveEmptyEntries);
        IEnumerable<JsonElement> cur = new[] { root };

        foreach (var seg in segs)
        {
            var isArr = seg.EndsWith("[]", StringComparison.Ordinal);
            var name = isArr ? seg.Substring(0, seg.Length - 2) : seg;

            cur = cur.SelectMany(el =>
            {
                if (el.ValueKind != JsonValueKind.Object) return Enumerable.Empty<JsonElement>();
                if (!el.TryGetProperty(name, out var child)) return Enumerable.Empty<JsonElement>();
                if (isArr)
                    return child.ValueKind == JsonValueKind.Array ? child.EnumerateArray() : Enumerable.Empty<JsonElement>();
                return new[] { child };
            });
        }

        foreach (var el in cur)
        {
            switch (el.ValueKind)
            {
                case JsonValueKind.String:  yield return el.GetString(); break;
                case JsonValueKind.Number:  yield return el.GetRawText(); break; // 直接用原文
                case JsonValueKind.True:    yield return "true"; break;
                case JsonValueKind.False:   yield return "false"; break;
                default: /* 对象/数组不作为鉴权值 */ break;
            }
        }
    }
}