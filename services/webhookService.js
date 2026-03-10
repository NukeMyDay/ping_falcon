const crypto = require('crypto');
const { getDb } = require('../db');

/**
 * Send a signed POST to a webhook subscriber.
 */
async function sendWebhook(subscription, payload) {
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
        'X-StatusPulse-Signature': signature,
        'X-StatusPulse-Event': 'status_change',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(
        `Webhook delivery failed to ${subscription.url}: HTTP ${res.status}`
      );
    }
  } catch (err) {
    console.error(
      `Webhook delivery error to ${subscription.url}: ${err.message}`
    );
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
