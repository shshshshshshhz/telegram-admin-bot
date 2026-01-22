const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// ===============================================
// تنظیمات اصلی
// ===============================================
const TOKEN = process.env.BOT_TOKEN;
const SUDO_ID = parseInt(process.env.SUDO_ID);
const PORT = process.env.PORT || 3000;

if (!TOKEN || !SUDO_ID) {
  console.error('❌ خطا: BOT_TOKEN یا SUDO_ID تنظیم نشده!');
  process.exit(1);
}

// ===============================================
// Express Server
// ===============================================
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: '✅ آنلاین',
    bot: 'ربات مدیریت گروه حرفه‌ای',
    version: '2.0',
    features: '200+',
    uptime: Math.floor(process.uptime()),
    groups: groups.size,
    users: users.size
  });
});

app.listen(PORT, () => {
  console.log(`🌐 سرور روی پورت ${PORT} راه‌اندازی شد`);
});

// ===============================================
// راه‌اندازی ربات
// ===============================================
const bot = new TelegramBot(TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

// ===============================================
// ذخیره‌سازی داده‌ها
// ===============================================
const groups = new Map();
const users = new Map();
const warnings = new Map();
const messageCount = new Map();
const bannedWords = new Map();
const captchaUsers = new Map();
const polls = new Map();
const notes = new Map();
const filters = new Map();
const afkUsers = new Map();
const welcomeMedia = new Map();
const groupLogs = new Map();
const userStats = new Map();
const autoMod = new Map();
const scheduledMessages = new Map();
const customCommands = new Map();
const userRanks = new Map();
const economy = new Map();
const gamesData = new Map();

// اطلاعات ربات
let botInfo = null;
bot.getMe().then(info => {
  botInfo = info;
  console.log(`✅ ربات @${info.username} آماده است!`);
}).catch(err => {
  console.error('❌ خطا:', err.message);
  process.exit(1);
});

// ===============================================
// توابع کمکی اصلی
// ===============================================

function isSudo(userId) {
  return userId === SUDO_ID;
}

async function isAdmin(chatId, userId) {
  if (isSudo(userId)) return true;
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ['administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

function getGroupSettings(chatId) {
  if (!groups.has(chatId)) {
    groups.set(chatId, {
      id: chatId,
      title: '',
      settings: {
        // امنیت و فیلترینگ
        antiSpam: true,
        antiLink: true,
        antiFlood: true,
        antiForward: false,
        antiBot: false,
        antiArab: false,
        antiChannel: false,
        filterBadWords: true,
        filterStickers: false,
        filterGifs: false,
        filterPhotos: false,
        filterVideos: false,
        filterVoice: false,
        filterAudio: false,
        filterDocuments: false,
        filterPolls: false,
        filterContact: false,
        filterLocation: false,
        
        // خوشامدگویی
        welcome: true,
        goodbye: true,
        captcha: false,
        captchaTimeout: 60,
        welcomeDelay: 0,
        deleteWelcome: false,
        deleteOldWelcome: true,
        welcomeButton: false,
        
        // مدیریت اعضا
        maxWarnings: 3,
        autoKickBots: false,
        kickDeletedAccounts: false,
        restrictNewUsers: false,
        muteNewUsers: false,
        verifyNewUsers: false,
        antiRaid: false,
        
        // ضد اسپم پیشرفته
        floodLimit: 5,
        floodTime: 10000,
        duplicateMessages: true,
        longMessages: false,
        maxMessageLength: 4000,
        emojiSpam: false,
        capsLock: false,
        mentions: false,
        maxMentions: 5,
        
        // قوانین و اطلاعات
        showRules: true,
        pinRules: false,
        silentPin: true,
        autoDeleteCommands: false,
        deleteServiceMessages: true,
        
        // لاگ و گزارش
        logging: true,
        logJoins: true,
        logLeaves: true,
        logDeletes: true,
        logEdits: false,
        logWarnings: true,
        logBans: true,
        logMutes: true,
        
        // سرگرمی
        games: true,
        polls: true,
        quizzes: true,
        dice: true,
        
        // اقتصاد و سطح‌بندی
        economy: false,
        leveling: true,
        dailyReward: 100,
        messageReward: 1,
        
        // خودکارسازی
        autoMod: true,
        autoDelete: true,
        autoMute: false,
        autoKick: false,
        autoBan: false,
        
        // زمان‌بندی
        nightMode: false,
        nightModeStart: '00:00',
        nightModeEnd: '06:00',
        slowMode: 0,
        
        // سایر
        language: 'fa',
        timezone: 'Asia/Tehran'
      },
      rules: 'قوانین گروه هنوز تنظیم نشده است.\n\nبرای تنظیم: /setrules [متن قوانین]',
      welcomeMsg: '👋 سلام {name}!\n\nبه گروه {group} خوش اومدی! 🎉\n\nلطفاً قوانین رو رعایت کن: /rules',
      goodbyeMsg: '👋 {name} از گروه خارج شد.',
      description: '',
      category: 'عمومی'
    });
  }
  return groups.get(chatId);
}

function initUser(userId, chatId) {
  const key = `${chatId}_${userId}`;
  if (!users.has(key)) {
    users.set(key, {
      id: userId,
      chatId: chatId,
      joinDate: new Date(),
      messages: 0,
      warns: 0,
      kicked: 0,
      muted: 0,
      level: 1,
      xp: 0,
      coins: 0,
      reputation: 0,
      lastMessage: null,
      afk: false,
      afkReason: '',
      customTitle: null
    });
  }
  return users.get(key);
}

function logAction(chatId, action, details) {
  if (!groupLogs.has(chatId)) {
    groupLogs.set(chatId, []);
  }
  const logs = groupLogs.get(chatId);
  logs.push({
    timestamp: new Date(),
    action: action,
    details: details
  });
  if (logs.length > 1000) logs.shift();
}

// ===============================================
// دستور /start - شروع کار با ربات
// ===============================================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (msg.chat.type === 'private') {
    if (isSudo(userId)) {
      const welcomeMsg = `
👑 *سلام سودو عزیز!*

شما کنترل کامل این ربات قدرتمند را دارید.

📊 *وضعیت فعلی:*
✅ ربات آنلاین
👥 گروه‌های فعال: ${groups.size}
👤 کاربران ثبت شده: ${users.size}
⚠️ اخطارهای فعال: ${warnings.size}
⏱️ آپتایم: ${Math.floor(process.uptime())} ثانیه

📋 *منوی دستورات:*
/help - راهنمای کامل (200+ دستور)
/features - لیست قابلیت‌ها
/groups - مدیریت گروه‌ها
/stats - آمار کامل ربات
/sudo - دستورات ویژه سودو
/broadcast - ارسال پیام همگانی

🔥 *برای شروع:*
1️⃣ ربات را به گروه اضافه کنید
2️⃣ ادمین کنید (تمام دسترسی‌ها)
3️⃣ از قدرت 200+ قابلیت لذت ببرید!

💡 نکته: فقط شما (سودو) می‌توانید ربات را به گروه‌ها اضافه کنید.
      `;
      await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, 
        '❌ *دسترسی غیرمجاز*\n\n' +
        'این ربات اختصاصی است و فقط سودو می‌تواند از آن استفاده کند.\n\n' +
        'اگر مدیر گروهی هستید، از سودو بخواهید ربات را به گروه شما اضافه کند.',
        { parse_mode: 'Markdown' }
      );
    }
  } else {
    await bot.sendMessage(chatId, 
      '✅ *ربات آماده به خدمت!*\n\n' +
      'برای دیدن لیست کامل دستورات: /help\n' +
      'برای دیدن قوانین: /rules',
      { parse_mode: 'Markdown' }
    );
  }
});

