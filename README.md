# PF2e Combat Turn Timer  
_A Foundry VTT Module for Pathfinder 2e_

![Foundry Version](https://img.shields.io/badge/Foundry_VTT-10%2B-orange)  
![License](https://img.shields.io/badge/license-MIT-green)  
![Version](https://img.shields.io/badge/version-1.0.0-blue)

## 📜 Overview  
**PF2e Combat Turn Timer** is a module for **Foundry VTT** that tracks the amount of time each combatant spends on their turn, as well as the total time elapsed in combat.

- 🕰️ **Live-updating timers** display per combatant and for the overall encounter.  
- ⏸️ **Pauses properly** when the game is paused.  
- 💾 **Timers persist** across logins and session reloads.  
- 🎛️ **Toggleable** via the module settings menu.  
- 📌 **Displays only in the sidebar combat tracker** (not the pop-out tracker).  

---

## 📥 Installation  

### 1️⃣ Install via Manifest URL  
1. Open Foundry VTT.  
2. Navigate to `Add-on Modules > Install Module`.  
3. Enter the manifest URL:


4. Click **Install** and activate the module.

### 2️⃣ Enable the Module  
1. Open your **Foundry Game**.  
2. Go to `Game Settings > Manage Modules`.  
3. Enable **PF2e Combat Turn Timer** and click **Save Changes**.

---

## ⚙️ Features & Settings  

### 📊 Timers Display in Combat Tracker  
- **Each combatant** has an individual turn timer.  
- A **Total Combat Time** tracker shows how long the encounter has lasted.  

### ⚙️ Settings Menu  
Navigate to `Game Settings > Module Settings > PF2e Combat Turn Timer` to:  
- **Enable/Disable the timer** (default: enabled).  
- When disabled, all timers will be removed from the UI.

### ⏸️ Game Pause Handling  
- **When the game is paused**, the active combatant’s timer and total combat time **freeze**.  
- Upon unpausing, the **pause duration is subtracted** to ensure accurate time tracking.  

### 🔄 Data Persistence  
- Timer data **persists** across logins and reloads.  
- Upon combat end, the data **resets automatically**.

---

## 🛠️ Known Issues & Limitations  
- The module **only works in the sidebar combat tracker** (not the pop-out version).  
- Timers **only track time during active turns** (does not include non-turn-related delays).  

---

## 🎮 How to Use  

1️⃣ **Start Combat**  
- Open the **Combat Tracker** and start a combat encounter.  
- Timers will automatically appear next to each combatant.  

2️⃣ **Watch Timers Update Live**  
- Each combatant's time updates in real time.  
- The **Total Combat Time** increments while combat is running.  

3️⃣ **Pause & Resume**  
- If the game is paused, the timers stop counting.  
- When unpaused, timers resume normally, subtracting the paused duration.  

4️⃣ **End Combat**  
- When combat ends, all timers reset for the next encounter.  

---

## 📜 License  
This module is released under the **MIT License**.  

---

## 👨‍💻 Credits & Contributions  
Created by **Jeremy Witchel**.  

- Contributions & feedback welcome!  

---

🚀 **Enjoy your enhanced combat tracking in Pathfinder 2e!** 🎲🔥  


