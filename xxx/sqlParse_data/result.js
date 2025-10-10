const result = {
  databaseType: 'PostgreSQL',

  procedures: [
    {
      type: 'PROCEDURE',
      schema: 'public',
      name: 'proc_sales_summary',
    },
  ],
  functionNames: [],
  sourceTables: [
    {
      schema: 'staging',
      table: 'sales_data',
      isTemporary: false,
    },
  ],
  targetTables: [
    {
      schema: 'report',
      table: 'sales_summary',
      isTemporary: false,
    },
  ],

  nodes: [
    {
      id: 'table:staging.sales_data',
      label: 'sales_data',
      type: 'table',
      isTemporary: false,
      style: { fill: '#87CEFA' }, // 蓝色代表普通表
    },
    {
      id: 'table:report.sales_summary',
      label: 'sales_summary',
      type: 'table',
      isTemporary: false,
      style: { fill: '#87CEFA' },
    },
    {
      id: 'procedure:public.proc_sales_summary',
      label: 'proc_sales_summary',
      type: 'procedure',
      style: { fill: '#FFB6C1' }, // 粉色代表存储过程
    },
  ],

  edges: [
    {
      source: 'table:staging.sales_data',
      target: 'table:report.sales_summary',
      label: 'TRANSFORM via proc_sales_summary',
    },
    {
      source: 'table:report.sales_summary',
      target: 'procedure:public.proc_sales_summary',
      label: 'CALL PROCEDURE',
    },
  ],

  columnEdges: [
    {
      source: 'staging.sales_data.region',
      target: 'report.sales_summary.region',
      label: 'FIELD_MAP',
    },
    {
      source: 'staging.sales_data.amount',
      target: 'report.sales_summary.total_sales',
      label: 'FIELD_MAP',
    },
  ],
};

/**
	•	databaseType：通过关键字启发判断出的数据库方言。
	•	procedures / functionNames：过程和函数的定义信息。
	•	sourceTables / targetTables：语句级血缘分析出的表集合。
	•	nodes：为构建可视化图谱准备的节点（表/函数/过程）。
	•	edges：语句级的“表→表” 与 “表→过程” 关系。
	•	columnEdges：字段级血缘映射（INSERT INTO ... SELECT ... 一一对应的列映射）。
 */
