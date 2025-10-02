package com.macro.mall.tiny.lineage;


import com.alibaba.fastjson.JSON;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

public class SqlFileParser {

    public static class OutputRecord {
        public String file;
        public int scriptIndex;
        public String databaseType = "PostgreSQL";
        public Map<String, String> procedures = new HashMap<>();
        public Map<String, String> functionNames = new HashMap<>();
        public List<Map<String, Object>> sourceTables = new ArrayList<>();
        public List<Map<String, Object>> targetTables = new ArrayList<>();
        public List<Map<String, Object>> nodes = new ArrayList<>();
        public List<Map<String, Object>> edges = new ArrayList<>();
        public List<Map<String, Object>> fieldEdges = new ArrayList<>();
    }




    public static void main(String[] args) throws Exception {
        String inputFile = "/Users/lihaomin/projects/GitHub/test/scripts/sqlParse/data/etl_user_orders.sql";
        String outputFile = "/Users/lihaomin/projects/GitHub/test/scripts/sqlParse/data/sqlflow_output.json";

        List<String> lines = Files.readAllLines(Paths.get(inputFile));
        List<String> rawScripts = new ArrayList<>();
        StringBuilder buffer = new StringBuilder();

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("--") || trimmed.startsWith("/*")) continue;

            buffer.append(line).append("\n");
            if (trimmed.endsWith(";") && !trimmed.startsWith("--")) {
                rawScripts.add(buffer.toString().trim());
                buffer.setLength(0);
            }
        }
        if (buffer.length() > 0) {
            rawScripts.add(buffer.toString().trim());
        }

        List<OutputRecord> output = new ArrayList<>();

        for (int i = 0; i < rawScripts.size(); i++) {
            String sql = rawScripts.get(i);

            try {
                SqlLineageExtractor.LineageResult result = SqlLineageExtractor.extract(sql);

                OutputRecord record = new OutputRecord();
                record.file = inputFile;
                record.scriptIndex = i + 1;

                for (String table : result.tables) {
                    Map<String, Object> node = new HashMap<>();
                    node.put("id", "table:" + table);
                    node.put("label", table.substring(table.lastIndexOf('.') + 1));
                    node.put("type", "table");
                    node.put("isTemporary", false);
                    node.put("style", Collections.singletonMap("fill", "#87CEFA"));
                    record.nodes.add(node);
                }

                for (SqlLineageExtractor.TableEdge edge : result.tableEdges) {
                    Map<String, Object> e = new HashMap<>();
                    e.put("source", "table:" + edge.sourceTable);
                    e.put("target", "table:" + edge.targetTable);
                    e.put("label", "TRANSFORM");
                    record.edges.add(e);

                    record.sourceTables.add(mapTable(edge.sourceTable));
                    record.targetTables.add(mapTable(edge.targetTable));
                }

                for (SqlLineageExtractor.FieldEdge f : result.fieldEdges) {
                    Map<String, Object> fe = new HashMap<>();
                    fe.put("source", f.sourceField);
                    fe.put("target", f.targetField);
                    fe.put("expression", f.expr);
                    record.fieldEdges.add(fe);
                }

                output.add(record);
            } catch (Exception e) {
                System.err.println("[Error] SQL Parse Failed at script #" + (i + 1));
                System.err.println("SQL 内容：\n" + sql);
                e.printStackTrace();
            }
        }

        Files.write(Paths.get(outputFile), JSON.toJSONString(output, true).getBytes());
        System.out.println("✅ Parse complete. Output written to: " + outputFile);
    }

    private static Map<String, Object> mapTable(String fullName) {
        Map<String, Object> map = new HashMap<>();
        String[] parts = fullName.split("\\.");
        map.put("schema", parts.length == 2 ? parts[0] : "public");
        map.put("table", parts.length == 2 ? parts[1] : parts[0]);
        map.put("isTemporary", false);
        return map;
    }
}