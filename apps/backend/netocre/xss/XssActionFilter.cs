using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using System.Reflection;
using System.Text.Encodings.Web;

public class XssActionFilter : IActionFilter
{
    private readonly bool _enabled;
    private readonly HtmlEncoder _encoder;

    public XssActionFilter(IConfiguration config)
    {
        _enabled = config.GetValue<bool>("Xss:Enabled");
        _encoder = HtmlEncoder.Default;
    }

    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!_enabled) return;

        // 检查是否打了 [IgnoreXss]
        var descriptor = context.ActionDescriptor as ControllerActionDescriptor;
        if (descriptor != null)
        {
            var hasIgnore = descriptor.MethodInfo.GetCustomAttribute<IgnoreXssAttribute>() != null
                         || descriptor.ControllerTypeInfo.GetCustomAttribute<IgnoreXssAttribute>() != null;
            if (hasIgnore) return;
        }

        foreach (var key in context.ActionArguments.Keys.ToList())
        {
            var arg = context.ActionArguments[key];
            if (arg == null) continue;

            SanitizeObject(arg);
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }

    private void SanitizeObject(object obj)
    {
        if (obj == null) return;

        if (obj is string str)
        {
            obj = _encoder.Encode(str);
            return;
        }

        var type = obj.GetType();
        if (type.IsClass && type != typeof(string))
        {
            foreach (var prop in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (!prop.CanRead || !prop.CanWrite) continue;

                var value = prop.GetValue(obj);
                if (value is string s)
                {
                    prop.SetValue(obj, _encoder.Encode(s));
                }
                else
                {
                    SanitizeObject(value);
                }
            }
        }
    }
}