class PF2eTurnTimer {
    constructor() {
        this.currentTurnStart = null;
        this.currentCombatant = null;
        this.lastPauseTime = null;
        this.pausedDuration = 0;
        this.interval = null;

        // Bind methods explicitly to avoid "undefined" errors
        this.getTotalCombatTime = this.getTotalCombatTime.bind(this);
        this.updateUI = this.updateUI.bind(this);

        Hooks.on("updateCombat", this.onCombatUpdate.bind(this));
        Hooks.on("deleteCombat", this.onCombatEnd.bind(this));
        Hooks.on("renderCombatTracker", this.updateUI);
        Hooks.on("pauseGame", this.onGamePause.bind(this));
        Hooks.on("ready", this.initializeTimers.bind(this));

        this.startLiveUpdate();
    }

    async initializeTimers() {
        if (game.user.isGM) {
            const settings = game.settings.get("pf2e-turn-timer", "combatTimers") || {};
            await game.settings.set("pf2e-turn-timer", "combatTimers", settings);
        }
    }

    startLiveUpdate() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.updateLiveTurnTimer();
            this.updateUI();
        }, 1000);
    }

    getCombatData(combat) {
        if (!combat) return null;
        return combat.getFlag("pf2e-turn-timer", "combatData") || {
            startTime: Date.now(),
            combatantTimers: {},
            pausedTime: 0,
            lastPausedCombatant: null,
        };
    }

    async saveCombatData(combat, data) {
        if (!game.user.isGM) return;
        await combat.setFlag("pf2e-turn-timer", "combatData", data);
    }

    async onCombatUpdate(combat, changes) {
        if (!combat) return;
        let combatData = this.getCombatData(combat);

        if (changes.turn !== undefined) {
            const combatant = combat.turns[combat.turn];

            if (this.currentCombatant && this.currentTurnStart) {
                const elapsedTime = (Date.now() - this.currentTurnStart) / 1000;
                combatData.combatantTimers[this.currentCombatant] = 
                    (combatData.combatantTimers[this.currentCombatant] || 0) + elapsedTime;
            }

            this.currentCombatant = combatant.id;
            this.currentTurnStart = Date.now();
        }

        await this.saveCombatData(combat, combatData);
    }

    async onCombatEnd(combat) {
        if (!combat) return;
        if (!game.user.isGM) return;
        await combat.unsetFlag("pf2e-turn-timer", "combatData");

        this.currentCombatant = null;
        this.currentTurnStart = null;
        this.lastPauseTime = null;
        this.pausedDuration = 0;
    }

    onGamePause(paused) {
        let combat = game.combat;
        if (!combat) return;

        let combatData = this.getCombatData(combat);

        if (paused) {
            this.lastPauseTime = Date.now();
            combatData.lastPausedCombatant = this.currentCombatant;
        } else if (this.lastPauseTime) {
            let pauseDuration = (Date.now() - this.lastPauseTime) / 1000;
            this.lastPauseTime = null;

            if (combatData.lastPausedCombatant) {
                combatData.combatantTimers[combatData.lastPausedCombatant] =
                    (combatData.combatantTimers[combatData.lastPausedCombatant] || 0) - pauseDuration;
            }

            combatData.pausedTime += pauseDuration;
            combatData.lastPausedCombatant = null;
            this.saveCombatData(combat, combatData);
        }
    }

    updateLiveTurnTimer() {
        if (!game.settings.get("pf2e-turn-timer", "enableTimer")) return;
        const combat = game.combat;
        if (!combat || !this.currentCombatant || !this.currentTurnStart) return;

        let combatData = this.getCombatData(combat);
        let elapsedTime = (Date.now() - this.currentTurnStart) / 1000;

        combatData.combatantTimers[this.currentCombatant] = 
            (combatData.combatantTimers[this.currentCombatant] || 0) + elapsedTime;

        this.currentTurnStart = Date.now();
        this.saveCombatData(combat, combatData);
    }

    getTotalCombatTime(combat) {
        if (!combat) return "00:00:00";
        const combatData = this.getCombatData(combat);
        if (!combatData) return "00:00:00";

        let adjustedTime = (Date.now() - combatData.startTime) / 1000 - combatData.pausedTime;
        return this.formatTime(adjustedTime);
    }

    getCombatantTime(combat, combatantId) {
        if (!combat) return "00:00:00";
        const combatData = this.getCombatData(combat);
        if (!combatData) return "00:00:00";

        let totalTime = combatData.combatantTimers[combatantId] || 0;
        return this.formatTime(totalTime > 0 ? totalTime : 0);
    }

    formatTime(seconds) {
        let h = Math.floor(seconds / 3600);
        let m = Math.floor((seconds % 3600) / 60);
        let s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }

    updateUI(app, html, data) {
    if (!game.settings.get("pf2e-turn-timer", "enableTimer")) return;
    if (!app || !html) return;

    const combat = game.combat;
    if (!combat) return;

    let tracker = html[0];
    if (!tracker) return; // Ensure tracker exists

    let totalTimerElement = tracker.querySelector(".total-combat-timer");
    if (!totalTimerElement) {
        totalTimerElement = document.createElement("div");
        totalTimerElement.className = "total-combat-timer";
        tracker.prepend(totalTimerElement);
    }

    // Apply styles to override flex behavior
    totalTimerElement.style.display = "block";
    totalTimerElement.style.flex = "none";
    totalTimerElement.style.width = "180px";
    totalTimerElement.style.height = "30px";
    totalTimerElement.style.lineHeight = "30px";
    totalTimerElement.style.textAlign = "center";
    totalTimerElement.style.margin = "5px auto";
    totalTimerElement.style.padding = "5px";
    totalTimerElement.style.overflow = "hidden";
    totalTimerElement.style.whiteSpace = "nowrap";

    totalTimerElement.innerHTML = `Total Combat Time: ${this.getTotalCombatTime(combat)}`;

    tracker.querySelectorAll(".combatant").forEach((combatantElement) => {
        const combatantId = combatantElement.dataset.combatantId;
        if (!combatantId) return;

        let timerElement = combatantElement.querySelector(".turn-timer");
        if (!timerElement) {
            timerElement = document.createElement("span");
            timerElement.className = "turn-timer";
            combatantElement.querySelector(".token-name").appendChild(timerElement);
        }

        timerElement.innerHTML = ` (${this.getCombatantTime(combat, combatantId)})`;
    });
}
}

// Register settings menu
Hooks.once("init", () => {
    game.settings.register("pf2e-turn-timer", "enableTimer", {
        name: "Enable Turn Timer",
        hint: "Enable or disable the combat turn timer.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
    });
});

// Apply only to sidebar combat tracker
Hooks.on("renderCombatTracker", (app, html, data) => {
    if (!window.pf2eTurnTimer) return;
    if (!app._popOut) window.pf2eTurnTimer.updateUI(app, html, data);
});

// Initialize module
Hooks.once("ready", () => {
    window.pf2eTurnTimer = new PF2eTurnTimer();
});
