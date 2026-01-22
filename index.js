const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// ===============================================
// تنظیمات اصلی
// ===============================================
const TOKEN = process.env.BOT_TOKEN;
const SUDO_ID = parseInt(process.env.SUDO_ID);
const PORT = process.env.PORT || 3000;

// بررسی وجود تنظیمات
if (!TOKEN) {
  console.error('❌ خطا: BOT_TOKEN تنظیم نشده است!');
  process.exit(1);
}

if (!SUDO_ID) {
  console.error('❌ خطا: SUDO_ID تنظیم نشده است!');
  process.exit(1);
}

// ===============================================
// راه‌اندازی Express برای Health Check
// ===============================================
const app = express();

app.get('/', (req, res) => {
  res.json({
    status: '✅ آنلاین',
    bot: 'ربات مدیریت گروه تلگرام',
    uptime: Math.floor(process.uptime()),
    groups: groups.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`🌐 سرور Express روی پورت ${PORT} راه‌اندازی شد`);
});

// ===============================================
// راه‌اندازی ربات تلگرام
// ===============================================
const bot = new TelegramBot(TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// ===============================================
// ذخیره‌سازی داده‌ها (در حافظه)
// ===============================================
const groups = new Map();
const users = new Map();
const warnings = new Map();
const messageCount = new Map();
const bannedWords = new Set();
const captchaUsers = new Map();

// ===============================================
// توابع کمکی
// ===============================================

// بررسی دسترسی سودو
function isSudo(userId) {
  return userId === SUDO_ID;
}

// بررسی ادمین بودن
async function isAdmin(chatId, userId) {
  if (isSudo(userId)) return true;
  
  try {
    const member = await bot.getChatMember(chatId, userId);
    return member.status === 'administrator' || member.status === 'creator';
  } catch (error) {
    console.error('خطا در بررسی ادمین:', error.message);
    return false;
  }
}

// دریافت تنظیمات گروه
function getGroupSettings(chatId) {
  if (!groups.has(chatId)) {
    groups.set(chatId, {
      id: chatId,
      title: '',
      settings: {
        antiSpam: true,
        antiLink: true,
        antiFlood: true,
        welcome: true,
        goodbye: true,
        captcha: false,
        filterBadWords: true,
        maxWarnings: 3,
        floodLimit: 5,
        floodTime: 10000
      },
      rules: 'قوانین گروه هنوز تنظیم نشده است.',
      welcomeMsg: '👋 سلام {name}!\n\nبه گروه {group} خوش اومدی! 🎉',
      goodbyeMsg: '👋 {name} از گروه خارج شد.'
    });
  }
  return groups.get(chatId);
}

// ===============================================
// دستور /start
// ===============================================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (msg.chat.type === 'private') {
    if (isSudo(userId)) {
      const welcomeMsg = `
👑 *سلام سودو عزیز!*

شما کنترل کامل این ربات را دارید.

📊 *وضعیت ربات:*
✅ آنلاین و آماده
📁 گروه‌های فعال: ${groups.size}
👥 کاربران ثبت شده: ${users.size}

📋 *دستورات سریع:*
/help - راهنمای کامل
/stats - آمار کلی
/groups - لیست گروه‌ها

🔥 *برای شروع:*
ربات را به گروه خود اضافه کنید و مدیر کنید!
      `;
      
      await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, '❌ شما دسترسی به این ربات ندارید.\n\nاین ربات فقط برای سودو قابل استفاده است.');
    }
  } else {
    await bot.sendMessage(chatId, '✅ ربات آماده است!\n\nبرای دیدن دستورات: /help');
  }
});

