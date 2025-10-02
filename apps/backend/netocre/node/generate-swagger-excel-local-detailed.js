#!/usr/bin/env node
/**
 * Export local OpenAPI/Swagger (v2/v3) to Excel with 3 sheets:
 *  - APIs
 *  - ParamFields   (field-level, recursive, mapped to model fields)
 *  - ResponseFields(field-level, recursive, mapped to model fields)
 *
 * Usage:
 *   node generate-swagger-3sheets.js --input ./swagger.json --output ./swagger-export.xlsx
 */

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

/* ---------------- CLI ---------------- */
const args = parseArgs(process.argv.slice(2));
required(args, ["input", "output"]);
const spec = JSON.parse(fs.readFileSync(path.resolve(args.input), "utf8"));
const isV3 = !!spec.openapi;

/* ---------------- Resolver ---------------- */
const resolver = createResolver(spec);

/* ---------------- Row buckets ---------------- */
const apiRows = [];
const paramFieldRows = [];
const respFieldRows = [];

/* ---------------- Walk operations ---------------- */
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

    // --- APIs sheet row ---
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

    // --- Parameters: path-level + op-level (v2/v3) ---
    const pathParams = (pathItem.parameters || []).map((x) =>
      resolveRef(resolver, x)
    );
    const opParams = (op.parameters || []).map((x) => resolveRef(resolver, x));
    const allParams = [...pathParams, ...opParams];

    for (const prm of allParams) {
      const schema = getParamSchema(prm);
      if (schema) {
        flattenToRows({
          rows: paramFieldRows,
          schema: resolveRef(resolver, schema),
          origin: {
            Kind: "Param",
            Tag: (op.tags || []).join(","),
            Method: m.toUpperCase(),
            Path: p,
            ParamName: prm.name || "(param)",
            In: prm.in || "",
          },
        });
      }
    }

    // --- v3 requestBody ---
    if (isV3 && op.requestBody) {
      const rb = resolveRef(resolver, op.requestBody);
      const media = pickBestMedia(rb && rb.content);
      if (media && media.schema) {
        const schema = resolveRef(resolver, media.schema);
        flattenToRows({
          rows: paramFieldRows,
          schema,
          origin: {
            Kind: "Param",
            Tag: (op.tags || []).join(","),
            Method: m.toUpperCase(),
            Path: p,
            ParamName: "(body)",
            In: "body",
          },
        });
      }
    }

    // --- Responses ---
    const responses = op.responses || {};
    for (const [code, resp] of Object.entries(responses)) {
      const r = resolveRef(resolver, resp);
      const media = pickBestMedia((r && r.content) || null);
      let schema = null;
      if (media && media.schema) {
        schema = resolveRef(resolver, media.schema);
      } else if (r && r.schema) {
        // v2
        schema = resolveRef(resolver, r.schema);
      }
      if (schema) {
        flattenToRows({
          rows: respFieldRows,
          schema,
          origin: {
            Kind: "Resp",
            Tag: (op.tags || []).join(","),
            Method: m.toUpperCase(),
            Path: p,
            Status: code,
          },
        });
      }
    }
  }
}

