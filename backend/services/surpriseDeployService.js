/**
 * Surprise Deploy Service
 * -----------------------
 * Generates self-contained interactive HTML for surprise pages
 * and deploys via smart fallback: Netlify → R2 → Internal
 */
const { createHash } = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');

const NETLIFY_API_BASE = 'https://api.netlify.com/api/v1';

// ── Helpers ────────────────────────────────────────────────────────

const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const interpolate = (text, vars) => {
  if (!text) return '';
  return text
    .replace(/\{\{recipientName\}\}/g, escHtml(vars.recipientName || ''))
    .replace(/\{\{senderName\}\}/g, escHtml(vars.senderName || ''))
    .replace(/\{\{finalMessage\}\}/g, escHtml(vars.finalMessage || ''))
    .replace(/\{\{scheduledAt\}\}/g, vars.scheduledAt || '');
};

const bgGradients = {
  hearts: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  sparkles: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  fireworks: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)',
  stars: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  night_sky: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  party: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  gradient_love: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
  gradient_warm: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  gold: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  sunshine: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  rain: 'linear-gradient(135deg, #616161 0%, #9bc5c3 100%)',
};

const categoryEmoji = {
  proposal: '💍', birthday: '🎂', anniversary: '💕',
  apology: '💛', congratulations: '🎉', other: '✨',
};

// ── HTML Generator ─────────────────────────────────────────────────

