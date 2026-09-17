const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// твой номер телефона для входа в админку
const ADMIN_PHONE = '87476475569'; 

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Ошибка БД:', err);
    else console.log('База данных подключена.');
});

// Создание таблиц
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            class TEXT NOT NULL,
            photo_url TEXT DEFAULT '',
            votes_count INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS voters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            user_class TEXT NOT NULL,
            voted_candidate_id INTEGER,
            FOREIGN KEY (voted_candidate_id) REFERENCES candidates (id)
        )
    `);
});

// --- API: Для учеников ---

// Получить список кандидатов
app.get('/api/candidates', (req, res) => {
    db.all('SELECT id, name, class, photo_url, votes_count FROM candidates', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Проверить статус голоса по номеру телефона
app.post('/api/check-voter', (req, res) => {
    const { phone } = req.body;
    db.get('SELECT * FROM voters WHERE phone = ?', [phone], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            return res.json({ registered: true, votedCandidateId: row.voted_candidate_id });
        }
        res.json({ registered: false });
    });
});

// Голосование
app.post('/api/vote', (req, res) => {
    const { phone, firstName, lastName, userClass, candidateId } = req.body;

    if (!phone || !firstName || !lastName || !userClass || !candidateId) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }

    db.get('SELECT * FROM voters WHERE phone = ?', [phone], (err, voter) => {
        if (err) return res.status(500).json({ error: err.message });
        if (voter) {
            return res.status(400).json({ error: 'Вы уже голосовали с этого номера!' });
        }

        db.run(
            'INSERT INTO voters (phone, first_name, last_name, user_class, voted_candidate_id) VALUES (?, ?, ?, ?, ?)',
            [phone, firstName, lastName, userClass, candidateId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });

                db.run('UPDATE candidates SET votes_count = votes_count + 1 WHERE id = ?', [candidateId]);
                res.json({ success: true });
            }
        );
    });
});

// --- API: Для админки ---

// Добавить кандидата
app.post('/api/admin/add-candidate', (req, res) => {
    const { adminPhone, name, candidateClass, photoUrl } = req.body;
    if (adminPhone !== ADMIN_PHONE) return res.status(403).json({ error: 'Доступ запрещен' });

    db.run(
        'INSERT INTO candidates (name, class, photo_url) VALUES (?, ?, ?)',
        [name, candidateClass, photoUrl || ''],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Получить список всех проголосовавших
app.post('/api/admin/voters', (req, res) => {
    const { adminPhone } = req.body;
    if (adminPhone !== ADMIN_PHONE) return res.status(403).json({ error: 'Доступ запрещен' });

    const query = `
        SELECT voters.id, voters.phone, voters.first_name, voters.last_name, voters.user_class, candidates.name as candidate_name 
        FROM voters 
        LEFT JOIN candidates ON voters.voted_candidate_id = candidates.id
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Удалить фейковый голос
app.post('/api/admin/delete-voter', (req, res) => {
    const { adminPhone, voterId } = req.body;
    if (adminPhone !== ADMIN_PHONE) return res.status(403).json({ error: 'Доступ запрещен' });

    db.get('SELECT voted_candidate_id FROM voters WHERE id = ?', [voterId], (err, voter) => {
        if (err || !voter) return res.status(404).json({ error: 'Голос не найден' });

        db.run('UPDATE candidates SET votes_count = votes_count - 1 WHERE id = ?', [voter.voted_candidate_id], () => {
            db.run('DELETE FROM voters WHERE id = ?', [voterId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
