import { StorageService } from '../services/StorageService.js';

export class StatsManager {
    constructor(eventBus, tagManager) {
        this.eventBus = eventBus;
        this.tagManager = tagManager;
        this.sessions = StorageService.get('pomodoro_sessions', []);

        // DOM Elements
        this.statsBtn = document.getElementById('stats-btn');
        this.modal = document.getElementById('stats-modal');
        this.closeBtn = document.getElementById('close-stats-btn');
        this.statsTotalTime = document.getElementById('stats-total-time');
        this.chartsContainer = document.getElementById('stats-charts');
        this.tabs = document.querySelectorAll('.stats-tab');

        this.currentPeriod = 'daily'; // daily, weekly, monthly

        this.initListeners();
    }

    initListeners() {
        // Listen to timer completions emitted by PomodoroTimer
        this.eventBus.on('sessionCompleted', (data) => {
            this.logSession(data.tagId, data.duration);
        });

        // Modal Controls
        this.statsBtn.addEventListener('click', () => {
            this.renderStats();
            this.modal.classList.add('active');
        });

        this.closeBtn.addEventListener('click', () => {
            this.modal.classList.remove('active');
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.modal.classList.remove('active');
        });

        // Tabs
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentPeriod = e.target.dataset.period;
                this.tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.renderStats();
            });
        });
    }

    logSession(tagId, durationSeconds) {
        const session = {
            id: Date.now(),
            tagId: tagId,
            duration: durationSeconds,
            timestamp: Date.now()
        };
        this.sessions.push(session);
        this.save();
    }

    save() {
        StorageService.set('pomodoro_sessions', this.sessions);
    }

    renderStats() {
        const filteredSessions = this.filterSessionsByPeriod(this.currentPeriod);

        // Calculate Totals
        const totalSeconds = filteredSessions.reduce((sum, s) => sum + s.duration, 0);
        this.statsTotalTime.textContent = this.formatTime(totalSeconds);

        // Group by Tag
        const tagStats = {};

        filteredSessions.forEach(session => {
            const tagId = session.tagId || 'uncategorized';
            if (!tagStats[tagId]) tagStats[tagId] = 0;
            tagStats[tagId] += session.duration;
        });

        // Render Charts
        this.chartsContainer.innerHTML = '';

        if (totalSeconds === 0) {
            this.chartsContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top: 2rem;">No data for this period</p>';
            return;
        }

        // Sort by duration desc
        const sortedTags = Object.keys(tagStats).sort((a, b) => tagStats[b] - tagStats[a]);
        const maxDuration = tagStats[sortedTags[0]];

        sortedTags.forEach(tagId => {
            const duration = tagStats[tagId];
            let tagName = 'No Tag';
            let tagColor = '#a0a0a0';

            if (tagId !== 'uncategorized') {
                const tag = this.tagManager.getTag(parseInt(tagId, 10));
                if (tag) {
                    tagName = tag.name;
                    tagColor = tag.color;
                }
            }

            const percent = (duration / maxDuration) * 100;

            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <div class="stat-label">
                    <span>${this.escapeHtml(tagName)}</span>
                    <span>${this.formatTime(duration)}</span>
                </div>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${percent}%; background-color: ${tagColor};"></div>
                </div>
            `;
            this.chartsContainer.appendChild(row);
        });
    }

    filterSessionsByPeriod(period) {
        const now = new Date();
        const startOfPeriod = new Date();

        if (period === 'daily') {
            startOfPeriod.setHours(0, 0, 0, 0);
        } else if (period === 'weekly') {
            const day = startOfPeriod.getDay();
            const diff = startOfPeriod.getDate() - day + (day === 0 ? -6 : 1);
            startOfPeriod.setDate(diff);
            startOfPeriod.setHours(0, 0, 0, 0);
        } else if (period === 'monthly') {
            startOfPeriod.setDate(1);
            startOfPeriod.setHours(0, 0, 0, 0);
        }

        return this.sessions.filter(session => session.timestamp >= startOfPeriod.getTime());
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
