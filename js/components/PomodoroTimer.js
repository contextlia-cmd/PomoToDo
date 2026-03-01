export class PomodoroTimer {
    constructor(eventBus, tagManager) {
        this.eventBus = eventBus;
        this.tagManager = tagManager;

        this.timeLeft = 25 * 60; // seconds
        this.timerId = null;
        this.mode = 'focus'; // focus, short, long
        this.isRunning = false;

        this.selectedTagId = null;
        this.cycleStep = 0; // 0: 1st Focus, 1: 1st Short, 2: 2nd Focus, 3: 2nd Short

        // Configuration
        this.modes = {
            focus: 25 * 60,
            short: 5 * 60,
            long: 15 * 60
        };

        // DOM Elements
        this.timeDisplay = document.getElementById('time-display');
        this.timerStatus = document.getElementById('timer-status');
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.progressCircle = document.querySelector('.progress-ring__circle');
        this.tagDisplay = document.getElementById('timer-tag-display');
        this.tagDisplayText = this.tagDisplay.querySelector('span');

        // Progress Ring calculation
        const radius = this.progressCircle.r.baseVal.value;
        this.circumference = radius * 2 * Math.PI;
        this.progressCircle.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
        this.progressCircle.style.strokeDashoffset = 0;

        this.initListeners();
        this.updateDisplay();
        this.updateTagDisplay();
    }

    initListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());

        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
                this.updateActiveButton();
            });
        });

        this.tagDisplay.addEventListener('click', () => {
            document.getElementById('toggle-tags-btn').click();
        });

        // Listen for tag selection from TagManager via EventBus
        this.eventBus.on('tagSelected', (tagId) => {
            this.selectedTagId = tagId;
            this.updateTagDisplay();
        });
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;

        this.selectedTagId = this.tagManager.getSelectedTag();
        this.updateTagDisplay();

        this.timerId = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            this.setProgress(this.timeLeft / this.modes[this.mode]);

            // Emit tick event specifically for TimePackage progress
            if (this.mode === 'focus') {
                this.eventBus.emit('focusTick');
            }

            if (this.timeLeft <= 0) {
                this.complete();
            }
        }, 1000);
    }

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        clearInterval(this.timerId);
    }

    reset() {
        this.pause();
        this.timeLeft = this.modes[this.mode];
        this.updateDisplay();
        this.setProgress(1);
        this.cycleStep = 0;
    }

    switchMode(mode) {
        this.mode = mode;
        this.cycleStep = 0;
        this.reset();
        this.updateStatusText();
        this.updateTheme();
    }

    complete() {
        this.pause();

        if (this.mode === 'focus') {
            // Emitting event to decoupling from StatsManager
            this.eventBus.emit('sessionCompleted', { tagId: this.selectedTagId, duration: this.modes.focus });
        }

        let soundType = 'focus-end';
        let shouldAutoStart = false;
        let nextMode = '';

        if (this.mode === 'focus') {
            soundType = 'focus-end';
            if (this.cycleStep === 0) {
                nextMode = 'short';
                this.cycleStep = 1;
                shouldAutoStart = true;
            } else if (this.cycleStep === 2) {
                nextMode = 'short';
                this.cycleStep = 3;
                shouldAutoStart = true;
            } else {
                this.cycleStep = 0;
            }
        } else if (this.mode === 'short') {
            if (this.cycleStep === 1) {
                soundType = 'short-break-1';
                nextMode = 'focus';
                this.cycleStep = 2;
                shouldAutoStart = true;
            } else if (this.cycleStep === 3) {
                soundType = 'cycle-complete';
                this.cycleStep = 0;
                shouldAutoStart = false;
                nextMode = 'focus';
            }
        }

        this.playAlarm(soundType);

        if (shouldAutoStart) {
            this.mode = nextMode;
            this.timeLeft = this.modes[this.mode];
            this.updateDisplay();
            this.updateStatusText();
            this.updateTheme();
            this.updateActiveButton();
            this.setProgress(1);

            setTimeout(() => {
                this.start();
            }, 1500);
        } else {
            setTimeout(() => {
                alert('Cycle Finished!');
                if (nextMode) {
                    this.switchMode(nextMode);
                    this.updateActiveButton();
                } else {
                    this.reset();
                }
            }, 500);
        }
    }

    updateStatusText() {
        const statusText = {
            focus: 'Focus Time',
            short: 'Short Break',
            long: 'Long Break'
        };
        this.timerStatus.textContent = statusText[this.mode];
    }

    updateTheme() {
        const root = document.documentElement;
        if (this.mode === 'focus') {
            root.style.setProperty('--accent-color', '#7b2cbf');
        } else {
            root.style.setProperty('--accent-color', '#38b000');
        }
    }

    updateActiveButton() {
        this.modeBtns.forEach(b => {
            b.classList.remove('active');
            if (b.dataset.mode === this.mode) b.classList.add('active');
        });
    }

    updateTagDisplay() {
        if (this.selectedTagId) {
            const tag = this.tagManager.getTag(this.selectedTagId);
            if (tag) {
                this.tagDisplayText.textContent = tag.name;
                this.tagDisplay.style.borderColor = tag.color;
                return;
            }
        }
        this.tagDisplayText.textContent = 'No Tag Selected';
        this.tagDisplay.style.borderColor = 'transparent';
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.title = `${this.timeDisplay.textContent} - Focus Dashboard`;
    }

    setProgress(percent) {
        const offset = this.circumference - (percent * this.circumference);
        this.progressCircle.style.strokeDashoffset = offset;
    }

    playAlarm(type = 'focus-end') {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const playTone = (freq, startTime, duration, type = 'sine') => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = audioCtx.currentTime;

        if (type === 'focus-end') {
            playTone(880, now, 0.1);
            playTone(880, now + 0.2, 0.1);
        } else if (type === 'short-break-1') {
            playTone(220, now, 0.3, 'square');
        } else if (type === 'cycle-complete') {
            playTone(523.25, now, 0.1);
            playTone(659.25, now + 0.1, 0.1);
            playTone(783.99, now + 0.2, 0.1);
            playTone(1046.50, now + 0.3, 0.4);
        } else {
            playTone(440, now, 0.5);
        }
    }
}
