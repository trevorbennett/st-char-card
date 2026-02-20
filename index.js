(function () {
    const { eventSource, event_types } = SillyTavern.getContext();

    const MODULE_NAME = 'hello-world';
    const DND_STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

    console.log('[HelloWorld] Extension loaded!');

    function getCharacterData() {
        const { characters, characterId } = SillyTavern.getContext();
        if (characterId === undefined || !characters[characterId]) return null;
        return characters[characterId];
    }

    function getStats() {
        const { extensionSettings } = SillyTavern.getContext();
        if (!extensionSettings[MODULE_NAME]) {
            extensionSettings[MODULE_NAME] = {};
        }
        return extensionSettings[MODULE_NAME];
    }

    function getCharKey() {
        const char = getCharacterData();
        return char ? `stats_${char.name}` : null;
    }

    function getCharStats() {
        const key = getCharKey();
        if (!key) return {};
        const settings = getStats();
        if (!settings[key]) {
            settings[key] = {};
            DND_STATS.forEach(s => settings[key][s] = 10);
        }
        return settings[key];
    }

    function onStatChange(stat, value) {
        const key = getCharKey();
        if (!key) return;
        const settings = getStats();
        settings[key][stat] = parseInt(value) || 0;
        SillyTavern.getContext().saveSettingsDebounced();
    }

    // Tracks the previous stats so we can show diffs
    let previousStats = {};

    function snapshotCurrentStats() {
        const stats = getCharStats();
        previousStats = { ...stats };
    }

    function updatePanelWithDiffs(newStats) {
        const panel = document.getElementById('hello-world-panel');
        if (!panel) return;

        DND_STATS.forEach(stat => {
            const input = panel.querySelector(`input[data-stat="${stat}"]`);
            if (!input) return;

            const wrapper = input.closest('.hw-stat');
            const oldVal = previousStats[stat] ?? 10;
            const newVal = newStats[stat] ?? 10;
            const diff = newVal - oldVal;

            input.value = newVal;

            // Remove old diff indicator
            wrapper.querySelector('.hw-diff')?.remove();
            wrapper.classList.remove('hw-stat-up', 'hw-stat-down');

            if (diff !== 0) {
                const diffEl = document.createElement('span');
                diffEl.className = 'hw-diff';
                if (diff > 0) {
                    diffEl.textContent = `(+${diff})`;
                    diffEl.classList.add('hw-diff-up');
                    wrapper.classList.add('hw-stat-up');
                } else {
                    diffEl.textContent = `(${diff})`;
                    diffEl.classList.add('hw-diff-down');
                    wrapper.classList.add('hw-stat-down');
                }
                wrapper.appendChild(diffEl);
            }
        });
    }

    async function evaluateStatsFromLLM() {
        const char = getCharacterData();
        if (!char) return;

        const { generateQuietPrompt } = SillyTavern.getContext();
        const currentStats = getCharStats();
        snapshotCurrentStats();

        const prompt = `Based on everything that has happened in this conversation so far, evaluate ${char.name}'s current D&D stats. Consider their actions, injuries, emotional state, buffs/debuffs, and any relevant context.

Current stats: STR=${currentStats.STR} DEX=${currentStats.DEX} CON=${currentStats.CON} INT=${currentStats.INT} WIS=${currentStats.WIS} CHA=${currentStats.CHA}

Respond with ONLY a JSON object containing the updated stats, no other text. Example: {"STR":10,"DEX":12,"CON":8,"INT":14,"WIS":11,"CHA":13}`;

        try {
            const result = await generateQuietPrompt({ quietPrompt: prompt });
            const match = result.match(/\{[^}]+\}/);
            if (!match) {
                console.warn('[HelloWorld] Could not parse LLM stat response:', result);
                return;
            }
            const parsed = JSON.parse(match[0]);
            const key = getCharKey();
            if (!key) return;
            const settings = getStats();
            DND_STATS.forEach(stat => {
                if (typeof parsed[stat] === 'number') {
                    settings[key][stat] = parsed[stat];
                }
            });
            SillyTavern.getContext().saveSettingsDebounced();
            updatePanelWithDiffs(settings[key]);
            console.log('[HelloWorld] Stats updated by LLM:', parsed);
        } catch (err) {
            console.error('[HelloWorld] Failed to evaluate stats:', err);
        }
    }

    function buildStatsHtml() {
        const stats = getCharStats();
        return DND_STATS.map(stat => `
            <div class="hw-stat">
                <label>${stat}</label>
                <input type="number" data-stat="${stat}" value="${stats[stat] ?? 10}" />
            </div>
        `).join('');
    }

    function createPanel() {
        document.getElementById('hello-world-panel')?.remove();

        const char = getCharacterData();
        if (!char) return;

        const panel = document.createElement('div');
        panel.id = 'hello-world-panel';

        const avatar = char.avatar
            ? `/characters/${encodeURIComponent(char.avatar)}`
            : '/img/ai4.png';

        panel.innerHTML = `
            <div class="hw-collapsible">
                <img src="${avatar}" alt="${char.name}" />
                <span>${char.name}</span>
                <div class="hw-stats-grid">${buildStatsHtml()}</div>
            </div>
            <div class="hw-toggle-bar" title="Toggle panel">▲</div>
        `;

        const toggleBar = panel.querySelector('.hw-toggle-bar');
        const collapsible = panel.querySelector('.hw-collapsible');

        // Restore collapsed state
        const settings = getStats();
        if (settings._panelCollapsed) {
            collapsible.classList.add('hw-collapsed');
            panel.classList.add('hw-panel-collapsed');
            toggleBar.textContent = '▼';
        }

        toggleBar.addEventListener('click', () => {
            const isCollapsed = collapsible.classList.toggle('hw-collapsed');
            panel.classList.toggle('hw-panel-collapsed', isCollapsed);
            toggleBar.textContent = isCollapsed ? '▼' : '▲';
            settings._panelCollapsed = isCollapsed;
            SillyTavern.getContext().saveSettingsDebounced();
        });

        panel.querySelectorAll('input[data-stat]').forEach(input => {
            input.addEventListener('change', (e) => {
                onStatChange(e.target.dataset.stat, e.target.value);
            });
        });

        document.getElementById('sheld')?.prepend(panel);
    }

    eventSource.on(event_types.APP_READY, () => {
        toastr.success('Hello World extension is running!');
        createPanel();
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        createPanel();
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        evaluateStatsFromLLM();
    });
})();
