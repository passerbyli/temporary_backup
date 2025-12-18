String data = [
    {
        "region": [{"name": "亚洲","code": "AS"}, {"name": "欧洲", "code": "EU"}],
        "country": [{"name": "中国", "code": "CN"}, {"name": "德国", "code": "DE"}],
        "repOffice": [{"name": "中国北京", "code": "CN-BJ"}]
    },
        {
        "region": [{"name": "亚洲","code": "AS"}, {"name": "欧洲", "code": "EU"}],
        "country": [{"name": "中国", "code": "CN"}, {"name": "德国", "code": "DE"}],
        "repOffice": [{"name": "德国柏林", "code": "DE-BE"}]
    }
]

AreaObject obj = JsonPath.read(jsonString,"$.data[0]");

现在需要把上面的 json 数据修改成下面的格式：

    {
        "region": [{"name": "亚洲","code": "AS"}, {"name": "欧洲", "code": "EU"}],
        "country": [{"name": "中国", "code": "CN"}, {"name": "德国", "code": "DE"}],
        "repOffice": [{"name": "中国北京", "code": "CN-BJ"},{"name": "德国柏林", "code": "DE-BE"}]
    }



