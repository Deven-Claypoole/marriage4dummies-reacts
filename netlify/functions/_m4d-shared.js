
const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const appId = 'c43c6075-5953-4ea7-98d7-2b0e887322e5';
const homepage = 'https://marriage4dummies-reacts.netlify.app';
const defaultIcon = homepage + '/apple-touch-icon.png';

function env(key) {
  const v = process.env[key];
  if (!v) throw Error('Server setup missing ' + key);
  return v;
}

function db() {
  return createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

const reply = (status, obj) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(obj)
});

function safeLink(input) {
  const value = String(input || '/').trim();

  if (value.startsWith('/') && !value.startsWith('//')) {
    return homepage + value;
  }

  try {
    const u = new URL(value);

    if (u.protocol !== 'https:') {
      throw Error('HTTPS required');
    }

    const allowed = new Set([
      'marriage4dummies-reacts.netlify.app',
      'youtube.com',
      'www.youtube.com',
      'youtu.be'
    ]);

    if (!allowed.has(u.hostname)) {
      throw Error('Link must point to M4D or YouTube');
    }

    return u.toString();
  } catch (e) {
    throw Error('Invalid notification link: ' + e.message);
  }
}

function idem(id, part) {
  const h = crypto
    .createHash('sha256')
    .update(String(id) + ':' + part)
    .digest('hex')
    .slice(0, 32);

  return (
    h.slice(0, 8) + '-' +
    h.slice(8, 12) + '-4' +
    h.slice(13, 16) + '-a' +
    h.slice(17, 20) + '-' +
    h.slice(20, 32)
  );
}

function cleanName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40) || 'M4D member';
}

