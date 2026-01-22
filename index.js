const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// تنظیمات اصلی
const TOKEN = process.env.BOT_TOKEN;
const SUDO_ID = parseInt(process.env.SUDO_ID);
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error('❌ خطا: BOT_TOKEN تنظیم نشده است!');
  process.exit(1);
}

if (!SUDO_ID) {
  console.error('❌ خطا: SUDO_ID تنظیم نشده است!');
  process.exit(1);
}

// راه‌اندازی Express
const app = express();

app.get('/', (req, res) => {
  res.json({
    status: '✅ آنلاین',
    bot: 'ربات مدیریت گروه تلگرام',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 سرور Express روی پورت ${PORT} راه‌اندازی شد`);
});

// راه‌اندازی ربات
const bot = new TelegramBot(TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

// ذخیره داده‌ها
const groups = new Map();
const users = new Map();
const warnings = new Map();
const messageCount = new Map();

// دریافت اطلاعات ربات یکبار در شروع
let botInfo = null;
bot.getMe().then(info => {
  botInfo = info;
  console.log(`✅ ربات راه‌اندازی شد: @${info.username}`);
}).catch(err => {
  console.error('❌ خطا در دریافت اطلاعات ربات:', err.message);
  process.exit(1);
});

// توابع کمکی
function isSudo(userId) {
  return userId === SUDO_ID;
}

async function isAdmin(chatId, userId) {
  if (isSudo(userId)) return true;
  try {
    const member = await bot.getChatMember(chatId, userId);
    return member.status === 'administrator' || member.status === 'creator';
  } catch (error) {
    return false;
  }
}

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
        maxWarnings: 3,
        floodLimit: 5,
        floodTime: 10000
      },
      welcomeMsg: '👋 سلام {name}!\n\nبه گروه {group} خوش اومدی! 🎉',
      goodbyeMsg: '👋 {name} از گروه خارج شد.'
    });
  }
  return groups.get(chatId);
}

// دستور /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (msg.chat.type === 'private') {
    if (isSudo(userId)) {
      await bot.sendMessage(chatId, 
        `👑 *سلام سودو عزیز!*\n\n` +
        `شما کنترل کامل این ربات را دارید.\n\n` +
        `📊 *وضعیت:*\n` +
        `✅ آنلاین\n` +
        `📁 گروه‌ها: ${groups.size}\n\n` +
        `📋 دستورات: /help`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId, '❌ شما دسترسی به این ربات ندارید.');
    }
  } else {
    await bot.sendMessage(chatId, '✅ ربات آماده است!\n\n/help - دستورات');
  }
});

// دستور /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdminUser = await isAdmin(chatId, userId);
  
  if (msg.chat.type === 'private' && !isSudo(userId)) return;
  
  let helpText = `📖 *راهنمای دستورات*\n\n`;
  
  if (isAdminUser || msg.chat.type === 'private') {
    helpText += `*👥 مدیریت:*\n` +
      `/warn @user - اخطار\n` +
      `/kick @user - اخراج\n` +
      `/ban @user - مسدود\n` +
      `/mute @user - سکوت\n\n` +
      `*⚙️ تنظیمات:*\n` +
      `/settings - تنظیمات گروه\n` +
      `/antilink on/off - ضد لینک\n` +
      `/antispam on/off - ضد اسپم\n\n`;
  }
  
  helpText += `*📊 عمومی:*\n/stats - آمار\n/rules - قوانین`;
  
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// عضو جدید
bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;
  const newMembers = msg.new_chat_members;
  
  if (!botInfo) return;
  
  // بررسی اضافه شدن ربات
  const botAdded = newMembers.find(m => m.is_bot && m.username === botInfo.username);
  
  if (botAdded) {
    if (!isSudo(msg.from.id)) {
      await bot.sendMessage(chatId, '❌ فقط سودو می‌تواند ربات را اضافه کند.\n\n🚪 خروج از گروه...');
      setTimeout(() => bot.leaveChat(chatId), 3000);
      return;
    }
    
    const groupData = getGroupSettings(chatId);
    groupData.title = msg.chat.title;
    
    await bot.sendMessage(chatId, 
      `✅ *ربات راه‌اندازی شد!*\n\n` +
      `👑 مدیر: سودو\n` +
      `📋 دستورات: /help\n\n` +
      `*قابلیت‌ها:*\n` +
      `✅ ضد اسپم\n` +
      `✅ ضد لینک\n` +
      `✅ خوشامدگویی`,
      { parse_mode: 'Markdown' }
    );
    
    await bot.sendMessage(SUDO_ID, `✅ ربات به "${msg.chat.title}" اضافه شد!`);
    return;
  }
  
  // خوشامدگویی به اعضای جدید
  const groupData = getGroupSettings(chatId);
  if (groupData.settings.welcome) {
    for (const member of newMembers) {
      if (!member.is_bot) {
        const welcomeMsg = groupData.welcomeMsg
          .replace('{name}', member.first_name)
          .replace('{group}', msg.chat.title);
        await bot.sendMessage(chatId, welcomeMsg);
      }
    }
  }
});

// عضو خارج شده
bot.on('left_chat_member', async (msg) => {
  const chatId = msg.chat.id;
  const leftMember = msg.left_chat_member;
  
  if (leftMember.is_bot) return;
  
  const groupData = getGroupSettings(chatId);
  if (groupData.settings.goodbye) {
    const goodbyeMsg = groupData.goodbyeMsg.replace('{name}', leftMember.first_name);
    await bot.sendMessage(chatId, goodbyeMsg);
  }
});

// سیستم اخطار
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
  if (!warnings.has(warnKey)) warnings.set(warnKey, []);
  
  const userWarnings = warnings.get(warnKey);
  userWarnings.push({ date: new Date(), reason });
  
  const groupData = getGroupSettings(chatId);
  const warnCount = userWarnings.length;
  
  await bot.sendMessage(chatId, 
    `⚠️ *اخطار به @${targetUsername}*\n\n` +
    `دلیل: ${reason}\n` +
    `تعداد: ${warnCount}/${groupData.settings.maxWarnings}`,
    { parse_mode: 'Markdown' }
  );
  
  if (warnCount >= groupData.settings.maxWarnings) {
    await bot.sendMessage(chatId, `🚫 @${targetUsername} به دلیل ${warnCount} اخطار اخراج شد.`);
    warnings.delete(warnKey);
  }
});

// ضد لینک
bot.on('message', async (msg) => {
  if (!msg.text || !groups.has(msg.chat.id)) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const groupData = getGroupSettings(chatId);
  
  if (!groupData.settings.antiLink || await isAdmin(chatId, userId)) return;
  
  if (/https?:\/\/|t\.me\/|@\w+/i.test(msg.text)) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      await bot.sendMessage(chatId, `❌ @${msg.from.username || msg.from.first_name}، لینک ممنوع است!`);
    } catch (err) {
      console.error('خطا در حذف پیام:', err.message);
    }
  }
});

// ضد اسپم
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!groups.has(chatId) || await isAdmin(chatId, userId)) return;
  
  const groupData = getGroupSettings(chatId);
  if (!groupData.settings.antiFlood) return;
  
  const userKey = `${chatId}_${userId}`;
  if (!messageCount.has(userKey)) messageCount.set(userKey, []);
  
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
      await bot.sendMessage(chatId, `🔇 @${msg.from.username || msg.from.first_name} به دلیل اسپم 1 ساعت سکوت شد.`);
      messageCount.delete(userKey);
    } catch (err) {
      console.error('خطا در محدود کردن:', err.message);
    }
  }
});

// دستور /settings
bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند تنظیمات را ببینند.');
  }
  
  const groupData = getGroupSettings(chatId);
  const s = groupData.settings;
  
  await bot.sendMessage(chatId,
    `⚙️ *تنظیمات گروه*\n\n` +
    `🛡️ ضد اسپم: ${s.antiSpam ? '✅' : '❌'}\n` +
    `🔗 ضد لینک: ${s.antiLink ? '✅' : '❌'}\n` +
    `💬 ضد فلود: ${s.antiFlood ? '✅' : '❌'}\n` +
    `👋 خوشامد: ${s.welcome ? '✅' : '❌'}\n` +
    `⚠️ حداکثر اخطار: ${s.maxWarnings}\n\n` +
    `*تغییر:* /antilink on|off`,
    { parse_mode: 'Markdown' }
  );
});

// دستور /stats
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (msg.chat.type === 'private' && !isSudo(userId)) return;
  
  let statsMsg = `📊 *آمار*\n\n`;
  
  if (isSudo(userId) && msg.chat.type === 'private') {
    statsMsg += `گروه‌ها: ${groups.size}\n` +
      `کاربران: ${users.size}\n` +
      `اخطارها: ${warnings.size}\n` +
      `آپتایم: ${Math.floor(process.uptime())}s`;
  } else {
    const memberCount = await bot.getChatMembersCount(chatId);
    statsMsg += `اعضا: ${memberCount}\n` +
      `اخطارها: ${[...warnings.keys()].filter(k => k.startsWith(chatId)).length}`;
  }
  
  await bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
});

// دستور /groups
bot.onText(/\/groups/, async (msg) => {
  if (!isSudo(msg.from.id)) return;
  
  if (groups.size === 0) {
    return await bot.sendMessage(msg.chat.id, '📋 هیچ گروهی ثبت نشده است.');
  }
  
  let list = '📋 *گروه‌ها:*\n\n';
  for (const [chatId, group] of groups.entries()) {
    list += `• ${group.title}\n   ID: \`${chatId}\`\n\n`;
  }
  
  await bot.sendMessage(msg.chat.id, list, { parse_mode: 'Markdown' });
});

// تنظیمات سریع
bot.onText(/\/antilink (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) return;
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.antiLink = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ ضد لینک ${groupData.settings.antiLink ? 'فعال' : 'غیرفعال'} شد.`);
});

bot.onText(/\/antispam (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) return;
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.antiSpam = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ ضد اسپم ${groupData.settings.antiSpam ? 'فعال' : 'غیرفعال'} شد.`);
});

// مدیریت خطاها
bot.on('polling_error', (error) => {
  console.error('❌ خطای Polling:', error.message);
});

process.on('uncaughtException', (error) => {
  console.error('❌ خطا:', error.message);
});

console.log('🤖 ربات در حال راه‌اندازی...');
console.log(`👑 سودو: ${SUDO_ID}`);
console.log('✅ آماده!');
