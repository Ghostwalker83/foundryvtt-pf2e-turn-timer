/**
 * PF2eTurnTimer - Corrected for Foundry VTT V13+ Compatibility.
 * Tracks the total time spent per combatant during combat encounters.
 */
class PF2eTurnTimer {
    constructor() {
        this.currentTurnStart = null;
        this.currentCombatantId = null; // Renamed to clearly be an ID
        this.lastPauseTime = null;
        this.pausedDuration = 0;
        this.interval = null;

        // Bind methods for hooks and UI updates
        this.updateUI = this.updateUI.bind(this);
        this.onCombatUpdate = this.onCombatUpdate.bind(this);
        this.onCombatEnd = this.onCombatEnd.bind(this);

        // Register hooks
        Hooks.on("updateCombat", this.onCombatUpdate);
        Hooks.on("deleteCombat", this.onCombatEnd);
        Hooks.on("renderCombatTracker", this.updateUI); // Called on every render
        Hooks.on("pauseGame", this.onGamePause.bind(this));
        
        // Start the continuous timer update
        this.startLiveUpdate();
    }

    /**
     * Retrieves the combat data flag for the current combat.
     * Initializes default structure if none exists.
     */
    getCombatData(combat) {
        if (!combat) return null;
        return combat.getFlag("pf2e-turn-timer", "combatData") || {
            // startTime is only set once per combat lifecycle
            startTime: combat.getFlag("pf2e-turn-timer", "combatData")?.startTime || Date.now(), 
            combatantTimers: {},
            pausedTime: 0,
            lastPausedCombatant: null,
        };
    }

    /**
     * Saves the updated combat data flag.
     * Only runs if the user is a GM.
     */
    async saveCombatData(combat, data) {
        if (!game.user.isGM) return;
        await combat.setFlag("pf2e-turn-timer", "combatData", data);
    }

    /**
     * Starts the 1-second interval for live UI updates.
     */
    startLiveUpdate() {
        if (this.interval) clearInterval(this.interval);
        // We only update the UI every second, avoiding heavy, constant saving.
        this.interval = setInterval(() => {
            this.updateLiveTurnTimer(); 
            this.updateUI(ui.combat); // Force the combat tracker to re-render for live update
        }, 1000);
    }

    /**
     * Hook triggered when combat state changes (like turn change).
     * @param {Combat} combat The updated Combat document.
     * @param {object} changes The changes applied.
     */
    async onCombatUpdate(combat, changes) {
        if (!combat) return;

        // Start combat if it was previously inactive
        if (combat.isActive && !this.currentCombatantId) {
             console.log("Turn Timer | Combat activated.");
             this.currentCombatantId = combat.combatant?.id;
             this.currentTurnStart = Date.now();
        }

        // Check if the turn index changed
        if (changes.turn !== undefined || changes.round !== undefined) {
            let combatData = this.getCombatData(combat);

            // 1. Finalize the previous combatant's time
            if (this.currentCombatantId && this.currentTurnStart) {
                const elapsedTime = (Date.now() - this.currentTurnStart) / 1000;
                combatData.combatantTimers[this.currentCombatantId] =
                    (combatData.combatantTimers[this.currentCombatantId] || 0) + elapsedTime;
            }

            // 2. Start the new combatant's timer
            const newCombatant = combat.turns[combat.turn];
            this.currentCombatantId = newCombatant?.id || null;
            this.currentTurnStart = Date.now();

            await this.saveCombatData(combat, combatData);
        }
        
        // Ensure UI refreshes after a turn change to show the saved data
        this.updateUI(ui.combat);
    }

    /**
     * Hook triggered when combat ends (deleted).
     */
    async onCombatEnd(combat) {
        // Clear all local state
        this.currentCombatantId = null;
        this.currentTurnStart = null;
        this.lastPauseTime = null;
        this.pausedDuration = 0;
        
        // Unset flag is handled by the original code's logic if GM
        if (game.user.isGM) {
            await combat.unsetFlag("pf2e-turn-timer", "combatData");
        }
        
        this.updateUI(ui.combat); // Refresh UI to clear timers
    }

