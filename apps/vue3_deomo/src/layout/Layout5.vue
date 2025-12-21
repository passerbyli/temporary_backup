<template>
  <div class="shell">
    <!-- 顶部（48px，全宽，保持不变） -->
    <div class="header">
      <div class="header-left">
        <span class="brand">Demo</span>
        <el-tag size="small" effect="plain">{{ areaType }}</el-tag>
      </div>

      <div class="header-right">
        <el-button size="small" text @click="goArea('china')">中国</el-button>
        <el-button size="small" text @click="goArea('oversea')">海外</el-button>
      </div>
    </div>

    <!-- 中间（灰底 + 12px 间距，高度随 footer 动态） -->
    <div class="body" :style="{ height: bodyHeight }">
      <div class="panel">
        <!-- 左侧：el-tree（折叠时完全隐藏，只留把手） -->
        <div class="left-card" :class="{ collapsed: isCollapse }" :style="{ width: asideWidth }">
          <!-- 展开态：tree 可滚动 -->
          <div class="left-scroll" v-show="!isCollapse">
            <el-skeleton v-if="loading" animated :rows="10" />

            <el-tree
              v-else
              ref="treeRef"
              class="nav-tree"
              :data="menus"
              :props="treeProps"
              node-key="menuId"
              :default-expanded-keys="expandedKeys"
              :expand-on-click-node="false"
              :highlight-current="true"
              :current-node-key="activeLeftKey"
              @node-click="onTreeNodeClick"
            >
              <template #default="{ node, data }">
                <!-- 只显示两层 -->
                <span v-if="node.level <= 2" class="tree-label">
                  {{ data.menuName }}
                </span>
                <span v-else style="display:none;" />
              </template>
            </el-tree>
          </div>

          <!-- 折叠/展开把手（始终显示） -->
          <button
            class="collapse-handle"
            @click="toggleCollapse"
            :title="isCollapse ? '展开导航' : '收起导航'"
          >
            <el-icon>
              <Expand v-if="isCollapse" />
              <Fold v-else />
            </el-icon>
          </button>
        </div>

        <!-- 右侧：tabs + 内容区（左右等高；仅内容滚动） -->
        <div class="right-card">
          <!-- 保留 router-view（你的结构要求） -->
          <router-view />

          <!-- Tabs 固定在上方，不滚动 -->
          <div class="tabs-bar" v-if="l3Tabs.length || l4Tabs.length">
            <!-- L3 tabs -->
            <div v-if="l3Tabs.length" class="tab-row">
              <div
                v-for="t in l3Tabs"
                :key="t.menuId"
                class="tab-item"
                :class="{ active: String(activeL3Id) === String(t.menuId) }"
                @click="onClickL3Tab(t)"
                :title="t.menuName"
              >
                {{ t.menuName }}
              </div>
            </div>

            <!-- L4 tabs -->
            <div v-if="l4Tabs.length" class="tab-row">
              <div
                v-for="t in l4Tabs"
                :key="t.menuId"
                class="tab-item"
                :class="{ active: String(activeLeafId) === String(t.menuId) }"
                @click="onClickL4Tab(t)"
                :title="t.menuName"
              >
                {{ t.menuName }}
              </div>
            </div>
          </div>

          <!-- ✅ 内容区：唯一滚动区域 -->
          <div class="content-scroll">
            <el-card shadow="never" class="content-card">
              <ContentRenderer :node="activeLeafNode" :payload="payload" />
            </el-card>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部（48px，全宽，保持不变；可隐藏） -->
    <div v-if="footerVisible" class="footer">
      <div class="footer-inner">{{ footerText }}</div>
    </div>
  </div>
</template>

<script>
import { Fold, Expand } from "@element-plus/icons-vue";
import { fetchMenu } from "@/services/menu";
import { normalizePayload } from "@/utils/routePayload";
import {
  findPathById,
  isLeaf,
  pickFirstLeaf,
  pickFirstLeafFromTree,
} from "@/utils/tree";
import ContentRenderer from "@/views/ContentRenderer.vue";

