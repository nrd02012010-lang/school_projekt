let currentSessionId = null;

// Элементы авторизации и голосования
const phoneInput = document.getElementById('phone');
const btnGetCode = document.getElementById('btn-get-code');
const btnBotLink = document.getElementById('btn-bot-link');
const codeInput = document.getElementById('code');
const btnVerify = document.getElementById('btn-verify');
const authSection = document.getElementById('auth-section');
const voteSection = document.getElementById('vote-section');
const candidatesList = document.getElementById('candidates-list');
const btnSubmitVote = document.getElementById('btn-submit-vote');
const messageDiv = document.getElementById('message');

// Элементы шестеренки и админки
const btnGear = document.getElementById('btn-gear');
const adminLoginSection = document.getElementById('admin-login-section');
const adminPanelSection = document.getElementById('admin-panel-section');
const adminPhoneInput = document.getElementById('admin-phone');
const adminPasswordInput = document.getElementById('admin-password');
const btnAdminLogin = document.getElementById('btn-admin-login');
const btnAdminClose = document.getElementById('btn-admin-close');
const btnAdminRefresh = document.getElementById('btn-admin-refresh');
const btnAdminExit = document.getElementById('btn-admin-exit');

// Поля добавления кандидата
const newCandidateName = document.getElementById('new-candidate-name');
const newCandidateGrade = document.getElementById('new-candidate-grade');
const newCandidatePhoto = document.getElementById('new-candidate-photo');
const newCandidateDescription = document.getElementById('new-candidate-description');
const btnAddCandidate = document.getElementById('btn-add-candidate');
const adminCandidatesList = document.getElementById('admin-candidates-list');

let selectedCandidateId = null;
let currentAdminPassword = '';