/* ---------------- Write Excel ---------------- */
(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "swagger-3sheets";
  wb.created = new Date();

  addSheet(
    wb,
    "APIs",
    [
      { header: "Tag", key: "Tag", width: 24 },
      { header: "Method", key: "Method", width: 10 },
      { header: "Path", key: "Path", width: 60 },
      { header: "Summary", key: "Summary", width: 50 },
      { header: "OperationId", key: "OperationId", width: 30 },
      { header: "Consumes", key: "Consumes", width: 30 },
      { header: "Produces", key: "Produces", width: 30 },
      { header: "Deprecated", key: "Deprecated", width: 10 },
    ],
    apiRows
  );

  addSheet(
    wb,
    "ParamFields",
    [
      { header: "Tag", key: "Tag", width: 20 },
      { header: "Method", key: "Method", width: 8 },
      { header: "Path", key: "Path", width: 60 },
      { header: "ParamName", key: "ParamName", width: 24 },
      { header: "In", key: "In", width: 10 },
      { header: "FieldPath", key: "FieldPath", width: 60 },
      { header: "FieldName", key: "FieldName", width: 26 },
      { header: "Type", key: "Type", width: 26 },
      { header: "Required", key: "Required", width: 8 },
      { header: "Enum", key: "Enum", width: 40 },
      { header: "Example", key: "Example", width: 40 },
      { header: "Description", key: "Description", width: 60 },
      { header: "SourceModel", key: "SourceModel", width: 28 },
      { header: "ArrayDepth", key: "ArrayDepth", width: 10 },
    ],
    paramFieldRows
  );

  addSheet(
    wb,
    "ResponseFields",
    [
      { header: "Tag", key: "Tag", width: 20 },
      { header: "Method", key: "Method", width: 8 },
      { header: "Path", key: "Path", width: 60 },
      { header: "Status", key: "Status", width: 8 },
      { header: "FieldPath", key: "FieldPath", width: 60 },
      { header: "FieldName", key: "FieldName", width: 26 },
      { header: "Type", key: "Type", width: 26 },
      { header: "Required", key: "Required", width: 8 },
      { header: "Enum", key: "Enum", width: 40 },
      { header: "Example", key: "Example", width: 40 },
      { header: "Description", key: "Description", width: 60 },
      { header: "SourceModel", key: "SourceModel", width: 28 },
      { header: "ArrayDepth", key: "ArrayDepth", width: 10 },
    ],
    respFieldRows
  );

  await wb.xlsx.writeFile(args.output);
  console.log(`✅ Excel generated: ${path.resolve(args.output)}
  Sheets:
   - APIs: ${apiRows.length} rows
   - ParamFields: ${paramFieldRows.length} rows
   - ResponseFields: ${respFieldRows.length} rows`);
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

function getParamSchema(prm) {
  if (!prm) return null;
  if (prm.schema) return prm.schema; // v3
  if (prm.in === "body" && prm.schema) return prm.schema; // v2
  return prm; // primitive param (v2)
}

/* ----- Type/enum/example helpers ----- */
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

/* ---------- Field-level flatten (recursive) ---------- */
/**
 * Flatten schema to field rows (recursive), preserving model mapping ($ref).
 * rows: target array (ParamFields or ResponseFields)
 * origin.Kind: 'Param' | 'Resp'
 * origin.*   : metadata columns (Tag, Method, Path, ParamName/In or Status)
 */
function flattenToRows({ rows, schema, origin }) {
  const maxDepth = args.maxDepth ? parseInt(args.maxDepth, 10) : Infinity;
  const startRef = schema.$ref ? refName(schema.$ref) : "";
  _walk(resolveRef(resolver, schema) || {}, {
    path: [],
    arrayDepth: 0,
    sourceModel: startRef || (isObjectSchema(schema) ? "(inline-object)" : ""),
    required: new Set(schema.required || []),
    depth: 0,
  });

  function _walk(sch, ctx) {
    if (ctx.depth >= maxDepth) {
      // 超过层级限制，不再继续递归，只输出一个占位行
      rows.push(
        buildFieldRow(origin, {
          FieldPath: buildPath(ctx.path) || "(maxDepth)",
          FieldName: ctx.path.length ? ctx.path[ctx.path.length - 1] : "(root)",
          Type: guessSchemaType(sch) || "object",
          Required: "NO",
          Enum: enumText(sch),
          Example: exampleText(sch),
          Description: sch.description || "",
          SourceModel: sch.$ref ? refName(sch.$ref) : ctx.sourceModel,
          ArrayDepth: ctx.arrayDepth,
        })
      );
      return;
    }

    sch = resolveRef(resolver, sch) || {};
    const merged = mergeComposedObject(sch);
    const hereModel = sch.$ref
      ? refName(sch.$ref)
      : isObjectSchema(sch)
      ? ctx.sourceModel
      : "";

    if (merged.isObject) {
      const req = new Set([
        ...(sch.required || []),
        ...(merged.required || []),
      ]);
      const props = { ...(sch.properties || {}), ...(merged.properties || {}) };

      for (const [name, propSchema0] of Object.entries(props)) {
        const propSchema = resolveRef(resolver, propSchema0) || {};
        const propType = guessSchemaType(propSchema);
        const nextPath = ctx.path.concat(name);

        // array
        if (propSchema.type === "array" || propSchema.items) {
          const inner = resolveRef(resolver, propSchema.items || {});
          rows.push(
            buildFieldRow(origin, {
              FieldPath: buildPath(nextPath) + "[]",
              FieldName: name,
              Type: `array<${guessSchemaType(inner) || "unknown"}>`,
              Required: req.has(name) ? "YES" : "NO",
              Enum: enumText(propSchema),
              Example: exampleText(propSchema),
              Description: propSchema.description || "",
              SourceModel: propSchema.$ref
                ? refName(propSchema.$ref)
                : hereModel,
              ArrayDepth: ctx.arrayDepth + 1,
            })
          );
          _walk(inner, {
            path: nextPath.concat("[]"),
            arrayDepth: ctx.arrayDepth + 1,
            sourceModel: inner.$ref
              ? refName(inner.$ref)
              : isObjectSchema(inner)
              ? hereModel
              : "",
            required: new Set(inner.required || []),
            depth: ctx.depth + 1,
          });
          continue;
        }

        // object
        if (isObjectSchema(propSchema)) {
          rows.push(
            buildFieldRow(origin, {
              FieldPath: buildPath(nextPath),
              FieldName: name,
              Type: "object",
              Required: req.has(name) ? "YES" : "NO",
              Enum: enumText(propSchema),
              Example: exampleText(propSchema),
              Description: propSchema.description || "",
              SourceModel: propSchema.$ref
                ? refName(propSchema.$ref)
                : hereModel,
              ArrayDepth: ctx.arrayDepth,
            })
          );
          _walk(propSchema, {
            path: nextPath,
            arrayDepth: ctx.arrayDepth,
            sourceModel: propSchema.$ref ? refName(propSchema.$ref) : hereModel,
            required: new Set(propSchema.required || []),
            depth: ctx.depth + 1,
          });
          continue;
        }

        // primitive
        rows.push(
          buildFieldRow(origin, {
            FieldPath: buildPath(nextPath),
            FieldName: name,
            Type: propType,
            Required: req.has(name) ? "YES" : "NO",
            Enum: enumText(propSchema),
            Example: exampleText(propSchema),
            Description: propSchema.description || "",
            SourceModel: propSchema.$ref ? refName(propSchema.$ref) : hereModel,
            ArrayDepth: ctx.arrayDepth,
          })
        );
      }
      return;
    }

    // array root
    if (sch.type === "array" || sch.items) {
      const inner = resolveRef(resolver, sch.items || {});
      rows.push(
        buildFieldRow(origin, {
          FieldPath: buildPath(ctx.path.concat("[]")),
          FieldName: ctx.path.length
            ? ctx.path[ctx.path.length - 1]
            : "(items)",
          Type: `array<${guessSchemaType(inner) || "unknown"}>`,
          Required: "NO",
          Enum: enumText(sch),
          Example: exampleText(sch),
          Description: sch.description || "",
          SourceModel: sch.$ref ? refName(sch.$ref) : ctx.sourceModel,
          ArrayDepth: ctx.arrayDepth + 1,
        })
      );
      _walk(inner, {
        path: ctx.path.concat("[]"),
        arrayDepth: ctx.arrayDepth + 1,
        sourceModel: inner.$ref
          ? refName(inner.$ref)
          : isObjectSchema(inner)
          ? ctx.sourceModel
          : "",
        required: new Set(inner.required || []),
        depth: ctx.depth + 1,
      });
      return;
    }

    // primitive root
    rows.push(
      buildFieldRow(origin, {
        FieldPath: buildPath(ctx.path.length ? ctx.path : ["(root)"]),
        FieldName: ctx.path.length ? ctx.path[ctx.path.length - 1] : "(root)",
        Type: guessSchemaType(sch),
        Required: "NO",
        Enum: enumText(sch),
        Example: exampleText(sch),
        Description: sch.description || "",
        SourceModel: sch.$ref ? refName(sch.$ref) : ctx.sourceModel,
        ArrayDepth: ctx.arrayDepth,
      })
    );
  }
}

function buildFieldRow(origin, data) {
  if (origin.Kind === "Param") {
    return {
      Tag: origin.Tag,
      Method: origin.Method,
      Path: origin.Path,
      ParamName: origin.ParamName,
      In: origin.In,
      FieldPath: data.FieldPath,
      FieldName: data.FieldName,
      Type: data.Type,
      Required: data.Required,
      Enum: data.Enum,
      Example: data.Example,
      Description: normalizeText(data.Description),
      SourceModel: data.SourceModel || "",
      ArrayDepth: data.ArrayDepth || 0,
    };
  } else {
    return {
      Tag: origin.Tag,
      Method: origin.Method,
      Path: origin.Path,
      Status: origin.Status,
      FieldPath: data.FieldPath,
      FieldName: data.FieldName,
      Type: data.Type,
      Required: data.Required,
      Enum: data.Enum,
      Example: data.Example,
      Description: normalizeText(data.Description),
      SourceModel: data.SourceModel || "",
      ArrayDepth: data.ArrayDepth || 0,
    };
  }
}

function normalizeText(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}
function buildPath(arr) {
  if (!arr || !arr.length) return "";
  return arr
    .join(".")
    .replace(/\.?\[\]\.?/g, "[]" + ".")
    .replace(/\.$/, "");
}
function isObjectSchema(s) {
  return !!(
    s &&
    (s.type === "object" || s.properties || s.allOf || s.oneOf || s.anyOf)
  );
}
function mergeComposedObject(schema) {
  // shallow merged view for first-level props/required when composed
  const out = { isObject: false, properties: {}, required: [] };
  if (!schema) return out;

  const collect = (obj) => {
    if (!obj) return;
    if (obj.properties) Object.assign(out.properties, obj.properties);
    if (Array.isArray(obj.required)) out.required.push(...obj.required);
  };

  if (schema.allOf) {
    schema.allOf.forEach((s) => collect(s));
    out.isObject = true;
  }
  if (schema.oneOf && schema.oneOf.length) {
    collect(schema.oneOf[0]);
    out.isObject = true;
  }
  if (schema.anyOf && schema.anyOf.length) {
    collect(schema.anyOf[0]);
    out.isObject = true;
  }
  if (schema.type === "object" || schema.properties) {
    collect(schema);
    out.isObject = true;
  }

  out.required = Array.from(new Set(out.required));
  return out;
}

function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.eachRow((row, i) => {
    row.alignment = { vertical: "top", wrapText: true };
    if (i === 1)
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFEFEF" },
      };
  });
}
function pickBestMedia(content) {
  if (!content || typeof content !== "object") return null;
  const jsonTypes = [
    "application/json",
    "application/*+json",
    "text/json",
    "text/*+json",
  ];
  for (const t of jsonTypes) if (content[t]) return content[t]; 
  return null;
}