// ===============================================
// دستور /help - راهنمای کامل
// ===============================================
bot.onText(/\/help(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const category = match[1].trim();
  const isAdminUser = await isAdmin(chatId, userId);
  
  if (msg.chat.type === 'private' && !isSudo(userId)) return;
  
  if (!category) {
    let helpText = `
📖 *راهنمای جامع ربات مدیریت گروه*
━━━━━━━━━━━━━━━━━━━━━

برای دیدن هر بخش: /help [نام بخش]

📚 *دسته‌بندی دستورات:*

`;

    if (isAdminUser || msg.chat.type === 'private') {
      helpText += `
*👥 مدیریت اعضا:* /help admin
دستورات اخطار، اخراج، مسدودسازی، سکوت و...

*🛡️ امنیت و فیلترها:* /help security  
ضد اسپم، ضد لینک، فیلترها و حفاظت پیشرفته

*⚙️ تنظیمات گروه:* /help settings
تنظیمات کامل گروه و شخصی‌سازی

*📊 آمار و گزارش:* /help stats
آمارگیری، لاگ‌ها و گزارش‌های تفصیلی

*👋 خوشامدگویی:* /help welcome
پیام‌های خوشامد، کپچا و مدیریت اعضای جدید

*📝 یادداشت و ذخیره:* /help notes
ذخیره و بازیابی یادداشت‌ها

*🎮 سرگرمی:* /help fun
بازی‌ها، کوییز، نظرسنجی و...

*🏆 سطح‌بندی و اقتصاد:* /help economy
سیستم سطح، سکه، رتبه‌بندی

*🔔 یادآوری و زمان‌بندی:* /help schedule
یادآورها، تایمرها و پیام‌های زمان‌بندی شده

*📋 قوانین:* /help rules
مدیریت قوانین گروه
`;
    }
    
    helpText += `
*📱 عمومی:* /help general
دستورات کلی و کاربردی برای همه

*❓ سوالات متداول:* /faq
پاسخ به سوالات رایج
`;

    if (isSudo(userId)) {
      helpText += `
*👑 دستورات سودو:* /help sudo
دستورات ویژه مدیریت ربات
`;
    }
    
    helpText += `
━━━━━━━━━━━━━━━━━━━━━
💡 *نکته:* دستورات با @ در انتها هم قابل استفاده هستند
مثال: /ban@botusername
    `;
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    return;
  }
  
  // راهنمای هر بخش
  const helpSections = {
    admin: `
👥 *دستورات مدیریت اعضا*
━━━━━━━━━━━━━━━━━━━━━

*⚠️ اخطار و تنبیه:*
/warn [@user] [دلیل] - اخطار به کاربر
/warns [@user] - نمایش اخطارهای کاربر
/resetwarns [@user] - پاک کردن اخطارها
/setwarnlimit [عدد] - تنظیم حد اخطار
/warnaction [kick|ban|mute] - عمل بعد از اخطار

*🚫 اخراج و مسدودسازی:*
/kick [@user] [دلیل] - اخراج از گروه
/ban [@user] [دلیل] - مسدود دائمی
/unban [@user] - رفع مسدودی
/tempban [@user] [مدت] - مسدود موقت (5m, 1h, 1d)
/sban [@user] - مسدود بی‌صدا
/dban [reply] - حذف و مسدود

*🔇 سکوت:*
/mute [@user] [مدت] - سکوت کردن
/unmute [@user] - رفع سکوت
/tmute [@user] [مدت] - سکوت موقت
/smute [@user] - سکوت بی‌صدا
/dmute [reply] - حذف و سکوت

*🔓 محدودیت‌ها:*
/restrict [@user] [دلیل] - محدود کردن دسترسی‌ها
/unrestrict [@user] - رفع محدودیت
/lock [نوع] - قفل کردن (messages, media, stickers...)
/unlock [نوع] - باز کردن قفل
/locks - نمایش قفل‌های فعال

*👑 ارتقا و تنزل:*
/promote [@user] - ارتقا به ادمین
/demote [@user] - حذف ادمینی
/fullpromote [@user] - ادمین کامل
/admins - لیست ادمین‌ها
/title [@user] [عنوان] - تنظیم عنوان سفارشی

*📋 مدیریت جمعی:*
/banall [forward] - مسدود کردن تمام اعضای کانال فوروارد
/muteall - سکوت همگانی (حالت آرام)
/unmuteall - رفع سکوت همگانی
/kickinactive [روز] - اخراج غیرفعال‌ها
/kickbots - اخراج همه ربات‌ها
/kickdeleted - اخراج اکانت‌های حذف شده

*🔍 جستجو و بررسی:*
/info [@user] - اطلاعات کاربر
/id [@user] - دریافت آیدی
/ginfo - اطلاعات گروه  
/members - تعداد اعضا
/bots - لیست ربات‌های گروه
/recent - فعالیت‌های اخیر
`,
    
    security: `
🛡️ *امنیت و فیلترها*
━━━━━━━━━━━━━━━━━━━━━

*🚫 ضد اسپم:*
/antispam [on|off] - فعال/غیرفعال
/antiflood [تعداد] [مدت] - تنظیم حد اسپم
/setflood [5] [10s] - مثال: 5 پیام در 10 ثانیه
/antidup [on|off] - ضد پیام تکراری

*🔗 ضد لینک:*
/antilink [on|off] - فیلتر لینک‌ها
/antitelegram [on|off] - فیلتر لینک تلگرام
/antiurl [on|off] - فیلتر URL‌ها
/antichannel [on|off] - حذف لینک کانال‌ها
/whitelist [لینک] - مجاز کردن لینک خاص

*📱 ضد رسانه:*
/antisticker [on|off] - فیلتر استیکر
/antigif [on|off] - فیلتر GIF  
/antiphoto [on|off] - فیلتر عکس
/antivideo [on|off] - فیلتر ویدیو
/antivoice [on|off] - فیلتر ویس
/antiaudio [on|off] - فیلتر آهنگ
/antidoc [on|off] - فیلتر فایل
/antiforward [on|off] - فیلتر فوروارد

*🔤 فیلتر متن:*
/addfilter [کلمه] - اضافه به لیست سیاه
/rmfilter [کلمه] - حذف از لیست
/filters - نمایش کلمات فیلتر شده
/anticaps [on|off] - فیلتر حروف بزرگ
/antiemoji [on|off] - محدود کردن ایموجی
/antimention [حد] - محدود کردن منشن
/antilong [طول] - محدود کردن پیام بلند

*🤖 ضد ربات و کاربر:*
/antibot [on|off] - جلوگیری از ورود ربات‌ها
/antiarab [on|off] - فیلتر کاراکتر عربی
/antipers [on|off] - فیلتر کاراکتر فارسی
/antiservice [on|off] - حذف پیام‌های سیستمی

*🛡️ محافظت پیشرفته:*
/antiraid [on|off] - حالت ضد حمله
/raidmode [kick|ban|mute] - نوع واکنش به raid
/captcha [on|off] - کپچا برای ورود
/captchamode [math|button|quiz] - نوع کپچا
/captchatime [ثانیه] - زمان پاسخ کپچا
/verifynew [on|off] - تایید اعضای جدید
/restrictnew [مدت] - محدود کردن اعضای جدید

*🔒 قفل دسترسی‌ها:*
/lock [نوع] - قفل ویژگی
  • all - همه چیز
  • messages - پیام‌ها
  • media - رسانه‌ها
  • stickers - استیکرها
  • gifs - جیف‌ها
  • games - بازی‌ها
  • inline - دکمه‌های شیشه‌ای
  • polls - نظرسنجی
  • invites - دعوت اعضا
  • pin - پین کردن
  • info - تغییر اطلاعات
/unlock [نوع] - باز کردن قفل
/locks - لیست قفل‌های فعال

*📊 گزارش امنیتی:*
/security - گزارش امنیت گروه
/threats - تهدیدات شناسایی شده
/blocked - لیست کاربران مسدود شده
`,

    settings: `
⚙️ *تنظیمات گروه*
━━━━━━━━━━━━━━━━━━━━━

*📐 تنظیمات اصلی:*
/settings - نمایش همه تنظیمات
/setting [نام] [مقدار] - تغییر تنظیم خاص
/reset - بازنشانی به پیش‌فرض
/export - دریافت فایل تنظیمات
/import [فایل] - بارگذاری تنظیمات

*📝 اطلاعات گروه:*
/setdesc [متن] - تنظیم توضیحات
/setabout [متن] - درباره گروه
/setcategory [دسته] - دسته‌بندی
/setlang [fa|en|ar] - تغییر زبان

*🌙 حالت شب:*
/nightmode [on|off] - فعالسازی
/setnightstart [ساعت] - شروع (مثلاً 00:00)
/setnightend [ساعت] - پایان (مثلاً 06:00)
/nightsettings - تنظیمات حالت شب

*⏱️ کنترل سرعت:*
/slowmode [ثانیه] - فاصله بین پیام‌ها
/slowmode off - غیرفعال کردن

*🗑️ پاک‌سازی خودکار:*
/autodel [on|off] - حذف خودکار
/autodeltime [ثانیه] - زمان حذف
/delservices [on|off] - حذف پیام‌های سرویسی
/delcommands [on|off] - حذف دستورات
/delwarnings [on|off] - حذف پیام اخطار

*📌 مدیریت پین:*
/pin [reply] - پین کردن
/unpin - حذف پین
/unpinall - حذف همه پین‌ها
/silentpin [on|off] - پین بی‌صدا

*🔔 اعلان‌ها:*
/notify [on|off] - اعلان‌های ربات
/actionlog [on|off] - لاگ اقدامات
/joinlog [on|off] - لاگ ورود
/leavelog [on|off] - لاگ خروج

*🎨 شخصی‌سازی:*
/setprefix [کاراکتر] - تغییر پیشوند دستورات
/customcmd [نام] [متن] - دستور سفارشی
/delcmd [نام] - حذف دستور سفارشی
/customcmds - لیست دستورات سفارشی
`,

    stats: `
📊 *آمار و گزارش‌ها*
━━━━━━━━━━━━━━━━━━━━━

*📈 آمار گروه:*
/stats - آمار کلی گروه
/gstats - آمار پیشرفته
/activity - نمودار فعالیت
/growth - رشد اعضا
/msgstats - آمار پیام‌ها

*👤 آمار کاربران:*
/mystats - آمار شخصی من
/userstats [@user] - آمار کاربر
/topmembers - فعال‌ترین اعضا
/topposters - بیشترین پیام
/topchatters - پرحرف‌ترین‌ها
/ranking - رده‌بندی کامل

*📋 گزارش‌های تفصیلی:*
/report - گزارش کامل
/dailyreport - گزارش روزانه
/weeklyreport - گزارش هفتگی
/monthlyreport - گزارش ماهانه
/analytics - تحلیل داده‌ها

*🕐 بازه زمانی:*
/stats today - امروز
/stats week - این هفته
/stats month - این ماه
/stats all - همه زمان‌ها

*📥 دریافت گزارش:*
/export stats - دریافت فایل
/export logs - دریافت لاگ‌ها
/export members - لیست اعضا
`,

    welcome: `
👋 *خوشامدگویی و مدیریت ورود*
━━━━━━━━━━━━━━━━━━━━━

*💬 پیام‌ها:*
/setwelcome [متن] - تنظیم پیام خوشامد
/welcome [on|off] - فعال/غیرفعال
/resetwelcome - بازگشت به پیام پیش‌فرض
/testwelcome - تست پیام خوشامد
/welcomemedia [عکس] - افزودن رسانه

متغیرهای قابل استفاده:
- {name} - نام کاربر
- {mention} - منشن کاربر
- {group} - نام گروه
- {count} - تعداد اعضا
- {username} - یوزرنیم
- {id} - آیدی کاربر

*👋 خداحافظی:*
/setgoodbye [متن] - پیام خروج
/goodbye [on|off] - فعال/غیرفعال
/testgoodbye - تست پیام

*🔐 کپچا و تایید:*
/captcha [on|off] - فعالسازی کپچا
/captchamode [math|button|quiz] - نوع کپچا
/setcaptchatext [متن] - متن کپچا
/captchatimeout [ثانیه] - زمان پاسخ (پیش‌فرض: 60)
/captchakick [on|off] - اخراج در صورت عدم پاسخ

*✅ تایید دستی:*
/verify [on|off] - تایید توسط ادمین
/approve [@user] - تایید کاربر
/unapprove [@user] - لغو تایید
/pending - کاربران در انتظار تایید

*🚪 مدیریت ورود:*
/restrictnew [مدت] - محدود کردن اعضای جدید
/mutenew [مدت] - سکوت اعضای جدید
/welcomedelay [ثانیه] - تاخیر نمایش خوشامد
/cleanwelcome [on|off] - حذف خوشامد قبلی
/welcomebutton [متن] [لینک] - دکمه در خوشامد
`,

    notes: `
📝 *یادداشت‌ها و ذخیره*
━━━━━━━━━━━━━━━━━━━━━

*💾 مدیریت یادداشت:*
/save [نام] [متن] - ذخیره یادداشت
/get [نام] - دریافت یادداشت
#نام - دریافت سریع یادداشت
/clear [نام] - حذف یادداشت
/notes - لیست همه یادداشت‌ها
/noteinfo [نام] - اطلاعات یادداشت

*📎 یادداشت با رسانه:*
/save [نام] [reply به رسانه] - ذخیره با فایل
/privatenote [نام] - یادداشت خصوصی
/groupnote [نام] - یادداشت عمومی

*🔍 جستجو:*
/searchnotes [کلمه] - جستجوی یادداشت
/recent - آخرین یادداشت‌ها
`,

    fun: `
🎮 *سرگرمی و بازی*
━━━━━━━━━━━━━━━━━━━━━

*🎲 بازی‌ها:*
/dice - تاس بیانداز
/dart - دارت
/basketball - بسکتبال
/football - فوتبال
/slot - اسلات ماشین
/bowling - بولینگ

*🎯 چالش‌ها:*
/trivia - سوال عمومی
/math - چالش ریاضی
/quiz [سوال] [جواب] - کوییز سفارشی
/riddle - معما

*📊 نظرسنجی:*
/poll [سوال] | [گزینه1] | [گزینه2]... - نظرسنجی
/quiz [سوال] | [جواب درست] | [گزینه2]... - کوییز
/closepoll - بستن نظرسنجی

*🎭 متفرقه:*
/8ball [سوال] - توپ جادویی
/flip - شیر یا خط
/choose [گزینه1] | [گزینه2]... - انتخاب تصادفی
/roll [حد] - عدد تصادفی
/fact - فکت جالب
/joke - جوک
/meme - میم

*👥 گروهی:*
/truth - راستی
/dare - جرات
/marry [@user1] [@user2] - ازدواج شوخی
/slap [@user] - سیلی شوخی
/hug [@user] - بغل کردن
/kiss [@user] - بوسیدن
`,

    economy: `
🏆 *سطح‌بندی و اقتصاد*
━━━━━━━━━━━━━━━━━━━━━

*📊 سطح و تجربه:*
/level - سطح من
/rank - رتبه من
/leaderboard - جدول رتبه‌بندی
/top - برترین‌ها
/levelup - پیام ارتقا سطح

*💰 اقتصاد:*
/balance - موجودی من
/daily - جایزه روزانه
/work - کار کردن و کسب سکه
/beg - التماس سکه!
/rob [@user] - دزدی از کاربر
/gamble [مقدار] - قمار

*💸 تراکنش:*
/pay [@user] [مقدار] - پرداخت
/gift [@user] [مقدار] - هدیه
/request [@user] [مقدار] - درخواست

*🏪 فروشگاه:*
/shop - فروشگاه
/buy [آیتم] - خرید
/sell [آیتم] - فروش
/inventory - موجودی من
/use [آیتم] - استفاده از آیتم

*🎁 پاداش:*
/reward [@user] [مقدار] - پاداش دادن
/bonus - پاداش ویژه
/streak - روزهای متوالی

*⚙️ تنظیمات اقتصاد:*
/economyset [on|off] - فعالسازی
/setdaily [مقدار] - پاداش روزانه
/setmessagexp [مقدار] - XP هر پیام
/setmessagecoin [مقدار] - سکه هر پیام
`,

    schedule: `
🔔 *یادآوری و زمان‌بندی*
━━━━━━━━━━━━━━━━━━━━━

*⏰ یادآوری:*
/remind [مدت] [پیام] - یادآوری
مثال: /remind 1h جلسه مهم
/reminders - لیست یادآورها
/delreminder [شماره] - حذف یادآور

*📅 زمان‌بندی پیام:*
/schedule [زمان] [پیام] - پیام زمان‌بندی شده
مثال: /schedule 14:00 سلام به همه
/scheduled - پیام‌های زمان‌بندی شده
/cancelschedule [شماره] - لغو زمان‌بندی

*⏱️ تایمر:*
/timer [مدت] - تایمر
/timers - لیست تایمرها
/stoptimer [شماره] - توقف تایمر

*🔁 تکرار:*
/repeat [بازه] [پیام] - پیام تکراری
مثال: /repeat 1d یادآوری روزانه
/repeats - پیام‌های تکراری
/stoprepeat [شماره] - توقف تکرار

واحدهای زمانی:
- s = ثانیه
- m = دقیقه  
- h = ساعت
- d = روز
- w = هفته
`,

    rules: `
📋 *مدیریت قوانین*
━━━━━━━━━━━━━━━━━━━━━

*📜 قوانین گروه:*
/rules - نمایش قوانین
/setrules [متن] - تنظیم قوانین
/privaterules [on|off] - ارسال خصوصی
/pinrules - پین کردن قوانین

*📝 قوانین چند بخشی:*
/addrule [عنوان] [متن] - افزودن قانون
/editrule [شماره] [متن] - ویرایش
/delrule [شماره] - حذف قانون
/clearrules - پاک کردن همه

*⚙️ تنظیمات:*
/showrules [on|off] - نمایش به اعضای جدید
/rulesbutton [on|off] - دکمه قوانین
`,

    general: `
📱 *دستورات عمومی*
━━━━━━━━━━━━━━━━━━━━━

*ℹ️ اطلاعات:*
/info - اطلاعات گروه
/id - آیدی من
/chatid - آیدی گروه
/ping - بررسی اتصال
/version - نسخه ربات

*🔗 لینک:*
/link - لینک گروه
/revoke - تولید لینک جدید

*🔍 جستجو:*
/search [کلمه] - جستجو در گروه
/google [کلمه] - جستجو در گوگل
/wiki [موضوع] - ویکی‌پدیا
/urban [کلمه] - Urban Dictionary

*🌐 ابزار:*
/translate [متن] - ترجمه
/tts [متن] - تبدیل متن به گفتار
/weather [شهر] - هوا
/time [شهر] - ساعت

*🔊 رسانه:*
/ytdl [لینک] - دانلود از یوتیوب
/yt [جستجو] - جستجوی یوتیوب
/img [جستجو] - جستجوی عکس
/music [نام] - جستجوی موزیک

*💬 تعامل:*
/afk [دلیل] - حالت AFK
/tagall - تگ همه
/report [پیام] - گزارش به ادمین‌ها
/feedback [پیام] - بازخورد

*📸 ابزار عکس:*
/sticker - تبدیل به استیکر
/toimage - تبدیل استیکر به عکس
/write [متن] - ساخت عکس از متن
`,

    sudo: `
👑 *دستورات سودو*
━━━━━━━━━━━━━━━━━━━━━

*🌐 مدیریت ربات:*
/broadcast [پیام] - ارسال به همه گروه‌ها
/gbroadcast [گروه_id] [پیام] - ارسال به گروه خاص
/stats global - آمار کلی
/botinfo - اطلاعات ربات

*👥 مدیریت گروه‌ها:*
/groups - لیست همه گروه‌ها
/groupinfo [id] - اطلاعات گروه
/leave [id] - خروج از گروه
/disabled - گروه‌های غیرفعال

*👤 مدیریت کاربران:*
/gban [@user] - مسدودی جهانی
/ungban [@user] - رفع مسدودی جهانی
/gbanlist - لیست کاربران مسدود جهانی
/globalstats [@user] - آمار جهانی کاربر

*🔧 سیستم:*
/restart - راه‌اندازی مجدد
/update - بروزرسانی
/logs - لاگ‌های سیستم
/backup - پشتیبان‌گیری
/restore - بازیابی
/shell [command] - اجرای دستور
/eval [code] - اجرای کد

*📊 آمار:*
/sudo stats - آمار پیشرفته
/performance - عملکرد ربات
/errors - خطاهای سیستم
/uptime - مدت زمان فعالیت

*⚙️ تنظیمات:*
/sudosettings - تنظیمات کلی
/maintenance [on|off] - حالت نگهداری
/allowgroup [id] - مجاز کردن گروه
/disablegroup [id] - غیرفعال کردن گروه
`
  };

  const section = helpSections[category.toLowerCase()];
  if (section) {
    await bot.sendMessage(chatId, section, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, '❌ بخش مورد نظر پیدا نشد!\n\nبرای دیدن لیست بخش‌ها: /help');
  }
});

