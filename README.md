# pingfalcon

**A lightweight, self-hostable status monitor for the tools your business depends on.**

Monitor 100 SaaS services in real time — from payments and e-commerce to communication and infrastructure. Select the services you care about, filter by region, and subscribe to webhook alerts when something breaks.

![pingfalcon screenshot](https://pingfalcon.net)

## Features

- **100 pre-configured services** — Shopify, Stripe, Klaviyo, Slack, GitHub, Cloudflare, OpenAI, Figma, Datadog, and more
- **Real-time status** — polls official status APIs every 60 seconds
- **Live timestamps** — "Updated X ago" counts up every second
- **Region filtering** — EU/DACH, US/Americas, APAC, Global
- **Webhook API** — receive POST notifications when a service status changes
- **Dark/light mode** — auto-detects system preference
- **Shareable URLs** — selected services are encoded in the URL
- **Suggest a service** — built-in form to request new integrations
- **Self-hostable** — runs as a single Node.js process, Docker-ready

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/NukeMyDay/pingfalcon.git
cd pingfalcon
docker compose up -d
```

The app will be available at `http://localhost:3000`.

### Without Docker

```bash
git clone https://github.com/NukeMyDay/pingfalcon.git
cd pingfalcon
npm install
node server.js
```

Requires Node.js 18+ and Python/make/g++ for native SQLite compilation.

## Configuration

Environment variables (set in `docker-compose.yml` or `.env`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` for prod |
| `POLL_INTERVAL` | `60000` | Status poll interval in ms |

Data is stored in `./data/pingfalcon.db` (SQLite).

## Adding Services

Edit `services/registry.js` and add an entry:

```js
{
  id: 'my-service',        // unique slug, used in URLs
  name: 'My Service',      // display name
  category: 'E-Commerce',  // grouping label
  color: '#ff6900',        // brand color (hex)
  statusPageUrl: 'https://status.my-service.com',
  apiUrl: 'https://status.my-service.com/api/v2/status.json',
  type: 'statuspage',      // 'statuspage' | 'slack' | 'google_cloud'
}
```

Supported API types:
- **`statuspage`** — [Statuspage.io](https://statuspage.io) v2 API (used by most services)
- **`slack`** — Slack's custom status API
- **`google_cloud`** — Google Cloud incidents JSON feed

## Webhook API

Subscribe to status change notifications:

```http
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/hook",
  "services": ["shopify", "stripe"],
  "secret": "your-optional-secret"
}
```

Payload sent on status change:

```json
{
  "event": "status_change",
  "service": "shopify",
  "previous_status": "operational",
  "current_status": "major_outage",
  "description": "...",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

Verify the signature: `X-Pingfalcon-Signature: HMAC-SHA256(secret, body)`

Unsubscribe: `DELETE /api/webhooks/:id`

## Supported Services

| Service | Category |
|---|---|
| Shopify, Klaviyo, Recharge, BigCommerce, Squarespace, Webflow | E-Commerce |
| Stripe, Adyen, Plaid, Chargebee, Braintree | Payments |
| Claude, OpenAI, Gemini | AI |
| Slack, Zoom, Discord, Twilio, Webex, RingCentral, Vonage, Telnyx, Pusher, Ably | Communication |
| Asana, Linear, Jira, Notion, monday.com, Airtable, ClickUp, Trello, Confluence, Coda | Project Management |
| Figma, Miro, Loom | Design |
| HubSpot, Braze, ActiveCampaign | CRM |
| Mailchimp, SendGrid, Mailgun, Brevo, Kit, Customer.io | Email Marketing |
| Zendesk, Intercom, Gorgias, Help Scout, Drift, LiveChat | Customer Support |
| GitHub, Cloudflare, DigitalOcean, Linode | Infrastructure |
| Vercel, Netlify, Render, Fly.io | Hosting |
| CircleCI, Buildkite | Developer Tools (CI/CD) |
| Supabase, LaunchDarkly, npm, Snyk, HashiCorp, Algolia, Cloudinary, Stream | Developer Tools |
| Datadog, New Relic, Sentry, Grafana Cloud | Monitoring |
| 1Password, Duo Security | Security |
| Snowflake, Segment, Fivetran, dbt Cloud, Stitch Data, Y42 | Data Platform |
| Mixpanel, Amplitude, Hotjar, FullStory, Optimizely, Pendo | Analytics |
| Calendly, Typeform, SurveyMonkey | Scheduling & Forms |
| Buffer, Hootsuite, Sprout Social | Social Media |
| Dropbox, Box | Storage |
| Contentful, Sanity, Ghost | CMS |
| Twitch | Streaming |

## Self-Hosting with Traefik

If you're running Traefik as a reverse proxy, add labels to `docker-compose.yml`:

```yaml
labels:
  - traefik.enable=true
  - "traefik.http.routers.pingfalcon.rule=Host(`yourdomain.com`) || Host(`www.yourdomain.com`)"
  - traefik.http.routers.pingfalcon.entrypoints=websecure
  - traefik.http.routers.pingfalcon.tls.certresolver=letsencrypt
  - traefik.http.services.pingfalcon.loadbalancer.server.port=3000
  # HTTP → HTTPS redirect
  - "traefik.http.routers.pingfalcon-http.rule=Host(`yourdomain.com`) || Host(`www.yourdomain.com`)"
  - traefik.http.routers.pingfalcon-http.entrypoints=web
  - traefik.http.routers.pingfalcon-http.middlewares=redirect-to-https
  - traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https
  - traefik.http.middlewares.redirect-to-https.redirectscheme.permanent=true
```

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (via `better-sqlite3`)
- **Frontend**: Vanilla JavaScript, no frameworks
- **Container**: Docker (node:20-alpine)

## License

MIT — free to use, modify, and self-host.

---

Built by [Florian zu Dreele](mailto:tweet@pingfalcon.net) · [pingfalcon.net](https://pingfalcon.net)