    /**
     * Hook triggered when the game is paused/unpaused.
     */
    onGamePause(paused) {
        const combat = game.combat;
        if (!combat) return;

        if (paused) {
            this.lastPauseTime = Date.now();
        } else if (this.lastPauseTime) {
            const pauseDuration = (Date.now() - this.lastPauseTime) / 1000;
            this.lastPauseTime = null;

            // When unpaused, adjust the current turn start time backwards by the pause duration.
            // This is the cleanest way to prevent the combatant's timer from including the pause.
            if (this.currentTurnStart) {
                this.currentTurnStart += pauseDuration * 1000;
            }
        }
        this.updateUI(ui.combat);
    }

    /**
     * Calculates the *live* elapsed time for the current combatant
     * and adds it to the combatant's total in the combatData structure.
     * This is only used for the *display* and is saved every second.
     */
    updateLiveTurnTimer() {
        if (!game.settings.get("pf2e-turn-timer", "enableTimer")) return;
        const combat = game.combat;
        if (!combat || !combat.isActive || !this.currentCombatantId || !this.currentTurnStart) return;
        if (game.paused) return; // Don't track if paused

        // NOTE: This approach leads to high data writes (once per second). 
        // A better approach would be to only save on turn change, but this 
        // matches the intent of the original high-frequency design.
        
        // Use a temporary data object for live calculation and immediate save
        let combatData = this.getCombatData(combat);
        let elapsedTime = (Date.now() - this.currentTurnStart) / 1000;
        
        combatData.combatantTimers[this.currentCombatantId] = 
            (combatData.combatantTimers[this.currentCombatantId] || 0) + elapsedTime;
        
        // Reset turn start time to the current moment for the next interval
        this.currentTurnStart = Date.now();
        
        // Save the live data update (only GM saves)
        this.saveCombatData(combat, combatData);
    }
    
    /**
     * Calculates the time since combat start, excluding pause time.
     */
    getTotalCombatTime(combat) {
        if (!combat || !combat.isActive) return "00:00:00";
        const combatData = this.getCombatData(combat);
        if (!combatData) return "00:00:00";

        // Calculate total elapsed time
        let totalTime = (Date.now() - combatData.startTime) / 1000;
        // Total time minus time spent while paused.
        let adjustedTime = totalTime - (combatData.pausedTime || 0);

        // This calculation is now done in updateCombat, but if we need a live
        // total time, we must aggregate combatant timers.
        
        // For simplicity, we aggregate all recorded combatant timers.
        let recordedTime = Object.values(combatData.combatantTimers).reduce((a, b) => a + b, 0);

        return this.formatTime(recordedTime > 0 ? recordedTime : 0);
    }

    /**
     * Gets the current combatant's total time (recorded time + live elapsed time).
     */
    getCombatantTime(combat, combatantId) {
        if (!combat) return "00:00:00";
        const combatData = this.getCombatData(combat);
        if (!combatData) return "00:00:00";

        let totalTime = combatData.combatantTimers[combatantId] || 0;

        // If this is the active combatant, add the live elapsed time.
        if (combat.combatant?.id === combatantId && combat.isActive && this.currentTurnStart && !game.paused) {
            totalTime += (Date.now() - this.currentTurnStart) / 1000;
        }
        
        return this.formatTime(totalTime > 0 ? totalTime : 0);
    }

    /**
     * Helper to format seconds into HH:MM:SS string.
     */
    formatTime(seconds) {
        if (seconds < 0) seconds = 0; // Prevent negative time
        let h = Math.floor(seconds / 3600);
        let m = Math.floor((seconds % 3600) / 60);
        let s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }

