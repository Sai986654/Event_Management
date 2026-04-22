/**
 * Seed surprise templates — run: node seeds/seed-surprise-templates.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const templates = [
  // ─── 1. Love Trap (classic viral) ──────────────────────────────
  {
    name: 'Love Trap 💕',
    description: 'The classic viral trap page — the No button dodges, shrinks, and vanishes while Yes keeps growing. Impossible to refuse!',
    category: 'proposal',
    tier: 'free',
    price: 0,
    sortOrder: 1,
    steps: [
      { type: 'intro', heading: 'Hey {{recipientName}} 💫', subtext: 'Someone has a question for you…', transition: 'fadeIn', delay: 2500, background: 'hearts' },
      { type: 'trap_button', heading: 'Do you like {{senderName}}?', yesText: 'Yes! 💕', noText: 'No 😤', noBehavior: 'dodge', noAlternateTexts: ['Are you sure?', 'Think again!', 'Really??', 'Last chance…'], background: 'hearts' },
      { type: 'trap_button', heading: 'Will you go on a date with {{senderName}}?', yesText: 'Absolutely! 🥰', noText: 'Hmm no', noBehavior: 'shrink', noAlternateTexts: ['Please? 🥺', 'Pretty please?', 'I\'ll be sad…'], background: 'sparkles' },
      { type: 'message', heading: 'One more thing…', text: 'I\'ve been wanting to ask you something special…', transition: 'slideUp', delay: 3000 },
      { type: 'trap_button', heading: 'Will you be mine forever? 💍', yesText: 'YES! 💖', noText: 'No', noBehavior: 'disappear', background: 'fireworks' },
      { type: 'final_reveal', heading: 'I love you, {{recipientName}} ❤️', text: '{{finalMessage}}', showPhotos: true, showVideo: true, confetti: true, background: 'gradient_love' },
    ],
  },

  // ─── 2. Fake Error Page ────────────────────────────────────────
  {
    name: 'Fake Error Surprise 🖥️',
    description: 'A convincing "404 Error" that glitches out and transforms into a birthday surprise. The progress bar loads "memories" from the crash dump!',
    category: 'birthday',
    tier: 'basic',
    price: 199,
    sortOrder: 2,
    steps: [
      { type: 'fake_scenario', scenario: 'error', heading: '⚠️ Critical Error: LOVE_OVERFLOW', text: 'Fatal exception at heart.exe — too many feelings detected.', fakeDetails: 'Error Code: 0xLOVE_0VERFL0W\nModule: heart.js:143\nStack: emotions.parse() → feelings.compile()\nRecommendation: Accept all love immediately', delay: 3500, background: 'night_sky' },
      { type: 'fake_scenario', scenario: 'loading', heading: 'Recovering lost memories…', text: 'Scanning photo archives…', progressBar: true, delay: 5000 },
      { type: 'message', heading: 'Wait… this isn\'t a crash 😏', text: 'The only error here is how long I waited to surprise you!', transition: 'glitch', delay: 2500 },
      { type: 'photo_reveal', heading: 'Files recovered from your heart drive 💾', layout: 'cascade', showPhotos: true },
      { type: 'final_reveal', heading: 'Happy Birthday, {{recipientName}}! 🎂🎈', text: '{{finalMessage}}', showVideo: true, confetti: true, background: 'party' },
    ],
  },

  // ─── 3. Memory Timeline ────────────────────────────────────────
  {
    name: 'Memory Timeline 📸',
    description: 'A cinematic scrolling timeline of your journey together — each photo fades in with a glowing dot. Ends with a voice message and heartfelt reveal.',
    category: 'anniversary',
    tier: 'basic',
    price: 199,
    sortOrder: 3,
    steps: [
      { type: 'intro', heading: 'Our Journey Together ✨', subtext: 'Scroll through our story, {{recipientName}}…', transition: 'fadeIn', background: 'stars' },
      { type: 'message', heading: 'It all started with a smile…', text: 'And every moment since has been better than the last.', delay: 3000, background: 'gradient_warm' },
      { type: 'timeline', heading: 'Our Moments', showPhotos: true, layout: 'timeline', autoScroll: true },
      { type: 'voice_message', heading: 'Press play… 🎧', text: 'I recorded something just for you.', playVoice: true },
      { type: 'final_reveal', heading: 'And the best chapters are still unwritten… 💕', text: '{{finalMessage}}', showVideo: true, confetti: true, background: 'gradient_warm' },
    ],
  },

  // ─── 4. Unlock Puzzle (Gamified) ───────────────────────────────
  {
    name: 'Unlock The Surprise 🔐',
    description: 'A gamified challenge — answer 3 personal questions to unlock the final surprise. Wrong answers get playful taunts. Only true love unlocks the vault!',
    category: 'proposal',
    tier: 'premium',
    price: 499,
    sortOrder: 4,
    steps: [
      { type: 'intro', heading: '🔒 This surprise is locked', subtext: 'Answer 3 questions to prove you know {{senderName}} well enough to unlock it…', transition: 'fadeIn', background: 'gold' },
      { type: 'quiz', heading: 'Challenge 1 of 3 🧩', question: 'Where did we first meet?', options: ['__placeholder__', '__placeholder__', '__placeholder__'], correctIndex: 0, wrongMessage: 'Wrong! Are you even paying attention? 😂', rightMessage: '🎉 You remember!! +1 unlock point!', background: 'gold' },
      { type: 'quiz', heading: 'Challenge 2 of 3 🧩', question: 'What\'s my favorite thing about you?', options: ['__placeholder__', '__placeholder__', '__placeholder__'], correctIndex: 0, wrongMessage: 'Nope! But everything about you is amazing 😏', rightMessage: '💕 You know me way too well!' },
      { type: 'quiz', heading: 'Challenge 3 of 3 🧩', question: 'What song reminds me of us?', options: ['__placeholder__', '__placeholder__', '__placeholder__'], correctIndex: 0, wrongMessage: 'Not that one! 🎵 But close…', rightMessage: '🎶 THAT\'S OUR SONG! Vault unlocked!' },
      { type: 'message', heading: '🔓 VAULT UNLOCKED!', text: 'You proved it — nobody knows us like you do.', transition: 'unlock', delay: 3000, background: 'gold' },
      { type: 'final_reveal', heading: '{{recipientName}}, this is for you ❤️', text: '{{finalMessage}}', showPhotos: true, showVideo: true, confetti: true, background: 'gold' },
    ],
  },

  // ─── 5. Midnight Surprise ──────────────────────────────────────
  {
    name: 'Midnight Surprise 🌙',
    description: 'A live countdown ticking to the exact second. The sky darkens, stars twinkle, and at zero — BOOM, confetti and your surprise explodes onto screen!',
    category: 'birthday',
    tier: 'basic',
    price: 199,
    sortOrder: 5,
    steps: [
      { type: 'countdown', heading: 'Something magical is coming… ⏳', subtext: 'Prepared for {{recipientName}} by {{senderName}}', countdownTo: '{{scheduledAt}}', background: 'night_sky' },
      { type: 'intro', heading: '🎉 IT\'S TIME!', subtext: 'The wait is over…', transition: 'burst', delay: 2000, background: 'fireworks' },
      { type: 'photo_reveal', heading: 'Memories that light up the night 🌟', layout: 'mosaic', showPhotos: true },
      { type: 'final_reveal', heading: 'Happy Birthday, {{recipientName}}! 🎂🌙', text: '{{finalMessage}}', showVideo: true, confetti: true, background: 'fireworks' },
    ],
  },

  // ─── 6. Apology ────────────────────────────────────────────────
  {
    name: "I'm Sorry 🥺",
    description: 'Starts with a rain effect and builds emotional tension. No confetti here — just raw sincerity, a dodge-button forgiveness ask, and a warm sunshine ending.',
    category: 'apology',
    tier: 'free',
    price: 0,
    sortOrder: 6,
    steps: [
      { type: 'intro', heading: '{{recipientName}}…', subtext: 'I need to say something.', transition: 'fadeIn', background: 'rain', delay: 3000 },
      { type: 'message', heading: 'I messed up.', text: 'And I know a webpage can\'t fix everything. But I wanted you to know how much you mean to me.', transition: 'slideUp', delay: 4500, background: 'rain' },
      { type: 'message', heading: 'You are my favorite person.', text: 'Every moment with you matters more than you\'ll ever know.', transition: 'fadeIn', delay: 4000 },
      { type: 'trap_button', heading: 'Will you forgive me? 🥺', yesText: 'Yes, I forgive you 💛', noText: 'Hmm…', noBehavior: 'dodge', noAlternateTexts: ['Please? 🥺', 'I promise I\'ll do better!', 'Give me one more chance…', 'I can\'t lose you…'], background: 'sunshine' },
      { type: 'final_reveal', heading: 'Thank you, {{recipientName}} 💛', text: '{{finalMessage}}', showPhotos: true, confetti: false, background: 'sunshine' },
    ],
  },

  // ─── 7. Congratulations ────────────────────────────────────────
  {
    name: 'Congratulations! 🏆',
    description: 'Dramatic 3-act build-up — suspense, disbelief, then EXPLOSIVE celebration! Gold confetti, bold text, maximum hype energy.',
    category: 'congratulations',
    tier: 'free',
    price: 0,
    sortOrder: 7,
    steps: [
      { type: 'intro', heading: 'Hey {{recipientName}} 👋', subtext: 'We heard some incredible news…', transition: 'fadeIn', delay: 2500 },
      { type: 'message', heading: 'Wait — is it true…?', text: 'You actually DID it?! 🤯', transition: 'slideUp', delay: 3000 },
      { type: 'message', heading: 'YES. IT. IS. 🔥', text: 'And everyone is SO proud of you!', transition: 'burst', delay: 2000, background: 'gold' },
      { type: 'photo_reveal', heading: 'The journey to greatness 📸', layout: 'cascade', showPhotos: true },
      { type: 'final_reveal', heading: 'You\'re a legend, {{recipientName}}! 🏆✨', text: '{{finalMessage}}', showPhotos: false, showVideo: true, confetti: true, background: 'gold' },
    ],
  },

  // ─── 8. Dare to Say Yes (Bold proposal) ────────────────────────
  {
    name: 'Dare to Say Yes? 💋',
    description: 'Bold and flirty — starts with a "dare" challenge, escalates through playful traps with shrinking/disappearing No buttons, ends with a dramatic proposal!',
    category: 'proposal',
    tier: 'premium',
    price: 499,
    sortOrder: 8,
    steps: [
      { type: 'intro', heading: 'I dare you to open this, {{recipientName}} 😏', subtext: 'Think you\'re brave enough?', transition: 'fadeIn', delay: 2000, background: 'gradient_love' },
      { type: 'trap_button', heading: 'Do you find {{senderName}} attractive?', yesText: 'Duh, obviously 😍', noText: 'Not really', noBehavior: 'dodge', noAlternateTexts: ['Liar! 😂', 'Your eyes say otherwise…', 'The button disagrees…'], background: 'gradient_love' },
      { type: 'message', heading: 'Okay hotshot, one more dare…', text: 'But this one\'s serious. Like, really serious.', delay: 3000, background: 'sparkles' },
      { type: 'trap_button', heading: 'Will you be mine? 💍✨', yesText: 'A MILLION TIMES YES! 💖', noText: 'Let me think…', noBehavior: 'disappear', noAlternateTexts: ['Too late, it\'s gone!'], background: 'fireworks' },
      { type: 'final_reveal', heading: 'You + Me = Forever 💋', text: '{{finalMessage}}', showPhotos: true, showVideo: true, confetti: true, background: 'gradient_love' },
    ],
  },

  // ─── 9. Prank & Reveal ─────────────────────────────────────────
  {
    name: 'Prank & Reveal 🤡',
    description: 'Start with a fake scary message ("we need to talk"), fake loading screen, a fake breakup scare — then PLOT TWIST, it\'s a surprise party!',
    category: 'birthday',
    tier: 'basic',
    price: 199,
    sortOrder: 9,
    steps: [
      { type: 'intro', heading: '{{recipientName}}, we need to talk.', subtext: 'It\'s important.', transition: 'fadeIn', delay: 3000, background: 'rain' },
      { type: 'message', heading: 'I\'ve been thinking a lot lately…', text: 'About us. About everything. And I\'ve made a decision.', delay: 4000, background: 'rain' },
      { type: 'fake_scenario', scenario: 'loading', heading: 'Loading the truth…', text: 'Preparing confession.exe', progressBar: true, delay: 5000 },
      { type: 'message', heading: '…I\'ve decided that…', text: '…you deserve the BIGGEST surprise ever! 🎉🎉🎉', transition: 'burst', delay: 2000, background: 'party' },
      { type: 'photo_reveal', heading: 'GOT YOU! 😂 Here are the real vibes:', showPhotos: true, layout: 'cascade' },
      { type: 'final_reveal', heading: 'HAPPY BIRTHDAY {{recipientName}}! 🎂🤡', text: '{{finalMessage}}', showVideo: true, confetti: true, background: 'party' },
    ],
  },

  // ─── 10. Letter From The Heart ─────────────────────────────────
  {
    name: 'Letter From The Heart 💌',
    description: 'An intimate digital love letter — slow fade-ins, gentle music, each message lingers. Like reading a real handwritten note, one page at a time.',
    category: 'anniversary',
    tier: 'free',
    price: 0,
    sortOrder: 10,
    steps: [
      { type: 'intro', heading: 'A letter for {{recipientName}} 💌', subtext: 'From the desk of {{senderName}}', transition: 'fadeIn', delay: 3000, background: 'gradient_love' },
      { type: 'message', heading: 'Dear {{recipientName}},', text: 'I wanted to write you something — not a text, not a DM — a real letter. So here it is.', delay: 5000, background: 'gradient_love' },
      { type: 'message', heading: 'Do you remember how we started?', text: 'That first conversation, the first laugh, the moment I knew you were different from everyone else.', delay: 5000, background: 'sparkles' },
      { type: 'message', heading: 'You changed everything.', text: 'The way I see mornings, the way I handle bad days, the reason I smile for no reason.', delay: 5000, background: 'hearts' },
      { type: 'voice_message', heading: 'I also recorded this for you…', text: 'Press play. Close your eyes. Just listen.', playVoice: true },
      { type: 'final_reveal', heading: 'Forever yours, {{senderName}} 💕', text: '{{finalMessage}}', showPhotos: true, confetti: false, background: 'gradient_love' },
    ],
  },

  // ─── 11. Treasure Hunt ─────────────────────────────────────────
  {
    name: 'Treasure Hunt 🗺️',
    description: 'A 3-clue treasure hunt — solve each riddle to advance. Wrong answers get funny reactions. The final treasure? Your surprise message!',
    category: 'birthday',
    tier: 'premium',
    price: 499,
    sortOrder: 11,
    steps: [
      { type: 'intro', heading: 'X marks the spot, {{recipientName}}! 🗺️', subtext: '{{senderName}} has hidden a treasure for you. Solve 3 clues to find it!', transition: 'fadeIn', background: 'gold' },
      { type: 'quiz', heading: 'Clue #1 🧭', question: 'I\'m something you and {{senderName}} share. I\'m not a secret, but only you two know it best. What am I?', options: ['__placeholder__', '__placeholder__', '__placeholder__'], correctIndex: 0, wrongMessage: 'Wrong map! Try another path 🗺️', rightMessage: '🎯 First clue solved! Onwards…', background: 'gold' },
      { type: 'quiz', heading: 'Clue #2 🧭', question: '{{senderName}} thinks about this every day. It starts with Y-O-U. What is it?', options: ['__placeholder__', '__placeholder__', '__placeholder__'], correctIndex: 0, wrongMessage: 'Dead end! Rethink your route 😅', rightMessage: '⭐ Two down, one to go!' },
      { type: 'quiz', heading: 'Final Clue 🧭', question: 'The treasure is hidden in a place made of love. Where is it?', options: ['__placeholder__', '__placeholder__', '__placeholder__'], correctIndex: 0, wrongMessage: 'So close! One more try… 🔍', rightMessage: '🏴‍☠️ TREASURE FOUND!' },
      { type: 'photo_reveal', heading: 'You found the treasure chest! 📷', showPhotos: true, layout: 'mosaic' },
      { type: 'final_reveal', heading: 'The real treasure is YOU, {{recipientName}} 💎', text: '{{finalMessage}}', showVideo: true, confetti: true, background: 'gold' },
    ],
  },

  // ─── 12. Friendship Bomb ───────────────────────────────────────
  {
    name: 'Friendship Bomb 🫶',
    description: 'For your bestie — starts with "I have a complaint about you", builds fake tension, then EXPLODES with love. Perfect for best friend birthdays!',
    category: 'congratulations',
    tier: 'free',
    price: 0,
    sortOrder: 12,
    steps: [
      { type: 'intro', heading: '{{recipientName}}, I have a complaint. 😤', subtext: 'And I\'ve been holding it in for too long.', transition: 'fadeIn', delay: 3000, background: 'rain' },
      { type: 'message', heading: 'My complaint is…', text: '…that you\'re TOO amazing and it\'s honestly unfair to everyone else. 😤💕', delay: 3500, transition: 'slideUp', background: 'sparkles' },
      { type: 'message', heading: 'Seriously though…', text: 'You\'re the kind of person who makes everyone around you better. And I\'m lucky to know you.', delay: 4000, background: 'hearts' },
      { type: 'trap_button', heading: 'Are we best friends forever? 🫶', yesText: 'FOREVER! 🫶', noText: 'Maybe…', noBehavior: 'dodge', noAlternateTexts: ['You can\'t escape friendship! 😂', 'Too late, we\'re bonded!', 'The button won\'t let you leave 🤣'], background: 'party' },
      { type: 'final_reveal', heading: 'Love you, {{recipientName}}! 🫶🎉', text: '{{finalMessage}}', showPhotos: true, showVideo: true, confetti: true, background: 'party' },
    ],
  },

  // ─── 13. The Big Reveal ────────────────────────────────────────
  {
    name: 'The Big Reveal 🎬',
    description: 'Movie trailer vibes — dramatic dark intro, suspenseful text, a fake "loading classified files" sequence, then the BIG announcement with cinematic flair!',
    category: 'other',
    tier: 'basic',
    price: 199,
    sortOrder: 13,
    steps: [
      { type: 'intro', heading: 'CLASSIFIED', subtext: 'This message is for {{recipientName}}\'s eyes only.', transition: 'fadeIn', delay: 3000, background: 'night_sky' },
      { type: 'fake_scenario', scenario: 'loading', heading: 'Decrypting message…', text: 'Verifying identity: {{recipientName}}', progressBar: true, delay: 5000, background: 'night_sky' },
      { type: 'message', heading: 'Identity confirmed. ✅', text: 'You are authorized to view the following.', delay: 2500, background: 'night_sky' },
      { type: 'message', heading: 'THE ANNOUNCEMENT IS…', text: '…well, you\'ll have to see it to believe it.', delay: 3000, transition: 'slideUp' },
      { type: 'photo_reveal', heading: 'Exhibit A: The Evidence 📁', showPhotos: true, layout: 'cascade' },
      { type: 'final_reveal', heading: '{{recipientName}}, HERE IT IS! 🎬🔥', text: '{{finalMessage}}', showVideo: true, confetti: true, background: 'fireworks' },
    ],
  },
];

async function seed() {
  console.log('🎉 Seeding surprise templates...');

  for (const t of templates) {
    const existing = await prisma.surpriseTemplate.findFirst({
      where: { name: t.name },
    });

    if (existing) {
      await prisma.surpriseTemplate.update({
        where: { id: existing.id },
        data: t,
      });
      console.log(`  ✅ Updated: ${t.name}`);
    } else {
      await prisma.surpriseTemplate.create({ data: t });
      console.log(`  ✅ Created: ${t.name}`);
    }
  }

  console.log(`\n🎉 Done! ${templates.length} templates seeded.`);
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
