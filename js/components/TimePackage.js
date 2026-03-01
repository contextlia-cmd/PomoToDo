export class TimePackage {
    constructor(eventBus) {
        this.eventBus = eventBus;

        // DOM Elements
        this.selectElement = document.getElementById('time-package-select');
        this.fillElement = document.getElementById('time-package-fill');
        this.remainingElement = document.getElementById('time-package-remaining');
        this.percentElement = document.getElementById('time-package-percent');

        // State
        this.totalSeconds = 14400; // Default: 4 hours
        this.elapsedSeconds = 0;

        this.loadState();
        this.initListeners();
        this.updateDisplay();
    }

    initListeners() {
        // Handle dropdown selection change
        this.selectElement.addEventListener('change', (e) => {
            this.totalSeconds = parseInt(e.target.value, 10);
            this.elapsedSeconds = 0; // Reset progress when package changes
            this.saveState();
            this.updateDisplay();
        });

        // Listen for tick from PomodoroTimer when in Focus mode
        this.eventBus.on('focusTick', () => {
            if (this.elapsedSeconds < this.totalSeconds) {
                this.elapsedSeconds++;
                this.saveState();
                this.updateDisplay();

                if (this.elapsedSeconds >= this.totalSeconds) {
                    this.notifyCompletion();
                }
            }
        });
    }

    updateDisplay() {
        // Update select value to match state
        this.selectElement.value = this.totalSeconds.toString();

        // Calculate remaining time
        const remaining = Math.max(0, this.totalSeconds - this.elapsedSeconds);
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        this.remainingElement.textContent = `Remaining: ${hours}h ${minutes.toString().padStart(2, '0')}m`;

        // Calculate percentage
        const percent = Math.min(100, (this.elapsedSeconds / this.totalSeconds) * 100);
        this.percentElement.textContent = `${Math.floor(percent)}%`;

        // Update progress bar width
        this.fillElement.style.width = `${percent}%`;
    }

    saveState() {
        const state = {
            totalSeconds: this.totalSeconds,
            elapsedSeconds: this.elapsedSeconds
        };
        localStorage.setItem('pomoToDo_timePackage', JSON.stringify(state));
        if (window.app && window.app.syncService) {
            window.app.syncService.triggerSync();
        }
    }

    loadState() {
        const saved = localStorage.getItem('pomoToDo_timePackage');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.totalSeconds = state.totalSeconds || 14400;
                this.elapsedSeconds = state.elapsedSeconds || 0;
            } catch (e) {
                console.error("Failed to parse time package state", e);
            }
        }
    }

    notifyCompletion() {
        // Only notify if we support notifications and haven't already alerted frequently
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Time Package Completed!', {
                body: 'Great job! You have completed your set time package for today.',
                icon: '/favicon.ico' // fallback to default icon if any
            });
        }
    }
}
