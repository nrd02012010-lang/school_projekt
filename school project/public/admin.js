// Переменные для хранения текущей сессии
let currentLogin = '';
let currentPassword = '';

// Главная функция загрузки данных админки
async function loadAdminData() {
    const loginInput = document.getElementById('adminLogin');
    const passwordInput = document.getElementById('adminPassword');

    if (loginInput) currentLogin = loginInput.value.trim();
    if (passwordInput) currentPassword = passwordPasswordInput ? passwordInput.value.trim() : currentPassword;

    // Если значение из полей пустые, берем то, что вводили ранее
    if (!currentLogin) currentLogin = document.getElementById('adminLogin')?.value.trim() || '';
    if (!currentPassword) currentPassword = document.getElementById('adminPassword')?.value.trim() || '';

    if (!currentLogin || !currentPassword) {
        alert('Введите логин и пароль!');
        return;
    }

    try {
        const res = await fetch('/api/admin/stats', {
            headers: {
                'x-admin-login': currentLogin,
                'x-admin-password': currentPassword
            }
        });

        if (res.status === 403) {
            alert('Неверный логин или пароль!');
            return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка доступа');

        // Скрываем карточку входа и показываем основной контент
        const loginCard = document.getElementById('login-card');
        const adminContent = document.getElementById('admin-content');
        if (loginCard) loginCard.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';

        // 1. Управление режимом доступа (скрываем кнопки редактирования для завуча)
        const adminControls = document.querySelectorAll('.admin-only-control');
        adminControls.forEach(el => {
            el.style.display = data.canEdit ? 'block' : 'none';
        });

        const readOnlyBadge = document.getElementById('read-only-badge');
        if (readOnlyBadge) {
            readOnlyBadge.style.display = data.canEdit ? 'none' : 'block';
        }

        // 2. Отображение кандидатов и их голосов
        const statsDiv = document.getElementById('results-list');
        if (statsDiv) {
            statsDiv.innerHTML = '';

            if (!data.stats || data.stats.length === 0) {
                statsDiv.innerHTML = '<p>Кандидаты еще не добавлены.</p>';
            } else {
                data.stats.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'candidate-card';

                    const h4 = document.createElement('h4');
                    h4.textContent = item.name;

                    const votesDiv = document.createElement('div');
                    votesDiv.className = 'votes';
                    votesDiv.textContent = `${item.votes} голосов`;

                    card.appendChild(h4);
                    card.appendChild(votesDiv);
                    statsDiv.appendChild(card);
                });
            }
        }

        // 3. Отображение списка проголосовавших
        const tableBody = document.getElementById('voters-table');
        if (tableBody) {
            tableBody.innerHTML = '';

            if (!data.voters || data.voters.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Пока никто не проголосовал.</td></tr>';
            } else {
                data.voters.forEach(voter => {
                    const tr = document.createElement('tr');

                    const tdName = document.createElement('td');
                    tdName.textContent = voter.fullName;

                    const tdGrade = document.createElement('td');
                    tdGrade.textContent = voter.grade;

                    const tdPhone = document.createElement('td');
                    tdPhone.textContent = voter.phone;

                    const tdChoice = document.createElement('td');

                    if (!data.canEdit) {
                        // Режим завуча (только просмотр)
                        const b = document.createElement('b');
                        b.style.color = '#00ff66';
                        b.textContent = voter.candidateName;
                        tdChoice.appendChild(b);
                    } else {
                        // Режим полного админа (выпадающий список для изменения выбора)
                        const select = document.createElement('select');
                        select.className = 'candidate-select';
                        select.setAttribute('data-voter-id', voter.id);

                        data.stats.forEach(cand => {
                            const opt = document.createElement('option');
                            opt.value = cand.id;
                            opt.textContent = cand.name;
                            if (cand.name === voter.candidateName) {
                                opt.selected = true;
                            }
                            select.appendChild(opt);
                        });

                        select.addEventListener('change', async (e) => {
                            const voterId = e.target.getAttribute('data-voter-id');
                            const newCandidateId = e.target.value;
                            await changeVoterCandidate(voterId, newCandidateId);
                        });

                        tdChoice.appendChild(select);
                    }

                    tr.appendChild(tdName);
                    tr.appendChild(tdGrade);
                    tr.appendChild(tdPhone);
                    tr.appendChild(tdChoice);

                    tableBody.appendChild(tr);
                });
            }
        }

    } catch (err) {
        alert('Ошибка при загрузке данных: ' + err.message);
    }
}

// Функция добавления нового кандидата
async function addCandidate() {
    const nameInput = document.getElementById('candName');
    const classInput = document.getElementById('candClass');

    const name = nameInput ? nameInput.value.trim() : '';
    const grade = classInput ? classInput.value.trim() : '';

    if (!name) return alert('Введите имя кандидата!');

    try {
        const res = await fetch('/api/admin/add-candidate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': currentPassword
            },
            body: JSON.stringify({ name, grade })
        });

        if (res.ok) {
            alert('Кандидат успешно добавлен!');
            if (nameInput) nameInput.value = '';
            if (classInput) classInput.value = '';
            loadAdminData();
        } else {
            const errData = await res.json();
            alert('Ошибка при добавлении: ' + (errData.error || 'Неизвестная ошибка'));
        }
    } catch (err) {
        alert('Ошибка сети: ' + err.message);
    }
}

// Функция быстрой смены голоса участника
async function changeVoterCandidate(voterId, newCandidateId) {
    try {
        const res = await fetch('/api/admin/change-voter-candidate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': currentPassword
            },
            body: JSON.stringify({ voterId, newCandidateId })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Ошибка смены голоса');

        // Перезагружаем интерфейс для синхронизации всех данных
        loadAdminData();
    } catch (err) {
        alert('Не удалось изменить голос: ' + err.message);
        loadAdminData();
    }
}
