package com.macro.mall.tiny.neo;

import com.aliyuncs.credentials.Credentials;
import com.aliyuncs.credentials.http.HttpConfig;
import com.aliyuncs.credentials.models.JWTTOKENClient;
import com.aliyuncs.credentials.models.JWTTokenClientFactory;

public class Utils {
    public static String getToken(String account,String key,String secret) {
        JWTTOKENClient jwttokenClient =
                JWTTokenClientFactory.getInstance().getJWtkenClient(Credentials.iamEndpoint("xx").account(
                        "xxxx").build(),HttpConfig.build().build());
        return jwttokenClient.getToken();;
    }
}
