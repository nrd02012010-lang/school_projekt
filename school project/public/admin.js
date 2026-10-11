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

        // Вывод таблицы участников с возможностью смены кандидата
        const tableBody = document.getElementById('votes-table-body');
        tableBody.innerHTML = '';
        if (!data.voters || data.voters.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="padding: 10px;">Пока никто не проголосовал.</td></tr>';
        } else {
            data.voters.forEach(voter => {
                // Создаем выпадающий список со всеми кандидатами
                let optionsHtml = '';
                data.stats.forEach(cand => {
                    const isSelected = cand.name === voter.candidateName ? 'selected' : '';
                    optionsHtml += `<option value="${cand.id}" ${isSelected}>${cand.name}</option>`;
                });

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';
                tr.innerHTML = `
                    <td style="padding: 10px;">${voter.fullName}</td>
                    <td style="padding: 10px;">${voter.grade}</td>
                    <td style="padding: 10px;">${voter.phone}</td>
                    <td style="padding: 10px;">
                        <select class="candidate-select" data-voter-id="${voter.id}" style="background: #222; color: #fff; border: 1px solid #444; padding: 5px; border-radius: 4px;">
                            ${optionsHtml}
                        </select>
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            // Навешиваем событие изменения на каждый селект
            document.querySelectorAll('.candidate-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const voterId = e.target.getAttribute('data-voter-id');
                    const newCandidateId = e.target.value;

                    try {
                        const response = await fetch('/api/admin/change-voter-candidate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-admin-password': currentPassword
                            },
                            body: JSON.stringify({ voterId, newCandidateId })
                        });

                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || 'Ошибка при смене выбора');

                        // Перезагружаем данные админки, чтобы обновились и голоса, и таблица
                        loadAdminData();
                    } catch (err) {
                        alert('Не удалось изменить голос: ' + err.message);
                        loadAdminData(); // Возвращаем селект в исходное положение при ошибке
                    }
                });
            });
        }

    } catch (err) {
        showMessage(err.message, true);
    }
}
