// E2-TODO: V4 replaces legacy category-string + service-counter coupling with
// MenuCategory/categoryId and tenant/site scoping. Menu endpoints are kept
// reachable in E1-02 but intentionally disabled to avoid silent crashes.
// E2-TODO: V3 -> V4 Menu field mapping (used when re-enabling in E5)
// MenuCategory:
//   - name (string) -> key (renamed)
//   - NEW: tenantId, siteId required
//   - NEW: orderMode (quantity | one_off)
//   - NEW: limitMode (total_per_category | per_item)
//   - NEW: defaultOperatorId (replaces ServiceCounter.id concept)
//   - nameZh -> nameSc (renamed)
//   - nameHant -> nameTc (renamed)
// MenuItem:
//   - name (string) -> key (renamed; uniqueness now scoped to siteId)
//   - category (string FK by name) -> categoryId (FK to MenuCategory.id)
//   - NEW: tenantId, siteId required
//   - nameZh -> nameSc, nameHant -> nameTc
//   - serviceCounterId field removed (use category.defaultOperatorId)
function respondMenuCompatDisabled(req, res) {
  return res.status(503).json({
    error: 'Menu API is temporarily disabled in V4 compatibility mode',
    code: 'E1_V4_COMPAT_DISABLED',
    feature: 'menu',
    todo: 'E2-TODO: rebuild menu/category workflows against MenuCategory/categoryId',
  });
}

const listMenuItems = respondMenuCompatDisabled;
const createMenuItem = respondMenuCompatDisabled;
const updateMenuItem = respondMenuCompatDisabled;
const deleteMenuItem = respondMenuCompatDisabled;
const uploadMenuItemImage = respondMenuCompatDisabled;

module.exports = {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadMenuItemImage,
};
