const { createHash } = require('crypto');

const NETLIFY_API_BASE = 'https://api.netlify.com/api/v1';

const ensureConfig = () => {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) {
    const err = new Error('NETLIFY_AUTH_TOKEN is missing.');
    err.code = 'NETLIFY_CONFIG';
    throw err;
  }
  return { token, teamSlug: process.env.NETLIFY_TEAM_SLUG || '' };
};

const toIsoDateTime = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
};

const htmlForEvent = (event) => {
  const title = event.title || 'Event Celebration';
  const venue = [event.venue, event.city, event.state].filter(Boolean).join(', ');
  const dateIso = toIsoDateTime(event.date);
  const mapLink = event.lat && event.lng
    ? `https://www.google.com/maps?q=${event.lat},${event.lng}`
    : event.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
      : '';

  const description = event.description || 'Join us for this special occasion.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; margin: 0; background: linear-gradient(160deg,#eef8ff,#f4fff7); color: #16324f; }
      .wrap { max-width: 880px; margin: 0 auto; padding: 32px 18px 50px; }
      .hero { background: white; border-radius: 18px; padding: 24px; box-shadow: 0 16px 36px rgba(10,45,70,0.12); }
      h1 { margin: 0 0 8px; font-size: 34px; }
      .meta { display: flex; flex-wrap: wrap; gap: 14px; margin: 14px 0 6px; color: #3d5f7f; }
      .count { margin-top: 16px; background: #143a5a; color: #fff; border-radius: 14px; padding: 18px; }
      .count strong { font-size: 28px; }
      .cta { margin-top: 18px; display: inline-block; text-decoration: none; background: #0f766e; color: #fff; padding: 10px 14px; border-radius: 10px; }
      .desc { margin-top: 14px; color: #3f5f7d; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <h1>${title}</h1>
        <div class="meta">
          <span>Type: ${event.type || 'Event'}</span>
          <span>Date: ${dateIso ? new Date(dateIso).toLocaleString() : 'TBD'}</span>
          <span>Guests: ${event.guestCount || 0}</span>
        </div>
        <div class="meta">
          <span>Location: ${venue || 'Location to be announced'}</span>
        </div>
        <div class="count">
          <div>Countdown to event</div>
          <strong id="countdown">Calculating...</strong>
        </div>
        ${mapLink ? `<a class="cta" href="${mapLink}" target="_blank" rel="noopener noreferrer">Open Location in Maps</a>` : ''}
        <p class="desc">${description}</p>
      </section>
    </main>
    <script>
      const eventDate = ${dateIso ? `new Date('${dateIso}')` : 'null'};
      const el = document.getElementById('countdown');
      function tick() {
        if (!eventDate) { el.textContent = 'Date will be announced soon'; return; }
        const now = new Date();
        const diff = eventDate - now;
        if (diff <= 0) { el.textContent = 'Event is live!'; return; }
        const d = Math.floor(diff / (1000*60*60*24));
        const h = Math.floor((diff / (1000*60*60)) % 24);
        const m = Math.floor((diff / (1000*60)) % 60);
        el.textContent = d + 'd ' + h + 'h ' + m + 'm';
      }
      tick();
      setInterval(tick, 60000);
    </script>
  </body>
</html>`;
};

const deployEventToNetlify = async (event) => {
  const { token, teamSlug } = ensureConfig();
  const baseSlug = String(event.slug || event.title || 'event').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 42);
  const siteName = `eventos-${baseSlug}-${Date.now().toString(36)}`;
  const html = htmlForEvent(event);
  const hash = createHash('sha1').update(html).digest('hex');

  const accountQuery = teamSlug ? `?account_slug=${encodeURIComponent(teamSlug)}` : '';
  const createSiteRes = await fetch(`${NETLIFY_API_BASE}/sites${accountQuery}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: siteName }),
  });

  if (!createSiteRes.ok) {
    const errText = await createSiteRes.text();
    throw new Error(`Failed to create Netlify site: ${errText}`);
  }

  const site = await createSiteRes.json();

  const createDeployRes = await fetch(`${NETLIFY_API_BASE}/sites/${site.id}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: { '/index.html': hash }, draft: false }),
  });

  if (!createDeployRes.ok) {
    const errText = await createDeployRes.text();
    throw new Error(`Failed to create Netlify deploy: ${errText}`);
  }

  const deploy = await createDeployRes.json();

  const uploadRes = await fetch(`${NETLIFY_API_BASE}/deploys/${deploy.id}/files/index.html`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/html; charset=utf-8',
    },
    body: html,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload Netlify file: ${errText}`);
  }

  return {
    siteId: site.id,
    siteName: site.name,
    siteUrl: site.ssl_url || site.url,
    deployId: deploy.id,
  };
};

module.exports = {
  deployEventToNetlify,
};
