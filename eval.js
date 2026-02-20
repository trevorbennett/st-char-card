/**
 * LLM evaluation logic for character stats and titles.
 * Exposed on window.CharacterSheet.Eval
 */
(function () {
    const MODULE_NAME = 'character-sheet';
    let evalInProgress = false;
    let previousStats = {};

    function getSettings() {
        const { extensionSettings } = SillyTavern.getContext();
        if (!extensionSettings[MODULE_NAME]) extensionSettings[MODULE_NAME] = {};
        return extensionSettings[MODULE_NAME];
    }

    function getStatsForName(name, preset) {
        const key = `stats_${name}`;
        const settings = getSettings();
        if (!settings[key]) settings[key] = {};
        preset.stats.forEach(s => {
            if (settings[key][s] === undefined) settings[key][s] = preset.defaults[s];
        });
        return settings[key];
    }

    function getActivePreset() {
        const { extensionSettings } = SillyTavern.getContext();
        return window.CharacterSheetPresets.getActivePreset(extensionSettings, MODULE_NAME);
    }

    function snapshotStats(name, preset) {
        const stats = getStatsForName(name, preset);
        previousStats[name] = { ...stats };
    }

    function getPreviousStats(name) {
        return previousStats[name] || {};
    }

    function statColor(val, min, max) {
        const t = (val - min) / (max - min);
        const r = Math.round(255 * (1 - t));
        const g = Math.round(255 * t);
        return `rgb(${r},${g},0)`;
    }

    function onStatChange(name, stat, value) {
        const Presets = window.CharacterSheetPresets;
        if (!Presets) return;
        const preset = getActivePreset();
        const key = `stats_${name}`;
        const settings = getSettings();
        if (!settings[key]) settings[key] = {};
        settings[key][stat] = Presets.clampStat(parseInt(value) || 0, preset);
        SillyTavern.getContext().saveSettingsDebounced();
    }

    function updatePanelWithDiffs(name, newStats, preset) {
        const Roster = window.CharacterSheet.Roster;
        const entry = Roster.currentEntry();
        if (!entry || entry.name !== name) return;

        const panel = document.getElementById('hello-world-panel');
        if (!panel) return;

        const prev = previousStats[name] || {};
        preset.stats.forEach(stat => {
            const input = panel.querySelector(`input[data-stat="${stat}"]`);
            if (!input) return;

            const wrapper = input.closest('.hw-stat');
            const oldVal = prev[stat] ?? preset.defaults[stat];
            const newVal = newStats[stat] ?? preset.defaults[stat];
            const diff = newVal - oldVal;

            input.value = newVal;

            const bar = wrapper.querySelector('.hw-stat-bar-fill');
            if (bar) {
                const pct = Math.round(((newVal - preset.min) / (preset.max - preset.min)) * 100);
                bar.style.width = `${pct}%`;
                bar.style.background = statColor(newVal, preset.min, preset.max);
            }

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

    async function evaluateAllCharacters(fresh) {
        const Presets = window.CharacterSheetPresets;
        const Roster = window.CharacterSheet.Roster;
        const Panel = window.CharacterSheet.Panel;
        const roster = Roster.getRoster();

        if (!Presets || !isEnabled() || roster.length === 0) return;
        if (evalInProgress) {
            console.log('[CharacterSheet] Eval already in progress, skipping.');
            return;
        }
        evalInProgress = true;

        const { generateQuietPrompt, saveSettingsDebounced } = SillyTavern.getContext();
        const preset = getActivePreset();

        for (const entry of roster) {
            snapshotStats(entry.name, preset);
        }

        const characters = roster.map(entry => ({
            name: entry.name,
            isUser: entry.isUser || false,
            currentStats: getStatsForName(entry.name, preset),
        }));

        const prompt = Presets.buildCombinedEvalPrompt(characters, preset, fresh);

        try {
            const result = await generateQuietPrompt({ quietPrompt: prompt });
            const match = result.match(/\{[\s\S]*\}/);
            if (!match) {
                console.warn('[CharacterSheet] Could not parse combined LLM response:', result);
                return;
            }
            const parsed = JSON.parse(match[0]);
            const settings = getSettings();

            for (const entry of roster) {
                const charData = parsed[entry.name];
                if (!charData) continue;

                if (typeof charData.title === 'string') {
                    entry.title = charData.title;
                }

                if (charData.stats && typeof charData.stats === 'object') {
                    const key = `stats_${entry.name}`;
                    if (!settings[key]) settings[key] = {};
                    preset.stats.forEach(stat => {
                        if (typeof charData.stats[stat] === 'number') {
                            settings[key][stat] = Presets.clampStat(charData.stats[stat], preset);
                        }
                    });
                    updatePanelWithDiffs(entry.name, settings[key], preset);
                }
            }

            saveSettingsDebounced();
            if (Panel) Panel.updateCharacterDisplay(Roster.currentEntry());

            console.log(`[CharacterSheet] All characters ${fresh ? 'freshly evaluated' : 'updated'}:`, parsed);
        } catch (err) {
            console.error('[CharacterSheet] Failed to evaluate characters:', err);
        } finally {
            evalInProgress = false;
        }
    }

    function isEnabled() {
        const settings = getSettings();
        return settings._enabled !== false;
    }

    if (!window.CharacterSheet) window.CharacterSheet = {};
    window.CharacterSheet.Eval = {
        getSettings,
        getStatsForName,
        getActivePreset,
        snapshotStats,
        getPreviousStats,
        statColor,
        onStatChange,
        updatePanelWithDiffs,
        evaluateAllCharacters,
        isEnabled,
    };
})();
