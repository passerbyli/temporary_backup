#!/usr/bin/env node
/**
 * Generate Excel from local Swagger/OpenAPI (v2/v3) JSON file.
 * Sheets:
 *  - APIs: one row per operation
 *  - Params: one row per parameter; when body/schema is an object, expand first-level fields into extra rows
 *  - Responses: one row per (operation, status)
 *  - Models: one row per schema/definition
 *
 * Usage:
 *   node generate-swagger-excel-local.js --input ./swagger.json --output ./swagger-export.xlsx
 */

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

/* ---------------- CLI ---------------- */
const args = parseArgs(process.argv.slice(2));
required(args, ["input", "output"]);
const spec = JSON.parse(fs.readFileSync(path.resolve(args.input), "utf8"));

/* -------------- Normalize & Resolve -------------- */
const isV3 = !!spec.openapi;
const resolver = createResolver(spec);

/* -------------- Build rows -------------- */
const apiRows = [];
const paramRows = [];
const respRows = [];
const modelRows = [];

const paths = spec.paths || {};
for (const [p, pathItem] of Object.entries(paths)) {
  for (const m of [
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "head",
    "options",
    "trace",
  ]) {
    const op = (pathItem || {})[m];
    if (!op) continue;

    // APIs
    apiRows.push({
      Tag: (op.tags || []).join(","),
      Method: m.toUpperCase(),
      Path: p,
      Summary: op.summary || "",
      OperationId: op.operationId || "",
      Consumes: getConsumes(spec, op).join(","),
      Produces: getProduces(spec, op).join(","),
      Deprecated: op.deprecated ? "YES" : "NO",
    });

    // Params (v2 path/op-level + v3 parameters + v3 requestBody)
    const directParams = (op.parameters || []).map((x) =>
      resolveRef(resolver, x)
    );
    // path-level params（v2/v3）—可选：这里简单合并
    const pathLevelParams = (pathItem.parameters || []).map((x) =>
      resolveRef(resolver, x)
    );
    const allParams = [...pathLevelParams, ...directParams];

    // regular parameters
    for (const prm of allParams) {
      const row = buildParamRow(p, m, op, prm);
      paramRows.push(row);

      // 字段级展开（仅第一层）：当 schema 是对象时
      const schema = getParamSchema(prm);
      const obj = resolveRef(resolver, schema);
      if (obj && isObjectSchema(obj)) {
        expandObjectFirstLevel(
          paramRows,
          {
            Tag: row.Tag,
            Method: row.Method,
            Path: row.Path,
            ParentParam: row.Name || "(param)",
            In: row.In || "",
          },
          obj
        );
      }
    }

    // v3 requestBody
    if (isV3 && op.requestBody) {
      const rb = resolveRef(resolver, op.requestBody);
      const media = pickBestMedia(rb && rb.content);
      if (media) {
        const schema = resolveRef(resolver, media.schema);
        const base = {
          Tag: (op.tags || []).join(","),
          Method: m.toUpperCase(),
          Path: p,
          Name: "(body)",
          In: "body",
          Required: rb.required ? "YES" : "NO",
          Type: guessSchemaType(schema),
          Enum: enumText(schema),
          Default: defaultText(schema),
          Example: exampleText(schema, media.example || rb.example),
          Description: (rb.description || "").replace(/\s+/g, " ").trim(),
        };
        paramRows.push(base);

        // 字段级展开（仅第一层）
        if (schema && isObjectSchema(schema)) {
          expandObjectFirstLevel(
            paramRows,
            {
              Tag: base.Tag,
              Method: base.Method,
              Path: base.Path,
              ParentParam: base.Name,
              In: base.In,
            },
            schema
          );
        }
      }
    }

    // Responses
    const responses = op.responses || {};
    for (const [code, resp] of Object.entries(responses)) {
      const r = resolveRef(resolver, resp);
      const media = pickBestMedia((r && r.content) || null);
      let schema, ex;
      if (media) {
        schema = resolveRef(resolver, media.schema);
        ex = media.example || r.example;
      } else if (r && r.schema) {
        // v2
        schema = resolveRef(resolver, r.schema);
        ex = r.examples || r.example;
      }
      respRows.push({
        Tag: (op.tags || []).join(","),
        Method: m.toUpperCase(),
        Path: p,
        Status: code,
        Type: guessSchemaType(schema),
        SchemaPreview: previewSchema(schema),
        Example: exampleText(schema, ex),
        Description:
          r && r.description ? r.description.replace(/\s+/g, " ").trim() : "",
      });
    }
  }
}

/* -------------- Models (components.schemas / definitions) -------------- */
const models = isV3
  ? (spec.components && spec.components.schemas) || {}
  : spec.definitions || {};
for (const [name, schema] of Object.entries(models)) {
  const s = resolveRef(resolver, schema) || {};
  const type = guessSchemaType(s);
  const required = (s.required || []).join(",");
  const enumTxt = enumText(s);
  const propsPreview = s.properties
    ? Object.keys(s.properties).slice(0, 12).join(",")
    : "";
  modelRows.push({
    Name: name,
    Type: type,
    Required: required,
    Enum: enumTxt,
    Properties: propsPreview,
    Description: (s.description || "").replace(/\s+/g, " ").trim(),
  });
}