const generateSurpriseHtml = (page, opts = {}) => {
  const {
    recipientName, senderName, finalMessage, steps, photos, musicUrl,
    videoUrl, voiceMessageUrl, title, category, scheduledAt, slug,
  } = page;

  const vars = { recipientName, senderName, finalMessage, scheduledAt };
  const trackingApiBase = opts.apiBaseUrl || 'https://event-management-9i4d.onrender.com/api';
  const emoji = categoryEmoji[category] || '✨';
  const photoJson = JSON.stringify(photos || []);
  const stepsJson = JSON.stringify((steps || []).map(step => ({
    ...step,
    heading: interpolate(step.heading, vars),
    subtext: step.subtext ? interpolate(step.subtext, vars) : undefined,
    text: step.text ? interpolate(step.text, vars) : undefined,
    question: step.question ? interpolate(step.question, vars) : undefined,
  })));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<title>${escHtml(title || 'A Surprise For You')}</title>
<meta name="description" content="${escHtml(senderName)} has a special surprise for ${escHtml(recipientName)} ✨"/>
<meta property="og:title" content="${escHtml(title || 'Someone has a surprise for you!')}"/>
<meta property="og:description" content="${escHtml(senderName)} created something special for ${escHtml(recipientName)} ${emoji}"/>
<meta property="og:type" content="website"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;overflow:hidden;height:100vh;width:100vw;color:#fff}
.screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;transition:background .8s ease;overflow:hidden}
h1,h2{font-family:'Playfair Display',Georgia,serif;text-shadow:0 2px 20px rgba(0,0,0,.3)}
.heading-xl{font-size:clamp(1.8rem,6vw,2.8rem);font-weight:700;text-align:center;margin-bottom:12px;animation:fadeInUp 1s ease-out}
.heading-lg{font-size:clamp(1.4rem,5vw,2rem);font-weight:700;text-align:center;margin-bottom:12px;animation:fadeInUp .8s ease-out}
.subtext{font-size:clamp(14px,3.5vw,18px);color:rgba(255,255,255,.85);text-align:center;max-width:400px;line-height:1.6}
.body-text{font-size:clamp(14px,3.5vw,16px);color:rgba(255,255,255,.85);text-align:center;max-width:440px;line-height:1.7;margin-bottom:16px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 36px;border-radius:30px;font-size:16px;font-weight:600;border:none;cursor:pointer;transition:transform .2s,box-shadow .2s;font-family:inherit}
.btn:hover{transform:scale(1.05)}
.btn-yes{background:linear-gradient(135deg,#43e97b,#38f9d7);color:#1a1a2e;box-shadow:0 4px 20px rgba(67,233,123,.4)}
.btn-no{background:rgba(255,255,255,.15);color:#fff;border:2px solid rgba(255,255,255,.4);backdrop-filter:blur(6px)}
.btn-next{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;box-shadow:0 4px 16px rgba(102,126,234,.4);margin-top:24px}
.btn-start{background:rgba(255,255,255,.15);color:#fff;border:2px solid rgba(255,255,255,.5);backdrop-filter:blur(10px);padding:16px 44px;font-size:18px;animation:pulse 2s ease infinite}
.btn-row{display:flex;gap:20px;margin-top:32px;flex-wrap:wrap;justify-content:center;align-items:center}
.taunt{color:rgba(255,255,255,.7);margin-top:16px;font-size:14px;animation:fadeInUp .4s ease}
.mono{font-family:monospace;font-size:12px;color:rgba(255,255,255,.4);max-width:400px;text-align:left;margin:16px auto;white-space:pre-line}
.progress-bg{width:80%;max-width:400px;height:8px;background:rgba(255,255,255,.2);border-radius:4px;margin:20px auto 0;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,#43e97b,#38f9d7);border-radius:4px;transition:width .2s;width:0}
.photo-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:20px 0}
.photo-grid img{width:120px;height:120px;object-fit:cover;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,.3)}
.photo-grid.final img{width:90px;height:90px;border-radius:10px}
.quiz-opts{display:flex;flex-direction:column;gap:10px;margin-top:20px;width:100%;max-width:350px}
.quiz-btn{padding:14px 20px;border-radius:12px;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:15px;cursor:pointer;transition:background .3s,transform .2s;font-family:inherit}
.quiz-btn:hover{background:rgba(255,255,255,.25)}
.quiz-btn.correct{background:#52c41a}
.quiz-btn.wrong{background:#ff4d4f}
.quiz-feedback{margin-top:12px;font-size:15px;animation:fadeInUp .4s ease}
.countdown-row{display:flex;gap:20px;margin-top:32px}
.cd-box{text-align:center}
.cd-num{font-size:clamp(36px,10vw,56px);font-weight:700;text-shadow:0 4px 20px rgba(0,0,0,.4);line-height:1}
.cd-label{color:rgba(255,255,255,.6);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
.timeline{padding-left:24px;text-align:left;margin:20px auto;max-width:400px;position:relative}
.timeline::before{content:'';position:absolute;left:5px;top:0;bottom:0;width:2px;background:rgba(255,255,255,.4)}
.tl-item{margin-bottom:20px;position:relative}
.tl-dot{position:absolute;left:-22px;top:4px;width:12px;height:12px;border-radius:50%;background:#fff}
.tl-item img{width:100%;max-width:260px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,.3)}
video{width:100%;max-width:460px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.4);margin-top:20px}
.dots{position:fixed;bottom:16px;left:0;right:0;display:flex;justify-content:center;gap:6px;z-index:10}
.dot{width:8px;height:8px;border-radius:4px;background:rgba(255,255,255,.3);transition:all .3s}
.dot.active{width:24px;background:#fff}
.dot.done{background:rgba(255,255,255,.7)}
.reactions{position:fixed;bottom:50px;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:10}
.reactions button{font-size:28px;background:rgba(255,255,255,.2);border:none;border-radius:50%;width:52px;height:52px;cursor:pointer;backdrop-filter:blur(6px);transition:transform .2s}
.reactions button:hover{transform:scale(1.2)}
.hearts{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.heart{position:absolute;bottom:-40px;font-size:20px;animation:floatUp 6s ease-in infinite;opacity:.5}
@keyframes floatUp{0%{transform:translateY(0);opacity:0}10%{opacity:.6}100%{transform:translateY(-110vh) rotate(360deg);opacity:0}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,255,255,.4)}50%{transform:scale(1.05);box-shadow:0 0 0 20px rgba(255,255,255,0)}}
.confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:999}
.cp{position:absolute;top:-20px;width:10px;height:10px;animation:confettiFall linear infinite}
@keyframes confettiFall{0%{top:-20px;opacity:1;transform:rotate(0) translateX(0)}100%{top:110vh;opacity:0;transform:rotate(720deg) translateX(80px)}}
.hidden{display:none!important}
</style>
</head>
<body>

<!-- Floating Hearts Background -->
<div class="hearts" id="hearts"></div>

<!-- Audio -->
${musicUrl ? `<audio id="bgMusic" src="${escHtml(musicUrl)}" loop preload="auto"></audio>` : ''}

<!-- Main Screen -->
<div class="screen" id="screen">
  <!-- Start Screen (rendered by JS) -->
</div>

<!-- Progress Dots -->
<div class="dots" id="dots"></div>

<!-- Reaction Buttons (shown on final step) -->
<div class="reactions hidden" id="reactions">
  <button onclick="react('loved_it')">😍</button>
  <button onclick="react('cried')">😭</button>
  <button onclick="react('melted')">🥰</button>
  <button onclick="react('laughed')">😂</button>
</div>

<script>
(function(){
  var STEPS = ${stepsJson};
  var PHOTOS = ${photoJson};
  var VIDEO_URL = ${JSON.stringify(videoUrl || '')};
  var VOICE_URL = ${JSON.stringify(voiceMessageUrl || '')};
  var MUSIC_URL = ${JSON.stringify(musicUrl || '')};
  var SCHEDULED_AT = ${JSON.stringify(scheduledAt || '')};
  var RECIPIENT = ${JSON.stringify(recipientName || '')};
  var SENDER = ${JSON.stringify(senderName || '')};
  var SLUG = ${JSON.stringify(slug || '')};
  var CATEGORY = ${JSON.stringify(category || 'other')};
  var EMOJI = ${JSON.stringify(emoji)};
  var API_BASE = ${JSON.stringify(trackingApiBase)};
  var SESSION_ID = 'sess_' + Math.random().toString(36).substring(2,15);
  var currentStep = -1; // -1 = start screen
  var screen = document.getElementById('screen');
  var dotsEl = document.getElementById('dots');
  var reactionEl = document.getElementById('reactions');

  // ── Floating Hearts ──
  var heartsEl = document.getElementById('hearts');
  for(var i=0;i<15;i++){
    var h = document.createElement('span');
    h.className = 'heart';
    h.textContent = '💕';
    h.style.left = Math.random()*100+'%';
    h.style.fontSize = (16+Math.random()*16)+'px';
    h.style.animationDuration = (4+Math.random()*6)+'s';
    h.style.animationDelay = Math.random()*5+'s';
    heartsEl.appendChild(h);
  }

  // ── Confetti ──
  function showConfetti(){
    var c = document.createElement('div');c.className='confetti';
    var colors = ['#f44336','#e91e63','#9c27b0','#3f51b5','#2196f3','#4caf50','#ffeb3b','#ff9800','#ff5722'];
    for(var i=0;i<50;i++){
      var p = document.createElement('div');p.className='cp';
      p.style.left = Math.random()*100+'%';
      p.style.background = colors[i%colors.length];
      p.style.borderRadius = Math.random()>.5?'50%':'2px';
      p.style.animationDuration = (2+Math.random()*3)+'s';
      p.style.animationDelay = Math.random()*2+'s';
      c.appendChild(p);
    }
    document.body.appendChild(c);
  }

  // ── Tracking ──
  function track(stepReached, completed, reaction){
    try{
      var body = JSON.stringify({sessionId:SESSION_ID,stepReached:stepReached,completed:!!completed,reaction:reaction||null});
      navigator.sendBeacon ? navigator.sendBeacon(API_BASE+'/surprises/view/'+SLUG+'/interact',new Blob([body],{type:'application/json'}))
        : fetch(API_BASE+'/surprises/view/'+SLUG+'/interact',{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true});
    }catch(e){}
  }

  // ── Background ──
  var BG = ${JSON.stringify(bgGradients)};
  function setBg(name){screen.style.background = BG[name]||BG.hearts||'linear-gradient(135deg,#667eea,#764ba2)'}

  // ── Dots ──
  function renderDots(){
    dotsEl.innerHTML = '';
    for(var i=0;i<STEPS.length;i++){
      var d = document.createElement('div');d.className='dot';
      if(i===currentStep) d.classList.add('active');
      else if(i<currentStep) d.classList.add('done');
      dotsEl.appendChild(d);
    }
  }

  // ── Next Step ──
  function nextStep(){
    currentStep++;
    if(currentStep >= STEPS.length){ currentStep = STEPS.length-1; return; }
    track(currentStep, currentStep >= STEPS.length-1);
    renderStep(STEPS[currentStep]);
    renderDots();
  }

  // ── Render Step ──
  function renderStep(step){
    screen.innerHTML = '';
    setBg(step.background);
    reactionEl.classList.add('hidden');

    switch(step.type){
      case 'intro': renderIntro(step); break;
      case 'trap_button': renderTrap(step); break;
      case 'message': renderMessage(step); break;
      case 'fake_scenario': renderFake(step); break;
      case 'photo_reveal': renderPhotoReveal(step); break;
      case 'timeline': renderTimeline(step); break;
      case 'voice_message': renderVoice(step); break;
      case 'quiz': renderQuiz(step); break;
      case 'countdown': renderCountdown(step); break;
      case 'final_reveal': renderFinal(step); break;
      default: renderMessage(step);
    }
  }

  // ── Step Renderers ──

  function renderIntro(step){
    screen.innerHTML = '<h1 class="heading-xl">'+step.heading+'</h1>'
      +(step.subtext?'<p class="subtext">'+step.subtext+'</p>':'')
      +(step.delay?'':'<button class="btn btn-next" onclick="window.__next()">Continue ✨</button>');
    if(step.delay) setTimeout(nextStep, step.delay);
  }

  function renderTrap(step){
    var noTexts = step.noAlternateTexts||[];
    var noCount = 0;
    var behavior = step.noBehavior||'dodge';

    var html = '<h2 class="heading-lg">'+step.heading+'</h2><div class="btn-row">'
      +'<button class="btn btn-yes" id="yesBtn" onclick="window.__next()">'+step.yesText+'</button>'
      +'<button class="btn btn-no" id="noBtn">'+step.noText+'</button>'
      +'</div><div id="tauntArea"></div>';
    screen.innerHTML = html;

    var noBtn = document.getElementById('noBtn');
    var yesBtn = document.getElementById('yesBtn');
    var taunt = document.getElementById('tauntArea');

    noBtn.addEventListener('click', function(){
      noCount++;
      // grow yes button
      var s = Math.min(1.5, 1+noCount*.1);
      yesBtn.style.transform = 'scale('+s+')';

      if(behavior==='dodge'){
        noBtn.style.transform = 'translate('+(Math.random()-.5)*250+'px,'+(Math.random()-.5)*180+'px)';
        noBtn.style.transition = 'transform .3s ease';
      } else if(behavior==='shrink'){
        var ns = Math.max(.2, 1-noCount*.25);
        noBtn.style.transform = 'scale('+ns+')';
        noBtn.style.transition = 'transform .3s ease';
        if(ns<=.2) noBtn.style.display='none';
      } else if(behavior==='disappear'){
        noBtn.style.display='none';
      }
      if(noCount<=noTexts.length) noBtn.textContent = noTexts[noCount-1]||step.noText;
      taunt.innerHTML = '<p class="taunt">'+(noCount===1?'Hmm, you clicked No? 🤨':noCount===2?'Really?? 😅':'The No button is giving up… 😂')+'</p>';
    });

    // On touch devices, handle touchstart for dodge
    if(behavior==='dodge'){
      noBtn.addEventListener('touchstart', function(e){
        e.preventDefault();
        noBtn.click();
      },{passive:false});
    }
  }

  function renderMessage(step){
    screen.innerHTML = '<h2 class="heading-lg">'+step.heading+'</h2>'
      +(step.text?'<p class="body-text">'+step.text+'</p>':'')
      +(step.delay?'':'<button class="btn btn-next" onclick="window.__next()">Next →</button>');
    if(step.delay) setTimeout(nextStep, step.delay);
  }

  function renderFake(step){
    screen.innerHTML = '<h2 class="heading-lg" style="'+(step.scenario==='error'?'color:#ff4d4f':'')+'">'
      +step.heading+'</h2><p class="body-text">'+step.text+'</p>'
      +(step.fakeDetails?'<pre class="mono">'+step.fakeDetails+'</pre>':'')
      +(step.progressBar?'<div class="progress-bg"><div class="progress-fill" id="pFill"></div></div>':'');

    if(step.progressBar){
      var p=0,fill=document.getElementById('pFill');
      var iv=setInterval(function(){
        p+=2;fill.style.width=p+'%';
        if(p>=100){clearInterval(iv);setTimeout(nextStep,500)}
      },step.delay?step.delay/50:80);
    } else if(step.delay){
      setTimeout(nextStep, step.delay);
    }
  }

  function renderPhotoReveal(step){
    var html = '<h2 class="heading-lg">'+step.heading+'</h2><div class="photo-grid">';
    PHOTOS.forEach(function(u,i){html+='<img src="'+u+'" alt="Memory '+(i+1)+'" style="animation:fadeInUp .5s ease '+(i*.2)+'s both"/>'});
    html+='</div><button class="btn btn-next" onclick="window.__next()">Continue 💕</button>';
    screen.innerHTML = html;
  }

  function renderTimeline(step){
    var html = '<h2 class="heading-lg">'+step.heading+'</h2><div class="timeline">';
    PHOTOS.forEach(function(u,i){
      html+='<div class="tl-item" style="animation:fadeInUp .5s ease '+(i*.3)+'s both"><div class="tl-dot"></div><img src="'+u+'" alt="Memory '+(i+1)+'"/></div>';
    });
    html+='</div><button class="btn btn-next" onclick="window.__next()">Continue 💕</button>';
    screen.innerHTML = html;
  }

  function renderVoice(step){
    screen.innerHTML = '<h2 class="heading-lg">'+step.heading+'</h2>'
      +(step.text?'<p class="body-text">'+step.text+'</p>':'')
      +(VOICE_URL?'<audio controls src="'+VOICE_URL+'" style="margin-top:20px;max-width:100%"></audio>':'')
      +'<button class="btn btn-next" onclick="window.__next()">Continue 💕</button>';
  }

  function renderQuiz(step){
    var html = '<p class="subtext" style="opacity:.6">'+step.heading+'</p>'
      +'<h2 class="heading-lg">'+step.question+'</h2><div class="quiz-opts" id="qOpts">';
    (step.options||[]).forEach(function(opt,i){
      html+='<button class="quiz-btn" data-idx="'+i+'">'+opt+'</button>';
    });
    html+='</div><div id="qFeedback"></div>';
    screen.innerHTML = html;

    document.getElementById('qOpts').addEventListener('click',function(e){
      var btn = e.target.closest('.quiz-btn'); if(!btn) return;
      var idx = parseInt(btn.dataset.idx);
      document.querySelectorAll('.quiz-btn').forEach(function(b){b.disabled=true});
      if(idx===step.correctIndex){
        btn.classList.add('correct');
        document.getElementById('qFeedback').innerHTML='<p class="quiz-feedback">'+(step.rightMessage||'Correct!')+'</p>';
        setTimeout(nextStep, 2000);
      } else {
        btn.classList.add('wrong');
        document.getElementById('qFeedback').innerHTML='<p class="quiz-feedback">'+(step.wrongMessage||'Try again!')+'</p>';
        setTimeout(function(){
          btn.classList.remove('wrong');
          document.querySelectorAll('.quiz-btn').forEach(function(b){b.disabled=false});
          document.getElementById('qFeedback').innerHTML='';
        },1500);
      }
    });
  }

  function renderCountdown(step){
    var target = SCHEDULED_AT ? new Date(SCHEDULED_AT) : null;
    if(!target || target<=new Date()){nextStep();return}
    screen.innerHTML = '<h2 class="heading-lg">'+step.heading+'</h2>'
      +(step.subtext?'<p class="subtext">'+step.subtext+'</p>':'')
      +'<div class="countdown-row"><div class="cd-box"><span class="cd-num" id="cdH">--</span><span class="cd-label">Hours</span></div>'
      +'<div class="cd-box"><span class="cd-num" id="cdM">--</span><span class="cd-label">Minutes</span></div>'
      +'<div class="cd-box"><span class="cd-num" id="cdS">--</span><span class="cd-label">Seconds</span></div></div>';
    var iv=setInterval(function(){
      var diff=target-new Date();
      if(diff<=0){clearInterval(iv);nextStep();return}
      document.getElementById('cdH').textContent=String(Math.floor(diff/36e5)).padStart(2,'0');
      document.getElementById('cdM').textContent=String(Math.floor(diff%36e5/6e4)).padStart(2,'0');
      document.getElementById('cdS').textContent=String(Math.floor(diff%6e4/1e3)).padStart(2,'0');
    },1000);
  }

  function renderFinal(step){
    if(step.confetti) showConfetti();
    var html = '<h1 class="heading-xl">'+step.heading+'</h1>'
      +(step.text?'<p class="body-text" style="font-size:clamp(16px,4vw,20px);line-height:1.8">'+step.text+'</p>':'');
    if(step.showPhotos && PHOTOS.length){
      html+='<div class="photo-grid final">';
      PHOTOS.forEach(function(u,i){html+='<img src="'+u+'" alt="Memory '+(i+1)+'" style="animation:fadeInUp .5s ease '+(i*.15)+'s both"/>'});
      html+='</div>';
    }
    if(step.showVideo && VIDEO_URL) html+='<video controls src="'+VIDEO_URL+'"></video>';
    screen.innerHTML = html;
    reactionEl.classList.remove('hidden');
    track(STEPS.length, true);
  }

  // ── Start Screen ──
  function showStart(){
    setBg('hearts');
    screen.innerHTML = '<div style="font-size:64px;margin-bottom:16px">'+EMOJI+'</div>'
      +'<h1 class="heading-xl">Hey '+RECIPIENT+' ✨</h1>'
      +'<p class="subtext">Someone has prepared something special for you…</p>'
      +'<button class="btn btn-start" onclick="window.__start()" style="margin-top:40px">💕 Open Your Surprise</button>';
    dotsEl.innerHTML = '';
  }

  window.__next = nextStep;
  window.__start = function(){
    currentStep = -1;
    nextStep();
    var audio = document.getElementById('bgMusic');
    if(audio) audio.play().catch(function(){});
  };
  window.react = function(r){
    track(STEPS.length, true, r);
    var btns = reactionEl.querySelectorAll('button');
    btns.forEach(function(b){b.style.opacity='.4'});
    event.target.style.opacity='1';event.target.style.transform='scale(1.3)';
  };

  showStart();
})();
</script>

<!-- Tracking pixel for view count -->
<img src="${trackingApiBase}/surprises/view/${escHtml(slug)}/pixel" width="1" height="1" style="position:absolute;opacity:0" alt=""/>

</body>
</html>`;
};

// ── Deploy Strategies ──────────────────────────────────────────────

/**
 * Deploy to Netlify — premium tier.
 */
const deployToNetlify = async (page, html) => {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) return null; // not configured, skip

  const hash = createHash('sha1').update(html).digest('hex');
  let siteId = page.deploySiteId || null;
  let siteUrl = page.deployedUrl || null;
  let siteName = null;

  // Reuse existing site or create new
  if (siteId) {
    const checkRes = await fetch(`${NETLIFY_API_BASE}/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      siteName = existing.name;
      siteUrl = existing.ssl_url || existing.url || siteUrl;
    } else {
      siteId = null;
    }
  }

  if (!siteId) {
    const baseSlug = String(page.slug || 'surprise').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 42);
    const newName = `vedika360-surprise-${baseSlug}`;
    const teamSlug = process.env.NETLIFY_TEAM_SLUG || '';
    const query = teamSlug ? `?account_slug=${encodeURIComponent(teamSlug)}` : '';

    const createRes = await fetch(`${NETLIFY_API_BASE}/sites${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });

    if (!createRes.ok) return null; // failed, fall through
    const site = await createRes.json();
    siteId = site.id;
    siteName = site.name;
    siteUrl = site.ssl_url || site.url;
  }

  // Deploy HTML
  const deployRes = await fetch(`${NETLIFY_API_BASE}/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { '/index.html': hash }, draft: false }),
  });
  if (!deployRes.ok) return null;
  const deploy = await deployRes.json();

  const uploadRes = await fetch(`${NETLIFY_API_BASE}/deploys/${deploy.id}/files/index.html`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  });
  if (!uploadRes.ok) return null;

  return { target: 'netlify', siteId, siteUrl, siteName };
};

