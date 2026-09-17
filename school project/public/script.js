let currentSessionId = null;

const authScreen = document.getElementById('auth-screen');
const telegramBlock = document.getElementById('telegram-block');
const voteScreen = document.getElementById('vote-screen');

const btnGetCode = document.getElementById('btn-get-code');
const btnVerifyCode = document.getElementById('btn-verify-code');
const btnVote = document.getElementById('btn-vote');
const messageDiv = document.getElementById('message');

function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${isError ? 'error' : 'success'}`;
    messageDiv.classList.remove('hidden');
}

// 1. Ввод телефона -> получаем ссылку
btnGetCode.addEventListener('click', async () => {
    const phone = document.getElementById('phone').value.trim();
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
        document.getElementById('bot-link').href = data.botLink;
        telegramBlock.classList.remove('hidden');
        showMessage('Перейдите в ТГ бота и получите код');
    } catch (err) {
        showMessage(err.message, true);
    }
});

// 2. Ввод кода -> проверка и переход к анкете
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

        authScreen.classList.add('hidden');
        voteScreen.classList.remove('hidden');
        showMessage('Код подтвержден. Заполните данные!');

        loadCandidates();
    } catch (err) {
        showMessage(err.message, true);
    }
});

// Загрузка кандидатов
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

// 3. Финальная отправка голоса
btnVote.addEventListener('click', async () => {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const grade = document.getElementById('grade').value.trim();
    const selected = document.querySelector('input[name="candidate"]:checked');

    if (!firstName || !lastName || !grade) return showMessage('Заполните Имя, Фамилию и Класс!', true);
    if (!selected) return showMessage('Выберите кандидата!', true);

    try {
        const res = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSessionId,
                fullName: `${firstName} ${lastName}`,
                grade,
                candidateId: selected.value
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        voteScreen.classList.add('hidden');
        showMessage('Ваш голос успешно принят! Спасибо за участие.');
    } catch (err) {
        showMessage(err.message, true);
    }
});
