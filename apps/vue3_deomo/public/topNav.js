// topNav.js
// 远程加载的 Vue2 顶部导航组件

export default {
  name: "TopNav",

  props: {
    title: {
      type: String,
      default: "统一平台"
    },
    menus: {
      type: Array,
      default: () => ([
        { key: "home", label: "首页", path: "/" },
        { key: "system", label: "系统管理", path: "/system" },
        { key: "about", label: "关于", path: "/about" }
      ])
    },
    activeKey: {
      type: String,
      default: ""
    },
    user: {
      type: Object,
      default: () => ({
        name: "游客"
      })
    }
  },

  methods: {
    handleMenuClick(menu) {
      this.$emit("menu-click", menu);

      // 兼容有无 vue-router 的场景
      if (this.$router && menu.path) {
        this.$router.push(menu.path).catch(() => {});
      } else if (menu.path) {
        window.location.href = menu.path;
      }
    },

    logout() {
      this.$emit("logout");
    }
  },

  render(h) {
    return h("div", { class: "top-nav" }, [
      // 左侧标题
      h("div", { class: "top-nav__left" }, this.title),

      // 中间菜单
      h(
        "div",
        { class: "top-nav__center" },
        this.menus.map(menu =>
          h(
            "span",
            {
              key: menu.key,
              class: [
                "top-nav__item",
                this.activeKey === menu.key ? "active" : ""
              ],
              on: {
                click: () => this.handleMenuClick(menu)
              }
            },
            menu.label
          )
        )
      ),

      // 右侧用户信息
      h("div", { class: "top-nav__right" }, [
        h("span", { class: "user-name" }, this.user.name),
        h(
          "span",
          {
            class: "logout",
            on: { click: this.logout }
          },
          "退出"
        )
      ]),

      // 样式（内联，保证远程加载即用）
      h("style", [
        `
        .top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          padding: 0 20px;
          background: #001529;
          color: #fff;
          box-sizing: border-box;
        }
        .top-nav__left {
          font-size: 16px;
          font-weight: bold;
        }
        .top-nav__center {
          display: flex;
          gap: 20px;
        }
        .top-nav__item {
          cursor: pointer;
          font-size: 14px;
          opacity: 0.85;
        }
        .top-nav__item:hover {
          opacity: 1;
        }
        .top-nav__item.active {
          border-bottom: 2px solid #1890ff;
          padding-bottom: 4px;
        }
        .top-nav__right {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 14px;
        }
        .logout {
          cursor: pointer;
          color: #ff7875;
        }
        `
      ])
    ]);
  }
};