export default {
  name: "Layout",
  components: { ContentRenderer, Fold, Expand },

  data() {
    return {
      isCollapse: false,
      loading: false,
      menus: [],

      // 当前叶子（唯一渲染源）
      activeLeafNode: null,

      // 左侧高亮（深度>2 高亮 L2）
      activeL2Id: "",

      // tabs
      l3Tabs: [],
      l4Tabs: [],
      activeL3Id: "",
      activeLeafId: "",

      // el-tree props：后端字段 child
      treeProps: {
        children: "child",
        label: "menuName",
      },

      // 展开的 keys：当当前节点>=2时，展开路径上的 L1/L2
      expandedKeys: [],
    };
  },

  computed: {
    areaType() {
      return this.$route.path.startsWith("/oversea") ? "oversea" : "china";
    },
    menuId() {
      return this.$route.query.menuId || "";
    },

    // 业务参数：除 menuId 外全部
    payload() {
      return normalizePayload(this.$route.query);
    },

    // 折叠彻底：只留把手
    asideWidth() {
      return this.isCollapse ? "44px" : "260px";
    },

    // el-tree 当前高亮：深度>2 高亮 L2，否则高亮当前 menuId
    activeLeftKey() {
      return this.activeL2Id || this.menuId || "";
    },

    footerInfo() {
      const f = this.activeLeafNode && this.activeLeafNode.footer;
      if (f === false || f === 0) return { show: false, text: "" };
      if (f === true || f === 1) return { show: true, text: "© 2025 Your Company. All rights reserved." };
      if (typeof f === "string") return { show: true, text: f };
      if (f && typeof f === "object") return { show: !!f.show, text: f.text || "" };
      return { show: true, text: "© 2025 Your Company. All rights reserved." };
    },
    footerVisible() {
      return this.footerInfo.show;
    },
    footerText() {
      return this.footerInfo.text;
    },

    // 中间高度根据 footer 是否展示动态变化
    bodyHeight() {
      const footerH = this.footerVisible ? 48 : 0;
      return `calc(100vh - 48px - ${footerH}px)`;
    },
  },

  watch: {
    areaType: { immediate: true, handler() { this.loadMenus(); } },
    menuId: { immediate: true, handler() { this.applyMenuId(); } },
  },

  methods: {
    toggleCollapse() {
      this.isCollapse = !this.isCollapse;

      // 折叠->展开时，恢复展开状态与高亮
      if (!this.isCollapse) {
        this.$nextTick(() => {
          const tree = this.$refs.treeRef;
          if (!tree) return;
          tree.setExpandedKeys(this.expandedKeys || []);
          if (this.activeLeftKey) tree.setCurrentKey(this.activeLeftKey);
        });
      }
    },

    goArea(type) {
      // 保留业务参数（除 menuId 也保留），只切 path
      this.$router.push({ path: `/${type}`, query: { ...this.$route.query } });
    },

    async loadMenus() {
      this.loading = true;
      this.menus = await fetchMenu(this.areaType);
      this.loading = false;

      // 无 menuId：默认第一个叶子
      if (!this.menuId) {
        const firstLeaf = pickFirstLeafFromTree(this.menus);
        if (firstLeaf) {
          this.$router.replace({
            path: `/${this.areaType}`,
            query: { ...this.$route.query, menuId: firstLeaf.menuId },
          });
        }
        return;
      }

      this.applyMenuId();
    },

    applyMenuId() {
      if (!this.menus.length) return;

      const path = findPathById(this.menus, this.menuId);

      // menuId 不存在：回退第一个叶子
      if (!path) {
        const firstLeaf = pickFirstLeafFromTree(this.menus);
        if (firstLeaf) {
          this.$router.replace({
            path: `/${this.areaType}`,
            query: { ...this.$route.query, menuId: firstLeaf.menuId },
          });
        }
        return;
      }

      const last = path[path.length - 1];

      // 指向非叶子：replace 到其下第一个叶子
      if (!isLeaf(last)) {
        const leaf = pickFirstLeaf(last);
        if (leaf) {
          this.$router.replace({
            path: `/${this.areaType}`,
            query: { ...this.$route.query, menuId: leaf.menuId },
          });
        }
        return;
      }

      // ✅ 叶子：唯一渲染源
      this.activeLeafNode = last;
      this.activeLeafId = last.menuId;

      // depth>2 高亮 L2（祖先）
      this.activeL2Id = path.length > 2 && path[1] ? path[1].menuId : "";

      // externalLink：自动打开（如不需要自动打开可删除）
      if (last.type === "externalLink" && last.link) {
        window.open(last.link, "_blank", "noopener,noreferrer");
      }

      // Tabs（使用 child 字段）
      const depth = path.length;

      if (depth <= 2) {
        this.l3Tabs = [];
        this.l4Tabs = [];
        this.activeL3Id = "";
      } else {
        const l2Node = path[1]; // L2
        this.l3Tabs = l2Node && l2Node.child ? l2Node.child : [];

        const l3Node = depth === 3 ? last : path[2]; // L3
        this.activeL3Id = l3Node ? l3Node.menuId : "";

        this.l4Tabs = l3Node && l3Node.child && l3Node.child.length ? l3Node.child : [];
      }

      // ✅ 左侧树展开：当前节点层级>=2（即 path.length>=2）展开路径上的 L1/L2
      this.syncTreeExpand(path);

      // ✅ 可选：滚动左侧让高亮节点可见（展开态才做）
      this.scrollTreeToCurrent();
    },

    // 树节点点击：只展示两层，但点击时要落到该节点下第一个叶子
    onTreeNodeClick(data, node) {
      // data 是被点击的节点（L1/L2）
      const leaf = pickFirstLeaf(data) || data;

      this.$router.push({
        path: `/${this.areaType}`,
        query: { ...this.$route.query, menuId: leaf.menuId },
      });
    },

    onClickL3Tab(l3) {
      const leaf = pickFirstLeaf(l3) || l3;
      this.$router.push({
        path: `/${this.areaType}`,
        query: { ...this.$route.query, menuId: leaf.menuId },
      });
    },

    onClickL4Tab(l4) {
      this.$router.push({
        path: `/${this.areaType}`,
        query: { ...this.$route.query, menuId: l4.menuId },
      });
    },

    // ✅ 关键：当当前节点>=2时，展开路径上的 L1/L2，并设置 currentKey
    syncTreeExpand(path) {
      if (!path || !path.length) return;

      // path.length>=2 说明“当前节点层级>=2”（L2/L3/L4）
      // 至少展开 L1；如果存在 L2 也一起展开（更符合“对应节点都要展开”）
      const keys = [];
      if (path[0]) keys.push(path[0].menuId);
      if (path.length >= 2 && path[1]) keys.push(path[1].menuId);

      this.expandedKeys = keys;

      // 折叠态不需要操作 tree
      if (this.isCollapse) return;

      this.$nextTick(() => {
        const tree = this.$refs.treeRef;
        if (!tree) return;

        tree.setExpandedKeys(keys);
        if (this.activeLeftKey) tree.setCurrentKey(this.activeLeftKey);
      });
    },

    // ✅ 可选：滚动左侧树到当前高亮节点
    scrollTreeToCurrent() {
      if (this.isCollapse) return;
      this.$nextTick(() => {
        const tree = this.$refs.treeRef;
        if (!tree || !tree.$el) return;
        const cur = tree.$el.querySelector(".is-current");
        if (cur && cur.scrollIntoView) {
          cur.scrollIntoView({ block: "center" });
        }
      });
    },
  },
};
</script>

