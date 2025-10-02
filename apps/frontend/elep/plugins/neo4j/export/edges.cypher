
MATCH (from:dl_Table {name:'dm_table_ods_1'}), (to:dl_Table {name:'dm_table_dwd_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_dwd_1'}), (to:dl_Table {name:'dm_table_dws_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_ods_0'}), (to:dl_Table {name:'dm_table_dwd_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_dim_1'}), (to:dl_Table {name:'dm_table_dws_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_dim_2'}), (to:dl_Table {name:'dm_table_dws_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_dim_3'}), (to:dl_Table {name:'dm_table_dws_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_dws_1'}), (to:dl_Table {name:'dm_table_ads_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_dws_2'}), (to:dl_Table {name:'dm_table_ads_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_dws_3'}), (to:dl_Table {name:'dm_table_ads_1'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);


MATCH (from:dl_Table {name:'dm_table_ads_1'}), (to:dl_Table {name:'dm_api_01'})
MERGE (from)-[:DEPENDS_ON {sql:'', task:''}]->(to);
