using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.Tasks;
using dotnetCore.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public class XssEscapeMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<XssEscapeMiddleware> _logger;
    private readonly SecurityOptions _options;

    private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
    {
        // 让 JSON 序列化时正常转义，不破坏结构
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = false,
        PropertyNameCaseInsensitive = true
    };

    public XssEscapeMiddleware(
        RequestDelegate next,
        ILogger<XssEscapeMiddleware> logger,
        IOptions<SecurityOptions> options)
    {
        _next = next;
        _logger = logger;
        _options = options.Value ?? new SecurityOptions();
    }

    public async Task Invoke(HttpContext context)
    {
        if (!_options.EnableXssRequestFilter)
        {
            await _next(context);
            return;
        }

        var ct = context.Request.ContentType ?? string.Empty;
        bool hasBody = (context.Request.ContentLength ?? 0) > 0 || context.Request.Body.CanRead;
        if (!hasBody)
        {
            await _next(context);
            return;
        }

        // 仅处理常见文本负载；跳过 multipart/form-data 等
        bool isJson = ct.IndexOf("application/json", StringComparison.OrdinalIgnoreCase) >= 0;
        bool isForm = ct.IndexOf("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase) >= 0;
        bool isText = ct.IndexOf("text/plain", StringComparison.OrdinalIgnoreCase) >= 0;

        if (!(isJson || isForm || isText))
        {
            await _next(context);
            return;
        }

        context.Request.EnableBuffering();

        string original;
        using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, false, 8192, leaveOpen: true))
        {
            context.Request.Body.Position = 0;
            original = await reader.ReadToEndAsync();
        }

        string sanitized = original;

        if (isJson)
        {
            sanitized = SanitizeJson(original, _options);
        }
        else if (isForm)
        {
            sanitized = SanitizeFormUrlEncoded(original, _options);
        }
        else if (isText)
        {
            sanitized = SanitizeText(original, _options);
        }

        if (!string.Equals(original, sanitized, StringComparison.Ordinal))
        {
            _logger.LogWarning("XSS dangerous tokens found and escaped. Path: {Path}", context.Request.Path);

            var bytes = Encoding.UTF8.GetBytes(sanitized);
            context.Request.Body = new MemoryStream(bytes);
            context.Request.ContentLength = bytes.LongLength;
        }
        else
        {
            context.Request.Body.Position = 0;
        }

        await _next(context);
    }

    // —— 工具：仅转义字符串“值”，不碰 JSON 结构 ——
    private string SanitizeJson(string json, SecurityOptions opt)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = SanitizeElement(doc.RootElement, opt);
            return JsonSerializer.Serialize(root, _jsonOptions);
        }
        catch
        {
            // JSON 非法时，保守策略：不改动，交由模型绑定报错
            return json;
        }
    }

    private object SanitizeElement(JsonElement elem, SecurityOptions opt)
    {
        switch (elem.ValueKind)
        {
            case JsonValueKind.Object:
                var dict = new Dictionary<string, object>();
                foreach (var p in elem.EnumerateObject())
                    dict[p.Name] = SanitizeElement(p.Value, opt);
                return dict;

            case JsonValueKind.Array:
                var list = new List<object>();
                foreach (var v in elem.EnumerateArray())
                    list.Add(SanitizeElement(v, opt));
                return list;

            case JsonValueKind.String:
                var s = elem.GetString();
                return EscapeDangerousTokensInValue(s, opt);

            // 数字/布尔/null 直接返回其 CLR 值
            case JsonValueKind.Number:
                if (elem.TryGetInt64(out var l)) return l;
                if (elem.TryGetDouble(out var d)) return d;
                return elem.GetRawText(); // 兜底

            case JsonValueKind.True: return true;
            case JsonValueKind.False: return false;
            case JsonValueKind.Null: return null;

            default:
                return elem.GetRawText();
        }
    }

    // —— application/x-www-form-urlencoded ——
    private string SanitizeFormUrlEncoded(string body, SecurityOptions opt)
    {
        // 形如 a=1&b=2，对每个值做转义再 UrlEncode 回去
        var pairs = body.Split('&', StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < pairs.Length; i++)
        {
            var kv = pairs[i].Split('=', 2);
            var key = kv[0];
            var val = kv.Length > 1 ? kv[1] : "";

            // 先 URL 解码，再做危险关键字转义，然后再编码回去
            var decoded = Uri.UnescapeDataString(val);
            var sanitizedVal = EscapeDangerousTokensInValue(decoded, opt);
            var encoded = Uri.EscapeDataString(sanitizedVal);
            pairs[i] = $"{key}={(kv.Length > 1 ? encoded : "")}";
        }
        return string.Join("&", pairs);
    }

    // —— text/plain —— 
    private string SanitizeText(string body, SecurityOptions opt)
    {
        return EscapeDangerousTokensInValue(body, opt);
    }

    // 只对文本值做 HTML 转义 + 危险关键字替换（大小写不敏感）
    private string EscapeDangerousTokensInValue(string input, SecurityOptions opt)
    {
        if (string.IsNullOrEmpty(input)) return input;

        // 先基础 HTML 转义 < > " ' & （这是对“值”的转义，不会破坏 JSON 结构）
        string escaped = System.Net.WebUtility.HtmlEncode(input);

        // 再把危险关键字（如 javascript:, onerror= 等）整体替换为已编码形式，进一步保险
        var tokens = (opt.XssDangerTokens ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.Trim())
            .Where(t => t.Length > 0);

        foreach (var token in tokens)
        {
            escaped = ReplaceIgnoreCase(escaped, token, System.Net.WebUtility.HtmlEncode(token));
        }
        return escaped;
    }

    private static string ReplaceIgnoreCase(string source, string oldValue, string newValue)
    {
        if (string.IsNullOrEmpty(source) || string.IsNullOrEmpty(oldValue)) return source;
        int startIndex = 0;
        var sb = new StringBuilder(source.Length);
        while (true)
        {
            int idx = source.IndexOf(oldValue, startIndex, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) { sb.Append(source, startIndex, source.Length - startIndex); break; }
            sb.Append(source, startIndex, idx - startIndex);
            sb.Append(newValue);
            startIndex = idx + oldValue.Length;
        }
        return sb.ToString();
    }
}