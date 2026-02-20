/**
 * Character roster management.
 */

let roster = [];
let viewIndex = 0;

export function buildRoster() {
    const { characters, characterId, chat, name1 } = SillyTavern.getContext();
    const seen = new Set();
    const newRoster = [];

    const userName = name1 || 'User';
    seen.add(userName.toLowerCase());

    if (characterId !== undefined && characters[characterId]) {
        const mainChar = characters[characterId];
        if (!seen.has(mainChar.name.toLowerCase())) {
            newRoster.push({
                name: mainChar.name,
                avatar: mainChar.avatar ? `/characters/${encodeURIComponent(mainChar.avatar)}` : null,
                title: mainChar.name,
            });
            seen.add(mainChar.name.toLowerCase());
        }
    }

    if (chat && Array.isArray(chat)) {
        for (const msg of chat) {
            const msgName = msg.name;
            if (msgName && !seen.has(msgName.toLowerCase()) && !msg.is_user) {
                const charObj = characters.find(c => c.name === msgName);
                newRoster.push({
                    name: msgName,
                    avatar: charObj?.avatar ? `/characters/${encodeURIComponent(charObj.avatar)}` : null,
                    title: msgName,
                });
                seen.add(msgName.toLowerCase());
            }
        }
    }

    newRoster.push({ name: userName, avatar: null, title: userName, isUser: true });
    roster = newRoster;
    if (viewIndex >= roster.length) viewIndex = 0;
}

export function getRoster() { return roster; }
export function getViewIndex() { return viewIndex; }
export function setViewIndex(i) { viewIndex = i; }
export function currentEntry() { return roster[viewIndex] || null; }

export function navigatePrev() {
    viewIndex = (viewIndex - 1 + roster.length) % roster.length;
    return currentEntry();
}

export function navigateNext() {
    viewIndex = (viewIndex + 1) % roster.length;
    return currentEntry();
}

export function resetView() {
    viewIndex = 0;
}
