Hooks.on("renderCombatTracker", (app, html, data) => {
    const combat = data.combat;
    if (!combat) return;

    html.find(".combatant").each((_, combatantElement) => {
        const combatantId = combatantElement.dataset.combatantId;
        if (!combatantId) return;

        const time = pf2eTurnTimer.getCombatantTime(combatantId);
        $(combatantElement).find(".token-name").append(` <span class="turn-timer">(${time}s)</span>`);
    });

    // Append total combat timer
    const totalTime = pf2eTurnTimer.getTotalCombatTime();
    html.find(".combat-tracker-header").append(`<div class="total-combat-timer">Total Time: ${totalTime}s</div>`);
});
