

namespace dotnetCore.Middleware;
using dotnetCore.Model;
using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

public class RequestSizeLimit3Middleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestSizeLimit3Middleware> _logger;
    private readonly SecurityOptions _opt;

    public RequestSizeLimit3Middleware(
        RequestDelegate next,
        ILogger<RequestSizeLimit3Middleware> logger,
        IOptions<SecurityOptions> options)
    {
        _next = next;
        _logger = logger;
        _opt = options.Value ?? new SecurityOptions();
    }

    public async Task Invoke(HttpContext context)
    {
        // 1) 整体请求体大小限制（最先拦截）
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

        if (!(_opt.EnableParamValueLimit && _opt.ParamValueMaxLength > 0))
        {
            await _next(context);
            return;
        }

        // 2) 只考虑 GET 与 POST
        if (HttpMethods.IsGet(context.Request.Method))
        {
            if (AnyQueryValueInvalid(context, _opt.ParamValueMaxLength,
                                     _opt.ParamNumericMin, _opt.ParamNumericMax,
                                     out var key, out var reason))
            {
                _logger.LogWarning("Request rejected (GET): {Reason}. Key={Key}. Path={Path}", reason, key, context.Request.Path);
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("Query parameter invalid.");
                return;
            }
        }
        else if (HttpMethods.IsPost(context.Request.Method))
        {
            var ct = context.Request.ContentType ?? string.Empty;
            var isJson = ct.IndexOf("application/json", StringComparison.OrdinalIgnoreCase) >= 0;

            // 仅支持 application/json
            if (isJson)
            {
                context.Request.EnableBuffering();
                string body;
                using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, false, 8192, leaveOpen: true))
                {
                    context.Request.Body.Position = 0;
                    body = await reader.ReadToEndAsync();
                }

                if (!CheckFirstLevelJsonValues(body, _opt.ParamValueMaxLength,
                                               _opt.ParamNumericMin, _opt.ParamNumericMax))
                {
                    _logger.LogWarning("Request rejected (POST JSON): first-level value invalid. Path={Path}", context.Request.Path);
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync("Body parameter invalid.");
                    return;
                }

                context.Request.Body.Position = 0; // 复位给后续读取
            }
        }

        await _next(context);
    }

    // —— GET：第一层 Query 值校验（字符串长度 + 数值边界）——
    private static bool AnyQueryValueInvalid(HttpContext ctx, int maxLen, double min, double max,
        out string offenderKey, out string reason)
    {
        offenderKey = null; reason = null;

        foreach (var kv in ctx.Request.Query)
        {
            foreach (var v in kv.Value)
            {
                if (v == null) continue;

                // 尝试按数字解析；成功则做数值边界判断；否则做字符串长度判断
                if (double.TryParse(v, System.Globalization.NumberStyles.Float,
                                    System.Globalization.CultureInfo.InvariantCulture, out var num))
                {
                    if (num < min || num > max)
                    {
                        offenderKey = kv.Key; reason = $"numeric out of range [{min}, {max}]";
                        return true;
                    }
                }
                else
                {
                    if (v.Length > maxLen)
                    {
                        offenderKey = kv.Key; reason = $"string length {v.Length} > {maxLen}";
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // —— POST-JSON：只检查根对象属性的字符串与数值 —— 只返回 bool（合法/不合法）
    private static bool CheckFirstLevelJsonValues(string json, int maxLen, double min, double max)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return true;

            foreach (var p in doc.RootElement.EnumerateObject())
            {
                var v = p.Value;
                switch (v.ValueKind)
                {
                    case JsonValueKind.String:
                        var s = v.GetString() ?? "";
                        if (s.Length > maxLen) return false;
                        break;

                    case JsonValueKind.Number:
                        if (!v.TryGetDouble(out var num)) return false; // 数字解析失败
                        if (num < min || num > max) return false;        // 超边界
                        break;

                    // 其他类型（bool/null/object/array）不检查
                }
            }
            return true;
        }
        catch
        {
            // 非法 JSON：这里不判 invalid，交由模型绑定决定
            return true;
        }
    }
}