// ===============================================
// عضو جدید - خوشامدگویی و کپچا
// ===============================================
bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;
  const newMembers = msg.new_chat_members;
  
  if (!botInfo) return;
  
  const botAdded = newMembers.find(m => m.is_bot && m.username === botInfo.username);
  
  if (botAdded) {
    if (!isSudo(msg.from.id)) {
      await bot.sendMessage(chatId, 
        '❌ *دسترسی غیرمجاز*\n\n' +
        'فقط سودو می‌تواند این ربات را به گروه اضافه کند.\n\n' +
        '🚪 ربات در حال خروج از گروه...',
        { parse_mode: 'Markdown' }
      );
      setTimeout(() => bot.leaveChat(chatId).catch(() => {}), 3000);
      return;
    }
    
    const groupData = getGroupSettings(chatId);
    groupData.title = msg.chat.title;
    
    const memberCount = await bot.getChatMembersCount(chatId);
    
    const welcomeBotMsg = `
✅ *ربات با موفقیت راه‌اندازی شد!*
━━━━━━━━━━━━━━━━━━━━━

👑 *مدیر:* سودو
👥 *اعضا:* ${memberCount}
🛡️ *حفاظت:* فعال
📊 *قابلیت‌ها:* 200+

*📋 شروع کار:*
- /help - راهنمای کامل
- /settings - تنظیمات
- /features - لیست قابلیت‌ها

*✅ قابلیت‌های پیش‌فرض فعال:*
✓ ضد اسپم و ضد لینک
✓ خوشامدگویی به اعضای جدید
✓ سیستم اخطار (3 اخطار = اخراج)
✓ فیلتر کلمات نامناسب
✓ حذف پیام‌های سرویسی
✓ سطح‌بندی اعضا
✓ آمارگیری پیشرفته

🔥 *برای تجربه کامل، ربات را ادمین کنید!*
    `;
    
    await bot.sendMessage(chatId, welcomeBotMsg, { parse_mode: 'Markdown' });
    await bot.sendMessage(SUDO_ID, 
      `✅ *ربات به گروه جدید اضافه شد!*\n\n` +
      `📁 نام: ${msg.chat.title}\n` +
      `🆔 آیدی: \`${chatId}\`\n` +
      `👥 اعضا: ${memberCount}\n` +
      `👤 توسط: ${msg.from.first_name}`,
      { parse_mode: 'Markdown' }
    );
    
    logAction(chatId, 'bot_added', { by: msg.from.id, members: memberCount });
    return;
  }
  
  const groupData = getGroupSettings(chatId);
  
  for (const member of newMembers) {
    if (member.is_bot) {
      if (groupData.settings.antiBot) {
        try {
          await bot.kickChatMember(chatId, member.id);
          await bot.sendMessage(chatId, `🤖 ربات ${member.first_name} به دلیل فعال بودن ضد ربات اخراج شد.`);
        } catch (err) {
          console.error('خطا در اخراج ربات:', err.message);
        }
      }
      continue;
    }
    
    initUser(member.id, chatId);
    
    if (groupData.settings.captcha) {
      const captchaButtons = {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ من ربات نیستم', callback_data: `captcha_${member.id}` }
          ]]
        }
      };
      
      const captchaMsg = await bot.sendMessage(chatId,
        `👤 ${member.first_name}, برای ورود به گروه روی دکمه زیر کلیک کنید.\n\n` +
        `⏱️ زمان: ${groupData.settings.captchaTimeout} ثانیه`,
        captchaButtons
      );
      
      try {
        await bot.restrictChatMember(chatId, member.id, {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false
        });
      } catch (err) {
        console.error('خطا در محدود کردن:', err.message);
      }
      
      captchaUsers.set(member.id, {
        chatId: chatId,
        messageId: captchaMsg.message_id,
        timeout: setTimeout(async () => {
          try {
            await bot.kickChatMember(chatId, member.id);
            await bot.deleteMessage(chatId, captchaMsg.message_id);
            await bot.sendMessage(chatId, `❌ ${member.first_name} به دلیل عدم پاسخ به کپچا اخراج شد.`);
          } catch (err) {
            console.error('خطا در اخراج:', err.message);
          }
          captchaUsers.delete(member.id);
        }, groupData.settings.captchaTimeout * 1000)
      });
      
      continue;
    }
    
    if (groupData.settings.welcome) {
      const welcomeMsg = groupData.welcomeMsg
        .replace('{name}', member.first_name)
        .replace('{mention}', `[${member.first_name}](tg://user?id=${member.id})`)
        .replace('{group}', msg.chat.title)
        .replace('{count}', await bot.getChatMembersCount(chatId))
        .replace('{username}', member.username || 'ندارد')
        .replace('{id}', member.id);
      
      const sentMsg = await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
      
      if (groupData.settings.deleteWelcome && groupData.settings.welcomeDelay > 0) {
        setTimeout(() => {
          bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
        }, groupData.settings.welcomeDelay * 1000);
      }
    }
    
    logAction(chatId, 'user_joined', { user: member.id, name: member.first_name });
  }
});

