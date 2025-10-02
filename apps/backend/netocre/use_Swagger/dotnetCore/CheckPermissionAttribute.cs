using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using System.Reflection;
using System.Text.Json.Nodes;
using dotnetCore.Manager;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using JsonSerializer = Newtonsoft.Json.JsonSerializer;

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public class CheckPermissionAttribute : Attribute, IAsyncActionFilter
{
    private  readonly ICommonManager _common;
    public Type ModelType { get; }
    public AuthFieldKind FieldKind { get; }

    public CheckPermissionAttribute(Type modelType, AuthFieldKind fieldKind,ICommonManager common)
    {
        _common = common;
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

        string raw = null;
        
        // raw=http.data.toString();

        object model = null;
        string fieldValue = null;

        try
        {
            if (!string.IsNullOrWhiteSpace(raw))
            {
                model = JsonConvert.DeserializeObject(raw, ModelType);

                // 通过反射读取字段值
                var propName = FieldKind.ToString(); // BusinessId / ChannelCode
                var prop = ModelType.GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
                if (prop != null && model != null)
                {
                    var val = prop.GetValue(model);
                    if (val != null)
                    {
                        fieldValue = val.ToString();
                        var ok = _common.checkPermission(fieldValue);
                        if (!ok)
                        {
                            ctx.Result = new ObjectResult(new { });
                            return;
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "BindAndPick 反序列化或取字段失败");
        }

        await next();
    }
}