```
# 安装依赖
npm i

# 执行（--packages 填你的 JAX-RS 资源包）
node export-apis.js --packages com.your.company.api

# 或安装成全局命令（本工程内）
npx cxf-api-export --packages com.your.company.api
```

```
# 指定工程根目录（默认 .）
node export-apis.js --packages com.your.api --project /path/to/project

# 指定输出目录（默认 target/api-export）
node export-apis.js --packages com.your.api --out ./out

# 传额外 mvn 参数（默认 -DskipTests）
node export-apis.js --packages com.your.api --mvnArgs "-DskipTests -Pdev"
```