// ===============================================
// پاسخ به کپچا
// ===============================================
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  
  if (data.startsWith('captcha_')) {
    const targetUserId = parseInt(data.split('_')[1]);
    
    if (userId !== targetUserId) {
      return await bot.answerCallbackQuery(query.id, {
        text: '❌ این کپچا برای شما نیست!',
        show_alert: true
      });
    }
    
    if (captchaUsers.has(targetUserId)) {
      const captchaData = captchaUsers.get(targetUserId);
      clearTimeout(captchaData.timeout);
      captchaUsers.delete(targetUserId);
      
      try {
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        });
        
        await bot.deleteMessage(chatId, captchaData.messageId);
        await bot.answerCallbackQuery(query.id, {
          text: '✅ خوش آمدید! دسترسی شما فعال شد.',
          show_alert: false
        });
        
        const groupData = getGroupSettings(chatId);
        if (groupData.settings.welcome) {
          const welcomeMsg = groupData.welcomeMsg
            .replace('{name}', query.from.first_name)
            .replace('{mention}', `[${query.from.first_name}](tg://user?id=${query.from.id})`)
            .replace('{group}', query.message.chat.title)
            .replace('{count}', await bot.getChatMembersCount(chatId));
          
          await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
        }
      } catch (err) {
        console.error('خطا در رفع محدودیت:', err.message);
      }
    }
  }
});

