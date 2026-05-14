const prisma = require('../lib/prisma');
const fs = require('fs');
const path = require('path');

async function ensureCategoryExists(name) {
  const n = String(name || '').trim();
  if (!n) return;
  try {
    await prisma.category.upsert({
      where: { name: n },
      update: {},
      create: { name: n, nameZh: n },
    });
  } catch (_) {
  }

  return n;
}

const listMenuItems = async (req, res) => {
  try {
    const active = req.query.active;
    const where = {};
    if (active === 'true') {
      where.isActive = true;
    }

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    res.json(items);
  } catch (error) {
    console.error('List menu items error:', error);
    res.status(500).json({ error: 'Failed to list menu items' });
  }
};

async function validateServiceCounterId(serviceCounterId) {
  if (serviceCounterId == null) return null;
  if (typeof serviceCounterId !== 'string' || !serviceCounterId.trim()) {
    const err = new Error('INVALID_SERVICE_COUNTER_ID');
    err.code = 'INVALID_SERVICE_COUNTER_ID';
    throw err;
  }
  const id = serviceCounterId.trim();
  const exists = await prisma.serviceCounter.findUnique({ where: { id } });
  if (!exists) {
    const err = new Error('SERVICE_COUNTER_NOT_FOUND');
    err.code = 'SERVICE_COUNTER_NOT_FOUND';
    throw err;
  }
  return id;
}

async function resolveServiceCounterIdForCategory(categoryName) {
  const key = String(categoryName || '').trim();
  if (!key) return null;
  const row = await prisma.category.findUnique({
    where: { name: key },
    select: { serviceCounterId: true },
  });
  return row?.serviceCounterId ?? null;
}

function normalizeOptionalString(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

const createMenuItem = async (req, res) => {
  try {
    const { name, category, stock, isActive, serviceCounterId, nameZh, nameEn, nameHant, descZh, descEn, descHant, imageUrl } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ error: 'category is required' });
    }
    if (stock != null && (typeof stock !== 'number' || stock < 0)) {
      return res.status(400).json({ error: 'stock must be a non-negative number' });
    }

    const normalizedCategory = await ensureCategoryExists(category);
    const counterId =
      serviceCounterId === undefined
        ? await resolveServiceCounterIdForCategory(normalizedCategory)
        : await validateServiceCounterId(serviceCounterId);
    const item = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        nameZh: normalizeOptionalString(nameZh) ?? name.trim(),
        nameEn: normalizeOptionalString(nameEn),
        nameHant: normalizeOptionalString(nameHant),
        descZh: normalizeOptionalString(descZh),
        descEn: normalizeOptionalString(descEn),
        descHant: normalizeOptionalString(descHant),
        imageUrl: normalizeOptionalString(imageUrl),
        category: normalizedCategory,
        stock: stock ?? 0,
        isActive: isActive ?? true,
        serviceCounterId: counterId,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create menu item error:', error);
    if (error.code === 'SERVICE_COUNTER_NOT_FOUND') {
      return res.status(404).json({ error: 'ServiceCounter not found' });
    }
    if (error.code === 'INVALID_SERVICE_COUNTER_ID') {
      return res.status(400).json({ error: 'Invalid serviceCounterId' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Menu item name already exists' });
    }
    res.status(500).json({ error: 'Failed to create menu item' });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, stock, isActive, serviceCounterId, nameZh, nameEn, nameHant, descZh, descEn, descHant, imageUrl } = req.body;

    const data = {};
    if (name != null) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      data.name = name.trim();
    }
    if (nameZh !== undefined) data.nameZh = normalizeOptionalString(nameZh);
    if (nameEn !== undefined) data.nameEn = normalizeOptionalString(nameEn);
    if (nameHant !== undefined) data.nameHant = normalizeOptionalString(nameHant);
    if (descZh !== undefined) data.descZh = normalizeOptionalString(descZh);
    if (descEn !== undefined) data.descEn = normalizeOptionalString(descEn);
    if (descHant !== undefined) data.descHant = normalizeOptionalString(descHant);
    if (imageUrl !== undefined) data.imageUrl = normalizeOptionalString(imageUrl);
    let nextCategory;
    if (category != null) {
      if (typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ error: 'category must be a non-empty string' });
      }
      nextCategory = await ensureCategoryExists(category);
      data.category = nextCategory;
    }
    if (stock != null) {
      if (typeof stock !== 'number' || stock < 0) {
        return res.status(400).json({ error: 'stock must be a non-negative number' });
      }
      data.stock = stock;
    }
    if (isActive != null) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be boolean' });
      }
      data.isActive = isActive;
    }
    if (serviceCounterId !== undefined) {
      if (serviceCounterId === null) {
        data.serviceCounterId = null;
      } else {
        data.serviceCounterId = await validateServiceCounterId(serviceCounterId);
      }
    } else if (nextCategory) {
      data.serviceCounterId = await resolveServiceCounterIdForCategory(nextCategory);
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data,
    });

    res.json(item);
  } catch (error) {
    console.error('Update menu item error:', error);
    if (error.code === 'SERVICE_COUNTER_NOT_FOUND') {
      return res.status(404).json({ error: 'ServiceCounter not found' });
    }
    if (error.code === 'INVALID_SERVICE_COUNTER_ID') {
      return res.status(400).json({ error: 'Invalid serviceCounterId' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Menu item name already exists' });
    }
    res.status(500).json({ error: 'Failed to update menu item' });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.menuItem.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Delete menu item error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
};

function resolveUploadsDir() {
  return path.join(__dirname, '..', '..', 'uploads');
}

function parseImageDataUrl(dataUrl) {
  const s = String(dataUrl || '').trim();
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(s);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2] };
}

function extFromMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/jpg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return null;
}

const uploadMenuItemImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { dataUrl } = req.body || {};

    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }
    const ext = extFromMime(parsed.mime);
    if (!ext) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    const buf = Buffer.from(parsed.base64, 'base64');
    if (!buf.length) {
      return res.status(400).json({ error: 'Empty image' });
    }

    const uploadsDir = resolveUploadsDir();
    const subDir = path.join(uploadsDir, 'menu-items');
    fs.mkdirSync(subDir, { recursive: true });

    const filename = `${id}-${Date.now()}.${ext}`;
    const abs = path.join(subDir, filename);
    fs.writeFileSync(abs, buf);

    const imageUrl = `/uploads/menu-items/${filename}`;
    const item = await prisma.menuItem.update({
      where: { id },
      data: { imageUrl },
    });

    return res.json({ imageUrl: item.imageUrl });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    return res.status(500).json({ error: 'Failed to upload image' });
  }
};

module.exports = {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadMenuItemImage,
};
