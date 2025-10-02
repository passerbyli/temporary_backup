#!/usr/bin/env node
/**
 * CXF JAX-RS 一键导出接口清单（无需启动应用）
 * 步骤：
 * 1) 使用 Maven 在构建期调用 swagger-maven-plugin 扫描 JAX-RS 注解，生成 target/openapi.json
 * 2) 解析 openapi.json，输出：
 *    - endpoints.csv（方法、路径、参数、响应）
 *    - schemas.xlsx（模型字段扁平清单，可交付给联调/测试）
 *
 * 用法：
 *   npx cxf-api-export --packages com.your.company.api,com.foo.bar [--project .] [--out out]
 *
 * 必填：
 *   --packages  逗号分隔的 JAX-RS 资源基础包（@Path 所在包）
 *
 * 可选：
 *   --project   Maven 工程根目录（默认：当前目录）
 *   --out       输出目录（默认：<project>/target/api-export）
 *   --mvnArgs   额外传给 mvn 的参数（例如 "-Pdev -DskipTests"）
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function sh(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeCsv(rows, file) {
  const esc = (v) => {
    if (v == null) return "";
    v = String(v);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const text = rows.map((r) => r.map(esc).join(",")).join("\n");
  fs.writeFileSync(file, text, "utf-8");
  console.log(`✔ ${file}`);
}

/** -------- OpenAPI 解析工具（简版，够用） -------- */
function makeResolver(spec) {
  const schemas = spec.components?.schemas || {};
  function byRef($ref) {
    if (!$ref?.startsWith("#/components/schemas/")) return null;
    const name = $ref.split("/").pop();
    return schemas[name] ? { name, schema: schemas[name] } : null;
  }
  return { byRef, schemas };
}

function flattenSchema(
  name,
  schema,
  resolver,
  prefix = "",
  requiredSet = new Set(),
  out = []
) {
  // 仅处理常见 object/array/$ref；组合(allOf/oneOf) 做简单展开
  if (!schema) return out;

  if (schema.$ref) {
    const hit = resolver.byRef(schema.$ref);
    if (hit)
      return flattenSchema(
        hit.name,
        hit.schema,
        resolver,
        prefix,
        requiredSet,
        out
      );
  }

  const allOf = schema.allOf;
  if (Array.isArray(allOf) && allOf.length) {
    allOf.forEach((s) =>
      flattenSchema(name, s, resolver, prefix, requiredSet, out)
    );
    return out;
  }

  if (schema.type === "array" && schema.items) {
    const pfx = prefix ? `${prefix}[]` : "[]";
    return flattenSchema(name, schema.items, resolver, pfx, requiredSet, out);
  }

  if (schema.type === "object" || schema.properties) {
    const req = new Set(schema.required || []);
    for (const [k, v] of Object.entries(schema.properties || {})) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v?.$ref) {
        const hit = resolver.byRef(v.$ref);
        if (hit) {
          flattenSchema(hit.name, hit.schema, resolver, p, req, out);
          continue;
        }
      }
      if (v?.type === "object" || v?.properties || v?.allOf) {
        flattenSchema(name, v, resolver, p, req, out);
        continue;
      }
      if (v?.type === "array" && v.items) {
        flattenSchema(name, v, resolver, `${p}[]`, req, out);
        continue;
      }
      out.push({
        schema: name,
        field: p,
        type: v?.type || (v?.$ref ? v.$ref.split("/").pop() : ""),
        format: v?.format || "",
        required: req.has(k) ? "Y" : "",
        description: v?.description || "",
      });
    }
    return out;
  }

  // fallback: 原子类型
  out.push({
    schema: name,
    field: prefix || name,
    type: schema.type || "",
    format: schema.format || "",
    required: requiredSet.has(prefix) ? "Y" : "",
    description: schema.description || "",
  });
  return out;
}

/** ------------- 主流程 ------------- */
(async function main() {
  const args = parseArgs(process.argv);
  const packages = args.packages;
  if (!packages) {
    console.error(
      "❌ 缺少必填参数 --packages  (例如 --packages com.your.api,com.foo.bar)"
    );
    process.exit(1);
  }
  const project = path.resolve(args.project || ".");
  const outDir = path.resolve(
    args.out || path.join(project, "target", "api-export")
  );
  const mvnArgs = args.mvnArgs || "-DskipTests";

  // 1) 先编译（让目标类可被扫描）
  sh(`mvn -q ${mvnArgs} package`, project);

  // 2) 直接命令行调用 swagger-maven-plugin（无需改 POM）
  const genOutDir = path.join(project, "target");
  const outputFilename = "openapi";
  const plugin = "org.openapitools.swagger:swagger-maven-plugin:2.1.5:generate";
  const cmd = [
    "mvn -q",
    mvnArgs,
    plugin,
    `-DresourcePackages=${packages}`,
    `-DoutputDirectory=${genOutDir.replace(/\\/g, "/")}`,
    `-DoutputFilename=${outputFilename}`,
    `-DoutputFormats=JSON`,
    `-DprettyPrint=true`,
  ].join(" ");
  sh(cmd, project);

  const openapiPath = path.join(genOutDir, `${outputFilename}.json`);
  if (!fs.existsSync(openapiPath)) {
    console.error(
      `❌ 未找到 ${openapiPath}。检查包名是否正确（--packages），或该项目是否使用 JAX-RS 注解。`
    );
    process.exit(2);
  }

  ensureDir(outDir);
  fs.copyFileSync(openapiPath, path.join(outDir, "openapi.json"));
  console.log(`✔ 生成 OpenAPI：${openapiPath}`);

  // 3) 解析 openapi.json → endpoints.csv
  const spec = readJson(openapiPath);
  const rows = [["Method", "Path", "Summary", "Params", "Responses"]];
  for (const [p, item] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(item)) {
      const params = [];
      for (const prm of op.parameters || []) {
        const schema = prm.schema || {};
        const t =
          schema.type || (schema.$ref ? schema.$ref.split("/").pop() : "-");
        params.push(`${prm.name}:${prm.in}:${t}${prm.required ? "*" : ""}`);
      }
      const rb = op.requestBody;
      if (rb?.content) {
        const ct = Object.keys(rb.content)[0];
        params.push(`body:${ct}`);
      }
      const res = [];
      for (const [code, r] of Object.entries(op.responses || {})) {
        const ct = r.content ? Object.keys(r.content)[0] : "no-content";
        res.push(`${code}:${ct}`);
      }
      rows.push([
        method.toUpperCase(),
        p,
        op.summary || "",
        params.join("; "),
        res.join("; "),
      ]);
    }
  }
  writeCsv(rows, path.join(outDir, "endpoints.csv"));

  // 4) 解析 schemas → schemas.xlsx（单表扁平字段）
  const resolver = makeResolver(spec);
  const allRows = [
    ["Schema", "Field", "Type", "Format", "Required", "Description"],
  ];
  for (const [name, schema] of Object.entries(resolver.schemas)) {
    flattenSchema(name, schema, resolver).forEach((r) =>
      allRows.push([
        r.schema,
        r.field,
        r.type,
        r.format,
        r.required,
        r.description,
      ])
    );
  }
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(allRows);
  xlsx.utils.book_append_sheet(wb, ws, "schemas");
  const xlsxPath = path.join(outDir, "schemas.xlsx");
  xlsx.writeFile(wb, xlsxPath);
  console.log(`✔ ${xlsxPath}`);

  console.log(`\n✅ 完成。输出目录：${outDir}`);
})();
