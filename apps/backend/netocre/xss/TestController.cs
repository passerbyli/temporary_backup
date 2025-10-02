[ApiController]
[Route("api/[controller]")]
public class CommentController : ControllerBase
{
    // 默认：会被全局转义
    [HttpPost("safe")]
    public IActionResult Safe([FromBody] CommentDto dto)
    {
        return Ok(new { content = dto.Content });
    }

    // 打上 IgnoreXss：不会转义
    [HttpPost("raw")]
    [IgnoreXss]
    public IActionResult Raw([FromBody] CommentDto dto)
    {
        return Ok(new { content = dto.Content });
    }
}

public class CommentDto
{
    public string Content { get; set; }
}