/* -------------- Write Excel -------------- */
(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "swagger-export-local";
  wb.created = new Date();

  addSheet(
    wb,
    "APIs",
    [
      { header: "Tag", key: "Tag", width: 24 },
      { header: "Method", key: "Method", width: 10 },
      { header: "Path", key: "Path", width: 50 },
      { header: "Summary", key: "Summary", width: 50 },
      { header: "OperationId", key: "OperationId", width: 28 },
      { header: "Consumes", key: "Consumes", width: 30 },
      { header: "Produces", key: "Produces", width: 30 },
      { header: "Deprecated", key: "Deprecated", width: 10 },
    ],
    apiRows
  );

  addSheet(
    wb,
    "Params",
    [
      { header: "Tag", key: "Tag", width: 20 },
      { header: "Method", key: "Method", width: 8 },
      { header: "Path", key: "Path", width: 50 },
      { header: "Name", key: "Name", width: 28 },
      { header: "In", key: "In", width: 12 },
      { header: "Required", key: "Required", width: 8 },
      { header: "Type", key: "Type", width: 26 },
      { header: "Enum", key: "Enum", width: 26 },
      { header: "Default", key: "Default", width: 18 },
      { header: "Example", key: "Example", width: 36 },
      { header: "Description", key: "Description", width: 50 },
      // —— 展开行的字段列 —— //
      { header: "ParentParam", key: "ParentParam", width: 20 },
      { header: "FieldName", key: "FieldName", width: 26 },
      { header: "FieldType", key: "FieldType", width: 24 },
      { header: "FieldRequired", key: "FieldRequired", width: 12 },
      { header: "FieldEnum", key: "FieldEnum", width: 26 },
      { header: "FieldExample", key: "FieldExample", width: 30 },
      { header: "FieldDescription", key: "FieldDescription", width: 50 },
    ],
    paramRows
  );

  addSheet(
    wb,
    "Responses",
    [
      { header: "Tag", key: "Tag", width: 20 },
      { header: "Method", key: "Method", width: 8 },
      { header: "Path", key: "Path", width: 50 },
      { header: "Status", key: "Status", width: 8 },
      { header: "Type", key: "Type", width: 26 },
      { header: "SchemaPreview", key: "SchemaPreview", width: 60 },
      { header: "Example", key: "Example", width: 36 },
      { header: "Description", key: "Description", width: 60 },
    ],
    respRows
  );

  addSheet(
    wb,
    "Models",
    [
      { header: "Name", key: "Name", width: 30 },
      { header: "Type", key: "Type", width: 20 },
      { header: "Required", key: "Required", width: 30 },
      { header: "Enum", key: "Enum", width: 40 },
      { header: "Properties", key: "Properties", width: 60 },
      { header: "Description", key: "Description", width: 60 },
    ],
    modelRows
  );

  await wb.xlsx.writeFile(args.output);
  console.log(`✅ Excel generated: ${path.resolve(args.output)}
  Sheets:
   - APIs: ${apiRows.length} rows
   - Params: ${paramRows.length} rows (incl. expanded fields)
   - Responses: ${respRows.length} rows
   - Models: ${modelRows.length} rows`);
})().catch((e) => {
  console.error("❌ Failed:", e?.stack || e);
  process.exit(1);
});

/* ---------------- Helpers ---------------- */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[k] = v;
    }
  }
  return out;
}
function required(obj, keys) {
  for (const k of keys)
    if (!obj[k]) {
      console.error(`Missing --${k}`);
      process.exit(1);
    }
}

