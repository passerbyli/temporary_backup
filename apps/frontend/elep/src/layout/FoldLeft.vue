<template>
  <div class="fold-left-box">
    <div class="fold-left-box-left" :style="{ width: asideWidth + 'px' }" v-show="asideWidth > 0">
      <slot name="left"></slot>
    </div>
    <div class="fold-left-box-line" :style="{ cursor: asideWidth === 0 ? '' : 'col-resize' }" ref="drag">
      <el-button size="mini" circle class="fold-left-box-line-button" @click="foldLeft">
        <el-icon>
          <ArrowRight v-if="asideWidth == 0" />
          <ArrowLeft v-else />
        </el-icon>
      </el-button>
    </div>
    <div class="fold-left-box-main">
      <slot name="main"></slot>
    </div>
  </div>
</template>

<script>
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
export default {
  name: 'FoldLeft',
  components: {
    ArrowRight,
    ArrowLeft,
  },
  data() {
    return {
      asideWidth: 300,
    }
  },
  props: {

  },
  mounted() {
    this.bindDrop()
  },
  methods: {
    // 折叠事件
    foldLeft() {
      this.asideWidth = this.asideWidth === 0 ? 300 : 0
    },
    // 绑定鼠标点击事件
    bindDrop() {
      const _this = this
      const drag = this.$refs.drag
      drag.onmousedown = function (e) {
        document.onmousemove = function (e) {
          _this.asideWidth += e.movementX
          if (_this.asideWidth < 20) {
            document.onmouseup()
            _this.asideWidth = 0
          }
        };
        document.onmouseup = function () {
          document.onmousemove = null
          document.onmouseup = null
        }
        return false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.fold-left-box {
  height: 100%;
  overflow: hidden;
  display: flex;

  &-left {
    height: 100%;
    overflow: hidden;
  }

  &-line {
    width: 4px;
    height: 100%;
    position: relative;
    border-left: 1px solid #e6e6e6;

    &-button {
      position: absolute;
      top: 50%;
      right: -10px;
    }
  }

  &-main {
    height: 100%;
    flex: 1;
    padding-left: 12px;
    overflow: hidden;
  }
}
</style>