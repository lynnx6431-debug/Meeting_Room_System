const { AsyncLocalStorage } = require('async_hooks');

const tenantStore = new AsyncLocalStorage();

function runWithContext(ctx, fn) {
  return tenantStore.run(ctx, fn);
}

function getContext() {
  return tenantStore.getStore() || null;
}

module.exports = { runWithContext, getContext };
