```
const modelData = [
  {
    id: 10000,
    name: "table",
    tables: [
      {
        id: 1,
        field: "field1_cn",
        label: "field1Name_cn",
        type: "varchar(100)",
        AliaseName: "aliaseName_cn",
        tableName: "table",
      },
      {
        id: 2,
        field: "field1_en",
        label: "field1Name_cn",
        type: "varchar(100)",
        AliaseName: "aliaseName_cn",
        tableName: "table",
      },
      {
        id: 3,
        field: "field1_cn_type",
        label: "field1Name_cn_type",
        type: "varchar(100)",
        AliaseName: "aliaseName_cn_type",
        tableName: "table",
      },
      {
        id: 4,
        field: "field1_en_type",
        label: "field1Name_en_type",
        type: "varchar(100)",
        AliaseName: "aliaseName_en_type",
        tableName: "table",
      },
    ],
    measures: [
      {
        id: 5,
        name: "总数_中文",
        expression: "xxxxxxx",
        tableName: "table",
        type: "number",
      },
      {
        id: 6,
        name: "国家_中文_类型",
        expression: "qqqqq",
        tableName: "table",
        type: "number",
      },
      {
        id: 7,
        name: "国家_英文_类型",
        expression: "qqqqq",
        tableName: "table",
        type: "number",
      },
    ],
  },
  {
    id: 10001,
    name: "table1",
    tables: [
      {
        id: 8,
        field: "field9_cn",
        label: "field9Name_cn",
        type: "varchar(100)",
        AliaseName: "aliaseName9_cn",
        tableName: "table1",
      },
    ],
  },
];

const sheetData = {
  cells: [
    {
      xAxis: {
        type: "category",
        data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      },
      yAxis: {
        type: "value",
      },
      series: [
        {
          data: [150, 230, 224, 218, 135, 147, 260],
          type: "line",
        },
      ],
    },
    {
      id: "213",
      name: "jdiaso",
      type: "table",
      config: {
        rowList: [
          {
            id: 1,
            label: "field1Name_cn",
            name: "field1_cn",
            treeId: "table.field1_cn",
            treeName: "field1Name_cn",
          },
        ],
      },
    },
    {
      id: "213",
      name: "jdiaso",
      type: "table",
      config: {
        yAxis: [
          {
            conifg: {
              fieldConf: {
                id: 6,
                name: "国家_中文_类型",
                expression: "qqqqq",
                tableName: "table",
                type: "number",
                treeId: "table.国家_中文_类型",
              },
            },
          },
        ],
      },
      sortField: {
        id: 6,
        iconType: "measure",
        label: "国家_中文_类型",
        expression: "xxxxxxx",
        name: "国家_中文_类型",
        treeId: "table.国家_中文_类型",
        treeName: "国家_中文_类型",
        displayName: "国家_中文_类型",
      },
      defaultFiled: {
        id: 1,
        label: "field1Name_cn",
        name: "field1_cn",
        treeId: "table.field1_cn",
        treeName: "field1Name_cn",
      },
    },
  ],
  filters: [],
};
```

遍历 sheetData 对象，查找所有有 treeId 属性的对象节点，保存临时变量为 treeObj，把 treeId 根据“.”分组为 arr[0],arr[1]。
如果 arr[1]字符串里包含*cn 结尾，*中文结尾或包含*cn*,_中文_，替换为*en,*英文或*en*,_英文_，赋值给新的变量 enStr。
modelData 对象数组里查找 name=arr[0]的对象 tableObj，再在 tableObj.table1 和 tableObj.measures 查找 name=enStr 的对象 enObj。
根据 enObj 替换 treeObj 对应的字段,前提是有对应的属性：
treeObj.name=enObj.field
treeObj.field=enObj.label
treeObj.treeId=arr[0]+''+enStr
treeObj.id=enObj.id
treeObj.expression=enObj.expression 等

主要目的是根据 modelData 翻译 sheetData 对象里的所有能匹配规则的中文属性。并生成新 json 文件。使用 nodejs 实现该功能
