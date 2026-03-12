# pingfalcon

**A lightweight, self-hostable status monitor for the tools your business depends on.**

Monitor 100 SaaS services in real time. Select the services you care about, filter by region, and subscribe to webhook alerts when something breaks.

![pingfalcon screenshot](https://pingfalcon.net)

## Features

- **100 pre-configured services** — Shopify, Stripe, Slack, GitHub, OpenAI, Cloudflare, and more
- **Real-time status** — polls official status APIs every 60 seconds
- **Live timestamps** — "Updated X ago" counts up every second
- **Region filtering** — EU/DACH, US/Americas, APAC, Global
- **Webhook API** — receive POST notifications when a service status changes, with automatic retries
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

Requires Node.js 18+.

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

Response:

```json
{
  "id": 1,
  "secret": "abc123...",
  "message": "Webhook registered. Store the secret — you need it to verify payloads and to unsubscribe."
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

Failed deliveries are retried up to 3 times with increasing delays (1s, 3s, 10s). 5xx errors and network timeouts trigger a retry; 4xx errors do not.

Unsubscribe: `DELETE /api/webhooks/:id` with `{ "secret": "..." }` in the body.

## Supported Services

| Category | Services |
|---|---|
| AI | Claude, OpenAI, Gemini |
| Analytics | Mixpanel, Amplitude, Hotjar, FullStory, Optimizely, Pendo |
| CMS | Contentful, Sanity, Ghost |
| Communication | Slack, Zoom, Discord, Twilio, Webex, RingCentral, Vonage, Telnyx, Pusher, Ably |
| CRM | HubSpot, Braze, ActiveCampaign |
| Customer Support | Zendesk, Intercom, Gorgias, Help Scout, Drift, LiveChat |
| Data Platform | Snowflake, Segment, Fivetran, dbt Cloud, Stitch Data, Y42 |
| Design | Figma, Miro, Loom |
| Developer Tools | CircleCI, Buildkite, Supabase, LaunchDarkly, npm, Snyk, HashiCorp, Algolia, Cloudinary, Stream |
| E-Commerce | Shopify, Klaviyo, Recharge, BigCommerce, Squarespace, Webflow |
| Email Marketing | Mailchimp, SendGrid, Mailgun, Brevo, Kit, Customer.io |
| Forms | Typeform, SurveyMonkey |
| Hosting | Vercel, Netlify, Render, Fly.io |
| Infrastructure | GitHub, Cloudflare, DigitalOcean, Linode |
| Monitoring | Datadog, New Relic, Sentry, Grafana Cloud |
| Payments | Stripe, Plaid, Chargebee, Braintree, PayPal |
| Productivity | Notion |
| Project Management | Asana, Linear, Jira, monday.com, Airtable, ClickUp, Trello, Confluence, Coda |
| Scheduling | Calendly |
| Security | 1Password, Duo Security |
| Social Media | Buffer, Hootsuite, Sprout Social |
| Storage | Dropbox, Box |
| Streaming | Twitch |

## Self-Hosting with Traefik

If you're running Traefik as a reverse proxy, add labels to `docker-compose.yml`:

```yaml
labels:
  - traefik.enable=true
  - "traefik.http.routers.pingfalcon.rule=Host(`yourdomain.com`) || Host(`www.yourdomain.com`)"
  - traefik.http.routers.pingfalcon.entrypoints=websecure
  - traefik.http.routers.pingfalcon.tls.certresolver=letsencrypt
  - traefik.http.services.pingfalcon.loadbalancer.server.port=3000
  # HTTP router — required for ACME HTTP-01 challenge
  - "traefik.http.routers.pingfalcon-http.rule=Host(`yourdomain.com`) || Host(`www.yourdomain.com`)"
  - traefik.http.routers.pingfalcon-http.entrypoints=web
  - traefik.http.routers.pingfalcon-http.service=pingfalcon
```

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (via `better-sqlite3`)
- **Frontend**: Vanilla JavaScript, no frameworks
- **Container**: Docker (node:20-alpine)

## License

MIT — free to use, modify, and self-host.
