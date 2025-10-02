using dotnetCore.Model;

namespace dotnetCore.Middleware;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public class RequestSizeLimit2Middleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestSizeLimitMiddleware> _logger;
    private readonly SecurityOptions _opt;

    private static readonly JsonSerializerOptions JsonOpt = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public RequestSizeLimit2Middleware(
        RequestDelegate next,
        ILogger<RequestSizeLimitMiddleware> logger,
        IOptions<SecurityOptions> options)
    {
        _next = next;
        _logger = logger;
        _opt = options.Value ?? new SecurityOptions();
    }

    public async Task Invoke(HttpContext context)
    {
        // —— 模式1：按请求体大小限制（最先拦截）——
        if (_opt.EnableRequestSizeLimit && _opt.MaxRequestBodySizeBytes > 0)
        {
            var len = context.Request.ContentLength;
            if (len.HasValue && len.Value > _opt.MaxRequestBodySizeBytes)
            {
                _logger.LogWarning("Request rejected: Content-Length {Len} > {Limit}. Path: {Path}",
                    len.Value, _opt.MaxRequestBodySizeBytes, context.Request.Path);
                context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
                await context.Response.WriteAsync("Payload too large.");
                return;
            }
        }

        // —— 模式2：按“第一层参数值长度”限制（GET/POST）——
        if (_opt.EnableParamValueLimit && _opt.ParamValueMaxLength > 0)
        {
            // GET：只检查 Query 值长度（不修改URL，一律拒绝）
            if (_opt.ParamValueCheckGet && HttpMethods.IsGet(context.Request.Method))
            {
                if (AnyQueryValueTooLong(context, _opt.ParamValueMaxLength, out var offenderKey, out var offenderLen))
                {
                    _logger.LogWarning(
                        "Request rejected: Query value too long. Key={Key}, Len={Len}, Max={Max}. Path={Path}",
                        offenderKey, offenderLen, _opt.ParamValueMaxLength, context.Request.Path);
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync("Query parameter too long.");
                    return;
                }
            }

            // POST：仅对 JSON / x-www-form-urlencoded 检查第一层值长度
            if (_opt.ParamValueCheckPost &&
                (HttpMethods.IsPost(context.Request.Method) ||
                 HttpMethods.IsPut(context.Request.Method) ||
                 HttpMethods.IsPatch(context.Request.Method)))
            {
                var ct = context.Request.ContentType ?? string.Empty;
                if (MatchesAnyContentType(ct, _opt.ParamValueContentTypes))
                {
                    context.Request.EnableBuffering();
                    string original;
                    using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, false, 8192, leaveOpen: true))
                    {
                        context.Request.Body.Position = 0;
                        original = await reader.ReadToEndAsync();
                    }

                    if (ct.Contains("application/json", StringComparison.OrdinalIgnoreCase))
                    {
                        var result = EnforceFirstLevelJsonValueLength(original, _opt.ParamValueMaxLength, _opt.ParamValueAction);
                        if (!result.Success)
                        {
                            _logger.LogWarning(
                                "Request rejected: JSON value too long. Key={Key}, Len={Len}, Max={Max}. Path={Path}",
                                result.OffenderKey, result.OffenderLen, _opt.ParamValueMaxLength, context.Request.Path);
                            context.Response.StatusCode = StatusCodes.Status400BadRequest;
                            await context.Response.WriteAsync("Body parameter too long.");
                            return;
                        }
                        if (result.RewrittenBody != null)
                        {
                            ReplaceRequestBody(context, result.RewrittenBody);
                        }
                        else
                        {
                            context.Request.Body.Position = 0;
                        }
                    }
                    else if (ct.Contains("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase))
                    {
                        var result = EnforceFirstLevelFormValueLength(original, _opt.ParamValueMaxLength, _opt.ParamValueAction);
                        if (!result.Success)
                        {
                            _logger.LogWarning(
                                "Request rejected: Form value too long. Key={Key}, Len={Len}, Max={Max}. Path={Path}",
                                result.OffenderKey, result.OffenderLen, _opt.ParamValueMaxLength, context.Request.Path);
                            context.Response.StatusCode = StatusCodes.Status400BadRequest;
                            await context.Response.WriteAsync("Body parameter too long.");
                            return;
                        }
                        if (result.RewrittenBody != null)
                        {
                            ReplaceRequestBody(context, result.RewrittenBody);
                        }
                        else
                        {
                            context.Request.Body.Position = 0;
                        }
                    }
                    else
                    {
                        // 其他类型（如 multipart）不处理
                        context.Request.Body.Position = 0;
                    }
                }
            }
        }

        await _next(context);
    }

    // —— 工具：GET 查询检查（仅第一层）——
    private static bool AnyQueryValueTooLong(HttpContext ctx, int max,
        out string offenderKey, out int offenderLen)
    {
        offenderKey = null;
        offenderLen = 0;
        foreach (var kv in ctx.Request.Query)
        {
            foreach (var v in kv.Value)
            {
                var len = v?.Length ?? 0;
                if (len > max)
                {
                    offenderKey = kv.Key;
                    offenderLen = len;
                    return true;
                }
            }
        }
        return false;
    }

    private static bool MatchesAnyContentType(string contentType, string csv)
    {
        var list = (csv ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim());
        return list.Any(t => contentType.IndexOf(t, StringComparison.OrdinalIgnoreCase) >= 0);
    }

    private static void ReplaceRequestBody(HttpContext ctx, string newBody)
    {
        var bytes = Encoding.UTF8.GetBytes(newBody);
        ctx.Request.Body = new MemoryStream(bytes);
        ctx.Request.ContentLength = bytes.LongLength;
    }

    // —— JSON：只检查第一层 string/number/bool/null 的“值”长度；数组/对象视为整体 ToString 长度不检查 —— 
    private static (bool Success, string OffenderKey, int OffenderLen, string RewrittenBody)
        EnforceFirstLevelJsonValueLength(string json, int max, string action)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                // 非对象的一层，跳过
                return (true, null, 0, null);
            }

            var root = doc.RootElement;
            var dict = new Dictionary<string, object>();
            string offenderKey = null;
            int offenderLen = 0;
            bool needRewrite = false;

            foreach (var p in root.EnumerateObject())
            {
                switch (p.Value.ValueKind)
                {
                    case JsonValueKind.String:
                        var s = p.Value.GetString() ?? "";
                        if (s.Length > max)
                        {
                            offenderKey = p.Name; offenderLen = s.Length;
                            if (IsTruncate(action))
                            {
                                dict[p.Name] = s.Substring(0, max);
                                needRewrite = true;
                            }
                            else
                            {
                                return (false, offenderKey, offenderLen, null);
                            }
                        }
                        else dict[p.Name] = s;
                        break;

                    case JsonValueKind.Number:
                        var numStr = p.Value.GetRawText();
                        if (numStr.Length > max)
                        {
                            offenderKey = p.Name; offenderLen = numStr.Length;
                            if (IsTruncate(action))
                            {
                                // 数字不建议截断为字符串；直接拒绝更安全
                                return (false, offenderKey, offenderLen, null);
                            }
                            else return (false, offenderKey, offenderLen, null);
                        }
                        else dict[p.Name] = p.Value.Clone().GetRawText(); // 保留原始
                        break;

                    case JsonValueKind.True:
                    case JsonValueKind.False:
                    case JsonValueKind.Null:
                        dict[p.Name] = JsonSerializer.Deserialize<object>(p.Value.GetRawText());
                        break;

                    default:
                        // 数组/对象：不检查（只第一层），原样保留
                        dict[p.Name] = JsonSerializer.Deserialize<object>(p.Value.GetRawText());
                        break;
                }
            }

            if (needRewrite)
            {
                var rewritten = JsonSerializer.Serialize(dict, JsonOpt);
                return (true, null, 0, rewritten);
            }
            return (true, null, 0, null);
        }
        catch
        {
            // 非法 JSON：交给模型绑定处理（这里不拒绝）
            return (true, null, 0, null);
        }
    }

    // —— x-www-form-urlencoded：仅第一层 key=value —— 
    private static (bool Success, string OffenderKey, int OffenderLen, string RewrittenBody)
        EnforceFirstLevelFormValueLength(string body, int max, string action)
    {
        var pairs = body.Split('&', StringSplitOptions.RemoveEmptyEntries);
        bool needRewrite = false;
        string offenderKey = null;
        int offenderLen = 0;

        for (int i = 0; i < pairs.Length; i++)
        {
            var kv = pairs[i].Split('=', 2);
            var key = kv[0];
            var val = kv.Length > 1 ? kv[1] : "";

            // 先 URL 解码（+ 转空格等）
            var decoded = Uri.UnescapeDataString(val ?? "");
            if (decoded.Length > max)
            {
                offenderKey = Uri.UnescapeDataString(key);
                offenderLen = decoded.Length;

                if (IsTruncate(action))
                {
                    var truncated = decoded.Substring(0, max);
                    var encoded = Uri.EscapeDataString(truncated);
                    pairs[i] = $"{key}={(kv.Length > 1 ? encoded : "")}";
                    needRewrite = true;
                }
                else
                {
                    return (false, offenderKey, offenderLen, null);
                }
            }
        }

        return needRewrite
            ? (true, null, 0, string.Join("&", pairs))
            : (true, null, 0, null);
    }

    private static bool IsTruncate(string action) =>
        "TRUNCATE".Equals(action, StringComparison.OrdinalIgnoreCase);
}