function validAvatar(url) {
  if (typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'https:') {
      return null;
    }

    const site = new URL(homepage).hostname;
    const supa = new URL(env('SUPABASE_URL')).hostname;

    if (![site, supa].includes(parsed.hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

async function getMember(client, id) {
  if (!id) return null;

  const { data, error } = await client
    .from('profiles')
    .select('username,avatar_url')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn(
      'M4D profile lookup failed:',
      error.code || error.message
    );
    return null;
  }

  return {
    name: cleanName(data?.username),
    avatar: validAvatar(data?.avatar_url)
  };
}

async function enrich(client, event) {
  let senderId = null;
  let kind = null;
  let messageText = '';

  const source = String(event.source_key || '');

  if (
    event.category === 'messages' &&
    source.startsWith('message:')
  ) {
    const id = source.slice('message:'.length);

    const { data, error } = await client
      .from('m4d_messages')
      .select('sender_id,recipient_id,body')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (data?.recipient_id !== event.recipient_id) {
      return null;
    }

    senderId = data.sender_id;
    kind = 'message';
    messageText = data.body;

  } else if (
    event.category === 'friends' &&
    (
      source.startsWith('friend-request:') ||
      source.startsWith('friend-accepted:')
    )
  ) {
    const accepted = source.startsWith('friend-accepted:');
    const id = source.split(':').slice(1).join(':');

    const { data, error } = await client
      .from('friendships')
      .select('requester_id,recipient_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    senderId = accepted
      ? data.recipient_id
      : data.requester_id;

    if (
      (accepted ? data.requester_id : data.recipient_id) !==
      event.recipient_id
    ) {
      return null;
    }

    kind = accepted ? 'accepted' : 'request';
  }

  if (!senderId) return null;

  const profile = await getMember(client, senderId);
  if (!profile) return null;

  const name = profile.name;

  const title =
    kind === 'message'
      ? `💬 ${name}`
      : kind === 'accepted'
        ? `✅ ${name} accepted your request`
        : `👥 ${name} sent a friend request`;

  let body =
    kind === 'message'
      ? `New message from ${name}. Tap to read it.`
      : kind === 'accepted'
        ? `${name} accepted your friend request.`
        : `${name} wants to add you on M4D.`;

  if (kind === 'message') {
    // Only include the actual message if the recipient
    // has enabled message previews in their settings.

    const { data: settings, error: settingsError } =
      await client
        .from('m4d_notification_preferences')
        .select('message_previews')
        .eq('user_id', event.recipient_id)
        .maybeSingle();

    if (settingsError) throw settingsError;

    if (settings?.message_previews === true) {
      const preview = String(messageText || '')
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (preview) {
        const chars = Array.from(preview);

        body =
          chars.slice(0, 120).join('') +
          (chars.length > 120 ? '…' : '');
      }
    }
  }

  return {
    title: title.slice(0, 100),
    body: body.slice(0, 240),
    avatar: profile.avatar
  };
}

async function sendToOneSignal(event, userIds, part, extra) {
  if (!userIds.length) return null;

  const payload = {
    app_id: appId,

    headings: {
      en: (extra?.title || event.title).slice(0, 100)
    },

    contents: {
      en: (extra?.body || event.body).slice(0, 240)
    },

    url: safeLink(event.target_url),

    target_channel: 'push',

    include_aliases: {
      external_id: userIds
    },

    idempotency_key: idem(event.id, part)
  };

  if (extra?.avatar) {
    // Profile pictures are supported differently
    // depending on the phone and browser.

    payload.chrome_web_icon = extra.avatar;
    payload.chrome_web_image = extra.avatar;
    payload.firefox_icon = extra.avatar;
  } else {
    payload.chrome_web_icon = defaultIcon;
  }

  const result = await fetch(
    'https://api.onesignal.com/notifications',
    {
      method: 'POST',

      headers: {
        Authorization:
          'Key ' + env('ONESIGNAL_REST_API_KEY'),

        'Content-Type': 'application/json'
      },

      body: JSON.stringify(payload)
    }
  );

  const response = await result.json().catch(() => ({}));

  if (!result.ok) {
    throw Error(
      'OneSignal ' +
      result.status +
      ': ' +
      JSON.stringify(response).slice(0, 300)
    );
  }

  if (!response.id) {
    throw Error(
      'OneSignal returned no notification ID; ' +
      'targeting may have matched no subscribers'
    );
  }

  return response.id;
}

async function matchingRecipients(client, event) {
  if (event.recipient_id) {
    const { data, error } = await client
      .from('m4d_notification_preferences')
      .select(event.category)
      .eq('user_id', event.recipient_id)
      .maybeSingle();

    if (error) throw error;

    return data && data[event.category] === false
      ? []
      : [event.recipient_id];
  }

  const ids = [];

  for (let page = 1; page <= 200; page++) {
    const { data, error } =
      await client.auth.admin.listUsers({
        page,
        perPage: 200
      });

    if (error) throw error;

    const users = data?.users || [];

    ids.push(...users.map(x => x.id));

    if (users.length < 200) break;
  }

  const accepted = [];

  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);

    const { data, error } = await client
      .from('m4d_notification_preferences')
      .select('user_id,' + event.category)
      .in('user_id', slice);

    if (error) throw error;

    const disabled = new Set(
      (data || [])
        .filter(r => r[event.category] === false)
        .map(r => r.user_id)
    );

    accepted.push(
      ...slice.filter(id => !disabled.has(id))
    );
  }

  return accepted;
}

async function dispatchEvent(client, event) {
  const recipients = await matchingRecipients(client, event);

  if (!recipients.length) {
    const { error } = await client
      .from('m4d_push_events')
      .update({
        delivery_status: 'failed',
        last_error:
          'No eligible recipients (disabled or no registered users)'
      })
      .eq('id', event.id);

    if (error) throw error;

    return 0;
  }

  const extra = await enrich(client, event);

  for (let i = 0; i < recipients.length; i += 500) {
    await sendToOneSignal(
      event,
      recipients.slice(i, i + 500),
      i / 500,
      extra
    );
  }

  const { error } = await client
    .from('m4d_push_events')
    .update({
      delivery_status: 'sent',
      processed_at: new Date().toISOString(),
      last_error: null
    })
    .eq('id', event.id);

  if (error) throw error;

  return recipients.length;
}

async function drainQueue(client, batch = 12) {
  const { data, error } = await client.rpc(
    'm4d_claim_push_events',
    {
      batch_size: batch
    }
  );

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const event of data || []) {
    try {
      await dispatchEvent(client, event);
      sent++;
    } catch (err) {
      failed++;

      console.error(
        'M4D push event ' + event.id + ':',
        String(err?.message || err)
      );

      const { error: updateErr } = await client
        .from('m4d_push_events')
        .update({
          delivery_status:
            event.attempts < 4 ? 'pending' : 'failed',

          last_error: String(
            err?.message || err
          ).slice(0, 500)
        })
        .eq('id', event.id);

      if (updateErr) {
        console.error(
          'Failed to update event status:',
          updateErr.code || updateErr.message
        );
      }
    }
  }

  return {
    processed: (data || []).length,
    sent,
    failed
  };
}

module.exports = {
  db,
  reply,
  safeLink,
  dispatchEvent,
  drainQueue
};