// Вспомогательная функция вывода уведомлений
function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${isError ? 'error' : 'success'}`;
    messageDiv.classList.remove('hidden');
}

// 1. Запрос кода (Получение ссылки на бота)
btnGetCode.addEventListener('click', async () => {
    const phone = phoneInput.value.trim();
    if (!phone) return showMessage('Введите номер телефона!', true);

    try {
        const res = await fetch('/api/request-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Ошибка запроса кода');

        currentSessionId = data.sessionId;
        btnBotLink.href = data.botLink;
        btnBotLink.classList.remove('hidden');

        showMessage('Нажмите синюю кнопку ниже, чтобы перейти в бота!');
    } catch (err) {
        showMessage(err.message, true);
    }
});

// 2. Проверка 4-значного кода из Telegram
btnVerify.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code || !currentSessionId) return showMessage('Сначала получите код!', true);

    try {
        const res = await fetch('/api/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSessionId, code })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Неверный код!');

        authSection.classList.add('hidden');
        voteSection.classList.remove('hidden');
        showMessage('Номер подтвержден! Заполните анкету.');
        loadCandidates();
    } catch (err) {
        showMessage(err.message, true);
    }
});

// 3. Загрузка кандидатов в виде интерактивной ленты карточек
async function loadCandidates() {
    try {
        const res = await fetch('/api/candidates');
        const candidates = await res.json();

        candidatesList.innerHTML = '';
        if (!candidates || candidates.length === 0) {
            candidatesList.innerHTML = '<p style="color:#aaa;">Список кандидатов пока пуст.</p>';
            return;
        }

        candidates.forEach(c => {
            const card = document.createElement('div');
            card.className = 'candidate-card';
            
            const photoHtml = c.photoUrl ? `<img src="${c.photoUrl}" alt="${c.name}">` : '';
            const gradeHtml = c.grade ? `<div class="grade-badge">${c.grade}</div>` : '';
            const descHtml = c.description ? `<p>${c.description}</p>` : '';

            card.innerHTML = `
                ${photoHtml}
                <h3>${c.name}</h3>
                ${gradeHtml}
                ${descHtml}
            `;

            // Выбор кандидата при клике/тапе по карточке
            card.onclick = () => {
                document.querySelectorAll('.candidate-card').forEach(el => el.classList.remove('selected'));
                card.classList.add('selected');
                selectedCandidateId = c.id;
            };

            candidatesList.appendChild(card);
        });
    } catch (err) {
        showMessage('Ошибка загрузки кандидатов', true);
    }
}

// 4. Отправка голоса ученика
btnSubmitVote.addEventListener('click', async () => {
    const fullName = document.getElementById('fullName').value.trim();
    const grade = document.getElementById('grade').value.trim();

    if (!fullName || !grade) {
        return showMessage('Введите ваше ФИО и класс!', true);
    }
    if (!selectedCandidateId) {
        return showMessage('Выберите кандидата из списка!', true);
    }

    try {
        const res = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSessionId,
                fullName,
                grade,
                candidateId: selectedCandidateId
            })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Ошибка при отправке голоса');

        voteSection.classList.add('hidden');
        showMessage('Спасибо! Ваш голос успешно учтен.');
    } catch (err) {
        showMessage(err.message, true);
    }
});

// === ЛОГИКА АДМИН-ПАНЕЛИ ===

// Переключение на окно входа в админку по клику на шестеренку
btnGear.addEventListener('click', () => {
    authSection.classList.add('hidden');
    voteSection.classList.add('hidden');
    adminLoginSection.classList.remove('hidden');
});

// Закрытие окна админки
btnAdminClose.addEventListener('click', () => {
    adminLoginSection.classList.add('hidden');
    authSection.classList.remove('hidden');
});

// Вход в панель админа
btnAdminLogin.addEventListener('click', async () => {
    const phone = adminPhoneInput.value.trim();
    currentAdminPassword = adminPasswordInput.value.trim();

    if (!phone) return showMessage('Введите ваш телефон!', true);
    if (!currentAdminPassword) return showMessage('Введите пароль админа!', true);

    await loadAdminStats();
});

// Кнопка обновления статистики
btnAdminRefresh.addEventListener('click', loadAdminStats);

// Выход из панели админа
btnAdminExit.addEventListener('click', () => {
    adminPanelSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    currentAdminPassword = '';
});

// Добавление нового кандидата с отправкой фото через FormData
if (btnAddCandidate) {
    btnAddCandidate.addEventListener('click', async () => {
        const name = newCandidateName.value.trim();
        const grade = newCandidateGrade.value.trim();
        const description = newCandidateDescription.value.trim();
        const photoFile = newCandidatePhoto.files[0];

        if (!name) return showMessage('Введите ФИО кандидата!', true);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('grade', grade);
        formData.append('description', description);
        if (photoFile) {
            formData.append('photo', photoFile);
        }

        try {
            const res = await fetch('/api/admin/add-candidate', {
                method: 'POST',
                headers: {
                    'x-admin-password': currentAdminPassword
                },
                body: formData
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Ошибка добавления кандидата');

            // Очищаем поля формы
            newCandidateName.value = '';
            newCandidateGrade.value = '';
            newCandidateDescription.value = '';
            newCandidatePhoto.value = '';

            showMessage('Кандидат успешно добавлен!');
            await loadAdminStats();
        } catch (err) {
            showMessage(err.message, true);
        }
    });
}

// Удаление кандидата админом
async function deleteCandidate(id) {
    if (!confirm('Удалить этого кандидата?')) return;

    try {
        const res = await fetch('/api/admin/delete-candidate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': currentAdminPassword
            },
            body: JSON.stringify({ id })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Ошибка удаления кандидата');

        showMessage('Кандидат удален');
        await loadAdminStats();
    } catch (err) {
        showMessage(err.message, true);
    }
}

// Загрузка статистики голосов и таблицы учеников для админки
async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'x-admin-password': currentAdminPassword }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Неверный пароль!');

        adminLoginSection.classList.add('hidden');
        adminPanelSection.classList.remove('hidden');
        messageDiv.classList.add('hidden');

        // Вывод кандидатов в списке управления админки
        if (adminCandidatesList) {
            const candRes = await fetch('/api/candidates');
            const candidates = await candRes.json();
            
            adminCandidatesList.innerHTML = '';
            candidates.forEach(c => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#222; padding:8px 12px; margin-bottom:5px; border-radius:5px;';
                div.innerHTML = `
                    <span><strong>${c.name}</strong> ${c.grade ? `(${c.grade})` : ''}</span>
                    <button onclick="deleteCandidate(${c.id})" style="background:#ff4444; color:#fff; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;">Удалить</button>
                `;
                adminCandidatesList.appendChild(div);
            });
        }

        // Подсчет и вывод результатов голосования
        const statsDiv = document.getElementById('results-stats');
        statsDiv.innerHTML = '';
        if (!data.stats || data.stats.length === 0) {
            statsDiv.innerHTML = '<p>Кандидатов пока нет.</p>';
        } else {
            data.stats.forEach(item => {
                const div = document.createElement('div');
                div.style.cssText = 'background:#222; padding:10px; border-radius:8px; margin-bottom:8px;';
                div.innerHTML = `<strong>${item.name}</strong>: <span style="color:#00d2ff; font-size:18px; font-weight:bold;">${item.votes}</span> голосов`;
                statsDiv.appendChild(div);
            });
        }

        // Таблица проголосовавших учеников
        const tableBody = document.getElementById('votes-table-body');
        tableBody.innerHTML = '';
        if (!data.voters || data.voters.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="padding:10px; text-align:center;">Пока никто не проголосовал.</td></tr>';
        } else {
            data.voters.forEach(voter => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${voter.fullName}</td>
                    <td>${voter.grade}</td>
                    <td>${voter.phone}</td>
                    <td style="color:#00d2ff;">${voter.candidateName}</td>
                `;
                tableBody.appendChild(tr);
            });
        }
    } catch (err) {
        showMessage(err.message, true);
    }
}
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

// 3. Список кандидатов (для всех)
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

// === 5. АДМИНКА (СТАТИСТИКА И УПРАВЛЕНИЕ КАНДИДАТАМИ) ===

// Получение статистики и списка проголосовавших
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

// Добавить кандидата (только для админа)
app.post('/api/admin/add-candidate', (req, res) => {
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Неверный пароль админа' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Введите имя кандидата' });
    }

    db.run('INSERT INTO candidates (name) VALUES (?)', [name.trim()], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID, name: name.trim() });
    });
});

// Удалить кандидата (только для админа)
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