<style scoped>
.shell {
  height: 100vh;
  overflow: hidden;
  background: #f2f3f5;
}

/* 顶部/底部保持不变 */
.header {
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-light);
}
.footer {
  height: 48px;
  padding: 0 16px;
  background: var(--el-bg-color-overlay);
  border-top: 1px solid var(--el-border-color-light);
}
.footer-inner {
  height: 48px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 中间灰底 + 12px */
.body {
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
  background: #f2f3f5;
}

/* 左右等高 */
.panel {
  height: 100%;
  display: flex;
  gap: 12px;
  align-items: stretch;
  overflow: hidden;
}

/* 左侧卡片 */
.left-card {
  height: 100%;
  flex: 0 0 auto;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
  overflow: hidden;
  position: relative;
}

/* 折叠态：只剩把手 */
.left-card.collapsed {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 左侧滚动区 */
.left-scroll {
  height: 100%;
  overflow: auto;
  padding: 8px 8px 56px; /* 给把手按钮留空间 */
  box-sizing: border-box;
}

/* el-tree 美化 */
.nav-tree {
  background: transparent;
}
.tree-label {
  display: inline-block;
  width: 100%;
}

/* 折叠/展开把手按钮 */
.collapse-handle {
  position: absolute;
  right: 10px;
  bottom: 10px;

  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-overlay);
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;
}
.left-card.collapsed .collapse-handle {
  position: static;
  right: auto;
  bottom: auto;
}
.collapse-handle:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

/* 右侧卡片 */
.right-card {
  height: 100%;
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
  padding: 12px;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* div tabs */
.tabs-bar {
  flex: 0 0 auto;
  margin-bottom: 8px;
}
.tab-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
}
.tab-row::-webkit-scrollbar { height: 6px; }
.tab-row::-webkit-scrollbar-thumb { background: #dcdfe6; border-radius: 999px; }

.tab-item {
  flex: 0 0 auto;
  padding: 6px 12px;
  border-radius: 999px;
  background: #f5f7fa;
  color: #606266;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid transparent;
  user-select: none;
  transition: all .15s ease;
}
.tab-item:hover {
  background: #ecf5ff;
  color: var(--el-color-primary);
}
.tab-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}

/* 内容区唯一滚动 */
.content-scroll {
  flex: 1 1 auto;
  overflow: auto;
  min-height: 0;
}
.content-card {
  min-height: 100%;
  border-radius: 10px;
}

/* header */
.header-left { display:flex; align-items:center; gap:10px; }
.header-right { display:flex; align-items:center; gap:8px; }
.brand { font-weight: 700; }
</style>