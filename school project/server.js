const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('school_electionsbot');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '02012010r';

// Твой токен и бот прописаны напрямую
const BOT_USERNAME = 'school_voting_bot'; // Если у твоего бота другое username начни с него (без собаки)
const BOT_TOKEN = '8830924380:AAG05JEwPrFUL8u8VK1mevcZOzFEsT89t_g';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const db = new sqlite3.Database('./database.db');

// Хранилище для загружаемых фото кандидатов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Создание таблиц БД
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        grade TEXT,
        description TEXT,
        photoUrl TEXT,
        votes INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS voters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        fullName TEXT,
        grade TEXT,
        candidateId INTEGER
    )`);
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

// Обработка /start в Telegram
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

// 3. Получение списка кандидатов
app.get('/api/candidates', (req, res) => {
    db.all('SELECT id, name, grade, description, photoUrl FROM candidates', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. Отправка голоса
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

// === 5. АДМИНКА ===

// Статистика
app.get('/api/admin/stats', (req, res) => {
    const clientPassword = req.headers['x-admin-password'];

    if (!clientPassword || clientPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Неверный личный код администратора!' });
    }

    const statsQuery = `
        SELECT c.id, c.name, COUNT(v.id) as votes 
        FROM candidates c 
        LEFT JOIN voters v ON c.id = v.candidateId 
        GROUP BY c.id
    `;

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

// Добавление кандидата
app.post('/api/admin/add-candidate', upload.single('photo'), (req, res) => {
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Неверный пароль админа' });
    }

    const { name, grade, description } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Введите имя кандидата' });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(
        'INSERT INTO candidates (name, grade, description, photoUrl) VALUES (?, ?, ?, ?)',
        [name.trim(), grade ? grade.trim() : '', description ? description.trim() : '', photoUrl],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Удаление кандидата
app.post('/api/admin/delete-candidate', (req, res) => {
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Неверный пароль админа' });
    }

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Не указан ID кандидата' });

    db.run('DELETE FROM candidates WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
