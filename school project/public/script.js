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

// Элементы шестеренки и админки (обновлены под новые ID)
const btnGear = document.getElementById('btn-gear');
const adminLoginSection = document.getElementById('admin-login-section');
const adminPanelSection = document.getElementById('admin-panel-section');
const adminLoginInput = document.getElementById('admin-login');
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
let currentAdminLogin = '';
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
        btnBotLink.style.display = 'block';

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
            
            if (c.photoUrl) {
                const img = document.createElement('img');
                img.src = c.photoUrl;
                img.alt = c.name;
                card.appendChild(img);
            }

            const h3 = document.createElement('h3');
            h3.textContent = c.name;
            card.appendChild(h3);

            if (c.grade) {
                const gradeBadge = document.createElement('div');
                gradeBadge.className = 'grade-badge';
                gradeBadge.textContent = c.grade;
                card.appendChild(gradeBadge);
            }

            if (c.description) {
                const p = document.createElement('p');
                p.textContent = c.description;
                card.appendChild(p);
            }

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

// Вход в панель админа по логину и паролю
btnAdminLogin.addEventListener('click', async () => {
    currentAdminLogin = adminLoginInput.value.trim();
    currentAdminPassword = adminPasswordInput.value.trim();

    if (!currentAdminLogin) return showMessage('Введите логин!', true);
    if (!currentAdminPassword) return showMessage('Введите пароль админа!', true);

    await loadAdminStats();
});

// Кнопка обновления статистики
btnAdminRefresh.addEventListener('click', loadAdminStats);

// Выход из панели админа
btnAdminExit.addEventListener('click', () => {
    adminPanelSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    currentAdminLogin = '';
    currentAdminPassword = '';
    if (adminLoginInput) adminLoginInput.value = '';
    if (adminPasswordInput) adminPasswordInput.value = '';
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
                    'x-admin-login': currentAdminLogin,
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
                'x-admin-login': currentAdminLogin,
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

// Функции ручного управления баллами (+1 / -1)
async function addVote(candidateId) {
    try {
        const res = await fetch('/api/admin/add-vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-login': currentAdminLogin,
                'x-admin-password': currentAdminPassword
            },
            body: JSON.stringify({ candidateId })
        });
        if (!res.ok) throw new Error('Ошибка');
        await loadAdminStats();
    } catch (err) {
        showMessage('Не удалось прибавить голос', true);
    }
}

async function subVote(candidateId) {
    try {
        const res = await fetch('/api/admin/sub-vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-login': currentAdminLogin,
                'x-admin-password': currentAdminPassword
            },
            body: JSON.stringify({ candidateId })
        });
        if (!res.ok) throw new Error('Ошибка');
        await loadAdminStats();
    } catch (err) {
        showMessage('Не удалось убавить голос', true);
    }
}

