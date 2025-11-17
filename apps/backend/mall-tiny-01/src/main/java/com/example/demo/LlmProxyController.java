package com.example.demo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/llm")
public class LlmProxyController {

    @Value("${auth.service-url}") // https://auth-service
    private String authServiceUrl;

    @Value("${auth.project-id}")
    private String projectId;

    @Value("${auth.token}")
    private String authToken;

    @Value("${llm.url}") // https://llm-service/v1/chat/stream
    private String llmUrl;

    // ============================== 对外接口 =================================
    @PostMapping("/stream")
    public void stream(@RequestBody LlmRequest llmRequest,
                       HttpServletResponse response) throws IOException {

        HttpsURLConnection llmConn = null;

        try {
            // 1. 获取 Authorization（忽略证书）
            String authorization = getAuthorizationHeader();

            // 2. 调用大模型接口
            URL url = new URL(llmUrl);
            llmConn = createUnsafeHttpsConnection(url);
            llmConn.setRequestMethod("POST");
            llmConn.setDoOutput(true);
            llmConn.setDoInput(true);

            llmConn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
            llmConn.setRequestProperty("Accept", "text/event-stream");
            llmConn.setRequestProperty("Authorization", authorization);
            llmConn.setChunkedStreamingMode(0);

            // 3. 将实体类转成 HashMap → 再转 JSON
            Map<String, Object> map = new HashMap<>();
            map.put("title", llmRequest.getTitle());
            map.put("id", llmRequest.getId());
            String jsonBody = mapToJson(map);

            try (OutputStream out = llmConn.getOutputStream()) {
                out.write(jsonBody.getBytes(StandardCharsets.UTF_8));
                out.flush();
            }

            // 4. 流式透传返回
            int statusCode = llmConn.getResponseCode();
            response.setStatus(statusCode);
            response.setContentType("text/event-stream;charset=UTF-8");
            response.setHeader("Cache-Control", "no-cache");
            response.setCharacterEncoding("UTF-8");

            InputStream llmIn = (statusCode >= 200 && statusCode < 300)
                    ? llmConn.getInputStream()
                    : llmConn.getErrorStream();

            if (llmIn == null) {
                response.flushBuffer();
                return;
            }

            try (InputStream in = llmIn;
                 InputStreamReader reader = new InputStreamReader(in, java.nio.charset.StandardCharsets.UTF_8);
                 java.io.PrintWriter writer = response.getWriter()) {

                char[] buffer = new char[4096]; // 字符缓冲区
                int len;
                while ((len = reader.read(buffer)) != -1) {
                    writer.write(buffer, 0, len);
                    writer.flush(); // 依然是流式，一边读一边刷给前端
                }
            }

        } catch (Exception e) {
            response.setStatus(500);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().write("proxy error: " + e.getMessage());
            response.getWriter().flush();
        } finally {
            if (llmConn != null) llmConn.disconnect();
        }
    }

    // ============================== 忽略证书创建 HTTPS 连接 ==============================
    protected HttpsURLConnection createUnsafeHttpsConnection(URL url) throws Exception {
        HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();

        TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public void checkClientTrusted(X509Certificate[] xcs, String s) {
                    }

                    public void checkServerTrusted(X509Certificate[] xcs, String s) {
                    }

                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                }
        };

        SSLContext sc = SSLContext.getInstance("TLS");
        sc.init(null, trustAll, new SecureRandom());
        conn.setSSLSocketFactory(sc.getSocketFactory());
        conn.setHostnameVerifier((hostname, session) -> true);

        return conn;
    }

    // ============================== 获取 Authorization（POST JSON） ==============================
    protected String getAuthorizationHeader() throws Exception {
        URL url = new URL(authServiceUrl + "/auth/token");
        HttpsURLConnection conn = createUnsafeHttpsConnection(url);

        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
        conn.setRequestProperty("Accept", "application/json");

        // 入参：{"projectId":"xxx","token":"asdas"}
        Map<String, Object> body = new HashMap<>();
        body.put("projectId", projectId);
        body.put("token", authToken);
        String json = mapToJson(body);

        try (OutputStream out = conn.getOutputStream()) {
            out.write(json.getBytes(StandardCharsets.UTF_8));
            out.flush();
        }

        int code = conn.getResponseCode();
        if (code != 200) {
            throw new RuntimeException("获取 token 失败，状态码：" + code);
        }

        String resp = readStreamToString(conn.getInputStream(), "UTF-8");

        // ⚠ 不使用 Jackson，只用简单字符串方式提取 token
        String token = extractTokenFromJson(resp);

        conn.disconnect();

        return "Bearer " + token;
    }

    // ============================== 工具：HashMap -> JSON ==============================
    protected String mapToJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");

        int i = 0;
        for (Map.Entry<String, Object> e : map.entrySet()) {
            if (i++ > 0) sb.append(",");
            sb.append("\"").append(e.getKey()).append("\":");

            Object val = e.getValue();
            if (val == null) {
                sb.append("null");
            } else {
                sb.append("\"").append(val.toString().replace("\"", "\\\"")).append("\"");
            }
        }

        sb.append("}");
        return sb.toString();
    }

    // ============================== 工具：简单解析 JSON 中的 token 字段 ==============================
    protected String extractTokenFromJson(String json) {
        // 假设返回格式： {"token":"xxxxx"} 或 {"xxx": "...", "token":"xxx"}
        int idx = json.indexOf("\"token\"");
        if (idx < 0) throw new RuntimeException("返回中未找到 token 字段：" + json);

        int colon = json.indexOf(":", idx);
        int quote1 = json.indexOf("\"", colon + 1);
        int quote2 = json.indexOf("\"", quote1 + 1);

        return json.substring(quote1 + 1, quote2);
    }

    protected String readStreamToString(InputStream is, String charset) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, charset))) {
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append('\n');
        }
        return sb.toString();
    }

    // ============================== 入参实体类 =================================
    public static class LlmRequest {
        private String title;
        private String id;

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }
    }
}