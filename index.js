/**
 * Character Sheet Extension for SillyTavern
 * Entry point — wires up events and initializes the extension.
 */

import * as Roster from './roster.js';
import * as Eval from './eval.js';
import { createPanel, addExtensionSettings, updateCharacterDisplay } from './panel.js';

const { eventSource, event_types } = SillyTavern.getContext();

// Wire panel callbacks into eval to avoid circular imports
Eval.setPanelCallbacks(updateCharacterDisplay);

let isNewChat = false;
let messageCount = 0;

console.log('[CharacterSheet] Extension loaded!');

// --- Event handlers ---

eventSource.on(event_types.CHAT_CHANGED, () => {
    isNewChat = true;
    messageCount = 0;
    Roster.resetView();
    createPanel();
});

eventSource.on(event_types.MESSAGE_RECEIVED, () => {
    messageCount++;

    if (isNewChat && messageCount === 1) {
        isNewChat = false;
        setTimeout(() => {
            Roster.buildRoster();
            createPanel();
            Eval.evaluateAllCharacters(true);
        }, 3000);
        return;
    }

    if (messageCount % 5 === 0) {
        setTimeout(() => {
            Roster.buildRoster();
            createPanel();
            Eval.evaluateAllCharacters(false);
        }, 3000);
    }
});

// --- Init ---
addExtensionSettings();
createPanel();