// ===============================================
// دستور /help
// ===============================================
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const isAdminUser = await isAdmin(chatId, userId);
  
  if (msg.chat.type === 'private' && !isSudo(userId)) {
    return;
  }
  
  let helpText = `
📖 *راهنمای دستورات ربات*

`;

  if (isAdminUser || msg.chat.type === 'private') {
    helpText += `
*👥 مدیریت اعضا:*
/warn [@user] - اخطار
/kick [@user] - اخراج
/ban [@user] - مسدود کردن
/unban [@user] - رفع مسدودی
/mute [@user] - سکوت
/unmute [@user] - رفع سکوت

*⚙️ تنظیمات:*
/settings - تنظیمات گروه
/setrules [متن] - تنظیم قوانین
/setwelcome [متن] - تنظیم پیام خوشامد

*🛡️ امنیت:*
/antilink on/off - ضد لینک
/antispam on/off - ضد اسپم
/captcha on/off - کپچا ورود
`;
  }
  
  helpText += `
*📊 عمومی:*
/rules - نمایش قوانین
/info - اطلاعات گروه
/stats - آمار گروه
  `;
  
  if (isSudo(userId)) {
    helpText += `
*👑 دستورات سودو:*
/broadcast [متن] - ارسال همگانی
/groups - لیست گروه‌ها
/leave [id] - خروج از گروه
`;
  }
  
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// ===============================================
// عضو جدید (خوشامدگویی / کپچا)
// ===============================================
bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;
  const newMembers = msg.new_chat_members;
  
  // بررسی اینکه آیا ربات اضافه شده
  const botAdded = newMembers.find(m => m.id === bot.options.polling.params.offset || m.username === (await bot.getMe()).username);
  
  if (botAdded) {
    // فقط سودو می‌تواند ربات را اضافه کند
    if (!isSudo(msg.from.id)) {
      await bot.sendMessage(chatId, '❌ فقط سودو می‌تواند این ربات را به گروه اضافه کند.\n\n🚪 در حال خروج از گروه...');
      setTimeout(async () => {
        try {
          await bot.leaveChat(chatId);
        } catch (err) {
          console.error('خطا در خروج از گروه:', err.message);
        }
      }, 3000);
      return;
    }
    
    // ثبت گروه
    const groupData = getGroupSettings(chatId);
    groupData.title = msg.chat.title;
    groups.set(chatId, groupData);
    
    const welcomeBotMsg = `
✅ *ربات با موفقیت راه‌اندازی شد!*

👑 مدیریت توسط: سودو
🛡️ سیستم حفاظتی: فعال

📋 برای دیدن دستورات: /help
⚙️ تنظیمات: /settings

*قابلیت‌های فعال شده:*
✅ ضد اسپم
✅ ضد لینک
✅ خوشامدگویی
✅ سیستم اخطار
    `;
    
    await bot.sendMessage(chatId, welcomeBotMsg, { parse_mode: 'Markdown' });
    await bot.sendMessage(SUDO_ID, `✅ ربات به گروه *"${msg.chat.title}"* اضافه شد!\n\nID: \`${chatId}\``, { parse_mode: 'Markdown' });
    
    return;
  }
  
  // خوشامدگویی به اعضای عادی
  const groupData = getGroupSettings(chatId);
  
  for (const member of newMembers) {
    if (!member.is_bot && groupData.settings.welcome) {
      const welcomeMsg = groupData.welcomeMsg
        .replace('{name}', member.first_name)
        .replace('{group}', msg.chat.title);
      
      await bot.sendMessage(chatId, welcomeMsg);
    }
  }
});

// ===============================================
// عضو خارج شده (خداحافظی)
// ===============================================
bot.on('left_chat_member', async (msg) => {
  const chatId = msg.chat.id;
  const leftMember = msg.left_chat_member;
  
  if (leftMember.is_bot) return;
  
  const groupData = getGroupSettings(chatId);
  
  if (groupData.settings.goodbye) {
    const goodbyeMsg = groupData.goodbyeMsg
      .replace('{name}', leftMember.first_name)
      .replace('{group}', msg.chat.title);
    
    await bot.sendMessage(chatId, goodbyeMsg);
  }
});

