
      MATCH (from:Table {name: 'dm.table_ods_1'}), (to:Table {name: 'dm.table_dwd_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_dwd_1'}), (to:Table {name: 'dm.table_dws_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_ods_0'}), (to:Table {name: 'dm.table_dwd_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_dim_1'}), (to:Table {name: 'dm.table_dws_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_dim_2'}), (to:Table {name: 'dm.table_dws_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_dim_3'}), (to:Table {name: 'dm.table_dws_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_dws_1'}), (to:Table {name: 'dm.table_ads_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_dws_2'}), (to:Table {name: 'dm.table_ads_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_dws_3'}), (to:Table {name: 'dm.table_ads_1'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    

      MATCH (from:Table {name: 'dm.table_ads_1'}), (to:Table {name: 'dm.api_01'})
      MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to)
    