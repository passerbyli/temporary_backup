using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

public interface IParamAuthorizer
{
    /// <summary>批量鉴权：返回每个值是否有权限；外部服务失败时建议默认拒绝</summary>
    Task<IDictionary<string, bool>> AuthorizeBatchAsync(IEnumerable<string> values, string forwardAuthorizationHeader, CancellationToken ct);
}