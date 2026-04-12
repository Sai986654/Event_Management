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
  const {
    giftQrDataUrl, giftUpiId, giftPayeeName, giftNote,
    apiBaseUrl, eventSlug,
    hostName, hostSubtitle, hostImageUrl,
    bgMusicUrl,
  } = opts;

  const title = event.title || 'Event Celebration';
  const venue = [event.venue, event.city, event.state].filter(Boolean).join(', ');
  const dateIso = toIsoDateTime(event.date);
  const endDateIso = toIsoDateTime(event.endDate);
  const coverImage = event.coverImage || '';
  const description = event.description || 'Join us for this special occasion.';
  const eventType = event.type || 'Event';
  const timeline = Array.isArray(event.timeline) ? event.timeline : [];

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

  // Google Calendar link
  const gcalStart = dateIso ? new Date(dateIso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') : '';
  const gcalEnd = endDateIso
    ? new Date(endDateIso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    : gcalStart;
  const gcalLink = gcalStart
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(description.slice(0, 300))}&location=${encodeURIComponent(venue)}`
    : '';

  const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Build gallery items
  const photoCards = mediaUrls.slice(0, 20).map((url, i) =>
    `<div class="carousel-slide${i === 0 ? ' active' : ''}"><img src="${url}" alt="Event photo ${i + 1}" loading="lazy" /></div>`
  ).join('\n            ');

  // Build schedule items from timeline JSON
  const scheduleCards = timeline.filter(t => t.title).map((item) => {
    const timeStr = item.time || '';
    const icon = item.icon || '🕐';
    return `<div class="schedule-card">
              <div class="schedule-icon">${icon}</div>
              <div class="schedule-info">
                <div class="schedule-time">${escHtml(timeStr)}</div>
                <div class="schedule-title">${escHtml(item.title)}</div>
                ${item.description ? `<div class="schedule-desc">${escHtml(item.description)}</div>` : ''}
              </div>
            </div>`;
  }).join('\n          ');

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
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #f8f6f3; color: #1a1a2e; line-height: 1.6; }

    /* ── Sticky Nav ── */
    .sticky-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 900;
      background: rgba(26,26,46,.85); backdrop-filter: blur(12px);
      padding: 0 24px; display: flex; align-items: center; justify-content: center;
      gap: 8px; height: 52px; transition: transform .3s;
    }
    .sticky-nav.hidden { transform: translateY(-100%); }
    .sticky-nav a {
      color: rgba(255,255,255,.75); text-decoration: none; font-size: 13px;
      font-weight: 500; padding: 6px 14px; border-radius: 20px; transition: all .2s;
    }
    .sticky-nav a:hover, .sticky-nav a.active { color: #fff; background: rgba(255,255,255,.15); }

    /* ── Music Toggle ── */
    .music-toggle {
      position: fixed; bottom: 24px; right: 24px; z-index: 950;
      width: 48px; height: 48px; border-radius: 50%; border: none;
      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
      font-size: 20px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s; animation: pulse-ring 2s ease-out infinite;
    }
    .music-toggle:hover { transform: scale(1.1); }
    .music-toggle.playing { animation: spin-disc 3s linear infinite; }
    @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(102,126,234,.5); } 70% { box-shadow: 0 0 0 12px rgba(102,126,234,0); } 100% { box-shadow: 0 0 0 0 rgba(102,126,234,0); } }
    @keyframes spin-disc { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* ── Hero ── */
    .hero {
      position: relative; min-height: 85vh; display: flex; align-items: flex-end;
      background: ${coverImage ? `url('${coverImage}') center/cover no-repeat` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
    }
    .hero::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.2) 50%, rgba(0,0,0,.05) 100%);
    }
    .hero-content { position: relative; z-index: 1; width: 100%; padding: 60px 24px 48px; max-width: 960px; margin: 0 auto; }
    .event-badge {
      display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 1.2px; background: rgba(255,255,255,.2); color: #fff;
      backdrop-filter: blur(8px); margin-bottom: 16px;
    }
    .hero h1 {
      font-family: 'Playfair Display', Georgia, serif; font-size: clamp(2.4rem, 7vw, 4.2rem);
      font-weight: 700; color: #fff; line-height: 1.12; margin-bottom: 16px;
      text-shadow: 0 2px 20px rgba(0,0,0,.3);
    }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 20px; color: rgba(255,255,255,.9); font-size: 15px; margin-bottom: 24px; }
    .hero-meta svg { width: 18px; height: 18px; vertical-align: -3px; margin-right: 6px; fill: currentColor; opacity: .8; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }
    .hero-btn {
      display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 12px;
      font-size: 14px; font-weight: 600; text-decoration: none; transition: transform .2s, box-shadow .2s;
    }
    .hero-btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; box-shadow: 0 4px 16px rgba(102,126,234,.4); }
    .hero-btn-secondary { background: rgba(255,255,255,.15); color: #fff; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.25); }
    .hero-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,.2); }
    .scroll-hint {
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2;
      color: rgba(255,255,255,.6); font-size: 13px; text-align: center; animation: bounce 2s infinite;
    }
    .scroll-hint svg { display: block; margin: 4px auto 0; width: 24px; height: 24px; fill: currentColor; }
    @keyframes bounce { 0%,100%{ transform: translateX(-50%) translateY(0); } 50%{ transform: translateX(-50%) translateY(6px); } }

    /* ── Countdown ── */
    .countdown-section { background: #1a1a2e; padding: 56px 24px; text-align: center; }
    .countdown-label { color: rgba(255,255,255,.6); font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; }
    .countdown-boxes { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
    .cd-box {
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
      padding: 20px 16px; min-width: 90px; text-align: center;
    }
    .cd-box .num { font-family: 'Playfair Display', serif; font-size: 42px; font-weight: 700; color: #fff; display: block; line-height: 1; }
    .cd-box .lbl { color: rgba(255,255,255,.5); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
    .cd-live { display: none; color: #4ade80; font-size: 22px; font-weight: 600; }

    /* ── Content Sections ── */
    .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }
    .section { padding: 56px 0; }
    .section-title {
      font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700;
      margin-bottom: 24px; position: relative; padding-bottom: 12px; text-align: center;
    }
    .section-title::after {
      content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 48px; height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 3px;
    }
    .section-subtitle { text-align: center; color: #666; margin: -16px 0 28px; font-size: 15px; }

    /* ── Host / Family Card ── */
    .host-section { text-align: center; padding: 56px 24px; background: linear-gradient(135deg, #fef9f0 0%, #fdf2f8 100%); }
    .host-avatar {
      width: 120px; height: 120px; border-radius: 50%; object-fit: cover;
      border: 4px solid #fff; box-shadow: 0 4px 20px rgba(0,0,0,.1); margin-bottom: 16px;
    }
    .host-name { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .host-sub { color: #666; font-size: 15px; }

    /* ── Details Card ── */
    .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
    .detail-card {
      background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,.06);
      border: 1px solid rgba(0,0,0,.04); text-align: center;
    }
    .detail-card .icon { width: 48px; height: 48px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
    .detail-card .icon svg { width: 22px; height: 22px; fill: #fff; }
    .detail-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
    .detail-card .value { font-size: 16px; font-weight: 600; color: #1a1a2e; }

    .desc-block { background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,.06); margin-top: 28px; line-height: 1.8; color: #444; font-size: 16px; text-align: center; }

    /* ── Schedule / Itinerary ── */
    .schedule-list { max-width: 600px; margin: 0 auto; }
    .schedule-card {
      display: flex; gap: 16px; align-items: flex-start; padding: 20px;
      background: #fff; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,.06);
      margin-bottom: 12px; border-left: 4px solid #667eea;
    }
    .schedule-icon { font-size: 28px; flex-shrink: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: #f0f0ff; border-radius: 12px; }
    .schedule-info { flex: 1; }
    .schedule-time { font-size: 13px; color: #667eea; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
    .schedule-title { font-size: 17px; font-weight: 600; color: #1a1a2e; }
    .schedule-desc { font-size: 14px; color: #666; margin-top: 4px; }

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

    /* ── Gallery Carousel ── */
    .carousel-wrapper { position: relative; border-radius: 14px; overflow: hidden; background: #111; aspect-ratio: 16/10; max-height: 520px; }
    .carousel-slide { position: absolute; inset: 0; opacity: 0; transition: opacity .8s ease-in-out; }
    .carousel-slide.active { opacity: 1; }
    .carousel-slide img { width: 100%; height: 100%; object-fit: contain; }
    .carousel-btn {
      position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
      width: 44px; height: 44px; border-radius: 50%; border: none;
      background: rgba(255,255,255,.2); backdrop-filter: blur(8px); color: #fff;
      font-size: 22px; cursor: pointer; transition: background .2s;
    }
    .carousel-btn:hover { background: rgba(255,255,255,.35); }
    .carousel-prev { left: 12px; }
    .carousel-next { right: 12px; }
    .carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
    .carousel-dot {
      width: 10px; height: 10px; border-radius: 50%; background: #ccc; border: none;
      cursor: pointer; transition: background .2s, transform .2s;
    }
    .carousel-dot.active { background: #667eea; transform: scale(1.3); }
    .gallery-thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-top: 16px; }
    .gallery-thumb { border-radius: 8px; overflow: hidden; aspect-ratio: 1; cursor: pointer; opacity: .6; transition: opacity .2s; border: 2px solid transparent; }
    .gallery-thumb.active { opacity: 1; border-color: #667eea; }
    .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }

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
      cursor: pointer; transition: transform .2s, box-shadow .2s; width: 100%; justify-content: center;
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

    /* ── Scroll animations ── */
    .reveal { opacity: 0; transform: translateY(30px); transition: opacity .7s, transform .7s; }
    .reveal.visible { opacity: 1; transform: translateY(0); }

    /* ── Footer ── */
    .footer { text-align: center; padding: 40px 24px; color: #999; font-size: 13px; border-top: 1px solid #eee; }

    @media (max-width: 600px) {
      .hero { min-height: 70vh; }
      .sticky-nav { gap: 4px; padding: 0 12px; }
      .sticky-nav a { font-size: 12px; padding: 6px 10px; }
      .cd-box { min-width: 72px; padding: 14px 8px; }
      .cd-box .num { font-size: 32px; }
      .carousel-wrapper { aspect-ratio: 4/3; }
      .gallery-thumbs { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); }
      .map-bar { flex-direction: column; gap: 12px; text-align: center; }
    }
  </style>
</head>
<body>

  <!-- Sticky Navigation -->
  <nav class="sticky-nav" id="stickyNav">
    <a href="#home">Home</a>
    <a href="#details">Details</a>
    ${scheduleCards ? '<a href="#schedule">Schedule</a>' : ''}
    ${mediaUrls.length ? '<a href="#gallery">Gallery</a>' : ''}
    ${mapEmbedSrc ? '<a href="#location">Location</a>' : ''}
    ${giftQrDataUrl ? '<a href="#gifting">Gift</a>' : ''}
  </nav>

  ${bgMusicUrl ? `
  <!-- Background Music -->
  <audio id="bgMusic" loop preload="auto">
    <source src="${escHtml(bgMusicUrl)}" type="audio/mpeg" />
  </audio>
  <button class="music-toggle" id="musicBtn" title="Toggle music">&#9835;</button>
  ` : ''}

  <!-- Hero -->
  <section class="hero" id="home">
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
      <div class="hero-actions">
        ${gcalLink ? `<a href="${gcalLink}" target="_blank" rel="noopener" class="hero-btn hero-btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
          Save the Date
        </a>` : ''}
        ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener" class="hero-btn hero-btn-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
          Get Directions
        </a>` : ''}
      </div>
    </div>
    <div class="scroll-hint">
      Scroll Down
      <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
    </div>
  </section>

  <!-- Countdown -->
  <section class="countdown-section" id="countdown">
    <div class="countdown-label">Counting Down To The Big Day</div>
    <div class="countdown-boxes" id="cd-boxes">
      <div class="cd-box"><span class="num" id="cd-d">--</span><span class="lbl">Days</span></div>
      <div class="cd-box"><span class="num" id="cd-h">--</span><span class="lbl">Hours</span></div>
      <div class="cd-box"><span class="num" id="cd-m">--</span><span class="lbl">Minutes</span></div>
      <div class="cd-box"><span class="num" id="cd-s">--</span><span class="lbl">Seconds</span></div>
    </div>
    <div class="cd-live" id="cd-live">&#127881; The Event Is Live!</div>
  </section>

  ${hostName ? `
  <!-- Host / Family -->
  <section class="host-section reveal" id="host">
    ${hostImageUrl ? `<img class="host-avatar" src="${escHtml(hostImageUrl)}" alt="${escHtml(hostName)}" />` : ''}
    <div class="host-name">${escHtml(hostName)}</div>
    ${hostSubtitle ? `<div class="host-sub">${escHtml(hostSubtitle)}</div>` : ''}
  </section>
  ` : ''}

  <div class="container">
    <!-- Details -->
    <section class="section reveal" id="details">
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

    ${scheduleCards ? `
    <!-- Event Schedule / Itinerary -->
    <section class="section reveal" id="schedule">
      <h2 class="section-title">Event Schedule</h2>
      <p class="section-subtitle">Here's what we have planned for the day</p>
      <div class="schedule-list">
        ${scheduleCards}
      </div>
    </section>` : ''}

    ${mapEmbedSrc ? `
    <!-- Map -->
    <section class="section reveal" id="location" style="padding-top:0">
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

    ${mediaUrls.length ? `
    <!-- Gallery -->
    <section class="section reveal" id="gallery" style="padding-top:0">
      <h2 class="section-title">Gallery</h2>
      <div class="carousel-wrapper" id="carouselWrapper">
        ${photoCards}
        <button class="carousel-btn carousel-prev" id="carouselPrev">&#10094;</button>
        <button class="carousel-btn carousel-next" id="carouselNext">&#10095;</button>
      </div>
      <div class="carousel-dots" id="carouselDots"></div>
      <div class="gallery-thumbs" id="galleryThumbs"></div>
    </section>` : ''}

    ${giftQrDataUrl ? `
    <!-- Gifting -->
    <section class="section reveal" id="gifting" style="padding-top:0">
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
    <section class="section reveal" style="padding-top:0">
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
  <div class="footer">Made with &#10084;&#65039; &middot; Powered by Vedika 360</div>

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

    /* ── Sticky Nav ── */
    var nav = document.getElementById('stickyNav');
    var lastY = 0;
    window.addEventListener('scroll', function() {
      var y = window.scrollY;
      if (y > 200) { nav.classList.toggle('hidden', y > lastY && y > 400); } else { nav.classList.remove('hidden'); }
      lastY = y;
      // Active section
      var links = nav.querySelectorAll('a');
      links.forEach(function(a) { a.classList.remove('active'); });
      var sections = document.querySelectorAll('section[id]');
      var current = '';
      sections.forEach(function(s) { if (s.offsetTop - 100 <= y) current = s.id; });
      if (current) { var active = nav.querySelector('a[href="#' + current + '"]'); if (active) active.classList.add('active'); }
    });

    /* ── Scroll Reveal ── */
    var reveals = document.querySelectorAll('.reveal');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function(el) { observer.observe(el); });

    /* ── Background Music ── */
    var audio = document.getElementById('bgMusic');
    var musicBtn = document.getElementById('musicBtn');
    if (audio && musicBtn) {
      var playing = false;
      musicBtn.addEventListener('click', function() {
        if (playing) { audio.pause(); musicBtn.classList.remove('playing'); musicBtn.innerHTML = '&#9835;'; }
        else { audio.play().catch(function(){}); musicBtn.classList.add('playing'); musicBtn.innerHTML = '&#10074;&#10074;'; }
        playing = !playing;
      });
      // Auto-play on first user interaction
      document.addEventListener('click', function autoPlay() {
        if (!playing) { audio.volume = 0.4; audio.play().then(function() { playing = true; musicBtn.classList.add('playing'); musicBtn.innerHTML = '&#10074;&#10074;'; }).catch(function(){}); }
        document.removeEventListener('click', autoPlay);
      }, { once: true });
    }

    /* ── Gallery Carousel ── */
    var slides = document.querySelectorAll('.carousel-slide');
    var dotsC = document.getElementById('carouselDots');
    var thumbsC = document.getElementById('galleryThumbs');
    var currentSlide = 0;
    if (slides.length > 0) {
      // Build dots & thumbs
      slides.forEach(function(s, i) {
        var dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', function() { goToSlide(i); });
        dotsC.appendChild(dot);

        var thumb = document.createElement('div');
        thumb.className = 'gallery-thumb' + (i === 0 ? ' active' : '');
        thumb.innerHTML = '<img src="' + s.querySelector('img').src + '" alt="Thumb" />';
        thumb.addEventListener('click', function() { goToSlide(i); });
        thumbsC.appendChild(thumb);
      });

      function goToSlide(idx) {
        slides[currentSlide].classList.remove('active');
        dotsC.children[currentSlide].classList.remove('active');
        thumbsC.children[currentSlide].classList.remove('active');
        currentSlide = idx;
        slides[currentSlide].classList.add('active');
        dotsC.children[currentSlide].classList.add('active');
        thumbsC.children[currentSlide].classList.add('active');
        // Scroll thumb into view
        thumbsC.children[currentSlide].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      document.getElementById('carouselPrev').addEventListener('click', function() {
        goToSlide((currentSlide - 1 + slides.length) % slides.length);
      });
      document.getElementById('carouselNext').addEventListener('click', function() {
        goToSlide((currentSlide + 1) % slides.length);
      });

      // Auto-advance every 4s
      var autoPlay = setInterval(function() { goToSlide((currentSlide + 1) % slides.length); }, 4000);
      document.getElementById('carouselWrapper').addEventListener('mouseenter', function() { clearInterval(autoPlay); });
      document.getElementById('carouselWrapper').addEventListener('mouseleave', function() {
        autoPlay = setInterval(function() { goToSlide((currentSlide + 1) % slides.length); }, 4000);
      });
    }

    /* ── Lightbox (click carousel image) ── */
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lb-img');
    slides.forEach(function(s) {
      s.querySelector('img').addEventListener('click', function() { lbImg.src = this.src; lb.classList.add('active'); });
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
    const newSiteName = `vedika360-${baseSlug}-${Date.now().toString(36)}`;
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
