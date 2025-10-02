using System;
using System.Collections.Generic;
using System.Linq;

namespace dotnetCore.Middleware;

using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

public class SingleJsonContentOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var body = operation.RequestBody;
        if (body?.Content == null || body.Content.Count <= 1) return;

        // 优先保留 application/json；没有则退而求其次保留任一 *+json
        if (body.Content.TryGetValue("application/json", out var appJson))
        {
            body.Content.Clear();
            body.Content["application/json"] = appJson;
        }
        else
        {
            var kv = body.Content.FirstOrDefault(kv => kv.Key.EndsWith("+json", StringComparison.OrdinalIgnoreCase));
            if (!kv.Equals(default(KeyValuePair<string, OpenApiMediaType>)))
            {
                body.Content.Clear();
                body.Content["application/json"] = kv.Value;
            }
        }
    }
}