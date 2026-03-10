/**
 * Service Registry
 *
 * Each service defines:
 *   id             - unique identifier (used in URL params)
 *   name           - display name
 *   category       - grouping label
 *   color          - brand color for avatar
 *   statusPageUrl  - public status page link
 *   apiUrl         - machine-readable status endpoint
 *   type           - parser type: 'statuspage' | 'slack' | 'google_cloud'
 *   regionFilter   - (optional) filter incidents by region
 *     .exclude     - array of component name patterns to ignore
 *                    An incident is hidden if ALL its affected components
 *                    match one of these patterns (case-insensitive).
 *                    Example: { exclude: ['Middle East', 'APAC'] }
 *
 * To add a new service, append an entry here and (if needed) add
 * a parser in statusChecker.js.
 */

const services = [
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'E-Commerce',
    color: '#96bf48',
    statusPageUrl: 'https://status.shopify.com',
    apiUrl: 'https://status.shopify.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'claude',
    name: 'Claude',
    category: 'AI',
    color: '#d97757',
    statusPageUrl: 'https://status.anthropic.com',
    apiUrl: 'https://status.anthropic.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    category: 'AI',
    color: '#4285f4',
    statusPageUrl: 'https://status.cloud.google.com',
    apiUrl: 'https://status.cloud.google.com/incidents.json',
    type: 'google_cloud',
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'Projektmanagement',
    color: '#f06a6a',
    statusPageUrl: 'https://status.asana.com',
    apiUrl: 'https://status.asana.com/api/v2/status.json',
    type: 'statuspage',
    // Exclude regional incidents not relevant for EU/DACH users
    regionFilter: { exclude: ['Middle East', 'UAE', 'APAC', 'Asia Pacific'] },
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Kommunikation',
    color: '#611f69',
    statusPageUrl: 'https://status.slack.com',
    apiUrl: 'https://status.slack.com/api/v2.0.0/current',
    type: 'slack',
  },
  {
    id: 'y42',
    name: 'Y42',
    category: 'Data Platform',
    color: '#0066cc',
    statusPageUrl: 'https://y42.statuspage.io',
    apiUrl: 'https://y42.statuspage.io/api/v2/status.json',
    type: 'statuspage',
  },
];

function getAllServices() {
  return services.map(({ apiUrl, ...rest }) => rest);
}

function getServiceById(id) {
  return services.find((s) => s.id === id) || null;
}

function getFullRegistry() {
  return services;
}

module.exports = { getAllServices, getServiceById, getFullRegistry };
