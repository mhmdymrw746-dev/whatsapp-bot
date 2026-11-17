const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const Pino = require('pino');

let antiLink = {};
let warnings = {};
let points = {}; // نقاط
let levels = {}; // مستويات
let spam = {}; // سبام
let afk = {}; // غايب
let bannedWords = ['xxx', 'كس', 'شرموط', 'متناك'];

const jokes = [
"مرة واحد غبي راح للدكتور قاله كل ما اشرب قهوة بتوجعني عيني.. قاله شيل المعلقة 😂",
"مرة واحد بخيل مات.. اهله لقوا في جيبه ورقة مكتوب عليها لو مت ادفنوني واقف عشان اوفر تمن الكفن 😂",
"مرة فرخة دخلت سوبر ماركت قالتله عندك بيض؟ قالها لا.. قالتله امال بتجيب منين؟ 😂",
"واحد بيقول لصاحبه انا حلمت اني بقيت غني.. صاحبه قاله طب اصحى وادفع اللي عليك 😂",
"مرة واحد محشش بيقول لصاحبه: تفتكر بكرة هيبقى ايه؟ قاله: بكرة هيبقى بعد النهاردة بيوم 😂"
];
const saraha = [
"لو خيروك تسيب الموبايل شهر ولا تسيب صاحبك المقرب؟",
"ايه اكتر حاجة بتكسفك؟",
"مين اخر واحد فكرت فيه قبل ما تنام؟",
"عمرك كدبت على اهلك في ايه؟",
"لو هتتجوز حد من المجموعة دي هتختار مين؟ 😂",
"ايه سر محدش يعرفه عنك؟"
];
const truth = ["عمرك سرقت حاجة؟", "بتحب حد من المجموعة؟", "ايه اكتر اكلة بتحبها؟", "عمرك عيطت في فيلم؟"];
const games = {};

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({ auth: state, logger: Pino({ level: 'silent' }) });
    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        const phone = process.env.PHONE_NUMBER;
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phone);
                console.log("==== رمز الاقتران بتاعك هو: " + code + " ====");
            } catch(e) { console.log("غلط:", e); }
        }, 3000);
    }

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ واتساب اشتغل");
        if (u.connection === 'close') start();
    });

    sock.ev.on('group-participants.update', async (u) => {
        if (u.action === 'add') {
            for (let p of u.participants) {
                await sock.sendMessage(u.id, { text: `👋 اهلا بيك @${p.split('@')[0]} نورت المجموعة ❤️\n🎮 اكتب !اوامر عشان تشوف كل الاوامر\n📜 قوانين المجموعة: احترم الكل، ممنوع الروابط، ممنوع الشتايم`, mentions: [p] });
            }
        }
        if (u.action === 'remove') {
            for (let p of u.participants) await sock.sendMessage(u.id, { text: `👋 @${p.split('@')[0]} سابنا ومشي 🥲`, mentions: [p] });
        }
        if (u.action === 'promote') {
            for (let p of u.participants) await sock.sendMessage(u.id, { text: `🎉 مبروك @${p.split('@')[0]} بقى مشرف 👑`, mentions: [p] });
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        if (!isGroup) {
            await sock.sendMessage(from, { text: "🤖 البوت للمجموعات بس، ضيفني في مجموعة وخلييني مشرف" });
            return;
        }
        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const sender = m.key.participant || m.key.remoteJid;
        const senderName = m.pushName || sender.split('@')[0];
        const metadata = await sock.groupMetadata(from);
        const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
        const isAdmin = admins.includes(sender);
        const isBotAdmin = admins.includes(sock.user.id);
        const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = mentioned[0] || m.message.extendedTextMessage?.contextInfo?.participant;
        const args = text.split(' ').slice(1).join(' ');
        const lower = text.toLowerCase();

        // ===== نظام النقاط والمستويات =====
        points[sender] = (points[sender] || 0) + 1;
        levels[sender] = Math.floor(points[sender] / 100) + 1;

        // ===== AFK - لو حد منشن واحد غايب =====
        if (mentioned.length > 0) {
            for (let id of mentioned) {
                if (afk[id]) await sock.sendMessage(from, { text: `💤 @${id.split('@')[0]} غايب: ${afk[id]}`, mentions: [id] });
            }
        }
        if (afk[sender]) { delete afk[sender]; await sock.sendMessage(from, { text: `👋 اهلا برجوعك @${sender.split('@')[0]}` , mentions: [sender] }); }

        // ===== ردود تلقائية =====
        if (lower === 'سلام' || lower === 'السلام عليكم' || lower === 'هاي' || lower === 'ازيك') {
            await sock.sendMessage(from, { text: `وعليكم السلام يا ${senderName} ❤️ عامل ايه؟` });
            return;
        }
        if (lower === 'بوت' || lower === 'يا بوت') { await sock.sendMessage(from, { text: `نعم يا ${senderName}؟ 😎 اكتب !اوامر` }); return; }
        if (lower.includes('بحبك')) { await sock.sendMessage(from, { text: `وانا كمان بحبك يا ${senderName} ❤️` }); return; }
        if (lower === 'صباح الخير') { await sock.sendMessage(from, { text: "صباح النور والفل 🌞" }); return; }
        if (lower === 'تصبح على خير') { await sock.sendMessage(from, { text: "وانت من اهله 😴" }); return; }

        // ===== حماية سبام =====
        if (!isAdmin) {
            const now = Date.now();
            if (!spam[sender]) spam[sender] = [];
            spam[sender].push(now);
            spam[sender] = spam[sender].filter(t => now - t < 10000);
            if (spam[sender].length > 7) {
                await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} بطل سبام!`, mentions: [sender] });
                spam[sender] = [];
                return;
            }
        }

        // ===== منع روابط + كلمات ممنوعة =====
        if (antiLink[from] && !isAdmin && (text.includes('http') || text.includes('wa.me') || text.includes('chat.whatsapp'))) {
            await sock.sendMessage(from, { delete: m.key });
            await sock.sendMessage(from, { text: `❌ ممنوع الروابط @${sender.split('@')[0]}`, mentions: [sender] }); return;
        }
        if (!isAdmin && bannedWords.some(w => lower.includes(w))) {
            await sock.sendMessage(from, { delete: m.key });
            await sock.sendMessage(from, { text: `⚠️ عيب يا @${sender.split('@')[0]} ممنوع الشتايم`, mentions: [sender] }); return;
        }

        if (!text.startsWith('!')) return;
        const cmd = text.split(' ')[0].toLowerCase();

        // ===== القايمة الكاملة =====
        if (cmd === '!اوامر' || cmd === '!help') {
            await sock.sendMessage(from, { text: `🤖 *بوت الوحش - كل الاوامر:*\n\n*🎮 العاب:*\n!خمن - لعبة تخمين الرقم\n!حجر / !ورقة / !مقص\n!نكتة - نكتة عشوائية\n!صراحة - سؤال صراحة\n!حقيقة - سؤال حقيقة\n!حب @شخص - نسبة الحب\n!توافق @شخص @شخص\n!عملة - ملك ولا كتابة\n!نرد - ارمي النرد\n\n*💰 اقتصاد:*\n!نقاطي - نقاطك ومستواك\n!توب - ترتيب الاعضاء\n!يومية - خد مكافأة يومية\n\n*👤 شخصي:*\n!ايدي - الايدي بتاعك\n!صورة - صورتك\n!غايب سبب - وضع غايب\n!معلومات - معلومات المجموعة\n\n*👑 مشرفين:*\n!منشن - منشن الكل\n!منشن_مشرفين\n!طرد @شخص | !ترقية | !تخفيض\n!قفل / !فتح\n!قفل_روابط / !فتح_روابط\n!انذار @شخص | !تصفير @شخص\n!تغيير_الاسم | !تغيير_الوصف\n!حذف - بالرد على رسالة\n!طرد_الكل ⚠️` });
            return;
        }

        // ===== العاب =====
        if (cmd === '!نكتة') { await sock.sendMessage(from, { text: jokes[Math.floor(Math.random()*jokes.length)] }); return; }
        if (cmd === '!صراحة') { await sock.sendMessage(from, { text: `🎤 *صراحة:*\n${saraha[Math.floor(Math.random()*saraha.length)]}` }); return; }
        if (cmd === '!حقيقة') { await sock.sendMessage(from, { text: `🤔 *حقيقة:*\n${truth[Math.floor(Math.random()*truth.length)]}` }); return; }
        if (cmd === '!حب') {
            if (!target) return sock.sendMessage(from, { text: "منشن: !حب @شخص" });
            const perc = Math.floor(Math.random()*101);
            await sock.sendMessage(from, { text: `❤️ نسبة الحب بينك وبين @${target.split('@')[0]} هي: ${perc}%\n${perc > 80 ? 'حب حقيقي 🥰' : perc > 50 ? 'فيه امل 😍' : 'مش نافع 😂'}`, mentions: [target] }); return;
        }
        if (cmd === '!توافق') {
            const perc = Math.floor(Math.random()*101);
            await sock.sendMessage(from, { text: `💕 نسبة التوافق: ${perc}%` }); return;
        }
        if (cmd === '!عملة') { await sock.sendMessage(from, { text: Math.random() > 0.5 ? "👑 ملك!" : "✍️ كتابة!" }); return; }
        if (cmd === '!نرد') { await sock.sendMessage(from, { text: `🎲 طلعلك: ${Math.floor(Math.random()*6)+1}` }); return; }
        if (cmd === '!خمن') {
            if (!games[from]) { games[from] = Math.floor(Math.random()*100)+1; await sock.sendMessage(from, { text: "🎯 خمنت رقم من 1 لـ 100.. اكتب !خمن 50" }); return; }
            const guess = parseInt(args);
            if (!guess) return sock.sendMessage(from, { text: "اكتب رقم: !خمن 50" });
            if (guess === games[from]) { await sock.sendMessage(from, { text: `🎉 صح! الرقم كان ${games[from]} كسبت 50 نقطة!` }); points[sender] = (points[sender]||0)+50; delete games[from]; }
            else if (guess < games[from]) await sock.sendMessage(from, { text: "⬆️ اكبر!" });
            else await sock.sendMessage(from, { text: "⬇️ اصغر!" });
            return;
        }
        if (['!حجر','!ورقة','!مقص'].includes(cmd)) {
            const choices = ['!حجر','!ورقة','!مقص'];
            const bot = choices[Math.floor(Math.random()*3)];
            let res = "تعادل 🤝";
            if ((cmd==='!حجر'&&bot==='!مقص')||(cmd==='!ورقة'&&bot==='!حجر')||(cmd==='!مقص'&&bot==='!ورقة')) res = "كسبت! 🎉";
            else if (cmd!==bot) res = "خسرت! 😂";
            await sock.sendMessage(from, { text: `انت: ${cmd.replace('!','')}\nانا: ${bot.replace('!','')}\n${res}` }); return;
        }
        if (cmd === '!حجر' || cmd === '!ورقه') {} // placeholder

        // ===== اقتصاد =====
        if (cmd === '!نقاطي') { await sock.sendMessage(from, { text: `💰 *${senderName}*\nنقاطك: ${points[sender]||0}\nمستواك: ${levels[sender]||1} ⭐\nفاضلك ${100 - ((points[sender]||0)%100)} نقطة للمستوى الجاي` }); return; }
        if (cmd === '!يومية') { points[sender]=(points[sender]||0)+100; await sock.sendMessage(from, { text: `🎁 خدت 100 نقطة هدية يومية! نقاطك بقت ${points[sender]}` }); return; }
        if (cmd === '!توب') {
            const sorted = Object.entries(points).sort((a,b)=>b[1]-a[1]).slice(0,10);
            let txt = "🏆 *توب 10:*\n\n";
            sorted.forEach(([id,pt],i)=>{ txt += `${i+1}. @${id.split('@')[0]} - ${pt} نقطة\n`; });
            await sock.sendMessage(from, { text: txt, mentions: sorted.map(s=>s[0]) }); return;
        }
        if (cmd === '!غايب') { afk[sender] = args || 'غايب'; await sock.sendMessage(from, { text: `💤 بقيت غايب: ${afk[sender]}` }); return; }
        if (cmd === '!ايدي') { await sock.sendMessage(from, { text: `🆔 ${sender}` }); return; }
        if (cmd === '!صورة') {
            try { const pp = await sock.profilePictureUrl(sender,'image'); await sock.sendMessage(from, { image:{url:pp}, caption:`صورتك @${sender.split('@')[0]}`, mentions:[sender] }); } catch { await sock.sendMessage(from, { text:"مفيش صورة" }); } return;
        }
        if (cmd === '!معلومات') { await sock.sendMessage(from, { text: `📊 *${metadata.subject}*\n👥 الاعضاء: ${metadata.participants.length}\n👑 المشرفين: ${admins.length}\n📝 الوصف: ${metadata.desc||'مفيش'}` }); return; }

        // ===== مشرفين =====
        if (!isAdmin) { await sock.sendMessage(from, { text: "❌ للمشرفين بس" }); return; }
        if (!isBotAdmin && ['!طرد','!ترقية','!تخفيض','!حذف','!طرد_الكل'].includes(cmd)) { await sock.sendMessage(from, { text: "❌ لازم تخلييني مشرف الاول" }); return; }

        if (cmd === '!منشن') {
            const all = metadata.participants.map(p=>p.id);
            let txt = `📢 *نداء للجميع:*\n${args}\n\n`;
            for (let p of metadata.participants) txt += `@${p.id.split('@')[0]} `;
            await sock.sendMessage(from, { text: txt, mentions: all });
        }
        else if (cmd === '!منشن_مشرفين') {
            let txt = "👑 *المشرفين:*\n";
            for (let a of admins) txt += `@${a.split('@')[0]} `;
            await sock.sendMessage(from, { text: txt, mentions: admins });
        }
        else if (cmd === '!طرد') { if(!target) return sock.sendMessage(from,{text:"منشن: !طرد @شخص"}); await sock.groupParticipantsUpdate(from,[target],'remove'); await sock.sendMessage(from,{text:"✅ تم الطرد"}); }
        else if (cmd === '!ترقية') { if(!target) return sock.sendMessage(from,{text:"منشن: !ترقية @شخص"}); await sock.groupParticipantsUpdate(from,[target],'promote'); await sock.sendMessage(from,{text:"✅ بقى مشرف 👑"}); }
        else if (cmd === '!تخفيض') { if(!target) return sock.sendMessage(from,{text:"منشن: !تخفيض @شخص"}); await sock.groupParticipantsUpdate(from,[target],'demote'); await sock.sendMessage(from,{text:"✅ اتشال منه الاشراف"}); }
        else if (cmd === '!قفل') { await sock.groupSettingUpdate(from,'announcement'); await sock.sendMessage(from,{text:"🔒 اتقفلت"}); }
        else if (cmd === '!فتح') { await sock.groupSettingUpdate(from,'not_announcement'); await sock.sendMessage(from,{text:"🔓 اتفتحت"}); }
        else if (cmd === '!قفل_روابط') { antiLink[from]=true; await sock.sendMessage(from,{text:"🔗 الروابط اتقفلت"}); }
        else if (cmd === '!فتح_روابط') { antiLink[from]=false; await sock.sendMessage(from,{text:"🔗 الروابط اتفتحت"}); }
        else if (cmd === '!انذار') {
            if(!target) return sock.sendMessage(from,{text:"منشن: !انذار @شخص"});
            warnings[target]=(warnings[target]||0)+1;
            if(warnings[target]>=3){ await sock.groupParticipantsUpdate(from,[target],'remove'); delete warnings[target]; await sock.sendMessage(from,{text:`🚫 @${target.split('@')[0]} خد 3 انذارات واتطرد`,mentions:[target]}); }
            else await sock.sendMessage(from,{text:`⚠️ انذار ${warnings[target]}/3 لـ @${target.split('@')[0]}`,mentions:[target]});
        }
        else if (cmd === '!تصفير') { if(!target) return sock.sendMessage(from,{text:"منشن: !تصفير @شخص"}); delete warnings[target]; await sock.sendMessage(from,{text:"✅ اتصفرت انذاراته"}); }
        else if (cmd === '!تغيير_الاسم') { if(!args) return sock.sendMessage(from,{text:"اكتب: !تغيير_الاسم الاسم الجديد"}); await sock.groupUpdateSubject(from,args); await sock.sendMessage(from,{text:"✅ اتغير الاسم لـ: "+args}); }
        else if (cmd === '!تغيير_الوصف') { if(!args) return sock.sendMessage(from,{text:"اكتب: !تغيير_الوصف الوصف الجديد"}); await sock.groupUpdateDescription(from,args); await sock.sendMessage(from,{text:"✅ اتغير الوصف"}); }
        else if (cmd === '!حذف') {
            const quoted = m.message.extendedTextMessage?.contextInfo?.stanzaId;
            if(!quoted) return sock.sendMessage(from,{text:"رد على الرسالة واكتب !حذف"});
            await sock.sendMessage(from,{delete:{remoteJid:from, fromMe:false, id:quoted, participant:m.message.extendedTextMessage.contextInfo.participant}});
        }
        else if (cmd === '!طرد_الكل') {
            const nonAdmins = metadata.participants.filter(p=>!p.admin && p.id!==sock.user.id).map(p=>p.id);
            for(let id of nonAdmins) await sock.groupParticipantsUpdate(from,[id],'remove');
            await sock.sendMessage(from,{text:`✅ اتطرد ${nonAdmins.length} عضو`});
        }
    });
}
start();
