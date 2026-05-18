const basePrisma = require('./prisma');
const { getContext } = require('./tenantContext');

const TENANT_SCOPED_MODELS = new Set([
  'License',
  'LicenseAuditLog',
  'Site',
  'SiteBranding',
  'Room',
  'RoomSession',
  'MenuCategory',
  'MenuItem',
  'Order',
  'User',
  'RoomOperatorAssignment',
  'TenantConfig',
  'Invite',
]);

function shouldInject(model) {
  return TENANT_SCOPED_MODELS.has(model);
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function withTenantWhere(args, tenantId) {
  const tenantClause = { tenantId };
  if (!args) return { where: tenantClause };
  if (!args.where) return { ...args, where: tenantClause };
  return { ...args, where: { AND: [args.where, tenantClause] } };
}

function getActiveTenantContext(model) {
  const ctx = getContext();
  if (!ctx || ctx.role === 'SUPER_ADMIN' || !ctx.tenantId || !shouldInject(model)) {
    return null;
  }
  return ctx;
}

async function ensureTenantOwnership(model, args, tenantId) {
  const delegate = basePrisma[lowerFirst(model)];
  const existing = await delegate.findFirst({
    where: { AND: [args.where, { tenantId }] },
    select: { id: true },
  });

  if (!existing) {
    const err = new Error('NOT_FOUND_OR_FORBIDDEN');
    err.code = 'NOT_FOUND_OR_FORBIDDEN';
    throw err;
  }
}

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findFirst({ args, query, model }) {
        const ctx = getActiveTenantContext(model);
        if (ctx) args = withTenantWhere(args, ctx.tenantId);
        return query(args);
      },
      async findMany({ args, query, model }) {
        const ctx = getActiveTenantContext(model);
        if (ctx) args = withTenantWhere(args, ctx.tenantId);
        return query(args);
      },
      async findUnique({ args, query, model }) {
        const ctx = getActiveTenantContext(model);
        if (!ctx) return query(args);
        return basePrisma[lowerFirst(model)].findFirst(withTenantWhere(args, ctx.tenantId));
      },
      async count({ args, query, model }) {
        const ctx = getActiveTenantContext(model);
        if (ctx) args = withTenantWhere(args, ctx.tenantId);
        return query(args);
      },
      async update({ args, query, model }) {
        const ctx = getActiveTenantContext(model);
        if (ctx) {
          await ensureTenantOwnership(model, args, ctx.tenantId);
        }
        return query(args);
      },
      async delete({ args, query, model }) {
        const ctx = getActiveTenantContext(model);
        if (ctx) {
          await ensureTenantOwnership(model, args, ctx.tenantId);
        }
        return query(args);
      },
      async create({ args, query, model }) {
        const ctx = getActiveTenantContext(model);
        if (ctx) {
          const providedTenant = args?.data?.tenantId;
          if (providedTenant && providedTenant !== ctx.tenantId) {
            const err = new Error('TENANT_MISMATCH');
            err.code = 'TENANT_MISMATCH';
            throw err;
          }
          if (!providedTenant) {
            args = {
              ...args,
              data: { ...args.data, tenantId: ctx.tenantId },
            };
          }
        }
        return query(args);
      },
    },
  },
});

module.exports = prisma;