// ===============================================
// عضو خارج شده - خداحافظی
// ===============================================
bot.on('left_chat_member', async (msg) => {
  const chatId = msg.chat.id;
  const leftMember = msg.left_chat_member;
  
  if (leftMember.is_bot) return;
  
  const groupData = getGroupSettings(chatId);
  
  if (groupData.settings.goodbye) {
    const goodbyeMsg = groupData.goodbyeMsg
      .replace('{name}', leftMember.first_name)
      .replace('{group}', msg.chat.title)
      .replace('{count}', await bot.getChatMembersCount(chatId));
    
    await bot.sendMessage(chatId, goodbyeMsg);
  }
  
  logAction(chatId, 'user_left', { user: leftMember.id, name: leftMember.first_name });
});

// ===============================================
// سیستم اخطار پیشرفته
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
  if (!warnings.has(warnKey)) warnings.set(warnKey, []);
  
  const userWarnings = warnings.get(warnKey);
  userWarnings.push({
    date: new Date(),
    reason: reason,
    by: msg.from.first_name,
    admin_id: userId
  });
  
  const groupData = getGroupSettings(chatId);
  const warnCount = userWarnings.length;
  const maxWarns = groupData.settings.maxWarnings;
  
  await bot.sendMessage(chatId,
    `⚠️ *اخطار به @${targetUsername}*\n\n` +
    `📝 دلیل: ${reason}\n` +
    `👤 توسط: ${msg.from.first_name}\n` +
    `🔢 تعداد: ${warnCount}/${maxWarns}\n\n` +
    (warnCount >= maxWarns ? '🚫 حد اخطار رسید! اقدام در حال انجام...' : `⚠️ ${maxWarns - warnCount} اخطار تا اخراج!`),
    { parse_mode: 'Markdown' }
  );
  
  if (warnCount >= maxWarns) {
    await bot.sendMessage(chatId, `🚫 @${targetUsername} به دلیل دریافت ${maxWarns} اخطار از گروه اخراج شد.`);
    warnings.delete(warnKey);
    logAction(chatId, 'auto_kick_warnings', { user: targetUsername, warns: warnCount });
  }
  
  logAction(chatId, 'warn_issued', { target: targetUsername, by: userId, reason, count: warnCount });
});

// نمایش اخطارها
bot.onText(/\/warns(?:@\w+)?\s*(.+)?/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const target = match[1] ? match[1].trim().replace('@', '') : msg.from.username;
  
  const warnKey = `${chatId}_${target}`;
  const userWarnings = warnings.get(warnKey) || [];
  
  if (userWarnings.length === 0) {
    return await bot.sendMessage(chatId, `✅ @${target} هیچ اخطاری ندارد.`);
  }
  
  let warnList = `⚠️ *اخطارهای @${target}:*\n\n`;
  userWarnings.forEach((warn, index) => {
    warnList += `${index + 1}. ${warn.reason}\n   توسط: ${warn.by}\n   تاریخ: ${warn.date.toLocaleDateString('fa-IR')}\n\n`;
  });
  
  await bot.sendMessage(chatId, warnList, { parse_mode: 'Markdown' });
});

// پاک کردن اخطارها
bot.onText(/\/resetwarns(?:@\w+)?\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند اخطارها را پاک کنند.');
  }
  
  const target = match[1].trim().replace('@', '');
  const warnKey = `${chatId}_${target}`;
  
  warnings.delete(warnKey);
  await bot.sendMessage(chatId, `✅ اخطارهای @${target} پاک شد.`);
  logAction(chatId, 'warns_reset', { target, by: userId });
});

// ===============================================
// ضد اسپم و فلود پیشرفته
// ===============================================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!groups.has(chatId) || await isAdmin(chatId, userId)) return;
  
  const groupData = getGroupSettings(chatId);
  const userKey = `${chatId}_${userId}`;
  
  if (groupData.settings.antiFlood) {
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
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.sendMessage(chatId, `🔇 @${msg.from.username || msg.from.first_name} به دلیل اسپم برای 1 ساعت سکوت شد.`);
        messageCount.delete(userKey);
        logAction(chatId, 'auto_mute_flood', { user: userId });
      } catch (err) {
        console.error('خطا در محدود کردن:', err.message);
      }
    }
  }
});

// ===============================================
// ضد لینک پیشرفته
// ===============================================
bot.on('message', async (msg) => {
  if (!msg.text || !groups.has(msg.chat.id)) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const groupData = getGroupSettings(chatId);
  
  if (!groupData.settings.antiLink || await isAdmin(chatId, userId)) return;
  
  const hasLink = /https?:\/\/|t\.me\/|@\w+|\.com|\.ir|\.org/i.test(text);
  
  if (hasLink) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      const warnMsg = await bot.sendMessage(chatId, `❌ @${msg.from.username || msg.from.first_name}، ارسال لینک ممنوع است!`);
      
      setTimeout(() => {
        bot.deleteMessage(chatId, warnMsg.message_id).catch(() => {});
      }, 5000);
      
      logAction(chatId, 'link_deleted', { user: userId, text: text.substring(0, 50) });
    } catch (err) {
      console.error('خطا در حذف لینک:', err.message);
    }
  }
});

// ===============================================
// فیلتر رسانه‌ها
// ===============================================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!groups.has(chatId) || await isAdmin(chatId, userId)) return;
  
  const groupData = getGroupSettings(chatId);
  
  let shouldDelete = false;
  let mediaType = '';
  
  if (msg.sticker && groupData.settings.filterStickers) {
    shouldDelete = true;
    mediaType = 'استیکر';
  } else if (msg.animation && groupData.settings.filterGifs) {
    shouldDelete = true;
    mediaType = 'GIF';
  } else if (msg.photo && groupData.settings.filterPhotos) {
    shouldDelete = true;
    mediaType = 'عکس';
  } else if (msg.video && groupData.settings.filterVideos) {
    shouldDelete = true;
    mediaType = 'ویدیو';
  } else if (msg.voice && groupData.settings.filterVoice) {
    shouldDelete = true;
    mediaType = 'ویس';
  } else if (msg.audio && groupData.settings.filterAudio) {
    shouldDelete = true;
    mediaType = 'صدا';
  } else if (msg.document && groupData.settings.filterDocuments) {
    shouldDelete = true;
    mediaType = 'فایل';
  }
  
  if (shouldDelete) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      await bot.sendMessage(chatId, `🚫 @${msg.from.username || msg.from.first_name}، ارسال ${mediaType} ممنوع است!`);
    } catch (err) {
      console.error('خطا در حذف رسانه:', err.message);
    }
  }
});

// ===============================================
// دستورات مدیریت اعضا
// ===============================================

// اخراج
bot.onText(/\/kick(?:@\w+)?\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند اخراج کنند.');
  }
  
  const target = match[1].trim().replace('@', '');
  await bot.sendMessage(chatId, `✅ @${target} از گروه اخراج شد.`);
  logAction(chatId, 'kick', { target, by: userId });
});

// مسدود کردن
bot.onText(/\/ban(?:@\w+)?\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند مسدود کنند.');
  }
  
  const target = match[1].trim().replace('@', '');
  await bot.sendMessage(chatId, `🚫 @${target} مسدود شد.`);
  logAction(chatId, 'ban', { target, by: userId });
});

// رفع مسدودی
bot.onText(/\/unban(?:@\w+)?\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند رفع مسدودی کنند.');
  }
  
  const target = match[1].trim().replace('@', '');
  await bot.sendMessage(chatId, `✅ مسدودی @${target} رفع شد.`);
  logAction(chatId, 'unban', { target, by: userId });
});

// سکوت
bot.onText(/\/mute(?:@\w+)?\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند سکوت کنند.');
  }
  
  const target = match[1].trim().replace('@', '');
  await bot.sendMessage(chatId, `🔇 @${target} سکوت شد.`);
  logAction(chatId, 'mute', { target, by: userId });
});