// Функция сброса голоса ученика (дает шанс пройти заново)
async function resetVoter(voterId) {
    if (!confirm('Сбросить голос этого ученика? Он сможет проголосовать заново.')) return;

    try {
        const res = await fetch('/api/admin/reset-voter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-login': currentAdminLogin,
                'x-admin-password': currentAdminPassword
            },
            body: JSON.stringify({ voterId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка сброса');

        showMessage('Голос ученика сброшен!');
        await loadAdminStats();
    } catch (err) {
        showMessage(err.message, true);
    }
}

// Функция смены кандидата для конкретного ученика (админ-режим)
async function changeVoterCandidate(voterId, newCandidateId) {
    try {
        const res = await fetch('/api/admin/change-voter-candidate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-login': currentAdminLogin,
                'x-admin-password': currentAdminPassword
            },
            body: JSON.stringify({ voterId, newCandidateId })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка при изменении выбора');

        await loadAdminStats();
    } catch (err) {
        showMessage(err.message, true);
        await loadAdminStats();
    }
}

// Загрузка статистики голосов и таблицы учеников для админки
async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/stats', {
            headers: {
                'x-admin-login': currentAdminLogin,
                'x-admin-password': currentAdminPassword
            }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Неверный логин или пароль!');

        adminLoginSection.classList.add('hidden');
        adminPanelSection.classList.remove('hidden');
        messageDiv.classList.add('hidden');

        // Управление видимостью элементов для завуча (canEdit === false)
        const adminControls = document.querySelectorAll('.admin-only-control');
        adminControls.forEach(el => {
            el.style.display = data.canEdit ? 'block' : 'none';
        });

        const readOnlyBadge = document.getElementById('read-only-badge');
        if (readOnlyBadge) {
            readOnlyBadge.style.display = data.canEdit ? 'none' : 'block';
        }

        // Вывод кандидатов в списке управления админки (с кнопкой удаления для админа)
        if (adminCandidatesList && data.canEdit) {
            const candRes = await fetch('/api/candidates');
            const candidates = await candRes.json();
            
            adminCandidatesList.innerHTML = '';
            candidates.forEach(c => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#222; padding:8px 12px; margin-bottom:5px; border-radius:5px;';
                
                const span = document.createElement('span');
                span.textContent = `${c.name} ${c.grade ? `(${c.grade})` : ''}`;

                const btn = document.createElement('button');
                btn.style.cssText = 'background:#ff4444; color:#fff; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;';
                btn.textContent = 'Удалить';
                btn.onclick = () => deleteCandidate(c.id);

                div.appendChild(span);
                div.appendChild(btn);
                adminCandidatesList.appendChild(div);
            });
        }

        // Вывод результатов голосования и кнопок ручного управления баллами (+1 / -1)
        const statsDiv = document.getElementById('results-stats');
        statsDiv.innerHTML = '';
        if (!data.stats || data.stats.length === 0) {
            statsDiv.innerHTML = '<p>Кандидатов пока нет.</p>';
        } else {
            data.stats.forEach(item => {
                const div = document.createElement('div');
                div.style.cssText = 'background:#222; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;';
                
                const spanInfo = document.createElement('span');
                spanInfo.innerHTML = `<strong>${item.name}</strong> — <span style="color:#00d2ff; font-weight:bold; font-size:16px;">${item.votes}</span> гол.`;

                div.appendChild(spanInfo);

                if (data.canEdit) {
                    const btnBox = document.createElement('div');

                    const btnSub = document.createElement('button');
                    btnSub.style.cssText = 'background:#ff4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:4px;';
                    btnSub.textContent = '-1';
                    btnSub.onclick = () => subVote(item.id);

                    const btnAdd = document.createElement('button');
                    btnAdd.style.cssText = 'background:#00C851; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;';
                    btnAdd.textContent = '+1';
                    btnAdd.onclick = () => addVote(item.id);

                    btnBox.appendChild(btnSub);
                    btnBox.appendChild(btnAdd);
                    div.appendChild(btnBox);
                }

                statsDiv.appendChild(div);
            });
        }

        // Таблица проголосовавших учеников
        const tableBody = document.getElementById('votes-table-body');
        tableBody.innerHTML = '';
        if (!data.voters || data.voters.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="padding:10px; text-align:center;">Пока никто не проголосовал.</td></tr>';
        } else {
            data.voters.forEach(voter => {
                const tr = document.createElement('tr');

                const tdName = document.createElement('td');
                tdName.textContent = voter.fullName;

                const tdGrade = document.createElement('td');
                tdGrade.textContent = voter.grade;

                const tdPhone = document.createElement('td');
                tdPhone.textContent = voter.phone;

                const tdCand = document.createElement('td');
                
                if (!data.canEdit) {
                    // Текстовый вывод для завуча
                    tdCand.style.color = '#00d2ff';
                    tdCand.textContent = voter.candidateName;
                } else {
                    // Выпадающий список смены кандидата для тебя
                    const select = document.createElement('select');
                    select.style.cssText = 'background:#111; color:#00d2ff; border:1px solid #444; padding:4px; border-radius:4px;';
                    
                    data.stats.forEach(cand => {
                        const opt = document.createElement('option');
                        opt.value = cand.id;
                        opt.textContent = cand.name;
                        if (cand.name === voter.candidateName) opt.selected = true;
                        select.appendChild(opt);
                    });

                    select.onchange = (e) => changeVoterCandidate(voter.id, e.target.value);
                    tdCand.appendChild(select);
                }

                tr.appendChild(tdName);
                tr.appendChild(tdGrade);
                tr.appendChild(tdPhone);
                tr.appendChild(tdCand);

                if (data.canEdit) {
                    const tdAction = document.createElement('td');
                    const btnReset = document.createElement('button');
                    btnReset.style.cssText = 'background:#ffbb33; color:#000; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:bold;';
                    btnReset.textContent = 'Сбросить';
                    btnReset.onclick = () => resetVoter(voter.id);
                    tdAction.appendChild(btnReset);
                    tr.appendChild(tdAction);
                }

                tableBody.appendChild(tr);
            });
        }
    } catch (err) {
        showMessage(err.message, true);
    }
}
