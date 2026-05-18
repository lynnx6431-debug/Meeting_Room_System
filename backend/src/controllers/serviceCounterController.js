// E2-TODO: V4 removed the ServiceCounter model and replaces it with
// MenuCategory.defaultOperatorId / room operator assignments. Keep the route
// shape for now, but respond with a clear compatibility error instead of 404.
function respondServiceCounterCompatDisabled(req, res) {
  return res.status(503).json({
    error: 'Service counters are removed in V4 compatibility mode',
    code: 'E1_V4_COMPAT_DISABLED',
    feature: 'service-counters',
    todo: 'E2-TODO: replace with MenuCategory.defaultOperatorId and assignment APIs',
  });
}

const listServiceCounters = respondServiceCounterCompatDisabled;
const createServiceCounter = respondServiceCounterCompatDisabled;
const updateServiceCounter = respondServiceCounterCompatDisabled;
const deleteServiceCounter = respondServiceCounterCompatDisabled;

module.exports = { listServiceCounters, createServiceCounter, updateServiceCounter, deleteServiceCounter };
