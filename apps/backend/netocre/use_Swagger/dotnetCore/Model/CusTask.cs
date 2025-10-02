using System.ComponentModel.DataAnnotations;

namespace dotnetCore.Model;

public class CusTask
{
    /// <summary>
    /// 标题
    /// </summary>
    [StringLength(10, MinimumLength = 3)]
    public string Title { get; set; }
    /// <summary>
    /// 内容
    /// </summary>
    public string Context { get; set; }
    /// <summary>
    /// 创建时间
    /// </summary>
    public string CreateTime { get; set; }
    /// <summary>
    /// 用户信息
    /// </summary>
    public UserInfo UserInfo { get; set; }
}