export function fetchMenu(areaType) {
const china = [
  {
    menuId: 'home',
    menuName: '中国区首页',
    type: 'component',
    componentName: 'ChinaHome',
  },

  {
    menuId: 'c1',
    menuName: '中国-总览(L1)',
    children: [
      {
        menuId: 'c1_l2_board',
        menuName: '大盘(L2)',
        children: [
          {
            menuId: 'c1_l3_dashboard',
            menuName: 'Dashboard(L3 leaf)',
            type: 'component',
            componentName: 'ChinaDashboard',
            footer:false,
          },
          {
            menuId: 'c1_l3_city',
            menuName: '城市报表(L3)',
            children: [
              {
                menuId: 'c1_l4_city_sum',
                menuName: '城市-汇总(L4 leaf)',
                type: 'component',
                componentName: 'ChinaCityReport',
              },
              {
                menuId: 'c1_l4_city_detail',
                menuName: '城市-详情(L4 leaf)',
                type: 'component',
                componentName: 'ChinaCityDetail',
              },
            ],
          },
        ],
      },

      {
        menuId: 'c1_l2_region',
        menuName: '中国-区域(L2 leaf)',
        type: 'component',
        componentName: 'ChinaRegion2Report',
      },

      {
        menuId: 'c1_l2_more',
        menuName: '更多(L2)',
        children: [
          {
            menuId: 'c1_l3_links',
            menuName: '链接与组件(L3)',
            children: [
              {
                menuId: 'c1_l4_external',
                menuName: '外部站点(L4 leaf)',
                type: 'externalLink',
                link: 'https://www.wikipedia.org',
              },
              {
                menuId: 'c1_l4_internal',
                menuName: '内链报表(L4 leaf)',
                type: 'internalLink',
                link: 'https://www.baidu.com',
              },
              {
                menuId: 'c1_l4_jss',
                menuName: '第三方组件(L4 leaf)',
                type: 'jss',
                link: 'http://localhost:5173/topNav.js',
              },
            ],
          },
        ],
      },
    ],
  },
]
  const oversea = [
    {
      menuId: 'o1',
      menuName: '海外-总览(L1)',
      children: [
        {
          menuId: 'o1-1',
          menuName: '看板(L2)',
          children: [
            {
              menuId: 'o1-1-1',
              menuName: 'Dashboard(L3 leaf)',
              type: 'component',
              componentName: 'OverseaDashboard',
            },
            {
              menuId: 'o1-1-2',
              menuName: '区域报表(L3)',
              children: [
                {
                  menuId: 'o1-1-2-1',
                  menuName: '区域-汇总(L4 leaf)',
                  type: 'component',
                  componentName: 'OverseaRegionReport',
                },
                {
                  menuId: 'o1-1-2-2',
                  menuName: '区域-详情(L4 leaf)',
                  type: 'component',
                  componentName: 'OverseaRegionDetail',
                },
              ],
            },
          ],
        },
      ],
    },
  ]

  const mock = { china, oversea }

  return new Promise((resolve) => setTimeout(() => resolve(mock[areaType] || []), 1200))
}
