const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getAllServices, getServiceById } = require('../services/registry');
const { getStatusCache, normalizeStatuspageIndicator, isIncidentRelevant } = require('../services/statusChecker');
const { getDb } = require('../db');

const router = express.Router();

// --- Rate limiters ---

const suggestionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many suggestions. Try again later.' },
  keyGenerator: (req) => hashIp(req),
});

const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many votes. Try again later.' },
  keyGenerator: (req) => hashIp(req),
});

function hashIp(req) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex');
}

// --------------------------------------------------
// GET /api/services  — list available services
// --------------------------------------------------
router.get('/services', (req, res) => {
  res.json(getAllServices());
});

// Region filter patterns — an incident is hidden if ALL its affected
// components match one of the exclude patterns (case-insensitive).
const REGION_FILTERS = {
  eu: {
    exclude: [
      'Middle East', 'UAE', 'Saudi',
      'Asia Pacific', 'APAC', 'Japan', 'Singapore', 'Australia', 'India',
      'Hong Kong', 'Korea', 'China', 'Taiwan',
      'US East', 'US West', 'US Central', 'US North', 'US South',
      'North America', 'Americas', 'Canada', 'Brazil',
    ],
  },
  us: {
    exclude: [
      'Middle East', 'UAE', 'Saudi',
      'Asia Pacific', 'APAC', 'Japan', 'Singapore', 'Australia', 'India',
      'Hong Kong', 'Korea', 'China', 'Taiwan',
      'Europe', 'EU', 'EMEA', 'Frankfurt', 'Amsterdam', 'London',
      'Ireland', 'Paris', 'Stockholm',
    ],
  },
  apac: {
    exclude: [
      'Middle East', 'UAE', 'Saudi',
      'Europe', 'EU', 'EMEA', 'Frankfurt', 'Amsterdam', 'London',
      'Ireland', 'Paris', 'Stockholm',
      'US East', 'US West', 'US Central', 'US North', 'US South',
      'North America', 'Americas', 'Canada', 'Brazil',
    ],
  },
  global: null,
};

// --------------------------------------------------
// GET /api/status?ids=shopify,slack&region=eu|us|apac|global
// --------------------------------------------------
router.get('/status', (req, res) => {
  const cache = getStatusCache();
  const region = req.query.region || 'eu';
  const regionFilter = region in REGION_FILTERS ? REGION_FILTERS[region] : REGION_FILTERS.eu;
  const ids = req.query.ids
    ? req.query.ids.split(',').map((s) => s.trim()).filter(Boolean)
    : Object.keys(cache);

  const result = {};
  for (const id of ids) {
    const cached = cache[id];
    if (!cached) continue;

    const allInc = cached.allIncidents || [];

    // Apply region filter at query time
    const filteredInc = regionFilter
      ? allInc.filter((i) => isIncidentRelevant(i, regionFilter))
      : allInc;

    // Re-derive status based on filtered incidents
    let status, description;
    if (allInc.length > 0 && filteredInc.length === 0) {
      // Incidents exist but none relevant for this region
      status = 'operational';
      description = 'All Systems Operational';
    } else if (filteredInc.length > 0) {
      status = normalizeStatuspageIndicator(cached.rawIndicator || 'none');
      description = filteredInc[0].name;
    } else {
      // No incidents at all — use cached values directly
      status = cached.status;
      description = cached.description;
    }

    result[id] = { status, description, incidents: filteredInc, updatedAt: cached.updatedAt };
  }

  res.json(result);
});

// --------------------------------------------------
// Suggestions
// --------------------------------------------------

