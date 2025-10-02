using System.Threading.Tasks;
using dotnetCore.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace dotnetCore.Middleware;

/// <summary>
/// 自定义异常过滤器
/// </summary>
public class CustomerExceptionFilter : IAsyncExceptionFilter
{
    /// <summary>
    /// 重写OnExceptionAsync方法，定义自己的处理逻辑
    /// </summary>
    /// <param name="context"></param>
    /// <returns></returns>
    private readonly ILogger<CustomerExceptionFilter> _logger;
    public CustomerExceptionFilter(ILogger<CustomerExceptionFilter> logger)
    {
        _logger = logger;
    }
    public Task OnExceptionAsync(ExceptionContext context)
    {
        // 如果异常没有被处理则进行处理
        if(context.ExceptionHandled==false)
        {
            // 定义返回类型
            var result = new ResultModel<string>
            {
                ResultCode = 0,
                ResultMsg = context.Exception.Message
            };
            _logger.LogInformation("502 Bad Gateway: ");
            context.Result = new ContentResult
            {
                // 返回状态码设置为200，表示成功
                StatusCode = StatusCodes.Status200OK,
                // 设置返回格式
                ContentType="application/json;charset=utf-8",
                Content=JsonConvert.SerializeObject(result)
            };
        }
        // 设置为true，表示异常已经被处理了
        context.ExceptionHandled = true;
        return Task.CompletedTask;
    }
}