function createResolver(spec) {
  const cache = new Map();
  function byPointer(ptr) {
    const parts = String(ptr).replace(/^#\//, "").split("/");
    let cur = spec;
    for (const p of parts) {
      if (cur == null) return null;
      cur = cur[p];
    }
    return cur;
  }
  function resolveRef(obj) {
    if (!obj) return obj;
    if (obj.$ref) {
      const key = obj.$ref;
      if (cache.has(key)) return cache.get(key);
      const val = byPointer(key);
      const resolved = resolveRef(val);
      cache.set(key, resolved);
      return resolved;
    }
    if (obj.items && obj.items.$ref) obj.items = resolveRef(obj.items);
    if (obj.schema && obj.schema.$ref) obj.schema = resolveRef(obj.schema);
    return obj;
  }
  return { resolveRef };
}
function resolveRef(resolver, obj) {
  return resolver.resolveRef(obj);
}

function getConsumes(spec, op) {
  if (op.requestBody && op.requestBody.content)
    return Object.keys(op.requestBody.content);
  return op.consumes || spec.consumes || [];
}
function getProduces(spec, op) {
  const set = new Set();
  if (op.responses) {
    for (const r of Object.values(op.responses)) {
      const keys = r && r.content ? Object.keys(r.content) : null;
      if (keys) keys.forEach((k) => set.add(k));
    }
  }
  (op.produces || spec.produces || []).forEach((k) => set.add(k));
  return Array.from(set);
}

function guessSchemaType(s) {
  if (!s) return "";
  if (s.$ref) return refName(s.$ref);
  if (s.type === "array") {
    const inner = s.items ? guessSchemaType(s.items) : "";
    return inner ? `array<${inner}>` : "array";
  }
  if (s.type) return s.format ? `${s.type}(${s.format})` : s.type;
  if (s.oneOf || s.anyOf || s.allOf) return "composed";
  if (s.properties) return "object";
  return "";
}
function refName(ref) {
  const parts = String(ref).split("/");
  return parts[parts.length - 1];
}
function enumText(s) {
  const e = s && s.enum;
  return e ? e.join(" | ") : "";
}
function defaultText(s) {
  return s && s.default != null ? String(s.default) : "";
}
function exampleText(schema, ex) {
  if (!schema && !ex) return "";
  if (typeof ex === "string") return ex;
  if (ex && typeof ex === "object") {
    if (ex.value != null) return safeJson(ex.value);
    const first = Object.values(ex)[0];
    if (first && first.value != null) return safeJson(first.value);
  }
  if (schema && schema.example != null) return safeJson(schema.example);
  return "";
}
function safeJson(o) {
  try {
    return JSON.stringify(o);
  } catch {
    return String(o);
  }
}
function previewSchema(s) {
  if (!s) return "";
  if (s.$ref) return refName(s.$ref);
  if (s.type === "object" && s.properties) {
    const keys = Object.keys(s.properties).slice(0, 10);
    return `{ ${keys
      .map((k) => `${k}:${guessSchemaType(s.properties[k])}`)
      .join(", ")}${
      Object.keys(s.properties).length > keys.length ? ", ..." : ""
    } }`;
  }
  return guessSchemaType(s);
}

function isObjectSchema(s) {
  return !!(
    s &&
    (s.type === "object" || s.properties || s.allOf || s.oneOf || s.anyOf)
  );
}
function mergeComposedObject(schema) {
  // shallow merge for allOf/oneOf/anyOf(first) into an object-like for first-level display
  let out = { properties: {}, required: [] };
  if (!schema) return out;

  const collect = (obj) => {
    if (!obj) return;
    if (obj.properties) Object.assign(out.properties, obj.properties);
    if (Array.isArray(obj.required)) out.required.push(...obj.required);
  };

  if (schema.allOf) schema.allOf.forEach((s) => collect(s));
  if (schema.oneOf) collect(schema.oneOf[0]);
  if (schema.anyOf) collect(schema.anyOf[0]);
  collect(schema);

  // dedupe required
  out.required = Array.from(new Set(out.required));
  return out;
}

function expandObjectFirstLevel(rows, base, schema) {
  const merged = mergeComposedObject(schema);
  const props = merged.properties || {};
  const req = new Set(merged.required || []);

  for (const [field, fschema0] of Object.entries(props)) {
    const fschema =
      fschema0 && (fschema0.$ref ? resolver.resolveRef(fschema0) : fschema0);
    rows.push({
      Tag: base.Tag,
      Method: base.Method,
      Path: base.Path,
      Name: "",
      In: "",
      Required: "",
      Type: "",
      Enum: "",
      Default: "",
      Example: "",
      Description: "",
      ParentParam: base.ParentParam,
      FieldName: field,
      FieldType: guessSchemaType(fschema),
      FieldRequired: req.has(field) ? "YES" : "NO",
      FieldEnum: enumText(fschema),
      FieldExample: exampleText(fschema),
      FieldDescription:
        fschema && fschema.description
          ? String(fschema.description).replace(/\s+/g, " ").trim()
          : "",
    });
  }
}

function pickBestMedia(content) {
  if (!content) return null;
  const keys = Object.keys(content);
  const prefer = keys.find((k) => /json/i.test(k)) || keys[0];
  return content[prefer];
}

function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.eachRow((row, i) => {
    row.alignment = { vertical: "top", wrapText: true };
    if (i === 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFEFEF" },
      };
    }
  });
}

function buildParamRow(pathKey, method, op, prm) {
  const schema = getParamSchema(prm);
  return {
    Tag: (op.tags || []).join(","),
    Method: method.toUpperCase(),
    Path: pathKey,
    Name: prm.name || "",
    In: prm.in || (isV3 ? prm.in || "" : prm.in || ""),
    Required: prm.required ? "YES" : "NO",
    Type: guessSchemaType(schema || prm),
    Enum: enumText(schema || prm),
    Default: defaultText(schema || prm),
    Example: exampleText(schema || prm, prm.example),
    Description: (prm.description || "").replace(/\s+/g, " ").trim(),

    ParentParam: "",
    FieldName: "",
    FieldType: "",
    FieldRequired: "",
    FieldEnum: "",
    FieldExample: "",
    FieldDescription: "",
  };
}

function getParamSchema(prm) {
  if (!prm) return null;
  // v3: prm.schema
  if (prm.schema) return prm.schema;
  // v2 body param: prm.in === 'body' && prm.schema
  if (prm.in === "body" && prm.schema) return prm.schema;
  // v2 non-body param: type directly on prm
  return prm;
}
