const { getFullRegistry } = require('./registry');
const { notifyStatusChange } = require('./webhookService');
const { getDb } = require('../db');

// In-memory cache (raw, unfiltered)
// { serviceId: { rawIndicator, allIncidents, status, description, updatedAt } }
const statusCache = {};

/**
 * Normalize Statuspage.io indicator.
 * Exported so the API route can re-derive status after region filtering.
 */
function normalizeStatuspageIndicator(indicator) {
  const map = { none: 'operational', minor: 'degraded', major: 'partial_outage', critical: 'major_outage' };
  return map[indicator] || 'unknown';
}

/**
 * Returns true if an incident is relevant for the given regionFilter.
 * An incident is filtered OUT when ALL its affected components match
 * an excluded region pattern (case-insensitive).
 * Handles both raw Statuspage format (incident_updates) and shaped
 * format (affectedComponents string array). Exported for API route.
 */
function isIncidentRelevant(incident, regionFilter) {
  if (!regionFilter?.exclude?.length) return true;

  // Raw Statuspage format: incident_updates[0].affected_components[].name
  const rawComponents = incident.incident_updates?.[0]?.affected_components || [];
  // Shaped format: affectedComponents[] (array of strings)
  const shapedComponents = incident.affectedComponents || [];

  const componentNames = rawComponents.length > 0
    ? rawComponents.map((c) => c.name || '')
    : shapedComponents;

  // No component info → assume globally relevant
  if (componentNames.length === 0) return true;

  const patterns = regionFilter.exclude.map((r) => r.toLowerCase());
  const allExcluded = componentNames.every((name) =>
    patterns.some((p) => name.toLowerCase().includes(p))
  );
  return !allExcluded;
}

/** Shape a Statuspage incident into a lean object for the frontend. */
function shapeIncident(i) {
  const affected = (i.incident_updates?.[0]?.affected_components || []).map((c) => c.name);
  return {
    name: i.name,
    status: i.status,
    impact: i.impact,
    updatedAt: i.updated_at,
    url: i.shortlink || null,
    affectedComponents: affected,
  };
}

// --- Parsers ---

async function parseStatuspage(service) {
  const summaryUrl = service.apiUrl.replace('/status.json', '/summary.json');
  let res = await fetch(summaryUrl, { signal: AbortSignal.timeout(15000) });

  // Some status pages don't serve summary.json — fall back to status.json
  if (res.status === 404 && summaryUrl !== service.apiUrl) {
    res = await fetch(service.apiUrl, { signal: AbortSignal.timeout(15000) });
  }

  if (!res.ok) return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: `HTTP ${res.status}` };

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: 'No data' };

  const data = await res.json();
  const rawIndicator = data.status?.indicator || 'none';

  // Collect raw active incidents (keep raw format so isIncidentRelevant can read affected_components)
  const rawActive = (data.incidents || [])
    .filter((i) => i.status !== 'resolved' && i.status !== 'postmortem');

  // Filter on raw format BEFORE shaping (so affected_components are still present)
  const relevantRaw = rawActive.filter((i) => isIncidentRelevant(i, service.regionFilter));

  // Shape for storage — allIncidents (unfiltered) for other regions, incidents (filtered) for EU default
  const allIncidents = rawActive.map(shapeIncident);
  const relevantIncidents = relevantRaw.map(shapeIncident);

  const status =
    allIncidents.length > 0 && relevantIncidents.length === 0
      ? 'operational'
      : normalizeStatuspageIndicator(rawIndicator);

  const description =
    relevantIncidents.length > 0
      ? relevantIncidents[0].name
      : status === 'operational'
        ? 'All Systems Operational'
        : data.status?.description || 'All Systems Operational';

  return { rawIndicator, allIncidents, status, description, incidents: relevantIncidents };
}

async function parseSlack(service) {
  const res = await fetch(service.apiUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: `HTTP ${res.status}`, incidents: [] };
  const data = await res.json();

  if (data.status === 'ok' || (data.active_incidents || []).length === 0) {
    return { rawIndicator: 'none', allIncidents: [], status: 'operational', description: 'All Systems Operational', incidents: [] };
  }

  const shaped = data.active_incidents.map((i) => ({
    name: i.title || 'Active incident',
    status: 'investigating',
    impact: i.type === 'outage' ? 'major' : 'minor',
    updatedAt: i.date_updated || null,
    url: i.url || null,
    affectedComponents: [],
  }));

  const hasOutage = shaped.some((i) => i.impact === 'major');
  return {
    rawIndicator: hasOutage ? 'major' : 'minor',
    allIncidents: shaped,
    status: hasOutage ? 'major_outage' : 'degraded',
    description: shaped[0].name,
    incidents: shaped,
  };
}

async function parseGoogleCloud(service) {
  try {
    const res = await fetch(service.apiUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: `HTTP ${res.status}`, incidents: [] };
    const raw = await res.json();
    if (!Array.isArray(raw)) return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: 'Unexpected format', incidents: [] };

    const now = new Date();
    const active = raw.filter((inc) => {
      if (inc.end && new Date(inc.end) < now) return false;
      const desc = (inc.external_desc || '').toLowerCase();
      return desc.includes('gemini') || desc.includes('vertex ai') || desc.includes('generative') || desc.includes('ai platform');
    });

    if (active.length === 0) {
      return { rawIndicator: 'none', allIncidents: [], status: 'operational', description: 'All Systems Operational', incidents: [] };
    }

    const shaped = active.map((i) => ({
      name: i.external_desc?.split('.')[0] || 'Active incident',
      status: 'investigating',
      impact: 'major',
      updatedAt: i.modified || null,
      url: null,
      affectedComponents: [],
    }));

    return { rawIndicator: 'major', allIncidents: shaped, status: 'degraded', description: shaped[0].name, incidents: shaped };
  } catch {
    return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: 'Could not reach status page', incidents: [] };
  }
}

const parsers = { statuspage: parseStatuspage, slack: parseSlack, google_cloud: parseGoogleCloud, link_only: async () => ({ rawIndicator: 'none', allIncidents: [], status: 'unknown', description: 'No API available', incidents: [] }) };

// --- Main check ---

async function checkService(service) {
  const parser = parsers[service.type];
  if (!parser) return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: 'No parser', incidents: [] };
  try {
    return await parser(service);
  } catch (err) {
    return { rawIndicator: 'none', allIncidents: [], status: 'unknown', description: err.message || 'Request failed', incidents: [] };
  }
}

async function checkAllStatuses() {
  const services = getFullRegistry();
  const BATCH_SIZE = 10;

  for (let i = 0; i < services.length; i += BATCH_SIZE) {
    const batch = services.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (service) => {
        const result = await checkService(service);
        const now = new Date().toISOString();
        const previous = statusCache[service.id];
        const statusChanged = previous && previous.status !== result.status;

        statusCache[service.id] = { ...result, updatedAt: now };

        try {
          getDb().prepare('INSERT INTO status_log (service_id, status, description) VALUES (?, ?, ?)').run(service.id, result.status, result.description);
        } catch { /* ignore */ }

        if (statusChanged) notifyStatusChange(service.id, previous.status, result.status, result.description);
      })
    );
  }

  const entries = Object.entries(statusCache);
  console.log(`[${new Date().toISOString()}] Status check: ${entries.map(([id, s]) => `${id}=${s.status}`).join(', ')}`);
}

function getStatusCache() { return { ...statusCache }; }
function getServiceStatus(id) { return statusCache[id] || null; }

module.exports = { checkAllStatuses, getStatusCache, getServiceStatus, normalizeStatuspageIndicator, isIncidentRelevant };
