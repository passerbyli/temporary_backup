using System.Buffers;
using dotnetCore.Model;

namespace dotnetCore.Middleware;

using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public class XssRequestFilterMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<XssRequestFilterMiddleware> _logger;
    private readonly SecurityOptions _options;
    private readonly HtmlEncoder _htmlEncoder;

    private string[] _dangerTokens;
    private string[] _contentTypes;

    public XssRequestFilterMiddleware(
        RequestDelegate next,
        ILogger<XssRequestFilterMiddleware> logger,
        IOptions<SecurityOptions> options,
        HtmlEncoder htmlEncoder)
    {
        _next = next;
        _logger = logger;
        _options = options.Value ?? new SecurityOptions();
        _htmlEncoder = htmlEncoder;

        _dangerTokens = (_options.XssDangerTokens ?? string.Empty)
            .Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToArray();

        _contentTypes = (_options.XssContentTypes ?? string.Empty)
            .Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToArray();
    }

    public async Task Invoke(HttpContext context)
    {
        if (!_options.EnableXssRequestFilter)
        {
            await _next(context);
            return;
        }

        // 仅在指定的 Content-Type 下检查
        var ct = context.Request.ContentType ?? string.Empty;
        if (!_contentTypes.Any(t => ct.IndexOf(t, StringComparison.OrdinalIgnoreCase) >= 0))
        {
            await _next(context);
            return;
        }

        // 只处理可读可查的请求（POST/PUT/PATCH 通常有 body）
        if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method))
        {
            await _next(context);
            return;
        }

        // 允许重复读取
        context.Request.EnableBuffering();

        // 读取前 N 字节用于扫描
        var limit = Math.Max(1024, _options.XssScanBytesLimit);
        string headText;
        using (var reader = new StreamReader(
                   context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false,
                   bufferSize: limit, leaveOpen: true))
        {
            char[] buf = ArrayPool<char>.Shared.Rent(limit);
            try
            {
                int read = await reader.ReadBlockAsync(buf, 0, limit);
                headText = new string(buf, 0, read);
            }
            finally
            {
                ArrayPool<char>.Shared.Return(buf);
            }
        }

        // 恢复流位置供后续中间件读取
        context.Request.Body.Position = 0;

        if (IsDangerous(headText))
        {
            if (string.Equals(_options.XssAction, "Sanitize", StringComparison.OrdinalIgnoreCase))
            {
                // 简单“清洗”（演示）：将可疑片段整体 HTML 编码
                // 你也可以在这里做更细粒度的替换（谨慎！）
                var sanitized = _htmlEncoder.Encode(await ReadAllAsync(context.Request.Body));
                RewriteRequestBody(context, sanitized);
                _logger.LogWarning("XSS-like payload sanitized. Path: {Path}", context.Request.Path);
                await _next(context);
                return;
            }
            else
            {
                // 直接拒绝
                _logger.LogWarning("Request rejected by XSS filter. Path: {Path}", context.Request.Path);
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("Bad request.");
                return;
            }
        }

        await _next(context);
    }

    private bool IsDangerous(string text)
    {
        if (string.IsNullOrEmpty(text)) return false;

        var comparison = _options.XssCaseInsensitive ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        foreach (var token in _dangerTokens)
        {
            if (token.StartsWith("regex:", StringComparison.Ordinal))
            {
                // 支持 regex: 开头的正则规则
                var pattern = token.Substring("regex:".Length);
                var opts = _options.XssCaseInsensitive ? RegexOptions.IgnoreCase : RegexOptions.None;
                if (Regex.IsMatch(text, pattern, opts)) return true;
            }
            else
            {
                if (text.IndexOf(token, comparison) >= 0) return true;
            }
        }
        return false;
    }

    private static async Task<string> ReadAllAsync(Stream body)
    {
        body.Position = 0;
        using var reader = new StreamReader(body, Encoding.UTF8, false, 1024, leaveOpen: true);
        var s = await reader.ReadToEndAsync();
        body.Position = 0;
        return s;
    }

    private static void RewriteRequestBody(HttpContext ctx, string newBody)
    {
        // 用新的内存流替换请求体
        var bytes = Encoding.UTF8.GetBytes(newBody);
        var ms = new MemoryStream(bytes);
        ctx.Request.Body = ms;
    }
}