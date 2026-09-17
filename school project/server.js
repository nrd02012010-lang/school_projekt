const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// === ТВОЙ ЛИЧНЫЙ ДЛИННЫЙ ПАРОЛЬ АДМИНА ===
// Можешь поменять значение в кавычках на любой другой пароль
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '02012010r';

// === ТВОИ ДАННЫЕ БОТА ===
const BOT_TOKEN = '8830924380:AAG05JEwPrFUL8u8VK1mevcZOzFEsT89t_g';
const BOT_USERNAME = 'bot8830924380'; 

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === БАЗА ДАННЫХ ===
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Ошибка БД:', err.message);
    else console.log('База данных подключена.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        votes INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS voters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        fullName TEXT,
        grade TEXT,
        candidateId INTEGER
    )`);

    // Дефолтные кандидаты для проверки
    db.get('SELECT COUNT(*) as count FROM candidates', (err, row) => {
        if (row && row.count === 0) {
            db.run('INSERT INTO candidates (name) VALUES (?)', ['Кандидат 1']);
            db.run('INSERT INTO candidates (name) VALUES (?)', ['Кандидат 2']);
            db.run('INSERT INTO candidates (name) VALUES (?)', ['Кандидат 3']);
        }
    });
});

const sessions = {};

// 1. Ввод номера -> Ссылка на Telegram
app.post('/api/request-code', (req, res) => {
    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });

    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('7')) phone = '8' + phone.slice(1);

    db.get('SELECT id FROM voters WHERE phone = ?', [phone], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ error: 'Этот номер уже участвовал в голосовании!' });

        const sessionId = Math.random().toString(36).substring(2, 10);

        sessions[sessionId] = {
            phone: phone,
            code: null,
            verified: false,
            expires: Date.now() + 5 * 60 * 1000
        };

        const botLink = `https://t.me/${BOT_USERNAME}?start=${sessionId}`;
        res.json({ success: true, sessionId, botLink });
    });
});

// Обработка клика в Telegram (/start)
bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const sessionId = match[1];

    if (!sessions[sessionId] || Date.now() > sessions[sessionId].expires) {
        return bot.sendMessage(chatId, 'Сессия истекла. Запросите код заново на сайте.');
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    sessions[sessionId].code = code;

    bot.sendMessage(chatId, `Ваш код для авторизации: ${code}`);
});

// 2. Проверка кода
app.post('/api/verify-code', (req, res) => {
    const { sessionId, code } = req.body;
    const session = sessions[sessionId];

    if (!session || Date.now() > session.expires) {
        return res.status(400).json({ error: 'Сессия истекла. Попробуйте снова.' });
    }

    if (session.code !== code) {
        return res.status(400).json({ error: 'Неверный код!' });
    }

    session.verified = true;
    res.json({ success: true });
});

// 3. Список кандидатов
app.get('/api/candidates', (req, res) => {
    db.all('SELECT id, name FROM candidates', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. Запись голоса и анкеты
app.post('/api/vote', (req, res) => {
    const { sessionId, fullName, grade, candidateId } = req.body;
    const session = sessions[sessionId];

    if (!session || !session.verified) {
        return res.status(403).json({ error: 'Сначала подтвердите номер телефона.' });
    }

    db.get('SELECT id FROM voters WHERE phone = ?', [session.phone], (err, row) => {
        if (row) return res.status(400).json({ error: 'Вы уже проголосовали!' });

        db.run('INSERT INTO voters (phone, fullName, grade, candidateId) VALUES (?, ?, ?, ?)',
            [session.phone, fullName, grade, candidateId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });

                db.run('UPDATE candidates SET votes = votes + 1 WHERE id = ?', [candidateId]);
                delete sessions[sessionId];
                res.json({ success: true });
            }
        );
    });
});

// === 5. АДМИНКА (СТАТИСТИКА И СПИСОК ПРОГОЛОСОВАВШИХ) ===
app.get('/api/admin/stats', (req, res) => {
    const clientPassword = req.headers['x-admin-password'];

    if (!clientPassword || clientPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Неверный личный код администратора!' });
    }

    // Подсчет голосов
    const statsQuery = `
        SELECT c.id, c.name, COUNT(v.id) as votes 
        FROM candidates c 
        LEFT JOIN voters v ON c.id = v.candidateId 
        GROUP BY c.id
    `;

    // Выгрузка полного списка с именами
    const votersQuery = `
        SELECT v.fullName, v.grade, v.phone, c.name as candidateName 
        FROM voters v 
        JOIN candidates c ON v.candidateId = c.id 
        ORDER BY v.id DESC
    `;

    db.all(statsQuery, [], (err, stats) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД: ' + err.message });

        db.all(votersQuery, [], (err, voters) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД: ' + err.message });
            res.json({ stats, voters });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