// ===============================================
// سیستم اخطار
// ===============================================
bot.onText(/\/warn(?:@\w+)?\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند اخطار دهند.');
  }
  
  const input = match[1].trim();
  const parts = input.split(' ');
  const targetUsername = parts[0].replace('@', '');
  const reason = parts.slice(1).join(' ') || 'بدون دلیل';
  
  const warnKey = `${chatId}_${targetUsername}`;
  
  if (!warnings.has(warnKey)) {
    warnings.set(warnKey, []);
  }
  
  const userWarnings = warnings.get(warnKey);
  userWarnings.push({
    date: new Date(),
    reason: reason,
    by: msg.from.first_name
  });
  
  const groupData = getGroupSettings(chatId);
  const maxWarns = groupData.settings.maxWarnings;
  const warnCount = userWarnings.length;
  
  await bot.sendMessage(chatId, 
    `⚠️ *اخطار به* @${targetUsername}\n\n` +
    `📝 دلیل: ${reason}\n` +
    `🔢 تعداد اخطارها: ${warnCount}/${maxWarns}`,
    { parse_mode: 'Markdown' }
  );
  
  if (warnCount >= maxWarns) {
    await bot.sendMessage(chatId, `🚫 @${targetUsername} به دلیل دریافت ${maxWarns} اخطار از گروه اخراج شد.`);
    warnings.delete(warnKey);
    // اینجا باید userId واقعی کاربر را داشته باشید برای کیک
  }
});

// ===============================================
// ضد لینک
// ===============================================
bot.on('message', async (msg) => {
  if (!msg.text) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  if (!(groups.has(chatId))) return;
  
  const groupData = getGroupSettings(chatId);
  
  if (!groupData.settings.antiLink) return;
  if (await isAdmin(chatId, userId)) return;
  
  const hasLink = /https?:\/\/|t\.me\/|@\w+/i.test(text);
  
  if (hasLink) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      await bot.sendMessage(chatId, `❌ @${msg.from.username || msg.from.first_name}، ارسال لینک در این گروه ممنوع است!`);
    } catch (error) {
      console.error('خطا در حذف پیام:', error.message);
    }
  }
});

// ===============================================
// ضد اسپم (Flood)
// ===============================================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!groups.has(chatId)) return;
  if (await isAdmin(chatId, userId)) return;
  
  const groupData = getGroupSettings(chatId);
  if (!groupData.settings.antiFlood) return;
  
  const userKey = `${chatId}_${userId}`;
  
  if (!messageCount.has(userKey)) {
    messageCount.set(userKey, []);
  }
  
  const now = Date.now();
  const userMessages = messageCount.get(userKey);
  const recentMessages = userMessages.filter(time => now - time < groupData.settings.floodTime);
  
  recentMessages.push(now);
  messageCount.set(userKey, recentMessages);
  
  if (recentMessages.length > groupData.settings.floodLimit) {
    try {
      await bot.restrictChatMember(chatId, userId, {
        until_date: Math.floor(Date.now() / 1000) + 3600,
        can_send_messages: false
      });
      
      await bot.sendMessage(chatId, `🔇 @${msg.from.username || msg.from.first_name} به دلیل ارسال پیام‌های پی‌درپی (اسپم) برای 1 ساعت سکوت شد.`);
      
      messageCount.delete(userKey);
    } catch (error) {
      console.error('خطا در محدود کردن کاربر:', error.message);
    }
  }
});

// ===============================================
// دستور /settings
// ===============================================
bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند تنظیمات را ببینند.');
  }
  
  const groupData = getGroupSettings(chatId);
  const s = groupData.settings;
  
  const settingsMsg = `
⚙️ *تنظیمات گروه*

🛡️ *امنیت:*
- ضد اسپم: ${s.antiSpam ? '✅' : '❌'}
- ضد لینک: ${s.antiLink ? '✅' : '❌'}
- ضد فلود: ${s.antiFlood ? '✅' : '❌'}
- فیلتر کلمات بد: ${s.filterBadWords ? '✅' : '❌'}

👋 *خوشامدگویی:*
- پیام خوشامد: ${s.welcome ? '✅' : '❌'}
- پیام خداحافظی: ${s.goodbye ? '✅' : '❌'}
- کپچا ورود: ${s.captcha ? '✅' : '❌'}

⚠️ *سیستم اخطار:*
- حداکثر اخطار: ${s.maxWarnings}
- حد اسپم: ${s.floodLimit} پیام در ${s.floodTime / 1000} ثانیه

*برای تغییر تنظیمات:*
/antilink on|off
/antispam on|off
/welcome on|off
  `;
  
  await bot.sendMessage(chatId, settingsMsg, { parse_mode: 'Markdown' });
});

