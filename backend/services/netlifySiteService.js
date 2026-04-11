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

const htmlForEvent = (event, mediaUrls = [], opts = {}) => {
  const { giftQrDataUrl, giftUpiId, giftPayeeName, giftNote, apiBaseUrl, eventSlug } = opts;
  const title = event.title || 'Event Celebration';
  const venue = [event.venue, event.city, event.state].filter(Boolean).join(', ');
  const dateIso = toIsoDateTime(event.date);
  const endDateIso = toIsoDateTime(event.endDate);
  const coverImage = event.coverImage || '';
  const description = event.description || 'Join us for this special occasion.';
  const eventType = event.type || 'Event';

  const mapEmbedSrc = event.lat && event.lng
    ? `https://maps.google.com/maps?q=${event.lat},${event.lng}&z=15&output=embed`
    : event.address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(event.address)}&z=15&output=embed`
      : '';
  const mapLink = event.lat && event.lng
    ? `https://www.google.com/maps?q=${event.lat},${event.lng}`
    : event.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
      : '';

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };
  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const dateDisplay = formatDate(dateIso);
  const timeDisplay = formatTime(dateIso);
  const endTimeDisplay = endDateIso ? formatTime(endDateIso) : '';

  const photoCards = mediaUrls.slice(0, 12).map((url) =>
    `<div class="gallery-item"><img src="${url}" alt="Event photo" loading="lazy" /></div>`
  ).join('\n            ');

  const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description.slice(0, 160))}" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description.slice(0, 160))}" />
  ${coverImage ? `<meta property="og:image" content="${escHtml(coverImage)}" />` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #f8f6f3; color: #1a1a2e; line-height: 1.6; }

    /* ── Hero ── */
    .hero {
      position: relative; min-height: 70vh; display: flex; align-items: flex-end;
      background: ${coverImage ? `url('${coverImage}') center/cover no-repeat` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
    }
    .hero::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.18) 50%, rgba(0,0,0,.08) 100%);
    }
    .hero-content { position: relative; z-index: 1; width: 100%; padding: 60px 24px 48px; max-width: 960px; margin: 0 auto; }
    .event-badge {
      display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 1.2px; background: rgba(255,255,255,.2); color: #fff;
      backdrop-filter: blur(8px); margin-bottom: 16px;
    }
    .hero h1 {
      font-family: 'Playfair Display', Georgia, serif; font-size: clamp(2.2rem, 6vw, 3.8rem);
      font-weight: 700; color: #fff; line-height: 1.15; margin-bottom: 16px;
    }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 20px; color: rgba(255,255,255,.9); font-size: 15px; }
    .hero-meta svg { width: 18px; height: 18px; vertical-align: -3px; margin-right: 6px; fill: currentColor; opacity: .8; }

    /* ── Countdown ── */
    .countdown-section { background: #1a1a2e; padding: 48px 24px; text-align: center; }
    .countdown-label { color: rgba(255,255,255,.6); font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; }
    .countdown-boxes { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
    .cd-box {
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
      padding: 20px 12px; min-width: 90px; text-align: center;
    }
    .cd-box .num { font-family: 'Playfair Display', serif; font-size: 42px; font-weight: 700; color: #fff; display: block; line-height: 1; }
    .cd-box .lbl { color: rgba(255,255,255,.5); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
    .cd-live { display: none; color: #4ade80; font-size: 22px; font-weight: 600; }

    /* ── Content Sections ── */
    .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }
    .section { padding: 56px 0; }
    .section-title {
      font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700;
      margin-bottom: 24px; position: relative; padding-bottom: 12px;
    }
    .section-title::after {
      content: ''; position: absolute; bottom: 0; left: 0; width: 48px; height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 3px;
    }

    /* ── Details Card ── */
    .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
    .detail-card {
      background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,.06);
      border: 1px solid rgba(0,0,0,.04);
    }
    .detail-card .icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
    .detail-card .icon svg { width: 20px; height: 20px; fill: #fff; }
    .detail-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
    .detail-card .value { font-size: 16px; font-weight: 600; color: #1a1a2e; }

    .desc-block { background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,.06); margin-top: 28px; line-height: 1.8; color: #444; font-size: 16px; }

    /* ── Map ── */
    .map-section { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.06); margin-top: 20px; }
    .map-section iframe { width: 100%; height: 350px; border: 0; display: block; }
    .map-bar { padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .map-bar .addr { font-size: 14px; color: #555; }
    .map-bar a {
      display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 10px;
      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; text-decoration: none;
      font-size: 14px; font-weight: 600; transition: transform .2s;
    }
    .map-bar a:hover { transform: translateY(-1px); }

    /* ── Gallery ── */
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .gallery-item { border-radius: 12px; overflow: hidden; aspect-ratio: 4/3; background: #eee; }
    .gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; cursor: pointer; }
    .gallery-item:hover img { transform: scale(1.05); }

    /* ── Gifting ── */
    .gift-section { background: linear-gradient(135deg, #fef9f0 0%, #fdf2f8 100%); border-radius: 14px; padding: 36px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
    .gift-section h2 { font-family: 'Playfair Display', serif; font-size: 28px; margin-bottom: 8px; }
    .gift-sub { color: #666; margin-bottom: 24px; font-size: 15px; }
    .gift-qr { display: inline-block; background: #fff; padding: 16px; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .gift-qr img { width: 200px; height: 200px; }
    .gift-info { margin-top: 16px; color: #555; font-size: 14px; }
    .gift-info strong { color: #1a1a2e; }

    /* ── Photo Upload ── */
    .upload-section { background: #fff; border-radius: 14px; padding: 36px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
    .upload-form { max-width: 480px; margin: 24px auto 0; text-align: left; }
    .upload-form label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 6px; }
    .upload-form input, .upload-form textarea { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; font-family: inherit; margin-bottom: 16px; }
    .upload-form input:focus, .upload-form textarea:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,.15); }
    .upload-form textarea { resize: vertical; min-height: 70px; }
    .upload-btn {
      display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: transform .2s, box-shadow .2s; width: 100%;  justify-content: center;
    }
    .upload-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(102,126,234,.35); }
    .upload-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }
    .upload-msg { margin-top: 12px; padding: 12px; border-radius: 10px; font-size: 14px; text-align: center; }
    .upload-msg.ok { background: #ecfdf5; color: #065f46; }
    .upload-msg.err { background: #fef2f2; color: #991b1b; }

    /* ── Lightbox ── */
    .lightbox {
      display: none; position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.92);
      align-items: center; justify-content: center; cursor: pointer;
    }
    .lightbox.active { display: flex; }
    .lightbox img { max-width: 92vw; max-height: 88vh; border-radius: 8px; object-fit: contain; }
    .lb-close { position: absolute; top: 20px; right: 24px; color: #fff; font-size: 32px; cursor: pointer; z-index: 1001; }

    /* ── Footer ── */
    .footer { text-align: center; padding: 40px 24px; color: #999; font-size: 13px; border-top: 1px solid #eee; }

    @media (max-width: 600px) {
      .hero { min-height: 55vh; }
      .cd-box { min-width: 72px; padding: 14px 8px; }
      .cd-box .num { font-size: 32px; }
      .gallery-grid { grid-template-columns: repeat(2, 1fr); }
      .map-bar { flex-direction: column; gap: 12px; text-align: center; }
    }
  </style>
</head>
<body>

  <!-- Hero -->
  <section class="hero">
    <div class="hero-content">
      <span class="event-badge">${escHtml(eventType)}</span>
      <h1>${escHtml(title)}</h1>
      <div class="hero-meta">
        <span>
          <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
          ${dateDisplay || 'Date TBD'}${timeDisplay ? ' &middot; ' + timeDisplay : ''}${endTimeDisplay ? ' – ' + endTimeDisplay : ''}
        </span>
        ${venue ? `<span>
          <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
          ${escHtml(venue)}
        </span>` : ''}
      </div>
    </div>
  </section>

  <!-- Countdown -->
  <section class="countdown-section">
    <div class="countdown-label">Counting Down To The Big Day</div>
    <div class="countdown-boxes" id="cd-boxes">
      <div class="cd-box"><span class="num" id="cd-d">--</span><span class="lbl">Days</span></div>
      <div class="cd-box"><span class="num" id="cd-h">--</span><span class="lbl">Hours</span></div>
      <div class="cd-box"><span class="num" id="cd-m">--</span><span class="lbl">Minutes</span></div>
      <div class="cd-box"><span class="num" id="cd-s">--</span><span class="lbl">Seconds</span></div>
    </div>
    <div class="cd-live" id="cd-live">&#127881; The Event Is Live!</div>
  </section>

  <div class="container">
    <!-- Details -->
    <section class="section">
      <h2 class="section-title">Event Details</h2>
      <div class="details-grid">
        <div class="detail-card">
          <div class="icon" style="background:linear-gradient(135deg,#667eea,#764ba2)">
            <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
          </div>
          <div class="label">Date</div>
          <div class="value">${dateDisplay || 'To be announced'}</div>
        </div>
        <div class="detail-card">
          <div class="icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)">
            <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
          </div>
          <div class="label">Time</div>
          <div class="value">${timeDisplay || 'TBD'}${endTimeDisplay ? ' – ' + endTimeDisplay : ''}</div>
        </div>
        <div class="detail-card">
          <div class="icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">
            <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
          </div>
          <div class="label">Venue</div>
          <div class="value">${escHtml(venue || 'To be announced')}</div>
        </div>
        <div class="detail-card">
          <div class="icon" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">
            <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          </div>
          <div class="label">Expected Guests</div>
          <div class="value">${event.guestCount || '—'}</div>
        </div>
      </div>

      ${description ? `<div class="desc-block">${escHtml(description)}</div>` : ''}
    </section>

    ${mapEmbedSrc ? `
    <!-- Map -->
    <section class="section" style="padding-top:0">
      <h2 class="section-title">Location</h2>
      <div class="map-section">
        <iframe src="${mapEmbedSrc}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <div class="map-bar">
          <span class="addr">${escHtml(venue || event.address || '')}</span>
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
            Get Directions
          </a>` : ''}
        </div>
      </div>
    </section>` : ''}

    ${photoCards ? `
    <!-- Gallery -->
    <section class="section" style="padding-top:0">
      <h2 class="section-title">Event Photos</h2>
      <div class="gallery-grid">
        ${photoCards}
      </div>
    </section>` : ''}

    ${giftQrDataUrl ? `
    <!-- Gifting -->
    <section class="section" style="padding-top:0">
      <div class="gift-section">
        <h2>Send Your Blessings &#127873;</h2>
        <p class="gift-sub">Can't make it in person? You can still be part of the celebration — send a gift via UPI.</p>
        <div class="gift-qr">
          <img src="${giftQrDataUrl}" alt="Gift QR Code" />
        </div>
        <div class="gift-info">
          <p><strong>${escHtml(giftPayeeName || 'Event Family')}</strong></p>
          ${giftUpiId ? `<p>UPI: ${escHtml(giftUpiId)}</p>` : ''}
          ${giftNote ? `<p style="color:#888;font-style:italic">${escHtml(giftNote)}</p>` : ''}
        </div>
      </div>
    </section>` : ''}

    ${apiBaseUrl && eventSlug ? `
    <!-- Guest Photo Upload -->
    <section class="section" style="padding-top:0">
      <div class="upload-section" style="text-align:center">
        <h2 class="section-title" style="display:inline-block">Share Your Photos &#128247;</h2>
        <p style="color:#666;margin-bottom:8px">Upload your photos with a message. They'll appear in the event album after approval.</p>
        <form id="photoForm" class="upload-form">
          <label for="guestName">Your Name</label>
          <input type="text" id="guestName" placeholder="Enter your name" required />
          <label for="caption">Message / Caption</label>
          <textarea id="caption" placeholder="Write a message or blessing..."></textarea>
          <label for="photoFile">Choose Photo</label>
          <input type="file" id="photoFile" accept="image/*" required />
          <button type="submit" class="upload-btn" id="uploadBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
            Upload Photo
          </button>
          <div id="uploadMsg" class="upload-msg" style="display:none"></div>
        </form>
      </div>
    </section>` : ''}
  </div>

  <!-- Lightbox -->
  <div class="lightbox" id="lightbox">
    <span class="lb-close">&times;</span>
    <img id="lb-img" src="" alt="Photo" />
  </div>

  <!-- Footer -->
  <div class="footer">Made with &#10084;&#65039; &middot; Powered by Eventos</div>

  <script>
    /* ── Countdown ── */
    var eventDate = ${dateIso ? `new Date('${dateIso}')` : 'null'};
    var dEl = document.getElementById('cd-d');
    var hEl = document.getElementById('cd-h');
    var mEl = document.getElementById('cd-m');
    var sEl = document.getElementById('cd-s');
    var boxes = document.getElementById('cd-boxes');
    var liveEl = document.getElementById('cd-live');
    function pad(n) { return n < 10 ? '0' + n : n; }
    function tick() {
      if (!eventDate) { dEl.textContent = '--'; hEl.textContent = '--'; mEl.textContent = '--'; sEl.textContent = '--'; return; }
      var diff = eventDate - new Date();
      if (diff <= 0) { boxes.style.display = 'none'; liveEl.style.display = 'block'; return; }
      dEl.textContent = Math.floor(diff / 86400000);
      hEl.textContent = pad(Math.floor((diff / 3600000) % 24));
      mEl.textContent = pad(Math.floor((diff / 60000) % 60));
      sEl.textContent = pad(Math.floor((diff / 1000) % 60));
    }
    tick();
    setInterval(tick, 1000);

    /* ── Lightbox ── */
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lb-img');
    document.querySelectorAll('.gallery-item img').forEach(function(img) {
      img.addEventListener('click', function() { lbImg.src = this.src; lb.classList.add('active'); });
    });
    lb.addEventListener('click', function() { lb.classList.remove('active'); });

    /* ── Photo Upload ── */
    var form = document.getElementById('photoForm');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var btn = document.getElementById('uploadBtn');
        var msgEl = document.getElementById('uploadMsg');
        var name = document.getElementById('guestName').value.trim();
        var caption = document.getElementById('caption').value.trim();
        var file = document.getElementById('photoFile').files[0];
        if (!name || !file) return;
        btn.disabled = true;
        btn.textContent = 'Uploading...';
        msgEl.style.display = 'none';
        var fd = new FormData();
        fd.append('file', file);
        fd.append('guestName', name);
        fd.append('caption', caption || 'Photo from ' + name);
        fd.append('eventSlug', '${eventSlug || ''}');
        fetch('${apiBaseUrl || ''}/api/media/public-blessing', { method: 'POST', body: fd })
          .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
          .then(function(res) {
            msgEl.style.display = 'block';
            if (res.ok) {
              msgEl.className = 'upload-msg ok';
              msgEl.textContent = 'Thank you, ' + name + '! Your photo has been submitted.';
              form.reset();
            } else {
              msgEl.className = 'upload-msg err';
              msgEl.textContent = res.data.message || 'Upload failed. Please try again.';
            }
          })
          .catch(function() {
            msgEl.style.display = 'block';
            msgEl.className = 'upload-msg err';
            msgEl.textContent = 'Network error. Please try again.';
          })
          .finally(function() { btn.disabled = false; btn.textContent = 'Upload Photo'; });
      });
    }
  </script>
</body>
</html>`;
};

const deployEventToNetlify = async (event, mediaUrls = [], opts = {}) => {
  const { token, teamSlug } = ensureConfig();
  const html = htmlForEvent(event, mediaUrls, opts);
  const hash = createHash('sha1').update(html).digest('hex');

  let siteId = event.netlifySiteId || null;
  let siteUrl = event.netlifySiteUrl || null;
  let siteName = null;

  // ── Reuse existing site or create a new one ──
  if (siteId) {
    // Verify the site still exists on Netlify
    const checkRes = await fetch(`${NETLIFY_API_BASE}/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      siteName = existing.name;
      siteUrl = existing.ssl_url || existing.url || siteUrl;
    } else {
      // Site was deleted externally — create a fresh one
      siteId = null;
    }
  }

  if (!siteId) {
    const baseSlug = String(event.slug || event.title || 'event').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 42);
    const newSiteName = `eventos-${baseSlug}-${Date.now().toString(36)}`;
    const accountQuery = teamSlug ? `?account_slug=${encodeURIComponent(teamSlug)}` : '';
    const createSiteRes = await fetch(`${NETLIFY_API_BASE}/sites${accountQuery}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newSiteName }),
    });

    if (!createSiteRes.ok) {
      const errText = await createSiteRes.text();
      throw new Error(`Failed to create Netlify site: ${errText}`);
    }

    const site = await createSiteRes.json();
    siteId = site.id;
    siteName = site.name;
    siteUrl = site.ssl_url || site.url;
  }

  // ── Deploy updated HTML to the site ──
  const createDeployRes = await fetch(`${NETLIFY_API_BASE}/sites/${siteId}/deploys`, {
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
    siteId,
    siteName,
    siteUrl,
    deployId: deploy.id,
  };
};

module.exports = {
  deployEventToNetlify,
};
