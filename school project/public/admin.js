const loginCard = document.getElementById('login-card');
const adminPanel = document.getElementById('admin-panel');
const adminPasswordInput = document.getElementById('adminPassword');
const btnLogin = document.getElementById('btn-login');
const btnRefresh = document.getElementById('btn-refresh');
const messageDiv = document.getElementById('message');

let currentPassword = '';

function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${isError ? 'error' : 'success'}`;
    messageDiv.classList.remove('hidden');
}

btnLogin.addEventListener('click', () => {
    currentPassword = adminPasswordInput.value.trim();
    if (!currentPassword) return showMessage('Введите личный код доступа!', true);
    loadAdminData();
});

adminPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnLogin.click();
    }
});

btnRefresh.addEventListener('click', loadAdminData);

async function loadAdminData() {
    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'x-admin-password': currentPassword }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка доступа');

        loginCard.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        messageDiv.classList.add('hidden');

        // Вывод количества голосов по кандидатам
        const statsDiv = document.getElementById('results-stats');
        statsDiv.innerHTML = '';
        if (!data.stats || data.stats.length === 0) {
            statsDiv.innerHTML = '<p>Кандидаты еще не добавлены.</p>';
        } else {
            data.stats.forEach(item => {
                const div = document.createElement('div');
                div.className = 'candidate-option';
                div.style.cursor = 'default';
                div.innerHTML = `<strong>${item.name}</strong>: <span style="color: #00ff66; font-size: 18px;">${item.votes}</span> голосов`;
                statsDiv.appendChild(div);
            });
        }

        // Вывод таблицы участников
        const tableBody = document.getElementById('votes-table-body');
        tableBody.innerHTML = '';
        if (!data.voters || data.voters.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="padding: 10px;">Пока никто не проголосовал.</td></tr>';
        } else {
            data.voters.forEach(voter => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';
                tr.innerHTML = `
                    <td style="padding: 10px;">${voter.fullName}</td>
                    <td style="padding: 10px;">${voter.grade}</td>
                    <td style="padding: 10px;">${voter.phone}</td>
                    <td style="padding: 10px; color: #00ff66;">${voter.candidateName}</td>
                `;
                tableBody.appendChild(tr);
            });
        }

    } catch (err) {
        showMessage(err.message, true);
    }
}
