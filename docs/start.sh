Container_IP = `ifconfig eth0 | grep 'inet ' | awk '{print $2}'`
SerfLanPort = `echo ${VMPORT}|awk -F ':' '{print $2}'`


sed -i 's/{token}/'"${AGENT_TOKEN}"'/g' "./consul/config/client_policy.json"
sed -i 's/{server}/'"${CONSUL_SERVER}"'/g' "./consul/config/client_policy.json"
sed -i "s|{self_lan}|${SerfLangPort}|g" "./client_policy.json"

consul agent \
 -node=''"{env}"'_xxx_service_'$VMIP'_'$Container_IP \
 -advertise=${VMIP} \
 -config-file=./client_policy.json \
 -self-lan-port=$SerfLangPort &

export ASPNETCORE_URLS="http://${Container_IP}:${APP_PORT}"

exec dotnet xxx.Service.dll
