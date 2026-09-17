let currentSessionId = null;

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

// Админка
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

function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${isError ? 'error' : 'success'}`;
    messageDiv.classList.remove('hidden');
}

// 1. Запрос кода
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

        if (!res.ok) throw new Error(data.error);

        currentSessionId = data.sessionId;
        
        btnBotLink.href = data.botLink;
        btnBotLink.classList.remove('hidden');

        showMessage('Нажмите синюю кнопку ниже, чтобы перейти в бота!');
    } catch (err) {
        showMessage(err.message, true);
    }
});

// 2. Проверка кода из бота
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

        if (!res.ok) throw new Error(data.error);

        authSection.classList.add('hidden');
        voteSection.classList.remove('hidden');
        showMessage('Номер подтвержден! Заполните анкету.');
        loadCandidates();
    } catch (err) {
        showMessage(err.message, true);
    }
});

// 3. Загрузка кандидатов для голосования учеников
async function loadCandidates() {
    try {
        const res = await fetch('/api/candidates');
        const candidates = await res.json();

        candidatesList.innerHTML = '';
        candidates.forEach(c => {
            const div = document.createElement('div');
            div.className = 'candidate-option';
            div.style.cssText = 'display:flex; gap:15px; align-items:center; text-align:left; padding:12px; margin-bottom:10px; cursor:pointer; border:1px solid #444; border-radius:8px;';
            
            const photoHtml = c.photoUrl ? `<img src="${c.photoUrl}" style="width:60px; height:60px; object-fit:cover; border-radius:50%; flex-shrink:0;">` : '';
            const gradeHtml = c.grade ? `<span style="color:#00d2ff; font-size:14px;"> (${c.grade})</span>` : '';
            const descHtml = c.description ? `<p style="font-size:12px; color:#aaa; margin:4px 0 0 0;">${c.description}</p>` : '';

            div.innerHTML = `
                ${photoHtml}
                <div>
                    <strong>${c.name}</strong>${gradeHtml}
                    ${descHtml}
                </div>
            `;

            div.onclick = () => {
                document.querySelectorAll('.candidate-option').forEach(el => el.style.borderColor = '#444');
                div.style.borderColor = '#00d2ff';
                selectedCandidateId = c.id;
            };
            candidatesList.appendChild(div);
        });
    } catch (err) {
        showMessage('Ошибка загрузки кандидатов', true);
    }
}

// 4. Отправка голоса
btnSubmitVote.addEventListener('click', async () => {
    const fullName = document.getElementById('fullName').value.trim();
    const grade = document.getElementById('grade').value.trim();

    if (!fullName || !grade || !selectedCandidateId) {
        return showMessage('Заполните все поля и выберите кандидата!', true);
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

        if (!res.ok) throw new Error(data.error);

        voteSection.classList.add('hidden');
        showMessage('Спасибо! Ваш голос учтен.');
    } catch (err) {
        showMessage(err.message, true);
    }
});

// === ЛОГИКА АДМИНКИ ===

btnGear.addEventListener('click', () => {
    authSection.classList.add('hidden');
    voteSection.classList.add('hidden');
    adminLoginSection.classList.remove('hidden');
});

btnAdminClose.addEventListener('click', () => {
    adminLoginSection.classList.add('hidden');
    authSection.classList.remove('hidden');
});

btnAdminLogin.addEventListener('click', async () => {
    const phone = adminPhoneInput.value.trim();
    currentAdminPassword = adminPasswordInput.value.trim();

    if (!phone) return showMessage('Введите ваш телефон!', true);
    if (!currentAdminPassword) return showMessage('Введите пароль админа!', true);

    await loadAdminStats();
});

btnAdminRefresh.addEventListener('click', loadAdminStats);

btnAdminExit.addEventListener('click', () => {
    adminPanelSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    currentAdminPassword = '';
});

// Добавление нового кандидата с доп. инфой
if (btnAddCandidate) {
    btnAddCandidate.addEventListener('click', async () => {
        const name = newCandidateName.value.trim();
        const grade = newCandidateGrade.value.trim();
        const photoUrl = newCandidatePhoto.value.trim();
        const description = newCandidateDescription.value.trim();

        if (!name) return showMessage('Введите ФИО кандидата!', true);

        try {
            const res = await fetch('/api/admin/add-candidate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': currentAdminPassword
                },
                body: JSON.stringify({ name, grade, photoUrl, description })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            // Очищаем поля ввода
            newCandidateName.value = '';
            newCandidateGrade.value = '';
            newCandidatePhoto.value = '';
            newCandidateDescription.value = '';

            showMessage('Кандидат успешно добавлен!');
            await loadAdminStats();
        } catch (err) {
            showMessage(err.message, true);
        }
    });
}

// Удаление кандидата
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

        if (!res.ok) throw new Error(data.error);

        showMessage('Кандидат удален');
        await loadAdminStats();
    } catch (err) {
        showMessage(err.message, true);
    }
}

// Загрузка данных админки
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

        // Список кандидатов в панели админа
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

        // Результаты голосов
        const statsDiv = document.getElementById('results-stats');
        statsDiv.innerHTML = '';
        if (!data.stats || data.stats.length === 0) {
            statsDiv.innerHTML = '<p>Кандидатов пока нет.</p>';
        } else {
            data.stats.forEach(item => {
                const div = document.createElement('div');
                div.className = 'candidate-option';
                div.style.cursor = 'default';
                div.innerHTML = `<strong>${item.name}</strong>: <span style="color:#00d2ff; font-size:18px; font-weight:bold;">${item.votes}</span> голосов`;
                statsDiv.appendChild(div);
            });
        }

        // Таблица проголосовавших
        const tableBody = document.getElementById('votes-table-body');
        tableBody.innerHTML = '';
        if (!data.voters || data.voters.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">Пока никто не проголосовал.</td></tr>';
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