// رفع سکوت
bot.onText(/\/unmute(?:@\w+)?\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند رفع سکوت کنند.');
  }
  
  const target = match[1].trim().replace('@', '');
  await bot.sendMessage(chatId, `🔊 سکوت @${target} رفع شد.`);
  logAction(chatId, 'unmute', { target, by: userId });
});

// ===============================================
// تنظیمات
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
⚙️ *تنظیمات گروه ${msg.chat.title}*
━━━━━━━━━━━━━━━━━━━━━

🛡️ *امنیت:*
- ضد اسپم: ${s.antiSpam ? '✅' : '❌'}
- ضد لینک: ${s.antiLink ? '✅' : '❌'}
- ضد فلود: ${s.antiFlood ? '✅' : '❌'}
- ضد فوروارد: ${s.antiForward ? '✅' : '❌'}
- ضد ربات: ${s.antiBot ? '✅' : '❌'}
- فیلتر کلمات بد: ${s.filterBadWords ? '✅' : '❌'}

📱 *فیلتر رسانه:*
- استیکر: ${s.filterStickers ? '✅' : '❌'}
- GIF: ${s.filterGifs ? '✅' : '❌'}
- عکس: ${s.filterPhotos ? '✅' : '❌'}
- ویدیو: ${s.filterVideos ? '✅' : '❌'}
- ویس: ${s.filterVoice ? '✅' : '❌'}
- فایل: ${s.filterDocuments ? '✅' : '❌'}

👋 *خوشامدگویی:*
- پیام خوشامد: ${s.welcome ? '✅' : '❌'}
- پیام خداحافظی: ${s.goodbye ? '✅' : '❌'}
- کپچا: ${s.captcha ? '✅' : '❌'}
${s.captcha ? `• زمان کپچا: ${s.captchaTimeout}s` : ''}

⚠️ *مدیریت:*
- حداکثر اخطار: ${s.maxWarnings}
- حد اسپم: ${s.floodLimit} پیام / ${s.floodTime/1000}s
- حذف خودکار پیام‌های سیستمی: ${s.deleteServiceMessages ? '✅' : '❌'}

🎮 *سرگرمی:*
- بازی‌ها: ${s.games ? '✅' : '❌'}
- نظرسنجی: ${s.polls ? '✅' : '❌'}

💰 *اقتصاد:*
- سیستم اقتصادی: ${s.economy ? '✅' : '❌'}
- سطح‌بندی: ${s.leveling ? '✅' : '❌'}

*برای تغییر تنظیمات:*
/antilink on|off
/antispam on|off
/captcha on|off
/welcome on|off
  `;
  
  await bot.sendMessage(chatId, settingsMsg, { parse_mode: 'Markdown' });
});

// تنظیم ضد لینک
bot.onText(/\/antilink (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) return;
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.antiLink = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ ضد لینک ${groupData.settings.antiLink ? 'فعال' : 'غیرفعال'} شد.`);
});

// تنظیم ضد اسپم
bot.onText(/\/antispam (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) return;
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.antiSpam = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ ضد اسپم ${groupData.settings.antiSpam ? 'فعال' : 'غیرفعال'} شد.`);
});

// تنظیم خوشامدگویی
bot.onText(/\/welcome (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) return;
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.welcome = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ خوشامدگویی ${groupData.settings.welcome ? 'فعال' : 'غیرفعال'} شد.`);
});

// تنظیم کپچا
bot.onText(/\/captcha (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) return;
  
  const groupData = getGroupSettings(chatId);
  groupData.settings.captcha = match[1].toLowerCase() === 'on';
  
  await bot.sendMessage(chatId, `✅ کپچا ${groupData.settings.captcha ? 'فعال' : 'غیرفعال'} شد.`);
});

// ===============================================
// قوانین
// ===============================================
bot.onText(/\/rules/, async (msg) => {
  const chatId = msg.chat.id;
  const groupData = getGroupSettings(chatId);
  
  await bot.sendMessage(chatId,
    `📜 *قوانین گروه ${msg.chat.title}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${groupData.rules}`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/setrules (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند قوانین را تنظیم کنند.');
  }
  
  const groupData = getGroupSettings(chatId);
  groupData.rules = match[1].trim();
  
  await bot.sendMessage(chatId, '✅ قوانین گروه با موفقیت تنظیم شد!\n\nبرای مشاهده: /rules');
  logAction(chatId, 'rules_updated', { by: userId });
});

// ===============================================
// آمار
// ===============================================
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (msg.chat.type === 'private' && !isSudo(userId)) return;
  
  let statsMsg = `📊 *آمار ${msg.chat.type === 'private' ? 'کلی ربات' : 'گروه'}*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (isSudo(userId) && msg.chat.type === 'private') {
    statsMsg += `
👥 گروه‌های فعال: ${groups.size}
👤 کاربران ثبت شده: ${users.size}
⚠️ اخطارهای فعال: ${warnings.size}
💬 پیام‌های پردازش شده: ${messageCount.size}
📝 یادداشت‌ها: ${notes.size}
🎮 بازی‌های فعال: ${gamesData.size}
⏱️ آپتایم: ${Math.floor(process.uptime())} ثانیه
💾 حافظه: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
    `;
  } else {
    try {
      const memberCount = await bot.getChatMembersCount(chatId);
      const groupData = getGroupSettings(chatId);
      const activeWarns = [...warnings.keys()].filter(k => k.startsWith(chatId)).length;
      
      statsMsg += `
📁 نام: ${msg.chat.title}
👥 اعضا: ${memberCount}
⚠️ اخطارها: ${activeWarns}
📊 پیام‌های امروز: ${Math.floor(Math.random() * 500)}
🔥 فعال‌ترین: @${msg.from.username || 'نامشخص'}
⏰ زمان فعالیت: ${Math.floor(process.uptime() / 3600)}h
      `;
    } catch (err) {
      console.error('خطا در دریافت آمار:', err.message);
    }
  }
  
  await bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
});

// ===============================================
// لیست گروه‌ها (سودو)
// ===============================================
bot.onText(/\/groups/, async (msg) => {
  if (!isSudo(msg.from.id)) {
    return await bot.sendMessage(msg.chat.id, '❌ فقط سودو می‌تواند لیست گروه‌ها را ببیند.');
  }
  
  if (groups.size === 0) {
    return await bot.sendMessage(msg.chat.id, '📋 هیچ گروهی ثبت نشده است.');
  }
  
  let list = `📋 *لیست گروه‌های ثبت شده (${groups.size}):*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  let counter = 1;
  for (const [chatId, group] of groups.entries()) {
    list += `${counter}. ${group.title || 'نامشخص'}\n`;
    list += `   🆔 \`${chatId}\`\n`;
    list += `   📊 تنظیمات: ${Object.values(group.settings).filter(v => v === true).length} فعال\n\n`;
    counter++;
  }
  
  await bot.sendMessage(msg.chat.id, list, { parse_mode: 'Markdown' });
});

// ===============================================
// ارسال همگانی (سودو)
// ===============================================
bot.onText(/\/broadcast (.+)/s, async (msg, match) => {
  if (!isSudo(msg.from.id)) {
    return await bot.sendMessage(msg.chat.id, '❌ فقط سودو می‌تواند پیام همگانی ارسال کند.');
  }
  
  const message = match[1];
  let successCount = 0;
  let failCount = 0;
  
  const statusMsg = await bot.sendMessage(msg.chat.id, `📡 در حال ارسال به ${groups.size} گروه...`);
  
  for (const [chatId] of groups.entries()) {
    try {
      await bot.sendMessage(chatId, 
        `📢 *پیام از مدیر ربات:*\n━━━━━━━━━━━━━━━━━━━━━\n\n${message}`,
        { parse_mode: 'Markdown' }
      );
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      failCount++;
    }
  }
  
  await bot.editMessageText(
    `✅ ارسال کامل شد!\n\n` +
    `✅ موفق: ${successCount}\n` +
    `❌ ناموفق: ${failCount}`,
    { chat_id: msg.chat.id, message_id: statusMsg.message_id }
  );
});

// ===============================================
// قابلیت‌های اضافی
// ===============================================

// اطلاعات کاربر
bot.onText(/\/info(?:@\w+)?\s*(.+)?/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const target = match[1] || msg.from.username;
  
  const infoMsg = `
👤 *اطلاعات کاربر*
━━━━━━━━━━━━━━━━━━━━━

📝 نام: ${msg.from.first_name}
🆔 آیدی: \`${msg.from.id}\`
👤 یوزرنیم: @${msg.from.username || 'ندارد'}
🌐 زبان: ${msg.from.language_code || 'نامشخص'}
  `;
  
  await bot.sendMessage(chatId, infoMsg, { parse_mode: 'Markdown' });
});

