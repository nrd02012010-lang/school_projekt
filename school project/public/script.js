let currentSessionId = null;

const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');

const btnRequestCode = document.getElementById('btn-request-code');
const btnVerifyCode = document.getElementById('btn-verify-code');
const btnVote = document.getElementById('btn-vote');
const messageDiv = document.getElementById('message');

function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${isError ? 'error' : 'success'}`;
    messageDiv.classList.remove('hidden');
}

// 1. Отправка данных регистрации и запрос ссылки в Telegram
btnRequestCode.addEventListener('click', async () => {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const grade = document.getElementById('grade').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!firstName || !lastName || !grade || !phone) {
        return showMessage('Заполните все поля!', true);
    }

    try {
        const res = await fetch('/api/request-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        currentSessionId = data.sessionId;
        document.getElementById('bot-link').href = data.botLink;

        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        showMessage('Перейдите в бота и получите код');
    } catch (err) {
        showMessage(err.message, true);
    }
});

// 2. Проверка кода
btnVerifyCode.addEventListener('click', async () => {
    const code = document.getElementById('telegramCode').value.trim();

    if (!code) return showMessage('Введите код из бота!', true);

    try {
        const res = await fetch('/api/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSessionId, code })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        step2.classList.add('hidden');
        step3.classList.remove('hidden');
        showMessage('Код подтвержден! Выберите кандидата.');

        loadCandidates();
    } catch (err) {
        showMessage(err.message, true);
    }
});

// Загрузка списка кандидатов
async function loadCandidates() {
    try {
        const res = await fetch('/api/candidates');
        const candidates = await res.json();

        const listDiv = document.getElementById('candidates-list');
        listDiv.innerHTML = '';

        candidates.forEach(c => {
            const label = document.createElement('label');
            label.className = 'candidate-option';
            label.innerHTML = `
                <input type="radio" name="candidate" value="${c.id}">
                <span>${c.name}</span>
            `;
            listDiv.appendChild(label);
        });
    } catch (err) {
        showMessage('Ошибка загрузки кандидатов', true);
    }
}

// 3. Финальное голосование
btnVote.addEventListener('click', async () => {
    const selected = document.querySelector('input[name="candidate"]:checked');
    if (!selected) return showMessage('Выберите кандидата!', true);

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const grade = document.getElementById('grade').value.trim();
    const fullName = `${firstName} ${lastName}`;

    try {
        const res = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSessionId,
                fullName,
                grade,
                candidateId: selected.value
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        step3.classList.add('hidden');
        showMessage('Ваш голос успешно принят! Спасибо за участие.');
    } catch (err) {
        showMessage(err.message, true);
    }
});
