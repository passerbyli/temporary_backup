let a = {
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      minSize: 60 * 1024, // 把小于 60KB 的合并，减少碎片
      maxAsyncRequests: 8, // 限制异步并发 chunk 数
      maxInitialRequests: 6, // 限制首屏 chunk 数
      cacheGroups: {
        // Vue 全家桶
        vue: {
          test: /[\\/]node_modules[\\/](vue|vue-router|pinia)[\\/]/,
          name: 'chunk-vue',
          priority: 30,
          reuseExistingChunk: true,
        },
        // Element Plus
        element: {
          test: /[\\/]node_modules[\\/]element-plus[\\/]/,
          name: 'chunk-element',
          priority: 25,
          reuseExistingChunk: true,
        },
        // 其它 node_modules 合并成一个 vendor
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'chunk-vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        // 公共业务代码
        common: {
          name: 'chunk-common',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
}

