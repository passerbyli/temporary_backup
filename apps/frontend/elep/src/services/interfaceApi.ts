export async function getInterfaceList(filters: any) {
  return [
    {
      id: 1,
      name: '获取用户信息',
      url: '/api/user/info',
      impl: 'java',
      domain: '用户中心',
      authType: 'OAuth2',
      description: '获取当前登录用户的基本信息'
    },
    {
      id: 2,
      name: '订单查询',
      url: '/api/order/query',
      impl: 'netCore',
      domain: '订单系统',
      authType: 'Token',
      description: '根据条件查询订单列表'
    }
  ]
}

export async function getDomainList() {
  return ['用户中心', '订单系统', '支付系统']
}

export async function getAuthTypes() {
  return ['OAuth2', 'Token', 'None']
}

export async function getInterfaceDetail(id: number, env: 'prod' | 'test') {
  const mockData: {
    [key: number]: {
      prod: any
      test: any
    }
  } = {
    1: {
      prod: {
        id: 1,
        apiId: 'api-user-info',
        name: '获取用户信息',
        url: '/api/user/info',
        onlineUrl: 'https://api.example.com/user/info',
        impl: 'java',
        domain: '用户中心',
        authType: 'OAuth2',
        description: '生产环境用户信息接口',
        requestExample: '{ "token": "xxx" }',
        inputParams: [{ name: 'token', type: 'string', required: true, desc: '用户令牌' }],
        outputParams: [
          { name: 'userId', type: 'string', desc: '用户ID' },
          { name: 'username', type: 'string', desc: '用户名' },
          { name: 'email', type: 'string', desc: '邮箱' }
        ],
        backendScript: 'SELECT * FROM users WHERE token = ?;'
      },
      test: {
        id: 1,
        apiId: 'api-user-info',
        name: '获取用户信息',
        url: '/test-api/user/info',
        onlineUrl: 'https://test-api.example.com/user/info',
        impl: 'java',
        domain: '用户中心',
        authType: 'OAuth2',
        description: '测试环境用户信息接口',
        requestExample: '{ "token": "test-token" }',
        inputParams: [{ name: 'token', type: 'string', required: true, desc: '用户令牌（测试）' }],
        outputParams: [
          { name: 'userId', type: 'string', desc: '用户ID' },
          { name: 'username', type: 'string', desc: '用户名' },
          { name: 'email', type: 'string', desc: '邮箱地址' }
        ],
        backendScript: 'SELECT * FROM users WHERE token = ? /* test */;'
      }
    },
    2: {
      prod: {
        id: 2,
        apiId: 'api-order-query',
        name: '订单查询',
        url: '/api/order/query',
        onlineUrl: 'https://api.example.com/order/query',
        impl: 'netCore',
        domain: '订单系统',
        authType: 'Token',
        description: '订单查询接口-生产',
        requestExample: '{ "userId": "u123", "date": "2024-01-01" }',
        inputParams: [
          { name: 'userId', type: 'string', required: true, desc: '用户ID' },
          { name: 'date', type: 'string', required: false, desc: '下单日期' }
        ],
        outputParams: [
          { name: 'orderId', type: 'string', desc: '订单编号' },
          { name: 'amount', type: 'float', desc: '订单金额' }
        ],
        backendScript: 'SELECT * FROM orders WHERE user_id = ?;'
      },
      test: {
        id: 2,
        apiId: 'api-order-query',
        name: '订单查询',
        url: '/test-api/order/query',
        onlineUrl: 'https://test-api.example.com/order/query',
        impl: 'netCore',
        domain: '订单系统',
        authType: 'Token',
        description: '订单查询接口-测试',
        requestExample: '{ "userId": "test-user" }',
        inputParams: [
          { name: 'userId', type: 'string', required: true, desc: '测试用户ID' },
          { name: 'date', type: 'string', required: false, desc: '查询日期（测试）' }
        ],
        outputParams: [
          { name: 'orderId', type: 'string', desc: '订单编号' },
          { name: 'amount', type: 'float', desc: '金额' }
        ],
        backendScript: 'SELECT * FROM orders WHERE user_id = ? /* test */;'
      }
    }
  }
  return mockData[id]?.[env] || {}
}

declare global {
  interface Window {
    serviceApi: {
      getInterfaceList: (filters: any) => Promise<any>
      getDomainList: () => Promise<string[]>
      getAuthTypes: () => Promise<string[]>
      getInterfaceDetail: (id: number, env: string) => Promise<any>
      diffApiByRoute: (routeId: string) => Promise<any>
      queryApiListByRoute: (params: any) => Promise<any>
      getApiDetailByRouteId: (params: any) => Promise<any>
    }
  }
}

/**
 * 根据 route_id 对比生产与测试环境的接口注册差异
 * @param {string} routeId - 路由 ID
 * @returns {Promise<Array>} 差异对比结果
 */
export async function diffApiByRoute(routeId: string) {
  return await window.serviceApi.diffApiByRoute(routeId)
}

export async function queryApiListByRoute(params: any) {
  return await window.serviceApi.queryApiListByRoute(params)
}

export async function getApiDetailByRouteId(params: any) {
  return await window.serviceApi.getApiDetailByRouteId(params)
}
