using System;

namespace dotnetCore
{
    public class WeatherForecast
    {
        /// <summary>
        /// 日期
        /// </summary>
        public DateTime Date { get; set; }


        /// <summary>
        /// 气温-摄氏温标
        /// </summary>
        public int TemperatureC { get; set; }

        /// <summary>
        /// 气温-华氏度
        /// </summary>
        public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);

        /// <summary>
        /// 概要
        /// </summary>
        public string Summary { get; set; }
    }
}
