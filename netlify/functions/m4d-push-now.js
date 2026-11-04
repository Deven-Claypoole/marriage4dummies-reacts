
const crypto = require('node:crypto');

const {
  db,
  reply,
  drainQueue
} = require('./_m4d-shared');

function validSecret(received, expected) {
  if (!received || !expected) return false;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return reply(405, {
      error: 'Method not allowed'
    });
  }

  const key =
    event.headers['x-m4d-webhook-secret'] ||
    event.headers['X-M4D-Webhook-Secret'];

  if (!validSecret(
    key,
    process.env.M4D_WEBHOOK_SECRET
  )) {
    return reply(401, {
      error: 'Unauthorized'
    });
  }

  // The webhook triggers processing.
  // Notification recipients come from Supabase,
  // not from the webhook request.

  try {
    const result = await drainQueue(db(), 12);

    return reply(200, {
      ok: true,
      ...result
    });

  } catch (err) {
    console.error(
      'M4D immediate dispatch:',
      String(err?.message || err)
    );

    return reply(500, {
      error: 'Could not process queue'
    });
  }
};
