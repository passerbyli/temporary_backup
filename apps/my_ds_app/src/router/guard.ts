// router/guard.ts
import router from './index';
import { getMenuId } from '../services/pageMap.js';

router.beforeEach(async (to) => {
  if (to.name !== 'dynamicPage') return true;

  const pageCode = String(to.params.pageCode ?? '');
  if (!pageCode) return true;

  if (to.meta.menuId) return true;

  const menuId = await getMenuId(pageCode);
  if (!menuId) return { path: '/404' };

  to.meta.menuId = menuId;
  return true;
});
