using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using dotnetCore.Model;

namespace dotnetCore.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class WeatherForecastController : ControllerBase
    {
        private static readonly string[] Summaries = new[]
        {
            "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
        };

        private readonly ILogger<WeatherForecastController> _logger;

        public WeatherForecastController(ILogger<WeatherForecastController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// 获取天气
        /// </summary>
        /// <remarks>描述：这是一个查询添加的POST请求</remarks>
        /// <param name="cityCode">城市Code</param>
        /// <returns>返回天气信息</returns>
        [HttpGet]
        [Route("GetWeather")]
        [HttpPost("get")]
        [BindAndPick(typeof(WeatherForecast), AuthFieldKind.BusinessId)]
        public IEnumerable<WeatherForecast> Get(string cityCode)
        {
            var rng = new Random();
            return Enumerable.Range(1, 5).Select(index => new WeatherForecast
            {
                Date = DateTime.Now.AddDays(index),
                TemperatureC = rng.Next(-20, 55),
                Summary = Summaries[rng.Next(Summaries.Length)]
            })
            .ToArray();
        }


        
        /// <summary>
        /// 创建任务
        /// </summary>
        /// <remarks>这是一个理智</remarks>
        /// <param name="cusTask">任务</param>
        /// <returns>创建任务的状态</returns>
        [HttpPost]
        [Route("createTask")]
        public AppConfig CreateTask(CusTask cusTask)
        {
            var cus = new List<CusTask>();
            cus.Add(new CusTask()
            {
                Title="aaa"
            });
            return new AppConfig();
        }
        
        /// <summary>
        /// 批量创建任务
        /// </summary>
        /// <param name="list">任务集合</param>
        /// <returns>djodjsaio</returns>
        /// <remarks>
        /// 示例请求:
        /// 
        ///     GET /users/1
        /// 
        /// 示例响应:
        /// 
        ///     {
        ///         "id": 1,
        ///         "name": "John Doe"
        ///     }
        /// </remarks>
        /// <example>啊啊啊</example>
        [HttpPost]
        [Route("createTasks")]
        public IList<CusTask> CreateTasks(List<CusTask> list)
        {
            var cus = new List<CusTask>();
            cus.Add(new CusTask()
            {
                Title="aaa"
            });
            return cus;
        }


    }
}