/**
 * Deploy to Cloudflare R2 — standard tier.
 */
const deployToR2 = async (page, html) => {
  if (!R2_BUCKET || !R2_PUBLIC_URL) return null; // not configured

  const key = `surprises/${page.slug}/index.html`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(html, 'utf-8'),
      ContentType: 'text/html; charset=utf-8',
      CacheControl: 'public, max-age=3600',
    })
  );

  const url = `${R2_PUBLIC_URL}/${key}`;
  return { target: 'r2', siteId: key, siteUrl: url };
};

/**
 * Internal fallback — just mark as active, served from /surprise/:slug on frontend.
 */
const deployInternal = (page) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://vedika360.vercel.app';
  return {
    target: 'internal',
    siteId: page.slug,
    siteUrl: `${baseUrl}/surprise/${page.slug}`,
  };
};

// ── Smart Deploy (tiered fallback) ─────────────────────────────────

/**
 * Deploy a surprise page with smart fallback chain.
 * Premium/Ultimate → Netlify first → R2 → internal
 * Basic → R2 first → internal
 * Free → internal
 *
 * @param {string} preferredTarget - 'auto' | 'netlify' | 'r2' | 'internal'
 */
const deploySurprisePage = async (page, preferredTarget = 'auto') => {
  const html = generateSurpriseHtml(page, {
    apiBaseUrl: process.env.API_BASE_URL || 'https://event-management-9i4d.onrender.com/api',
  });

  // If user explicitly chose a target, try that first
  if (preferredTarget === 'netlify') {
    const result = await deployToNetlify(page, html);
    if (result) return result;
  }
  if (preferredTarget === 'r2') {
    const result = await deployToR2(page, html);
    if (result) return result;
  }
  if (preferredTarget === 'internal') {
    return deployInternal(page);
  }

  // Auto mode — tier-based fallback chain
  const tier = page.tier || 'free';

  if (tier === 'ultimate' || tier === 'premium') {
    // Try Netlify → R2 → Internal
    const netlifyResult = await deployToNetlify(page, html);
    if (netlifyResult) return netlifyResult;

    const r2Result = await deployToR2(page, html);
    if (r2Result) return r2Result;

    return deployInternal(page);
  }

  if (tier === 'basic') {
    // Try R2 → Internal
    const r2Result = await deployToR2(page, html);
    if (r2Result) return r2Result;

    return deployInternal(page);
  }

  // Free → Internal only
  return deployInternal(page);
};

module.exports = {
  generateSurpriseHtml,
  deploySurprisePage,
};
