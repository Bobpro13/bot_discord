// OwO Bot Captcha Guard - Standalone Discord Bot
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // REQUIRED: Enable in Discord Developer Portal -> Bot -> Privileged Gateway Intents
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

const OWO_BOT_ID = process.env.OWO_BOT_ID || '408785106942164992';
const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const PING_IN_CHANNEL = process.env.PING_IN_CHANNEL !== 'false';
const DM_USER = process.env.DM_USER !== 'false';

// Keywords that indicate an OwO captcha
const CAPTCHA_TRIGGERS = [
  'are you a human?',
  'beep boop',
  'please complete your captcha',
  'please complete the captcha',
  'verify that you are human',
  'verification',
  'type the following characters',
  'owobot.com/captcha',
  'banned from using commands',
  'please dm me',
  'solve the captcha',
  'anti-bot',
];

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log(`🛡️ Guarding ${client.guilds.cache.size} server(s) for OwO captchas.`);
  console.log(`🎯 Target User ID to ping: ${TARGET_USER_ID || 'Anyone mentioned'}`);
});

client.on('messageCreate', async (message) => {
  try {
    // 1. Only check messages from OwO bot
    const isOwo = message.author.id === OWO_BOT_ID || message.author.username.toLowerCase() === 'owo';
    if (!isOwo) return;

    const content = message.content.toLowerCase();
    const attachments = Array.from(message.attachments.values());
    const hasImage = attachments.some((a) => a.contentType?.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(a.name));

    let isCaptcha = false;
    let triggerReason = '';

    for (const phrase of CAPTCHA_TRIGGERS) {
      if (content.includes(phrase)) {
        isCaptcha = true;
        triggerReason = phrase;
        break;
      }
    }

    // Check embeds if content didn't match
    if (!isCaptcha && message.embeds.length > 0) {
      for (const embed of message.embeds) {
        const text = `${embed.title || ''} ${embed.description || ''}`.toLowerCase();
        for (const phrase of CAPTCHA_TRIGGERS) {
          if (text.includes(phrase)) {
            isCaptcha = true;
            triggerReason = `Embed: ${phrase}`;
            break;
          }
        }
        if (isCaptcha) break;
      }
    }

    // Direct message check
    if (!isCaptcha && message.channel.type === ChannelType.DM && hasImage) {
      isCaptcha = true;
      triggerReason = 'DM with image attachment';
    }

    if (!isCaptcha) return;

    // Check if target user is relevant
    const isTarget = TARGET_USER_ID
      ? message.mentions.users.has(TARGET_USER_ID) || content.includes(TARGET_USER_ID) || message.channel.type === ChannelType.DM
      : true;

    if (!isTarget) return;

    console.log(`🚨 CAPTCHA DETECTED in #${message.channel.name || 'DM'} (${triggerReason})`);

    // 2. Dispatch Channel Ping
    if (PING_IN_CHANNEL && message.guild && 'send' in message.channel) {
      const mention = TARGET_USER_ID ? `<@${TARGET_USER_ID}> ` : '';
      await message.channel.send({
        content: `${mention}🚨 **[OwO CAPTCHA ALERT]** An OwO verification has appeared! Solve it now to prevent a ban!\n🔗 **Jump to message:** ${message.url}`,
        allowedMentions: TARGET_USER_ID ? { users: [TARGET_USER_ID] } : { parse: ['users'] },
      }).catch(err => console.warn('Channel send failed:', err.message));
    }

    // 3. Dispatch via Discord Webhook (Zero Permissions Required)
    if (WEBHOOK_URL && WEBHOOK_URL.startsWith('http')) {
      try {
        const mention = TARGET_USER_ID ? `<@${TARGET_USER_ID}> ` : '@everyone ';
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `${mention}🚨 **[OwO CAPTCHA DETECTED]** In **#${message.channel.name || 'channel'}**!\n🔗 **Jump:** ${message.url}`,
            embeds: [{
              title: '🚨 OwO Captcha Alert',
              description: `**Reason:** ${triggerReason}\n**Channel:** #${message.channel.name || 'DM'}\n🔗 [Jump to Message](${message.url})`,
              color: 0xef4444,
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch (whErr) {
        console.warn('Webhook dispatch failed:', whErr.message);
      }
    }

    // 4. Dispatch Direct Message (DM)
    if (DM_USER && TARGET_USER_ID) {
      try {
        const user = await client.users.fetch(TARGET_USER_ID);
        if (user) {
          await user.send(
            `🚨 **[URGENT OwO CAPTCHA DETECTED]**\n` +
            `Server: **${message.guild?.name || 'Direct Messages'}**\n` +
            `Channel: **#${message.channel.name || 'DM'}**\n` +
            `Trigger: **${triggerReason}**\n` +
            `🔗 **Jump to message:** ${message.url}\n\n` +
            `*Solve it immediately in Discord to prevent a ban!*`
          );
        }
      } catch (dmErr) {
        console.warn('Could not send DM to target user:', dmErr.message);
      }
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

// Login
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ Error: DISCORD_BOT_TOKEN is not set in .env');
  process.exit(1);
}

client.login(token);
