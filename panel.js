/**
 * Panel UI rendering and event binding.
 * Exposed on window.CharacterSheet.Panel
 */
(function () {
    const MODULE_NAME = 'character-sheet';

    function buildStatsHtml(preset, stats) {
        const Eval = window.CharacterSheet.Eval;
        return preset.stats.map(stat => {
            const val = stats[stat] ?? preset.defaults[stat];
            const pct = Math.round(((val - preset.min) / (preset.max - preset.min)) * 100);
            const color = Eval.statColor(val, preset.min, preset.max);
            return `
            <div class="hw-stat">
                <label>${stat}</label>
                <input type="number" data-stat="${stat}" value="${val}" min="${preset.min}" max="${preset.max}" />
                <div class="hw-stat-bar"><div class="hw-stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
            </div>`;
        }).join('');
    }

    function updateCharacterDisplay(entry) {
        if (!entry) return;
        const panel = document.getElementById('hello-world-panel');
        if (!panel) return;
        const nameEl = panel.querySelector('.hw-image-panel .hw-char-name');
        const imgEl = panel.querySelector('.hw-image-panel img');
        if (nameEl) nameEl.textContent = entry.title || entry.name;
        if (imgEl) {
            imgEl.src = entry.avatar || '/img/ai4.png';
            imgEl.alt = entry.name;
        }
    }

    function refreshForCurrentView() {
        const Roster = window.CharacterSheet.Roster;
        const Eval = window.CharacterSheet.Eval;
        const Presets = window.CharacterSheetPresets;
        const entry = Roster.currentEntry();
        if (!entry || !Presets) return;

        const panel = document.getElementById('hello-world-panel');
        if (!panel) return;

        const preset = Eval.getActivePreset();
        const stats = Eval.getStatsForName(entry.name, preset);

        updateCharacterDisplay(entry);

        const grid = panel.querySelector('.hw-stats-grid');
        if (grid) grid.innerHTML = buildStatsHtml(preset, stats);

        const counter = panel.querySelector('.hw-nav-counter');
        if (counter) counter.textContent = `${Roster.getViewIndex() + 1}/${Roster.getRoster().length}`;

        panel.querySelectorAll('input[data-stat]').forEach(input => {
            input.addEventListener('change', (e) => {
                Eval.onStatChange(entry.name, e.target.dataset.stat, e.target.value);
            });
        });
    }

    function setEnabled(val) {
        const Eval = window.CharacterSheet.Eval;
        const settings = Eval.getSettings();
        settings._enabled = val;
        SillyTavern.getContext().saveSettingsDebounced();
    }

    function addExtensionSettings() {
        const Eval = window.CharacterSheet.Eval;
        const html = `
            <div class="character-sheet-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Character Sheet</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <label class="checkbox_label" for="character_sheet_enabled">
                            <input id="character_sheet_enabled" type="checkbox" ${Eval.isEnabled() ? 'checked' : ''} />
                            <span>Enable Character Sheet</span>
                        </label>
                    </div>
                </div>
            </div>`;
        document.getElementById('extensions_settings').insertAdjacentHTML('beforeend', html);
        document.getElementById('character_sheet_enabled').addEventListener('change', (e) => {
            setEnabled(e.target.checked);
            if (e.target.checked) {
                createPanel();
            } else {
                document.getElementById('hello-world-panel')?.remove();
            }
        });
    }

    function createPanel() {
        const Presets = window.CharacterSheetPresets;
        const Roster = window.CharacterSheet.Roster;
        const Eval = window.CharacterSheet.Eval;

        document.getElementById('hello-world-panel')?.remove();

        if (!Eval.isEnabled() || !Presets) return;

        Roster.buildRoster();
        const entry = Roster.currentEntry();
        if (!entry) return;

        const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
        const presetKey = Presets.getSelectedPresetKey(extensionSettings, MODULE_NAME);
        const preset = Presets.PRESETS[presetKey] || Presets.PRESETS[Presets.DEFAULT_PRESET_KEY];
        const stats = Eval.getStatsForName(entry.name, preset);
        const roster = Roster.getRoster();
        const viewIndex = Roster.getViewIndex();

        const panel = document.createElement('div');
        panel.id = 'hello-world-panel';

        const avatar = entry.avatar || '/img/ai4.png';

        panel.innerHTML = `
            <div class="hw-collapsible">
                <div class="hw-subpanel hw-image-panel">
                    <img src="${avatar}" alt="${entry.name}" />
                    <span class="hw-char-name">${entry.title || entry.name}</span>
                </div>
                <div class="hw-subpanel hw-stats-panel">
                    <div class="hw-stats-grid">${buildStatsHtml(preset, stats)}</div>
                    <div class="hw-panel-bottom">
                        <div class="hw-nav">
                            <span class="hw-nav-arrow hw-nav-left" title="Previous character">◀</span>
                            <span class="hw-nav-counter">${viewIndex + 1}/${roster.length}</span>
                            <span class="hw-nav-arrow hw-nav-right" title="Next character">▶</span>
                        </div>
                        <div class="hw-panel-actions">
                            ${Presets.buildPresetSelectorHtml(presetKey)}
                            <div class="hw-regen-wrapper" title="Regenerate stats">
                                <span class="hw-regen-icon">🎲</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="hw-toggle-bar" title="Toggle panel">▲</div>
        `;

        const toggleBar = panel.querySelector('.hw-toggle-bar');
        const collapsible = panel.querySelector('.hw-collapsible');
        const settings = Eval.getSettings();

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
            saveSettingsDebounced();
        });

        panel.querySelector('.hw-nav-left').addEventListener('click', () => {
            Roster.navigatePrev();
            refreshForCurrentView();
        });

        panel.querySelector('.hw-nav-right').addEventListener('click', () => {
            Roster.navigateNext();
            refreshForCurrentView();
        });

        panel.querySelector('#hw-preset-select').addEventListener('change', (e) => {
            Presets.setSelectedPresetKey(extensionSettings, MODULE_NAME, e.target.value);
            saveSettingsDebounced();
            createPanel();
            Eval.evaluateAllCharacters(false);
        });

        panel.querySelector('.hw-regen-wrapper').addEventListener('click', () => {
            Eval.evaluateAllCharacters(false);
        });

        panel.querySelectorAll('input[data-stat]').forEach(input => {
            input.addEventListener('change', (e) => {
                Eval.onStatChange(entry.name, e.target.dataset.stat, e.target.value);
            });
        });

        document.getElementById('sheld')?.prepend(panel);
    }

    if (!window.CharacterSheet) window.CharacterSheet = {};
    window.CharacterSheet.Panel = {
        buildStatsHtml,
        updateCharacterDisplay,
        refreshForCurrentView,
        addExtensionSettings,
        createPanel,
    };
})();
