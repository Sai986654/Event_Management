/**
 * Seed surprise templates — run: node seeds/seed-surprise-templates.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const templates = [
  // ─── 1. Love Trap (Proposal) ───────────────────────────────────
  {
    name: 'Love Trap 💕',
    description: 'The classic viral "will you be mine?" trap page. The No button runs away!',
    category: 'proposal',
    tier: 'free',
    price: 0,
    sortOrder: 1,
    steps: [
      {
        type: 'intro',
        heading: 'Hey {{recipientName}} 💫',
        subtext: 'Someone has a question for you…',
        transition: 'fadeIn',
        delay: 2000,
      },
      {
        type: 'trap_button',
        heading: 'Do you like {{senderName}}?',
        yesText: 'Yes! 💕',
        noText: 'No 😤',
        noBehavior: 'dodge', // button moves away on hover
        noAlternateTexts: ['Are you sure?', 'Think again!', 'Really??', 'Last chance…'],
        background: 'hearts',
      },
      {
        type: 'trap_button',
        heading: 'Will you go on a date with {{senderName}}?',
        yesText: 'Absolutely! 🥰',
        noText: 'Hmm no',
        noBehavior: 'shrink', // button shrinks
        noAlternateTexts: ['Please? 🥺', 'Pretty please?', 'I\'ll be sad…'],
        background: 'sparkles',
      },
      {
        type: 'message',
        heading: 'One more thing…',
        text: 'I\'ve been wanting to ask you something special…',
        transition: 'slideUp',
        delay: 3000,
      },
      {
        type: 'trap_button',
        heading: 'Will you be mine forever? 💍',
        yesText: 'YES! 💖',
        noText: 'No',
        noBehavior: 'disappear', // button vanishes
        background: 'fireworks',
      },
      {
        type: 'final_reveal',
        heading: 'I love you, {{recipientName}} ❤️',
        text: '{{finalMessage}}',
        showPhotos: true,
        showVideo: true,
        confetti: true,
        background: 'gradient_love',
      },
    ],
  },

  // ─── 2. Fake Error Page (Surprise) ─────────────────────────────
  {
    name: 'Fake Error Surprise 🖥️',
    description: 'Starts as a system error, transforms into a heartfelt surprise reveal.',
    category: 'birthday',
    tier: 'basic',
    price: 199,
    sortOrder: 2,
    steps: [
      {
        type: 'fake_scenario',
        scenario: 'error',
        heading: '⚠️ System Error 404',
        text: 'Something went wrong while loading your birthday surprise…',
        fakeDetails: 'Error Code: LOVE_OVERFLOW\nStack trace: heart.js line 143',
        delay: 3000,
      },
      {
        type: 'fake_scenario',
        scenario: 'loading',
        heading: 'Attempting to recover…',
        text: 'Loading memories…',
        progressBar: true,
        delay: 4000,
      },
      {
        type: 'message',
        heading: 'Wait… this isn\'t an error',
        text: 'This was a setup all along! 😏',
        transition: 'glitch',
        delay: 2000,
      },
      {
        type: 'photo_reveal',
        heading: 'Look what we found in the recovery files…',
        layout: 'cascade',
        showPhotos: true,
      },
      {
        type: 'final_reveal',
        heading: 'Happy Birthday, {{recipientName}}! 🎂',
        text: '{{finalMessage}}',
        showVideo: true,
        confetti: true,
        background: 'party',
      },
    ],
  },

  // ─── 3. Memory Timeline ────────────────────────────────────────
  {
    name: 'Memory Timeline 📸',
    description: 'A beautiful scrolling timeline of your journey together, ending with a special message.',
    category: 'anniversary',
    tier: 'basic',
    price: 199,
    sortOrder: 3,
    steps: [
      {
        type: 'intro',
        heading: 'Our Journey Together ✨',
        subtext: 'Scroll through our memories, {{recipientName}}',
        transition: 'fadeIn',
        background: 'stars',
      },
      {
        type: 'timeline',
        heading: 'Where it all began…',
        showPhotos: true,
        layout: 'timeline',
        autoScroll: true,
      },
      {
        type: 'voice_message',
        heading: 'Listen to this…',
        text: 'I recorded something special for you',
        playVoice: true,
      },
      {
        type: 'final_reveal',
        heading: 'And the journey continues… 💕',
        text: '{{finalMessage}}',
        showVideo: true,
        confetti: true,
        background: 'gradient_warm',
      },
    ],
  },

  // ─── 4. Unlock Puzzle (Gamified) ───────────────────────────────
  {
    name: 'Unlock The Surprise 🔐',
    description: 'Answer personal questions to unlock the final surprise. Gamified and engaging!',
    category: 'proposal',
    tier: 'premium',
    price: 499,
    sortOrder: 4,
    steps: [
      {
        type: 'intro',
        heading: 'Hey {{recipientName}} 🔒',
        subtext: 'A surprise is locked behind 3 questions. Can you unlock it?',
        transition: 'fadeIn',
      },
      {
        type: 'quiz',
        heading: 'Question 1/3',
        question: 'Where did we first meet?',
        options: ['__placeholder__', '__placeholder__', '__placeholder__'],
        correctIndex: 0,
        wrongMessage: 'Hmm, that\'s not right! Try again 💭',
        rightMessage: '🎉 Correct! You remember!',
      },
      {
        type: 'quiz',
        heading: 'Question 2/3',
        question: 'What\'s my favorite thing about you?',
        options: ['__placeholder__', '__placeholder__', '__placeholder__'],
        correctIndex: 0,
        wrongMessage: 'Nope! But everything about you is amazing 😊',
        rightMessage: '💕 You know me so well!',
      },
      {
        type: 'quiz',
        heading: 'Question 3/3',
        question: 'What song reminds me of us?',
        options: ['__placeholder__', '__placeholder__', '__placeholder__'],
        correctIndex: 0,
        wrongMessage: 'Not that one! But close 🎵',
        rightMessage: '🎶 That\'s our song!',
      },
      {
        type: 'message',
        heading: '🔓 Surprise Unlocked!',
        text: 'You proved you know us well. Here\'s your reward…',
        transition: 'unlock',
        delay: 3000,
      },
      {
        type: 'final_reveal',
        heading: '{{recipientName}}, I love you ❤️',
        text: '{{finalMessage}}',
        showPhotos: true,
        showVideo: true,
        confetti: true,
        background: 'gold',
      },
    ],
  },

  // ─── 5. Midnight Surprise ──────────────────────────────────────
  {
    name: 'Midnight Surprise 🌙',
    description: 'A countdown page that reveals the surprise exactly at the scheduled time.',
    category: 'birthday',
    tier: 'basic',
    price: 199,
    sortOrder: 5,
    steps: [
      {
        type: 'countdown',
        heading: 'Something special is coming… ⏳',
        subtext: 'For {{recipientName}}',
        countdownTo: '{{scheduledAt}}',
        background: 'night_sky',
      },
      {
        type: 'intro',
        heading: '🎉 The moment is here!',
        subtext: '{{senderName}} has something for you…',
        transition: 'burst',
        delay: 2000,
      },
      {
        type: 'photo_reveal',
        heading: 'Memories that made us smile',
        layout: 'mosaic',
        showPhotos: true,
      },
      {
        type: 'final_reveal',
        heading: 'Happy Birthday, {{recipientName}}! 🎂🎈',
        text: '{{finalMessage}}',
        showVideo: true,
        confetti: true,
        background: 'fireworks',
      },
    ],
  },

  // ─── 6. Apology / Sorry Page ───────────────────────────────────
  {
    name: 'I\'m Sorry 🥺',
    description: 'A heartfelt apology page with emotional progression and sincerity.',
    category: 'apology',
    tier: 'free',
    price: 0,
    sortOrder: 6,
    steps: [
      {
        type: 'intro',
        heading: '{{recipientName}}…',
        subtext: 'I need to tell you something.',
        transition: 'fadeIn',
        background: 'rain',
        delay: 3000,
      },
      {
        type: 'message',
        heading: 'I messed up.',
        text: 'And I know a page can\'t fix everything. But I wanted you to know…',
        transition: 'slideUp',
        delay: 4000,
      },
      {
        type: 'message',
        heading: 'You mean everything to me.',
        text: 'Every moment with you matters more than you know.',
        transition: 'fadeIn',
        delay: 4000,
      },
      {
        type: 'trap_button',
        heading: 'Will you forgive me? 🥺',
        yesText: 'Yes, I forgive you 💕',
        noText: 'Hmm…',
        noBehavior: 'dodge',
        noAlternateTexts: ['Please? 🥺', 'I\'ll do better!', 'Give me a chance…'],
      },
      {
        type: 'final_reveal',
        heading: 'Thank you, {{recipientName}} 💛',
        text: '{{finalMessage}}',
        showPhotos: true,
        confetti: false,
        background: 'sunshine',
      },
    ],
  },

  // ─── 7. Congratulations ────────────────────────────────────────
  {
    name: 'Congratulations! 🏆',
    description: 'Celebrate achievements with a dramatic build-up and confetti reveal.',
    category: 'congratulations',
    tier: 'free',
    price: 0,
    sortOrder: 7,
    steps: [
      {
        type: 'intro',
        heading: 'Hey {{recipientName}} 👋',
        subtext: 'We heard some news…',
        transition: 'fadeIn',
        delay: 2000,
      },
      {
        type: 'message',
        heading: 'Is it true…?',
        text: 'That you actually did it?! 🤯',
        transition: 'slideUp',
        delay: 3000,
      },
      {
        type: 'message',
        heading: 'YES. IT. IS. 🎉',
        text: 'And we couldn\'t be more proud!',
        transition: 'burst',
        delay: 2000,
      },
      {
        type: 'final_reveal',
        heading: 'Congratulations, {{recipientName}}! 🏆✨',
        text: '{{finalMessage}}',
        showPhotos: true,
        showVideo: true,
        confetti: true,
        background: 'gold',
      },
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
