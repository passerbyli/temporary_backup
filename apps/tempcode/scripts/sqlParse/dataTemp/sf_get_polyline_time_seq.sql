create or replace function public.sf_get_polyline_time_seq(in_platnumber text, in_time text) --in_time '2018-02-21'
returns table(
    id text,
    polyline text,
    timestamps text,
    start_time text
             ) as
    $BODY$
    DECLARE
        v_list public.location%ROWTYPE;  --按行读取表中记录
        v_stat_day timestamp := to_timestamp(in_time, 'yyyy-mm-dd hh24:mi:ss');
        v_end_day timestamp := to_timestamp(in_time, 'yyyy-mm-dd hh24:mi:ss') + '1 day';
        v_point text := '';  --输出点位组合结果
        v_time text := '';   --输出时间组合结果
        v_bz int := 0;  --用于判定200个点分组
        v_count int := 0;  --记录当天车辆总点数
    begin
        --获取每天记录的总数目，用于最后判定不足200时同样记录
        select count(*) into v_count from public.location
        where time >= v_stat_day and time < v_end_day and
              platenumber = in_platnumber and is_valid = 1;
        --利用循环方式按顺序重新组合点、时间
        for v_list in(select * from public.location
        where time >= v_stat_day and time < v_end_day and
              platenumber = in_platnumber and is_valid = 1 order by time)
        loop
            --把所有的点合并，所有的时间合并
            v_bz = v_bz + 1;
            v_point = v_point || v_list.lon || ',' || v_list.lat || ';';
            v_time = v_time || extract(epoch from v_list.time) || ';';
            --按200分组
            if v_bz % 200 = 0 or v_bz = v_count then
                id = v_list.platenumber;
                --去除最后多余的';'
                polyline = substring(v_point from 1 for length(v_point)-1);
                timestamps = substring(v_time from 1 for length(v_time)-1);
                --获取每条记录的点位开始时间
                start_time = substring( v_time from 1 for position(';' in v_time)-1);
                --返回结果
                return next;
                --初始化
                v_point = '';
                v_time = '';
            end if;
        end loop;
        return ;
    end;
    $BODY$
language 'plpgsql';