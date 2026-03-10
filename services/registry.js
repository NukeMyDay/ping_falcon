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
  // --- E-Commerce ---
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
    id: 'klaviyo',
    name: 'Klaviyo',
    category: 'E-Commerce',
    color: '#1c1c1c',
    statusPageUrl: 'https://status.klaviyo.com',
    apiUrl: 'https://status.klaviyo.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'recharge',
    name: 'Recharge',
    category: 'E-Commerce',
    color: '#5433ff',
    statusPageUrl: 'https://status.rechargepayments.com',
    apiUrl: 'https://status.rechargepayments.com/api/v2/status.json',
    type: 'statuspage',
  },

  // --- Payments ---
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Payments',
    color: '#6772e5',
    statusPageUrl: 'https://status.stripe.com',
    apiUrl: 'https://status.stripe.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'adyen',
    name: 'Adyen',
    category: 'Payments',
    color: '#0abf53',
    statusPageUrl: 'https://status.adyen.com',
    apiUrl: 'https://status.adyen.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'mollie',
    name: 'Mollie',
    category: 'Payments',
    color: '#ff6900',
    statusPageUrl: 'https://status.mollie.com',
    apiUrl: 'https://status.mollie.com/api/v2/status.json',
    type: 'statuspage',
  },

  // --- AI ---
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
    id: 'openai',
    name: 'OpenAI',
    category: 'AI',
    color: '#10a37f',
    statusPageUrl: 'https://status.openai.com',
    apiUrl: 'https://status.openai.com/api/v2/status.json',
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

  // --- Communication ---
  {
    id: 'slack',
    name: 'Slack',
    category: 'Communication',
    color: '#611f69',
    statusPageUrl: 'https://status.slack.com',
    apiUrl: 'https://status.slack.com/api/v2.0.0/current',
    type: 'slack',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'Communication',
    color: '#2d8cff',
    statusPageUrl: 'https://status.zoom.us',
    apiUrl: 'https://status.zoom.us/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Communication',
    color: '#7289da',
    statusPageUrl: 'https://discordstatus.com',
    apiUrl: 'https://discordstatus.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    category: 'Communication',
    color: '#f22f46',
    statusPageUrl: 'https://status.twilio.com',
    apiUrl: 'https://status.twilio.com/api/v2/status.json',
    type: 'statuspage',
  },

  // --- Project Management ---
  {
    id: 'asana',
    name: 'Asana',
    category: 'Project Management',
    color: '#f06a6a',
    statusPageUrl: 'https://status.asana.com',
    apiUrl: 'https://status.asana.com/api/v2/status.json',
    type: 'statuspage',
    regionFilter: { exclude: ['Middle East', 'UAE', 'APAC', 'Asia Pacific'] },
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Project Management',
    color: '#5e6ad2',
    statusPageUrl: 'https://linearstatus.com',
    apiUrl: 'https://linearstatus.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'Project Management',
    color: '#0052cc',
    statusPageUrl: 'https://jira-software.status.atlassian.com',
    apiUrl: 'https://jira-software.status.atlassian.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity',
    color: '#191919',
    statusPageUrl: 'https://status.notion.so',
    apiUrl: 'https://status.notion.so/api/v2/status.json',
    type: 'statuspage',
  },

  // --- CRM & Marketing ---
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    color: '#ff7a59',
    statusPageUrl: 'https://status.hubspot.com',
    apiUrl: 'https://status.hubspot.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    category: 'CRM',
    color: '#00428e',
    statusPageUrl: 'https://status.pipedrive.com',
    apiUrl: 'https://status.pipedrive.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'Email Marketing',
    color: '#ffe01b',
    statusPageUrl: 'https://mailchimp.statuspage.io',
    apiUrl: 'https://mailchimp.statuspage.io/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    category: 'Email Marketing',
    color: '#1a82e2',
    statusPageUrl: 'https://status.sendgrid.com',
    apiUrl: 'https://status.sendgrid.com/api/v2/status.json',
    type: 'statuspage',
  },

  // --- Customer Support ---
  {
    id: 'zendesk',
    name: 'Zendesk',
    category: 'Customer Support',
    color: '#1f73b7',
    statusPageUrl: 'https://status.zendesk.com',
    apiUrl: 'https://status.zendesk.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'Customer Support',
    color: '#286efa',
    statusPageUrl: 'https://www.intercomstatus.com',
    apiUrl: 'https://www.intercomstatus.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'gorgias',
    name: 'Gorgias',
    category: 'Customer Support',
    color: '#3b5ee8',
    statusPageUrl: 'https://status.gorgias.com',
    apiUrl: 'https://status.gorgias.com/api/v2/status.json',
    type: 'statuspage',
  },

  // --- Infrastructure & Hosting ---
  {
    id: 'github',
    name: 'GitHub',
    category: 'Infrastructure',
    color: '#24292e',
    statusPageUrl: 'https://www.githubstatus.com',
    apiUrl: 'https://www.githubstatus.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'Infrastructure',
    color: '#f38020',
    statusPageUrl: 'https://www.cloudflarestatus.com',
    apiUrl: 'https://www.cloudflarestatus.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Hosting',
    color: '#000000',
    statusPageUrl: 'https://www.vercel-status.com',
    apiUrl: 'https://www.vercel-status.com/api/v2/status.json',
    type: 'statuspage',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    category: 'Hosting',
    color: '#00c7b7',
    statusPageUrl: 'https://www.netlifystatus.com',
    apiUrl: 'https://www.netlifystatus.com/api/v2/status.json',
    type: 'statuspage',
  },

  // --- Analytics ---
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    category: 'Analytics',
    color: '#7856ff',
    statusPageUrl: 'https://status.mixpanel.com',
    apiUrl: 'https://status.mixpanel.com/api/v2/status.json',
    type: 'statuspage',
  },

  // --- Data Platform ---
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
