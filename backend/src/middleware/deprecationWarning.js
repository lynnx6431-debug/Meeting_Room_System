function deprecationWarning({ replacement, removalDate }) {
  return function deprecationWarningMiddleware(req, res, next) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', removalDate);
    res.setHeader('Link', `<${replacement}>; rel="successor-version"`);

    const ua = req.headers['user-agent'] || 'unknown';
    const ip = req.ip || 'unknown';
    console.warn(
      `[DEPRECATED] ${req.method} ${req.originalUrl} called by ${ip} (UA: ${String(ua).slice(0, 60)}) — use ${replacement} instead. Removal: ${removalDate}`,
    );

    return next();
  };
}

module.exports = {
  deprecationWarning,
};
