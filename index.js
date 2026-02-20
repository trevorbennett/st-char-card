/**
 * Character Sheet Extension — Entry Point
 * Loads modules and wires up SillyTavern events.
 */
(function () {
    const { eventSource, event_types } = SillyTavern.getContext();
    const EXTENSION_PATH = 'scripts/extensions/third-party/character-sheet';

    console.log('[CharacterSheet] Extension loaded!');

    let messageCount = 0;

    function loadScript(filename, globalKey) {
        return new Promise(async (resolve, reject) => {
            const existing = globalKey.split('.').reduce((o, k) => o?.[k], window);
            if (existing) { resolve(existing); return; }
            try {
                const resp = await fetch(`/${EXTENSION_PATH}/${filename}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${filename}`);
                const code = await resp.text();
                const blob = new Blob([code], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                const script = document.createElement('script');
                script.src = url;
                script.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve(globalKey.split('.').reduce((o, k) => o?.[k], window));
                };
                script.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error(`Failed to execute ${filename}`));
                };
                document.head.appendChild(script);
            } catch (err) {
                reject(err);
            }
        });
    }

    async function loadAllModules() {
        await loadScript('presets.js', 'CharacterSheetPresets');
        await loadScript('roster.js', 'CharacterSheet.Roster');
        await loadScript('eval.js', 'CharacterSheet.Eval');
        await loadScript('panel.js', 'CharacterSheet.Panel');
    }

    loadAllModules().then(() => {
        const { Roster, Eval, Panel } = window.CharacterSheet;
        console.log('[CharacterSheet] All modules loaded.');

        eventSource.on(event_types.APP_READY, () => {
            Panel.addExtensionSettings();
            Panel.createPanel();
        });

        eventSource.on(event_types.CHAT_CHANGED, () => {
            messageCount = 0;
            Roster.resetView();
            Panel.createPanel();
        });

        eventSource.on(event_types.MESSAGE_RECEIVED, () => {
            messageCount++;
            Roster.buildRoster();
            if (messageCount % 5 === 0) {
                setTimeout(() => Eval.evaluateAllCharacters(false), 3000);
            }
        });
    }).catch(err => {
        console.error('[CharacterSheet] Failed to initialize:', err);
    });
})();
