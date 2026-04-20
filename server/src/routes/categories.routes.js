import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { asyncHandler, HttpError } from '../utils/async.js';

const router = Router();

function toCategory(row) {
  if (!row) return null;
  return {
    _id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon ?? null,
    parentId: row.parent_id ?? null,
    sortOrder: row.sort_order ?? 0,
  };
}

// Flat fetch of all categories, ordered so parents come before children
// (parent_id NULLS FIRST, then sort_order, then name).
async function fetchAllOrdered() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, parent_id, slug, name, icon, sort_order')
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Build an in-memory tree from a flat, ordered list. Each node carries
// an empty `children` array we fill in during a single pass.
function buildTree(rows) {
  const byId = new Map();
  const roots = [];
  for (const row of rows) {
    byId.set(row.id, { ...toCategory(row), children: [] });
  }
  for (const row of rows) {
    const node = byId.get(row.id);
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return { roots, byId };
}

// Collect descendant ids (including `rootId` itself) using the prebuilt tree.
function collectDescendantIds(rootId, byId) {
  const out = [rootId];
  const node = byId.get(rootId);
  if (!node) return out;
  const stack = [...node.children];
  while (stack.length) {
    const n = stack.pop();
    out.push(n._id);
    for (const c of n.children) stack.push(c);
  }
  return out;
}

// Walk up parent_id chain from `id` — returns root-first ancestor list
// (excluding the node itself). Safe against accidental cycles.
function ancestorsOf(id, byId) {
  const chain = [];
  const seen = new Set();
  let curId = byId.get(id)?.parentId ?? null;
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const node = byId.get(curId);
    if (!node) break;
    chain.push({ _id: node._id, slug: node.slug, name: node.name });
    curId = node.parentId;
  }
  return chain.reverse();
}

// GET /api/categories — full tree
router.get('/', asyncHandler(async (_req, res) => {
  const rows = await fetchAllOrdered();
  const { roots } = buildTree(rows);
  res.json(roots);
}));

// GET /api/categories/:slug — single category with ancestors + descendants
router.get('/:slug', asyncHandler(async (req, res) => {
  const rows = await fetchAllOrdered();
  const { byId } = buildTree(rows);

  const hit = rows.find(r => r.slug === req.params.slug);
  if (!hit) throw new HttpError(404, 'Category not found');

  const node = byId.get(hit.id);
  const parent = node.parentId ? byId.get(node.parentId) : null;
  const ancestors = ancestorsOf(hit.id, byId);
  const descendantIds = collectDescendantIds(hit.id, byId);

  res.json({
    category: {
      _id: node._id,
      slug: node.slug,
      name: node.name,
      icon: node.icon,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
    },
    parent: parent ? { _id: parent._id, slug: parent.slug, name: parent.name } : null,
    ancestors,
    children: node.children.map(c => ({
      _id: c._id, slug: c.slug, name: c.name, parentId: c.parentId,
      sortOrder: c.sortOrder, icon: c.icon, children: c.children,
    })),
    descendantIds,
  });
}));

// Exported helper so products.routes can resolve descendants without
// duplicating tree-traversal code.
export async function resolveCategoryDescendantIds(categoryId) {
  const rows = await fetchAllOrdered();
  const { byId } = buildTree(rows);
  if (!byId.has(categoryId)) return [categoryId];
  return collectDescendantIds(categoryId, byId);
}

export default router;
