package com.macro.mall.tiny.lineage;


import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.schema.Column;
import net.sf.jsqlparser.schema.Table;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.insert.Insert;
import net.sf.jsqlparser.statement.select.*;
import net.sf.jsqlparser.util.deparser.ExpressionDeParser;

import java.util.*;

public class SqlLineageExtractor {

    public static class TableEdge {
        public String sourceTable;
        public String targetTable;

        public TableEdge(String sourceTable, String targetTable) {
            this.sourceTable = sourceTable;
            this.targetTable = targetTable;
        }

        @Override
        public String toString() {
            return sourceTable + " -> " + targetTable;
        }
    }

    public static class FieldEdge {
        public String sourceField;
        public String targetField;
        public String expr;

        public FieldEdge(String sourceField, String targetField, String expr) {
            this.sourceField = sourceField;
            this.targetField = targetField;
            this.expr = expr;
        }

        @Override
        public String toString() {
            return sourceField + " -> " + targetField + " [" + expr + "]";
        }
    }

    public static class LineageResult {
        public Set<String> tables = new HashSet<>();
        public List<TableEdge> tableEdges = new ArrayList<>();
        public List<FieldEdge> fieldEdges = new ArrayList<>();
    }

    public static LineageResult extract(String sql) throws Exception {
        LineageResult result = new LineageResult();
        Statement statement = CCJSqlParserUtil.parse(sql);

        if (statement instanceof Insert) {
            Insert insert = (Insert) statement;
            Table targetTable = insert.getTable();
            String targetTableName = targetTable.getFullyQualifiedName();
            result.tables.add(targetTableName);

            List<Column> targetColumns = insert.getColumns();

            if (insert.getSelect() != null && insert.getSelect().getSelectBody() instanceof PlainSelect) {
                PlainSelect select = (PlainSelect) insert.getSelect().getSelectBody();

                Map<String, String> aliasToTableMap = new HashMap<>();
                Set<String> sourceTables = new HashSet<>();

                collectTables(select.getFromItem(), aliasToTableMap, sourceTables);
                if (select.getJoins() != null) {
                    for (Join join : select.getJoins()) {
                        collectTables(join.getRightItem(), aliasToTableMap, sourceTables);
                    }
                }

                for (String src : sourceTables) {
                    result.tables.add(src);
                    result.tableEdges.add(new TableEdge(src, targetTableName));
                }

                List<SelectItem> selectItems = select.getSelectItems();
                for (int i = 0; i < Math.min(selectItems.size(), targetColumns.size()); i++) {
                    SelectItem selectItem = selectItems.get(i);
                    String targetField = targetTableName + "." + targetColumns.get(i).getColumnName();

                    if (selectItem instanceof SelectExpressionItem) {
                        Expression expr = ((SelectExpressionItem) selectItem).getExpression();
                        ExpressionExtractor extractor = new ExpressionExtractor(aliasToTableMap);
                        extractor.extract(expr);
                        for (String srcField : extractor.sourceFields) {
                            result.fieldEdges.add(new FieldEdge(srcField, targetField, extractor.expressionText));
                        }
                    }
                }
            }
        }

        return result;
    }

    private static void collectTables(FromItem fromItem, Map<String, String> aliasMap, Set<String> sourceTables) {
        if (fromItem instanceof Table) {
            Table table = (Table) fromItem;
            String fullName = table.getFullyQualifiedName();
            sourceTables.add(fullName);
            if (table.getAlias() != null) {
                aliasMap.put(table.getAlias().getName(), fullName);
            }
        } else if (fromItem instanceof SubSelect) {
            SubSelect subSelect = (SubSelect) fromItem;
            if (subSelect.getAlias() != null) {
                aliasMap.put(subSelect.getAlias().getName(), "subquery");
            }
            if (subSelect.getSelectBody() instanceof PlainSelect) {
                PlainSelect sub = (PlainSelect) subSelect.getSelectBody();
                collectTables(sub.getFromItem(), aliasMap, sourceTables);
                if (sub.getJoins() != null) {
                    for (Join join : sub.getJoins()) {
                        collectTables(join.getRightItem(), aliasMap, sourceTables);
                    }
                }
            }
        }
    }

    static class ExpressionExtractor extends ExpressionDeParser {
        public Set<String> sourceFields = new HashSet<>();
        public String expressionText;
        private final Map<String, String> aliasToTable;

        public ExpressionExtractor(Map<String, String> aliasToTable) {
            this.aliasToTable = aliasToTable;
        }

        @Override
        public void visit(Column column) {
            String tableAlias = column.getTable() != null ? column.getTable().getName() : null;
            String colName = column.getColumnName();
            if (tableAlias != null && aliasToTable.containsKey(tableAlias)) {
                sourceFields.add(aliasToTable.get(tableAlias) + "." + colName);
            } else {
                sourceFields.add(colName);
            }
            super.visit(column);
        }

        public void extract(Expression expression) {
            StringBuilder sb = new StringBuilder();
            this.setBuffer(sb);
            expression.accept(this);
            this.expressionText = sb.toString();
        }
    }

    public static void main(String[] args) throws Exception {
        String sql =
                "INSERT INTO ads.user_stats (user_id, total_amount) " +
                        "SELECT u.id, SUM(o.amount) " +
                        "FROM ods.users u " +
                        "JOIN ods.orders o ON u.id = o.user_id " +
                        "GROUP BY u.id";

        LineageResult result = extract(sql);

        System.out.println("\n[Tables]:");
        result.tables.forEach(System.out::println);

        System.out.println("\n[Table Edges]:");
        result.tableEdges.forEach(System.out::println);

        System.out.println("\n[Field Edges]:");
        result.fieldEdges.forEach(System.out::println);
    }
}