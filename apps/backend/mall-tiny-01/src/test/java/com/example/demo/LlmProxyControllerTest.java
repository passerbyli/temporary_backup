package com.example.demo;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mockito;
import org.powermock.api.mockito.PowerMockito;
import org.powermock.core.classloader.annotations.PrepareForTest;
import org.powermock.modules.junit4.PowerMockRunner;

import javax.net.ssl.HttpsURLConnection;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URL;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

/**
 * JUnit4 + Mockito + PowerMock
 */
@RunWith(PowerMockRunner.class)
@PrepareForTest({LlmProxyController.class})
public class LlmProxyControllerTest {

    /**
     * 测试 stream() 正常透传上游返回的流
     */
    @Test
    public void testStream_success() throws Exception {
        // 1. spy controller
        LlmProxyController controller = PowerMockito.spy(new LlmProxyController());

        // 2. 塞配置字段（按需）
        org.powermock.reflect.Whitebox.setInternalState(controller, "llmUrl",
                "https://llm-service/v1/chat/stream");

        // 3. stub 掉 getAuthorizationHeader()
        PowerMockito.doReturn("Bearer test-token")
                .when(controller, "getAuthorizationHeader");

        // 4. mock HttpsURLConnection，并 stub createUnsafeHttpsConnection()
        HttpsURLConnection mockConn = PowerMockito.mock(HttpsURLConnection.class);
        PowerMockito.doReturn(mockConn)
                .when(controller, "createUnsafeHttpsConnection", Mockito.any(URL.class));

        // 5. 模拟上游响应：200 + "hello-llm"
        ByteArrayInputStream llmRespStream =
                new ByteArrayInputStream("hello-llm".getBytes("UTF-8"));
        PowerMockito.when(mockConn.getResponseCode()).thenReturn(200);
        PowerMockito.when(mockConn.getInputStream()).thenReturn(llmRespStream);
        PowerMockito.when(mockConn.getErrorStream()).thenReturn(null);

        // 6. 捕获发给上游的请求体（可选）
        ByteArrayOutputStream llmReqBody = new ByteArrayOutputStream();
        PowerMockito.when(mockConn.getOutputStream()).thenReturn(llmReqBody);

        // 7. mock HttpServletResponse，用 Writer 收集输出
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        Mockito.when(response.getWriter()).thenReturn(pw);

        // 8. 构造入参实体
        LlmProxyController.LlmRequest req = new LlmProxyController.LlmRequest();
        req.setTitle("t1");
        req.setId("id1");

        // 9. 调用待测方法
        controller.stream(req, response);

        // 10. 刷新 writer
        pw.flush();

        // 11. 断言下游输出
        String body = sw.toString().trim();
        assertEquals("hello-llm", body);

        // 12. 校验 Authorization 请求头是否设置
        verify(mockConn).setRequestProperty(eq("Authorization"), eq("Bearer test-token"));

        // 13. 校验 HTTP 状态码
        verify(response).setStatus(200);
    }


    /**
     * 测试 private getAuthorizationHeader() 方法
     * 通过 PowerMock 的 Whitebox.invokeMethod() 调用私有方法
     */
    @Test
    public void testGetAuthorizationHeader_success() throws Exception {
        // 1. spy controller
        LlmProxyController controller = PowerMockito.spy(new LlmProxyController());

        // 2. 塞配置字段
        org.powermock.reflect.Whitebox.setInternalState(controller, "authServiceUrl", "https://auth-service");
        org.powermock.reflect.Whitebox.setInternalState(controller, "projectId", "p123");
        org.powermock.reflect.Whitebox.setInternalState(controller, "authToken", "asdas");

        // 3. mock 掉 createUnsafeHttpsConnection()
        HttpsURLConnection mockConn = PowerMockito.mock(HttpsURLConnection.class);
        PowerMockito.doReturn(mockConn)
                .when(controller, "createUnsafeHttpsConnection", Mockito.any(URL.class));

        // 4. 模拟授权服务返回 200 + {"token":"abc123"}
        PowerMockito.when(mockConn.getResponseCode()).thenReturn(200);
        String authJson = "{\"token\":\"abc123\"}";
        ByteArrayInputStream authIn =
                new ByteArrayInputStream(authJson.getBytes("UTF-8"));
        PowerMockito.when(mockConn.getInputStream()).thenReturn(authIn);

        ByteArrayOutputStream authReqBody = new ByteArrayOutputStream();
        PowerMockito.when(mockConn.getOutputStream()).thenReturn(authReqBody);

        // 5. 调用私有方法
        String result = org.powermock.reflect.Whitebox.invokeMethod(controller, "getAuthorizationHeader");

        // 6. 断言结果
        assertEquals("Bearer abc123", result);

        // 7. 校验请求体里包含 projectId / token
        String sentAuthBody = authReqBody.toString("UTF-8");
        org.junit.Assert.assertTrue(sentAuthBody.contains("projectId"));
        org.junit.Assert.assertTrue(sentAuthBody.contains("p123"));
        org.junit.Assert.assertTrue(sentAuthBody.contains("asdas"));

        // 8. 校验 Content-Type 头
        verify(mockConn).setRequestProperty(eq("Content-Type"), contains("application/json"));
    }
}