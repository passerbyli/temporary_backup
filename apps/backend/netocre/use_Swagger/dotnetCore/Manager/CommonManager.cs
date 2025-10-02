using System;
using dotnetCore.Model;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace dotnetCore.Manager;


public interface ICommonManager
{
    public Boolean checkPermission(String name);
}

/// <summary>
/// 
/// </summary>
public class CommonManager:ICommonManager
{
    private  readonly IMemoryCache _memoryCache;
    private  readonly AppConfig _appConfig;
    
    public CommonManager(IOptions<AppConfig> appConf,IMemoryCache memoryCache)
    {
        _appConfig = appConf?.Value;
        _memoryCache = memoryCache;
    }

    public bool checkPermission(string name)
    {
        //todo
        return true;
    }
}