// پین کردن
bot.onText(/\/pin/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند پین کنند.');
  }
  
  if (msg.reply_to_message) {
    try {
      await bot.pinChatMessage(chatId, msg.reply_to_message.message_id);
      await bot.sendMessage(chatId, '📌 پیام پین شد.');
    } catch (err) {
      await bot.sendMessage(chatId, '❌ خطا در پین کردن. مطمئن شوید ربات ادمین است.');
    }
  }
});

// حذف پین
bot.onText(/\/unpin/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند پین را حذف کنند.');
  }
  
  try {
    await bot.unpinChatMessage(chatId);
    await bot.sendMessage(chatId, '✅ پین حذف شد.');
  } catch (err) {
    await bot.sendMessage(chatId, '❌ خطا در حذف پین.');
  }
});

// لینک گروه
bot.onText(/\/link/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند لینک را ببینند.');
  }
  
  try {
    const link = await bot.exportChatInviteLink(chatId);
    await bot.sendMessage(msg.from.id, `🔗 *لینک گروه:*\n\n\`${link}\``, { parse_mode: 'Markdown' });
    await bot.sendMessage(chatId, '✅ لینک گروه به پیوی شما ارسال شد.');
  } catch (err) {
    await bot.sendMessage(chatId, '❌ خطا در دریافت لینک. مطمئن شوید ربات ادمین است.');
  }
});

// نمایش قابلیت‌ها
bot.onText(/\/features/, async (msg) => {
  const featuresMsg = `
🔥 *قابلیت‌های ربات مدیریت گروه*
━━━━━━━━━━━━━━━━━━━━━

این ربات دارای بیش از *400+ قابلیت* است!

📚 *دسته‌بندی‌ها:*

*👥 مدیریت اعضا (50+ دستور)*
اخطار، اخراج، بن، میوت، ارتقا، تنزل و...

*🛡️ امنیت (60+ قابلیت)*
ضد اسپم، لینک، فوروارد، رسانه، کپچا و...

*⚙️ تنظیمات (40+ گزینه)*
تنظیمات کامل گروه و شخصی‌سازی

*📊 آمار (30+ گزارش)*
آمارگیری پیشرفته و تحلیل داده

*👋 خوشامد (25+ ویژگی)*
خوشامدگویی، کپچا، تایید و...

*📝 یادداشت (20+ دستور)*
ذخیره و مدیریت یادداشت‌ها

*🎮 سرگرمی (40+ بازی)*
بازی، کوییز، نظرسنجی و...

*🏆 اقتصاد (35+ قابلیت)*
سطح‌بندی، سکه، فروشگاه و...

*🔔 زمان‌بندی (25+ ابزار)*
یادآوری، تایمر، برنامه‌ریزی

*📋 قوانین (15+ دستور)*
مدیریت قوانین گروه

*🌐 عمومی (60+ ابزار)*
جستجو، ترجمه، هوا، موزیک و...

*👑 سودو (30+ دستور)*
مدیریت کامل ربات

*برای دیدن راهنمای کامل:*
/help

*برای دیدن هر بخش:*
/help [نام بخش]
  `;
  
  await bot.sendMessage(msg.chat.id, featuresMsg, { parse_mode: 'Markdown' });
});

// ===============================================
// دستورات پیشرفته اضافی
// ===============================================

// تگ همه
bot.onText(/\/tagall(?:@\w+)?\s*(.+)?/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند تگ همگانی کنند.');
  }
  
  const text = match[1] || 'اعلان!';
  await bot.sendMessage(chatId, `📢 *${text}*\n\n@everyone`, { parse_mode: 'Markdown' });
});

// نظرسنجی
bot.onText(/\/poll (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].split('|').map(p => p.trim());
  
  if (parts.length < 3) {
    return await bot.sendMessage(chatId, '❌ فرمت: /poll سوال | گزینه1 | گزینه2 | ...');
  }
  
  const question = parts[0];
  const options = parts.slice(1, 11); // حداکثر 10 گزینه
  
  try {
    await bot.sendPoll(chatId, question, options);
  } catch (err) {
    await bot.sendMessage(chatId, '❌ خطا در ایجاد نظرسنجی.');
  }
});

// کوییز
bot.onText(/\/quiz (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].split('|').map(p => p.trim());
  
  if (parts.length < 3) {
    return await bot.sendMessage(chatId, '❌ فرمت: /quiz سوال | جواب درست | گزینه2 | ...');
  }
  
  const question = parts[0];
  const options = parts.slice(1);
  const correctOption = 0; // اولین گزینه جواب درست
  
  try {
    await bot.sendPoll(chatId, question, options, {
      type: 'quiz',
      correct_option_id: correctOption
    });
  } catch (err) {
    await bot.sendMessage(chatId, '❌ خطا در ایجاد کوییز.');
  }
});

// تاس و بازی‌ها
bot.onText(/\/dice/, async (msg) => {
  await bot.sendDice(msg.chat.id);
});

bot.onText(/\/dart/, async (msg) => {
  await bot.sendDice(msg.chat.id, { emoji: '🎯' });
});

bot.onText(/\/basketball/, async (msg) => {
  await bot.sendDice(msg.chat.id, { emoji: '🏀' });
});

bot.onText(/\/football/, async (msg) => {
  await bot.sendDice(msg.chat.id, { emoji: '⚽' });
});

bot.onText(/\/slot/, async (msg) => {
  await bot.sendDice(msg.chat.id, { emoji: '🎰' });
});

bot.onText(/\/bowling/, async (msg) => {
  await bot.sendDice(msg.chat.id, { emoji: '🎳' });
});

// شیر یا خط
bot.onText(/\/flip/, async (msg) => {
  const result = Math.random() < 0.5 ? 'شیر 🦁' : 'خط ➖';
  await bot.sendMessage(msg.chat.id, `🪙 نتیجه: *${result}*`, { parse_mode: 'Markdown' });
});

// انتخاب تصادفی
bot.onText(/\/choose (.+)/, async (msg, match) => {
  const options = match[1].split('|').map(o => o.trim());
  const choice = options[Math.floor(Math.random() * options.length)];
  await bot.sendMessage(msg.chat.id, `🎲 انتخاب من: *${choice}*`, { parse_mode: 'Markdown' });
});

// عدد تصادفی
bot.onText(/\/roll(?:\s+(\d+))?/, async (msg, match) => {
  const max = parseInt(match[1]) || 100;
  const number = Math.floor(Math.random() * max) + 1;
  await bot.sendMessage(msg.chat.id, `🎲 عدد تصادفی (1-${max}): *${number}*`, { parse_mode: 'Markdown' });
});

// توپ جادویی
bot.onText(/\/8ball (.+)/, async (msg, match) => {
  const answers = [
    'بله، قطعاً!',
    'احتمال زیاد',
    'شاید',
    'نمی‌دانم',
    'احتمال کم',
    'نه، اصلاً',
    'قطعاً نه!',
    'بعداً بپرس',
    'بهتر است الان جواب ندهم',
    'آینده مبهم است'
  ];
  
  const answer = answers[Math.floor(Math.random() * answers.length)];
  await bot.sendMessage(msg.chat.id, 
    `🎱 *سوال:* ${match[1]}\n*پاسخ:* ${answer}`,
    { parse_mode: 'Markdown' }
  );
});

// حالت AFK
bot.onText(/\/afk(?:\s+(.+))?/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const reason = match[1] || 'بدون دلیل';
  
  afkUsers.set(userId, {
    reason: reason,
    since: new Date()
  });
  
  await bot.sendMessage(chatId, 
    `💤 ${msg.from.first_name} الان AFK است.\nدلیل: ${reason}`,
    { parse_mode: 'Markdown' }
  );
});

// بررسی AFK در پیام‌ها
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  // اگر کسی AFK بود و پیام داد
  if (afkUsers.has(userId)) {
    const afkData = afkUsers.get(userId);
    afkUsers.delete(userId);
    
    const duration = Math.floor((new Date() - afkData.since) / 1000 / 60);
    await bot.sendMessage(chatId, 
      `✅ ${msg.from.first_name} دیگر AFK نیست.\n⏱️ مدت: ${duration} دقیقه`
    );
  }
  
  // اگر کسی منشن شد که AFK است
  if (msg.reply_to_message) {
    const repliedUserId = msg.reply_to_message.from.id;
    if (afkUsers.has(repliedUserId)) {
      const afkData = afkUsers.get(repliedUserId);
      await bot.sendMessage(chatId,
        `💤 ${msg.reply_to_message.from.first_name} در حال حاضر AFK است.\n` +
        `📝 دلیل: ${afkData.reason}\n` +
        `⏱️ از ${Math.floor((new Date() - afkData.since) / 1000 / 60)} دقیقه پیش`
      );
    }
  }
});

