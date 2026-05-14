const prisma = require('../lib/prisma');

function normalizeCategoryIds(input) {
  if (input === undefined) return undefined;
  if (input === null) return [];
  if (!Array.isArray(input)) {
    const err = new Error('INVALID_CATEGORY_IDS');
    err.code = 'INVALID_CATEGORY_IDS';
    throw err;
  }

  const ids = [];
  for (const v of input) {
    const id = String(v || '').trim();
    if (id) ids.push(id);
  }

  return [...new Set(ids)];
}

function normalizeOptionalStringForCreate(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function normalizeOptionalStringForUpdate(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const listServiceCounters = async (req, res) => {
  try {
    const list = await prisma.serviceCounter.findMany({
      orderBy: { name: 'asc' },
      include: { categories: { orderBy: { name: 'asc' }, select: { id: true, name: true, nameZh: true, nameEn: true, nameHant: true } } },
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list service counters' });
  }
};

const createServiceCounter = async (req, res) => {
  try {
    const { name, categoryIds, nameZh, nameEn, nameHant } = req.body || {};
    const n = String(name || '').trim();
    if (!n) {
      return res.status(400).json({ error: 'name is required' });
    }

    const ids = normalizeCategoryIds(categoryIds);

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceCounter.create({
        data: {
          name: n,
          nameZh: normalizeOptionalStringForCreate(nameZh) ?? n,
          nameEn: normalizeOptionalStringForCreate(nameEn),
          nameHant: normalizeOptionalStringForCreate(nameHant),
        },
      });

      const reassigned = [];
      if (ids !== undefined) {
        const cats = await tx.category.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            name: true,
            serviceCounterId: true,
            serviceCounter: { select: { id: true, name: true, nameZh: true, nameEn: true, nameHant: true } },
          },
        });
        if (cats.length !== ids.length) {
          const err = new Error('CATEGORY_NOT_FOUND');
          err.code = 'CATEGORY_NOT_FOUND';
          throw err;
        }

        for (const c of cats) {
          if (c.serviceCounterId && c.serviceCounterId !== created.id) {
            reassigned.push({ categoryId: c.id, categoryName: c.name, from: c.serviceCounter || null });
          }
        }

        await tx.category.updateMany({
          where: { id: { in: ids } },
          data: { serviceCounterId: created.id },
        });

        for (const c of cats) {
          await tx.menuItem.updateMany({
            where: { category: c.name },
            data: { serviceCounterId: created.id },
          });
        }
      }

      const counter = await tx.serviceCounter.findUnique({
        where: { id: created.id },
        include: { categories: { orderBy: { name: 'asc' }, select: { id: true, name: true } } },
      });

      return { counter, reassigned };
    });

    if (result.reassigned.length) {
      return res.status(201).json(result);
    }

    return res.status(201).json(result.counter);
  } catch (e) {
    if (e.code === 'INVALID_CATEGORY_IDS') {
      return res.status(400).json({ error: 'Invalid categoryIds' });
    }
    if (e.code === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({ error: 'Category not found' });
    }
    if (String(e.code || '') === 'P2002') {
      return res.status(409).json({ error: 'ServiceCounter name already exists' });
    }
    return res.status(500).json({ error: 'Failed to create service counter' });
  }
};

const updateServiceCounter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryIds, nameZh, nameEn, nameHant } = req.body || {};
    const counterId = String(id || '').trim();

    const data = {};
    if (name != null) {
      const n = String(name || '').trim();
      if (!n) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      data.name = n;
    }
    const nextNameZh = normalizeOptionalStringForUpdate(nameZh);
    const nextNameEn = normalizeOptionalStringForUpdate(nameEn);
    const nextNameHant = normalizeOptionalStringForUpdate(nameHant);
    if (nextNameZh !== undefined) data.nameZh = nextNameZh;
    if (nextNameEn !== undefined) data.nameEn = nextNameEn;
    if (nextNameHant !== undefined) data.nameHant = nextNameHant;

    const ids = normalizeCategoryIds(categoryIds);

    if (!Object.keys(data).length && ids === undefined) {
      return res.status(400).json({ error: 'No changes' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentCats = ids !== undefined
        ? await tx.category.findMany({
            where: { serviceCounterId: counterId },
            select: { id: true, name: true },
          })
        : [];

      const reassigned = [];
      const detach = [];
      const attach = [];

      if (ids !== undefined) {
        const nextCats = await tx.category.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            name: true,
            serviceCounterId: true,
            serviceCounter: { select: { id: true, name: true, nameZh: true, nameEn: true, nameHant: true } },
          },
        });
        if (nextCats.length !== ids.length) {
          const err = new Error('CATEGORY_NOT_FOUND');
          err.code = 'CATEGORY_NOT_FOUND';
          throw err;
        }

        const currentSet = new Set(currentCats.map((c) => c.id));
        const nextSet = new Set(ids);

        for (const c of currentCats) {
          if (!nextSet.has(c.id)) detach.push(c);
        }
        for (const c of nextCats) {
          if (c.serviceCounterId && c.serviceCounterId !== counterId) {
            reassigned.push({ categoryId: c.id, categoryName: c.name, from: c.serviceCounter || null });
          }
          if (!currentSet.has(c.id)) attach.push({ id: c.id, name: c.name });
        }

        if (detach.length) {
          await tx.category.updateMany({
            where: { id: { in: detach.map((c) => c.id) } },
            data: { serviceCounterId: null },
          });
          for (const c of detach) {
            await tx.menuItem.updateMany({
              where: { category: c.name },
              data: { serviceCounterId: null },
            });
          }
        }

        await tx.category.updateMany({
          where: { id: { in: ids } },
          data: { serviceCounterId: counterId },
        });
        for (const c of attach) {
          await tx.menuItem.updateMany({
            where: { category: c.name },
            data: { serviceCounterId: counterId },
          });
        }
      }

      const updated = Object.keys(data).length
        ? await tx.serviceCounter.update({
            where: { id: counterId },
            data,
          })
        : await tx.serviceCounter.findUnique({ where: { id: counterId } });

      const counter = await tx.serviceCounter.findUnique({
        where: { id: counterId },
        include: { categories: { orderBy: { name: 'asc' }, select: { id: true, name: true } } },
      });

      return { counter, reassigned, updated };
    });

    if (!result.counter) {
      return res.status(404).json({ error: 'ServiceCounter not found' });
    }

    if (result.reassigned.length) {
      return res.json({ counter: result.counter, reassigned: result.reassigned });
    }

    return res.json(result.counter);
  } catch (e) {
    if (e.code === 'INVALID_CATEGORY_IDS') {
      return res.status(400).json({ error: 'Invalid categoryIds' });
    }
    if (e.code === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({ error: 'Category not found' });
    }
    if (String(e.code || '') === 'P2025') {
      return res.status(404).json({ error: 'ServiceCounter not found' });
    }
    if (String(e.code || '') === 'P2002') {
      return res.status(409).json({ error: 'ServiceCounter name already exists' });
    }
    return res.status(500).json({ error: 'Failed to update service counter' });
  }
};

const deleteServiceCounter = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.serviceCounter.delete({ where: { id: String(id || '').trim() } });
    return res.status(204).end();
  } catch (e) {
    if (String(e.code || '') === 'P2025') {
      return res.status(404).json({ error: 'ServiceCounter not found' });
    }
    return res.status(500).json({ error: 'Failed to delete service counter' });
  }
};

module.exports = { listServiceCounters, createServiceCounter, updateServiceCounter, deleteServiceCounter };
