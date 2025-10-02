using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Reflection;
using Microsoft.AspNetCore.Http;

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class BindAndPickAttribute : Attribute, IAsyncActionFilter
{
    public Type ModelType { get; }
    public AuthFieldKind FieldKind { get; }

    public BindAndPickAttribute(Type modelType, AuthFieldKind fieldKind)
    {
        ModelType = modelType ?? throw new ArgumentNullException(nameof(modelType));
        FieldKind = fieldKind;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var http = ctx.HttpContext;
        var logger = (ILogger<BindAndPickAttribute>)http.RequestServices.GetService(typeof(ILogger<BindAndPickAttribute>));

        // 只处理 JSON 的 POST
        var ct = http.Request.ContentType ?? "";
        if (!HttpMethods.IsPost(http.Request.Method) ||
            !ct.Contains("application/json", StringComparison.OrdinalIgnoreCase))
        {
            await next(); return;
        }

        // 读取 Body
        http.Request.EnableBuffering();
        string raw;
        using (var sr = new StreamReader(http.Request.Body, leaveOpen: true))
            raw = await sr.ReadToEndAsync();
        http.Request.Body.Position = 0;

        object model = null;
        string fieldValue = null;

        try
        {
            if (!string.IsNullOrWhiteSpace(raw))
            {
                model = JsonSerializer.Deserialize(raw, ModelType, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                // 通过反射读取字段值
                var propName = FieldKind.ToString(); // BusinessId / ChannelCode
                var prop = ModelType.GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
                if (prop != null && model != null)
                {
                    var val = prop.GetValue(model);
                    if (val != null) fieldValue = val.ToString();
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "BindAndPick 反序列化或取字段失败");
        }

        // 保存结果
        http.Items["__TypedBody"] = model;
        http.Items["__AuthFieldKind"] = FieldKind;
        http.Items["__AuthFieldValue"] = fieldValue;

        await next();
    }
}