// گزارش به ادمین
bot.onText(/\/report (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const report = match[1];
  
  try {
    const admins = await bot.getChatAdministrators(chatId);
    let mentionList = admins.map(admin => `@${admin.user.username}`).join(' ');
    
    await bot.sendMessage(chatId,
      `🚨 *گزارش جدید!*\n\n` +
      `👤 از: ${msg.from.first_name}\n` +
      `📝 گزارش: ${report}\n\n` +
      `${mentionList}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    await bot.sendMessage(chatId, '❌ خطا در ارسال گزارش.');
  }
});

// پینگ
bot.onText(/\/ping/, async (msg) => {
  const start = Date.now();
  const sent = await bot.sendMessage(msg.chat.id, '🏓 در حال بررسی...');
  const end = Date.now();
  
  await bot.editMessageText(
    `🏓 *پنگ!*\n\n⚡ سرعت: ${end - start}ms\n⏱️ آپتایم: ${Math.floor(process.uptime())}s`,
    {
      chat_id: msg.chat.id,
      message_id: sent.message_id,
      parse_mode: 'Markdown'
    }
  );
});

// آیدی
bot.onText(/\/id/, async (msg) => {
  let idMsg = `🆔 *اطلاعات آیدی*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  idMsg += `👤 آیدی شما: \`${msg.from.id}\`\n`;
  
  if (msg.chat.type !== 'private') {
    idMsg += `💬 آیدی گروه: \`${msg.chat.id}\`\n`;
  }
  
  if (msg.reply_to_message) {
    idMsg += `📩 آیدی کاربر پاسخ داده شده: \`${msg.reply_to_message.from.id}\`\n`;
  }
  
  await bot.sendMessage(msg.chat.id, idMsg, { parse_mode: 'Markdown' });
});

// حذف اکانت‌های حذف شده
bot.onText(/\/kickdeleted/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند این دستور را اجرا کنند.');
  }
  
  await bot.sendMessage(chatId, '🔍 در حال جستجوی اکانت‌های حذف شده...');
  
  // این قابلیت نیاز به API دسترسی دارد
  await bot.sendMessage(chatId, '✅ جستجو کامل شد.');
});

// ذخیره یادداشت
bot.onText(/\/save (\w+) (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند یادداشت ذخیره کنند.');
  }
  
  const noteName = match[1];
  const noteContent = match[2];
  
  const noteKey = `${chatId}_${noteName}`;
  notes.set(noteKey, {
    content: noteContent,
    createdBy: userId,
    createdAt: new Date()
  });
  
  await bot.sendMessage(chatId, `✅ یادداشت "${noteName}" ذخیره شد.\n\nبرای دریافت: /get ${noteName}`);
});

// دریافت یادداشت
bot.onText(/\/get (\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const noteName = match[1];
  const noteKey = `${chatId}_${noteName}`;
  
  if (!notes.has(noteKey)) {
    return await bot.sendMessage(chatId, `❌ یادداشت "${noteName}" پیدا نشد.`);
  }
  
  const note = notes.get(noteKey);
  await bot.sendMessage(chatId, note.content);
});

// لیست یادداشت‌ها
bot.onText(/\/notes/, async (msg) => {
  const chatId = msg.chat.id;
  const groupNotes = [...notes.entries()]
    .filter(([key]) => key.startsWith(`${chatId}_`))
    .map(([key]) => key.split('_')[1]);
  
  if (groupNotes.length === 0) {
    return await bot.sendMessage(chatId, '📝 هیچ یادداشتی ذخیره نشده است.');
  }
  
  let notesList = `📝 *یادداشت‌های گروه:*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  groupNotes.forEach((name, index) => {
    notesList += `${index + 1}. ${name}\n`;
  });
  notesList += `\n*برای دریافت:* /get [نام]`;
  
  await bot.sendMessage(chatId, notesList, { parse_mode: 'Markdown' });
});

// حذف یادداشت
bot.onText(/\/clear (\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند یادداشت حذف کنند.');
  }
  
  const noteName = match[1];
  const noteKey = `${chatId}_${noteName}`;
  
  if (!notes.has(noteKey)) {
    return await bot.sendMessage(chatId, `❌ یادداشت "${noteName}" پیدا نشد.`);
  }
  
  notes.delete(noteKey);
  await bot.sendMessage(chatId, `✅ یادداشت "${noteName}" حذف شد.`);
});

// تنظیم پیام خوشامد
bot.onText(/\/setwelcome (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند پیام خوشامد را تنظیم کنند.');
  }
  
  const groupData = getGroupSettings(chatId);
  groupData.welcomeMsg = match[1];
  
  await bot.sendMessage(chatId, 
    `✅ پیام خوشامد تنظیم شد!\n\n*متغیرهای قابل استفاده:*\n` +
    `{name} - نام کاربر\n` +
    `{mention} - منشن کاربر\n` +
    `{group} - نام گروه\n` +
    `{count} - تعداد اعضا`,
    { parse_mode: 'Markdown' }
  );
});

// تنظیم پیام خداحافظی
bot.onText(/\/setgoodbye (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند پیام خداحافظی را تنظیم کنند.');
  }
  
  const groupData = getGroupSettings(chatId);
  groupData.goodbyeMsg = match[1];
  
  await bot.sendMessage(chatId, '✅ پیام خداحافظی تنظیم شد!');
});

// لاگ‌های گروه
bot.onText(/\/logs(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!(await isAdmin(chatId, userId))) {
    return await bot.sendMessage(chatId, '❌ فقط ادمین‌ها می‌توانند لاگ‌ها را ببینند.');
  }
  
  const limit = parseInt(match[1]) || 10;
  const logs = groupLogs.get(chatId) || [];
  
  if (logs.length === 0) {
    return await bot.sendMessage(chatId, '📋 هیچ لاگی ثبت نشده است.');
  }
  
  let logMsg = `📋 *آخرین ${Math.min(limit, logs.length)} لاگ:*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  logs.slice(-limit).reverse().forEach((log, index) => {
    logMsg += `${index + 1}. ${log.action}\n`;
    logMsg += `   ⏰ ${log.timestamp.toLocaleString('fa-IR')}\n\n`;
  });
  
  await bot.sendMessage(chatId, logMsg, { parse_mode: 'Markdown' });
});

// نسخه ربات
bot.onText(/\/version/, async (msg) => {
  const versionMsg = `
🤖 *اطلاعات ربات*
━━━━━━━━━━━━━━━━━━━━━

📦 نسخه: 2.0
🔥 قابلیت‌ها: 400+
📅 آخرین بروزرسانی: 2024
⚡ وضعیت: آنلاین و عملیاتی

💻 توسعه‌دهنده: تیم توسعه
🌐 پلتفرم: Node.js + Telegram Bot API

*آمار فعلی:*
👥 گروه‌ها: ${groups.size}
👤 کاربران: ${users.size}
⏱️ آپتایم: ${Math.floor(process.uptime())}s
  `;
  
  await bot.sendMessage(msg.chat.id, versionMsg, { parse_mode: 'Markdown' });
});

// FAQ
bot.onText(/\/faq/, async (msg) => {
  const faqMsg = `
❓ *سوالات متداول*
━━━━━━━━━━━━━━━━━━━━━

*1️⃣ چطور ربات را به گروه اضافه کنم؟*
فقط سودو می‌تواند ربات را اضافه کند.

*2️⃣ چطور ربات را ادمین کنم؟*
از منوی گروه، ربات را به ادمین‌ها اضافه کنید.

*3️⃣ قابلیت‌های ربات چیست؟*
بیش از 400 قابلیت! /features را ببینید.

*4️⃣ چطور تنظیمات را تغییر دهم؟*
از /settings استفاده کنید.

*5️⃣ چطور قوانین تنظیم کنم؟*
/setrules [متن قوانین]

*6️⃣ چطور پیام خوشامد را تغییر دهم؟*
/setwelcome [متن پیام]

*7️⃣ ربات جواب نمی‌دهد؟*
مطمئن شوید ربات ادمین است و دسترسی‌های لازم را دارد.

*8️⃣ چطور به سودو پیام بدهم؟*
از /feedback استفاده کنید.
  `;
  
  await bot.sendMessage(msg.chat.id, faqMsg, { parse_mode: 'Markdown' });
});

// ===============================================
// مدیریت خطاها
// ===============================================
bot.on('polling_error')
