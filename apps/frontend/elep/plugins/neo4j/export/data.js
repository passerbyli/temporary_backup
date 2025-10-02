const graphData = {
  nodes: [
    {
      id: 'ods_user',
      label: 'ODS原始用户表',
      alias: 'ODS原始用户表',
      schema: 'ods',
      fields: [
        {
          name: 'user_id',
          type: 'varchar',
          length: 32,
          primaryKey: true,
        },
        {
          name: 'user_name',
          type: 'varchar',
          length: 128,
          primaryKey: false,
        },
      ],
    },
    {
      id: 'dwd_user_info',
      label: 'DWD用户信息宽表',
      alias: 'DWD用户信息宽表',
      comboId: 'dwd',
      schema: 'dwd',
      fields: [
        {
          name: 'user_id',
          type: 'varchar',
          length: 32,
          primaryKey: true,
        },
        {
          name: 'gender',
          type: 'varchar',
          length: 2,
          primaryKey: false,
        },
      ],
    },
    {
      id: 'dwd_user_info2',
      label: 'DWD用户信息宽表2',
      alias: 'DWD用户信息宽表2',
      comboId: 'dwd',
      schema: 'dwd',
      fields: [
        {
          name: 'user_id',
          type: 'varchar',
          length: 32,
          primaryKey: true,
        },
        {
          name: 'gender',
          type: 'varchar',
          length: 2,
          primaryKey: false,
        },
      ],
    },
    {
      id: 'dws_user_summary',
      label: 'DWS用户汇总表',
      alias: 'DWS用户汇总表',
      comboId: 'dws',
      schema: 'dws',
      fields: [
        {
          name: 'user_id',
          type: 'varchar',
          length: 32,
          primaryKey: true,
        },
        {
          name: 'total_orders',
          type: 'int',
          length: 4,
          primaryKey: false,
        },
      ],
    },
    {
      id: 'ads_user_behavior',
      label: 'ADS用户行为表',
      alias: 'ADS用户行为表',
      schema: 'ads',
      fields: [
        {
          name: 'user_id',
          type: 'varchar',
          length: 32,
          primaryKey: true,
        },
        {
          name: 'summary_score',
          type: 'float',
          length: 8,
          primaryKey: false,
        },
      ],
    },
  ],
  edges: [
    {
      source: 'ods_user',
      target: 'dwd_user_info',
      label: 'proc_etl_user_clean',
      schedule: '0 2 * * *',
    },
    {
      source: 'dwd_user_info',
      target: 'dws_user_summary',
      label: 'proc_user_summary',
      schedule: '0 3 * * *',
    },
    {
      source: 'dws_user_summary',
      target: 'ads_user_behavior',
      label: 'proc_user_behavior_export',
      schedule: '0 4 * * *',
    },
  ],
}