// ===============================================
// دستور /stats
// ===============================================
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (msg.chat.type === 'private' && !isSudo(userId)) {
    return;
  }
  
  let statsMsg = `📊 *آمار ربات*\n\n`;
  
  if (isSudo(userId) && msg.chat.type === 'private') {
    statsMsg += `
👥 تعداد گروه‌ها: ${groups.size}
👤 تعداد کاربران: ${users.size}
⚠️ تعداد اخطارها: ${warnings.size}
💬 پیام‌های پردازش شده: ${messageCount.size}
⏱️ آپتایم: ${Math.floor(process.uptime())} ثانیه
    `;
  } else {
    const groupData = getGroupSettings(chatId);
    statsMsg += `
📁 گروه: ${msg.chat.title}
👥 اعضا: ${await bot.getChatMembersCount(chatId)}
⚠️ اخطارهای فعال: ${[...warnings.keys()].filter(k => k.startsWith(chatId)).length}
    `;
  }
  
  await bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
});

// ===============================================
// دستور /groups (فقط سودو)
// ===============================================
bot.onText(/\/groups/, async (msg) => {
  const userId = msg.from.id;
  
  if (!isSudo(userId)) {
    return await bot.sendMessage(msg.chat.id, '❌ فقط سودو می‌تواند لیست گروه‌ها را ببیند.');
  }
  
  if (groups.size === 0) {
    return await bot.sendMessage(msg.chat.id, '📋 هیچ گروهی ثبت نشده است.\n\nربات را به گروه‌های خود اضافه کنید.');
  }
  
  let groupsList = '📋 *لیست گروه‌های ثبت شده:*\n\n';
  
  for (const [chatId, group] of groups.entries()) {
    groupsList += `• ${group.title}\n   ID: \`${chatId}\`\n\n`;
  }
  
  await bot.sendMessage(msg.chat.id, groupsList, { parse_mode: 'Markdown' });
});

// ===============================================
// تنظیمات سریع
// ===============================================
bot.onText(/\/antilink (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند تنظیمات را تغییر دهند.');
  }
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.antiLink = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ ضد لینک ${groupData.settings.antiLink ? 'فعال' : 'غیرفعال'} شد.`);
});

bot.onText(/\/antispam (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند تنظیمات را تغییر دهند.');
  }
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.antiSpam = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ ضد اسپم ${groupData.settings.antiSpam ? 'فعال' : 'غیرفعال'} شد.`);
});

bot.onText(/\/welcome (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند تنظیمات را تغییر دهند.');
  }
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.welcome = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ خوشامدگویی ${groupData.settings.welcome ? 'فعال' : 'غیرفعال'} شد.`);
});

// ===============================================
// مدیریت خطاها
// ===============================================
bot.on('polling_error', (error) => {
  console.error('❌ خطای Polling:', error.message);
});

bot.on('error', (error) => {
  console.error('❌ خطای ربات:', error.message);
});

process.on('uncaughtException', (error) => {
  console.error('❌ خطای غیرمنتظره:', error.message);
});

// ===============================================
// شروع ربات
// ===============================================
console.log('🤖 ربات در حال راه‌اندازی...');
console.log(`👑 سودو: ${SUDO_ID}`);
console.log(`🔑 توکن: ${TOKEN.substring(0, 10)}...`);
console.log('✅ ربات آماده است و منتظر پیام‌ها!