    /**
     * Renders the UI elements into the Combat Tracker.
     * Uses jQuery injection, which is generally more stable than raw DOM manipulation in Hooks.
     * @param {Application} app The Combat Tracker application instance.
     * @param {JQuery} html The jQuery object wrapping the application's HTML.
     */
    updateUI(app, html) {
        // ui.combat is the CombatTracker instance
        if (!(app instanceof CombatTracker)) return; 
        if (!game.settings.get("pf2e-turn-timer", "enableTimer")) return;

        const combat = game.combat;
        const $html = $(html); // Ensure we are working with a jQuery object

        // --- 1. Total Combat Timer Injection ---
        
        let $totalTimer = $html.find(".total-combat-timer");
        if (!$totalTimer.length) {
            // Inject the total timer element just below the header
            const header = $html.find("header.sidebar-header");
            $totalTimer = $(`<div class="total-combat-timer flexrow">
                <h3 style="flex: 1 1 50%; text-align: left; padding-left: 10px;">Combat Time:</h3>
                <span style="flex: 1 1 50%; text-align: right; padding-right: 10px;"></span>
            </div>`);
            
            header.after($totalTimer);
        }
        
        // Update the display value
        const timeValue = combat?.isActive ? this.getTotalCombatTime(combat) : "00:00:00";
        $totalTimer.find("span").text(timeValue);


        // --- 2. Combatant Turn Timer Injection ---

        $html.find(".combatant").each((index, element) => {
            const $combatantElement = $(element);
            const combatantId = $combatantElement.data("combatantId");
            if (!combatantId) return;

            let $timerElement = $combatantElement.find(".turn-timer");
            if (!$timerElement.length) {
                // Inject the timer element inside the combatant's name
                $timerElement = $(`<span class="turn-timer"></span>`);
                $combatantElement.find(".token-name").append($timerElement);
            }

            const combatantTime = combat ? this.getCombatantTime(combat, combatantId) : "00:00:00";
            $timerElement.text(` (${combatantTime})`);

            // Apply active class for visual indication
            if (combatantId === combat?.combatant?.id && combat.isActive && !game.paused) {
                $timerElement.addClass("active-timer");
            } else {
                $timerElement.removeClass("active-timer");
            }
        });
    }
}

// --- Foundry VTT Hooks and Initialization ---

// Register settings menu
Hooks.once("init", () => {
    // Register the main settings
    game.settings.register("pf2e-turn-timer", "enableTimer", {
        name: "Turn Timer | Enable",
        hint: "Enable or disable the combat turn timer module.",
        scope: "world", // Changed to world scope for GM control over the feature
        config: true,
        type: Boolean,
        default: true,
        // The setting controls the timer's activation and display
        onChange: () => window.pf2eTurnTimer?.updateUI(ui.combat) 
    });
    
    // The combat data flag does not need a user-facing setting; it's internal.
});

// Initialize module instance once the game is ready
Hooks.once("ready", () => {
    // Check if the PF2e system is active (optional, but good practice)
    if (game.system.id !== "pf2e") {
        console.warn("PF2e Turn Timer: This module is intended for the PF2e system.");
    }
    
    // Initialize the main application class
    window.pf2eTurnTimer = new PF2eTurnTimer();
    console.log("PF2e Turn Timer Initialized.");
});

// Minimal CSS to make the timers look good in the tracker
Hooks.on("renderSidebarTab", async (app, html) => {
    if (app.options.id !== "combat") return;

    // Inject styles into the combat tracker
    const style = `
        <style>
        /* Styling for the Total Combat Timer (New Element) */
        #combat .total-combat-timer {
            border-bottom: 1px solid #78290e;
            padding: 5px 0;
            background: rgba(0, 0, 0, 0.1);
            color: #f0f0e0;
        }
        #combat .total-combat-timer h3 {
            font-size: 14px;
            font-family: 'Signika', sans-serif;
            text-transform: uppercase;
        }
        #combat .total-combat-timer span {
            font-family: 'Fira Code', monospace;
            font-size: 14px;
            font-weight: bold;
            color: #f0f0e0;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.1);
        }

        /* Styling for the Combatant Timer (Inline Element) */
        #combat .combatant .token-name .turn-timer {
            font-size: 11px;
            font-family: 'Fira Code', monospace;
            font-weight: normal;
            margin-left: 5px;
            color: rgba(255, 255, 255, 0.6);
        }
        /* Highlight the active combatant's timer */
        #combat .combatant .token-name .turn-timer.active-timer {
            color: #FF6347; /* Tomato red for emphasis */
            font-weight: bold;
            text-shadow: 0 0 3px rgba(255, 99, 71, 0.5);
        }
        </style>
    `;
    html.find(".directory-list").before(style);
});
