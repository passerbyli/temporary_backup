namespace dotnetCore.Model;

public class SecurityOptions
{
    // ====== 大请求限制 ======
    public bool EnableRequestSizeLimit { get; set; } = true;
    public long MaxRequestBodySizeBytes { get; set; } = 256 * 1024; // 256KB
    
    

    // —— 新增：按“字段值长度”限制（仅检查第一层）——
    public bool EnableParamValueLimit { get; set; } = true;

    /// <summary>允许的最大“值”长度（字符数）。超出则按 ParamValueAction 处理。</summary>
    public int ParamValueMaxLength { get; set; } = 256;

    /// <summary>超限动作：Reject 或 Truncate。GET 一律 Reject（不改URL）。</summary>
    public string ParamValueAction { get; set; } = "Reject"; // "Reject" | "Truncate"

    /// <summary>POST 检查的内容类型（仅 JSON / 表单），逗号分隔，大小写不敏感。</summary>
    public string ParamValueContentTypes { get; set; } =
        "application/json,application/x-www-form-urlencoded";

    /// <summary>是否检查 GET 查询参数</summary>
    public bool ParamValueCheckGet { get; set; } = true;

    /// <summary>是否检查 POST 参数</summary>
    public bool ParamValueCheckPost { get; set; } = true;

    // ====== XSS 请求过滤 ======
    public bool EnableXssRequestFilter { get; set; } = true;
    /// <summary>只扫描前 N 字节，避免超大包体导致过高 CPU 消耗</summary>
    public int XssScanBytesLimit { get; set; } = 64 * 1024; // 64KB

    /// <summary>命中规则时的动作：Reject / Sanitize</summary>
    public string XssAction { get; set; } = "Reject";

    /// <summary>仅对这些 Content-Type 扫描（逗号分隔，大小写不敏感，包含判断）</summary>
    public string XssContentTypes { get; set; } = "application/json,application/x-www-form-urlencoded,text/plain";

    /// <summary>是否忽略大小写</summary>
    public bool XssCaseInsensitive { get; set; } = true;

    /// <summary>危险关键字（正则或简单包含匹配）。逗号分隔。</summary>
    public string XssDangerTokens { get; set; } =
        "<script,</script,</ script,script>,javascript:,onerror=,onload=,onfocus=,onmouseover=,<img,src=,document.cookie,</iframe,</ object,</embed";
    
    // ====== Origin 校验 ======
    public bool EnableOriginValidation { get; set; } = true;

    /// <summary>允许的 Origin 列表（必须包含 scheme，如 http://localhost:8080）</summary>
    public string[] AllowedOrigins { get; set; } = new string[0];

    /// <summary>是否忽略大小写比较</summary>
    public bool OriginIgnoreCase { get; set; } = true;


    // 响应头安全
    public bool EnableSecurityHeaders { get; set; } = true;
    
    
    /// <summary>数值允许的最小值（含）。</summary>
    public double ParamNumericMin { get; set; } = -1_000_000_000_000d; // -1e12

    /// <summary>数值允许的最大值（含）。</summary>
    public double ParamNumericMax { get; set; } =  1_000_000_000_000d; //  1e12
}