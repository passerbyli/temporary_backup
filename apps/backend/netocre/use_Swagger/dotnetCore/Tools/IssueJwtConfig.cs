using dotnetCore.Tools.Base;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace dotnetCore.Tools
{
    public class IssueJwtConfig
    {

        #region 初始化

        /// <summary>
        /// 初始化
        /// </summary>
        /// <returns></returns>
        public static IssueJwtConfig GetInstance()
        {
            return Newtonsoft.Json.JsonConvert.DeserializeObject<IssueJwtConfig>(ConfigurationManager.AppSettings[nameof(IssueJwtConfig)]);
        }

        #endregion


        /// <summary>
        /// 
        /// </summary>
        public string Iss { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public string Aud { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public string Secret { get; set; }
    }
}