// GET /api/suggestions
router.get('/suggestions', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.url, s.created_at,
              COUNT(v.id) AS votes
       FROM suggestions s
       LEFT JOIN suggestion_votes v ON v.suggestion_id = s.id
       GROUP BY s.id
       ORDER BY votes DESC, s.created_at DESC`
    )
    .all();
  res.json(rows);
});

// POST /api/suggestions  { name, url? }
router.post('/suggestions', suggestionLimiter, (req, res) => {
  const { name, url } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name is required (min 2 characters).' });
  }

  const cleanName = name.trim();
  const normalized = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ipHash = hashIp(req);
  const db = getDb();

  // Check if suggestion already exists
  const existing = db
    .prepare('SELECT id FROM suggestions WHERE name_normalized = ?')
    .get(normalized);

  if (existing) {
    // Auto-vote
    try {
      db.prepare(
        'INSERT INTO suggestion_votes (suggestion_id, ip_hash) VALUES (?, ?)'
      ).run(existing.id, ipHash);
    } catch {
      // Already voted — UNIQUE constraint
    }
    const votes = db
      .prepare('SELECT COUNT(*) AS count FROM suggestion_votes WHERE suggestion_id = ?')
      .get(existing.id);
    return res.json({
      action: 'voted',
      id: existing.id,
      votes: votes.count,
      message: `"${cleanName}" already suggested — your vote was counted.`,
    });
  }

  // Create new suggestion + initial vote
  const insert = db.prepare(
    'INSERT INTO suggestions (name, name_normalized, url) VALUES (?, ?, ?)'
  );
  const result = insert.run(cleanName, normalized, url || null);
  const suggestionId = result.lastInsertRowid;

  db.prepare(
    'INSERT INTO suggestion_votes (suggestion_id, ip_hash) VALUES (?, ?)'
  ).run(suggestionId, ipHash);

  res.status(201).json({
    action: 'created',
    id: suggestionId,
    votes: 1,
    message: `"${cleanName}" added to suggestions.`,
  });
});

// POST /api/suggestions/:id/vote
router.post('/suggestions/:id/vote', voteLimiter, (req, res) => {
  const { id } = req.params;
  const ipHash = hashIp(req);
  const db = getDb();

  const suggestion = db
    .prepare('SELECT id FROM suggestions WHERE id = ?')
    .get(id);
  if (!suggestion) {
    return res.status(404).json({ error: 'Suggestion not found.' });
  }

  try {
    db.prepare(
      'INSERT INTO suggestion_votes (suggestion_id, ip_hash) VALUES (?, ?)'
    ).run(id, ipHash);
  } catch {
    return res.status(409).json({ error: 'Already voted for this suggestion.' });
  }

  const votes = db
    .prepare('SELECT COUNT(*) AS count FROM suggestion_votes WHERE suggestion_id = ?')
    .get(id);

  res.json({ id: Number(id), votes: votes.count });
});

// --------------------------------------------------
// Webhooks
// --------------------------------------------------

// POST /api/webhooks  { url, services?, secret? }
router.post('/webhooks', (req, res) => {
  const { url, services, secret } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid webhook URL is required.' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  const subscriptionSecret =
    secret || crypto.randomBytes(32).toString('hex');
  const serviceList = Array.isArray(services) ? services : [];

  const db = getDb();
  const result = db
    .prepare(
      'INSERT INTO webhook_subscriptions (url, secret, services) VALUES (?, ?, ?)'
    )
    .run(url, subscriptionSecret, JSON.stringify(serviceList));

  res.status(201).json({
    id: result.lastInsertRowid,
    secret: subscriptionSecret,
    message:
      'Webhook registered. Store the secret — you need it to verify payloads and to unsubscribe.',
  });
});

// DELETE /api/webhooks/:id  { secret }
router.delete('/webhooks/:id', (req, res) => {
  const { id } = req.params;
  const { secret } = req.body;

  if (!secret) {
    return res.status(400).json({ error: 'Secret is required to unsubscribe.' });
  }

  const db = getDb();
  const sub = db
    .prepare('SELECT * FROM webhook_subscriptions WHERE id = ?')
    .get(id);

  if (!sub) {
    return res.status(404).json({ error: 'Subscription not found.' });
  }

  if (sub.secret !== secret) {
    return res.status(403).json({ error: 'Invalid secret.' });
  }

  db.prepare('DELETE FROM webhook_subscriptions WHERE id = ?').run(id);
  res.json({ message: 'Webhook subscription removed.' });
});

module.exports = router;
