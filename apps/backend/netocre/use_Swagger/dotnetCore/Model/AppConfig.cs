namespace dotnetCore.Model;

public class AppConfig
{
    /// <summary>
    /// 开启请求长度限制
    /// </summary>
    public bool EnableRequestSizeLimit { get; set; } = true;
    /// <summary>
    /// 用户信息
    /// </summary>
    public UserInfo UserInfo { get; set; }
}