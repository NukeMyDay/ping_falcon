const crypto = require('crypto');
const { getDb } = require('../db');

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // 1s, 3s, 10s

/**
 * Send a signed POST to a webhook subscriber, with exponential backoff retries.
 */
async function sendWebhook(subscription, payload, attempt = 0) {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', subscription.secret)
    .update(body)
    .digest('hex');

  try {
    const res = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pingfalcon-Signature': signature,
        'X-Pingfalcon-Event': 'status_change',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return;

    // Retry on 5xx, not on 4xx (client errors are permanent)
    if (res.status >= 500 && attempt < MAX_RETRIES - 1) {
      console.warn(`Webhook to ${subscription.url} failed (HTTP ${res.status}), retry ${attempt + 1}/${MAX_RETRIES - 1} in ${RETRY_DELAYS[attempt]}ms`);
      setTimeout(() => sendWebhook(subscription, payload, attempt + 1), RETRY_DELAYS[attempt]);
    } else {
      console.error(`Webhook delivery failed to ${subscription.url}: HTTP ${res.status}`);
    }
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      console.warn(`Webhook to ${subscription.url} error (${err.message}), retry ${attempt + 1}/${MAX_RETRIES - 1} in ${RETRY_DELAYS[attempt]}ms`);
      setTimeout(() => sendWebhook(subscription, payload, attempt + 1), RETRY_DELAYS[attempt]);
    } else {
      console.error(`Webhook delivery failed permanently to ${subscription.url}: ${err.message}`);
    }
  }
}

/**
 * Notify all active subscribers about a service status change.
 */
function notifyStatusChange(serviceId, previousStatus, currentStatus, description) {
  let subscriptions;
  try {
    const db = getDb();
    subscriptions = db
      .prepare('SELECT * FROM webhook_subscriptions WHERE active = 1')
      .all();
  } catch {
    return;
  }

  const payload = {
    event: 'status_change',
    service: serviceId,
    previous_status: previousStatus,
    current_status: currentStatus,
    description: description || '',
    timestamp: new Date().toISOString(),
  };

  for (const sub of subscriptions) {
    // Check if this subscriber cares about this service
    let services;
    try {
      services = JSON.parse(sub.services);
    } catch {
      services = [];
    }

    // Empty array = subscribed to all
    if (services.length === 0 || services.includes(serviceId)) {
      sendWebhook(sub, payload);
    }
  }
}

module.exports = { notifyStatusChange };
