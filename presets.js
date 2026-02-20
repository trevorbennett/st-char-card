/**
 * Stat preset definitions and prompt building for the character sheet extension.
 */

export const PRESETS = {
    dnd: {
        name: 'D&D',
        stats: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
        defaults: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
        min: 1, max: 20, promptLabel: 'D&D',
    },
    special: {
        name: 'Fallout (SPECIAL)',
        stats: ['Strength', 'Perception', 'Endurance', 'Charisma', 'Intelligence', 'Agility', 'Luck'],
        defaults: { Strength: 5, Perception: 5, Endurance: 5, Charisma: 5, Intelligence: 5, Agility: 5, Luck: 5 },
        min: 1, max: 10, promptLabel: 'Fallout SPECIAL',
    },
    elderScrolls: {
        name: 'Elder Scrolls',
        stats: ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Speed', 'Endurance', 'Personality', 'Luck'],
        defaults: { Strength: 50, Intelligence: 50, Willpower: 50, Agility: 50, Speed: 50, Endurance: 50, Personality: 50, Luck: 50 },
        min: 0, max: 100, promptLabel: 'Elder Scrolls',
    },
    cyberpunk: {
        name: 'Cyberpunk',
        stats: ['Intelligence', 'Reflexes', 'Dexterity', 'Technology', 'Cool', 'Willpower', 'Luck', 'Movement', 'Body', 'Empathy'],
        defaults: { Intelligence: 5, Reflexes: 5, Dexterity: 5, Technology: 5, Cool: 5, Willpower: 5, Luck: 5, Movement: 5, Body: 5, Empathy: 5 },
        min: 1, max: 10, promptLabel: 'Cyberpunk',
    },
    callOfCthulhu: {
        name: 'Call of Cthulhu',
        stats: ['Strength', 'Constitution', 'Size', 'Dexterity', 'Appearance', 'Intelligence', 'Power', 'Education', 'Sanity'],
        defaults: { Strength: 50, Constitution: 50, Size: 50, Dexterity: 50, Appearance: 50, Intelligence: 50, Power: 50, Education: 50, Sanity: 50 },
        min: 0, max: 99, promptLabel: 'Call of Cthulhu',
    },
    vtm: {
        name: 'Vampire: The Masquerade',
        stats: ['Strength', 'Dexterity', 'Stamina', 'Charisma', 'Manipulation', 'Appearance', 'Perception', 'Intelligence', 'Wits'],
        defaults: { Strength: 1, Dexterity: 1, Stamina: 1, Charisma: 1, Manipulation: 1, Appearance: 1, Perception: 1, Intelligence: 1, Wits: 1 },
        min: 0, max: 5, promptLabel: 'Vampire: The Masquerade',
    },
};

export const DEFAULT_PRESET_KEY = 'dnd';

export function getSelectedPresetKey(extensionSettings, moduleKey) {
    return extensionSettings[moduleKey]?._presetKey || DEFAULT_PRESET_KEY;
}

export function setSelectedPresetKey(extensionSettings, moduleKey, presetKey) {
    if (!extensionSettings[moduleKey]) extensionSettings[moduleKey] = {};
    extensionSettings[moduleKey]._presetKey = presetKey;
}

export function getActivePreset(extensionSettings, moduleKey) {
    const key = getSelectedPresetKey(extensionSettings, moduleKey);
    return PRESETS[key] || PRESETS[DEFAULT_PRESET_KEY];
}

export function buildPresetSelectorHtml(selectedKey) {
    const options = Object.entries(PRESETS)
        .map(([key, preset]) => {
            const selected = key === selectedKey ? 'selected' : '';
            return `<option value="${key}" ${selected}>${preset.name}</option>`;
        })
        .join('');
    return `<div class="hw-preset-wrapper" title="Change stat preset">
        <span class="hw-preset-icon">⚙</span>
        <select id="hw-preset-select" class="hw-preset-select">${options}</select>
    </div>`;
}

export function clampStat(value, preset) {
    return Math.max(preset.min, Math.min(preset.max, value));
}

/**
 * Build a combined prompt that evaluates stats AND titles for all characters.
 * Static instructions first (cacheable prefix), dynamic data last.
 */
export function buildCombinedEvalPrompt(characters, preset, fresh) {
    const statNames = preset.stats.join(', ');
    const exampleStats = Object.fromEntries(preset.stats.map(s => [s, preset.defaults[s]]));

    const staticPrefix = `You are a character stat evaluator for a ${preset.promptLabel} roleplay.

Your job: evaluate stats and assign a fitting title for each character listed below.
Stats to evaluate: ${statNames}
Valid range for each stat: ${preset.min} to ${preset.max}

Rules:
- Consider each character's actions, injuries, emotional state, buffs/debuffs, personality, and role in the story.
- Titles should be evocative and fitting, in the format "Name, the Title" (e.g. "Yuriko, the Tiger's Shadow").
- Respond with ONLY a JSON object. Each key is the character's exact name. Each value has "title" (string) and "stats" (object with full stat names as keys, integer values).
- Example value: ${JSON.stringify({ title: 'Name, the Evocative Title', stats: exampleStats })}`;

    const modeInstruction = fresh
        ? 'This is a brand new conversation. Evaluate all characters from scratch based on their descriptions and the opening scenario. Do NOT use default or sample values.'
        : 'Based on everything that has happened in this conversation so far, update the stats accordingly.';

    const charDescriptions = characters.map(c => {
        const who = c.isUser ? `"${c.name}" (the player/user, the protagonist)` : `"${c.name}"`;
        if (fresh) return `- ${who}`;
        const statList = preset.stats.map(s => `${s}=${c.currentStats[s] ?? preset.defaults[s]}`).join(', ');
        return `- ${who}: ${statList}`;
    }).join('\n');

    return `${staticPrefix}

${modeInstruction}

Characters:
${charDescriptions}`;
}
