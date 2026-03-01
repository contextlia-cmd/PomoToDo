import { StorageService } from '../services/StorageService.js';

export class MisaAgent {
    constructor(eventBus, chatService = null) {
        this.eventBus = eventBus;
        this.chatService = chatService;

        // DOM Elements
        this.statusBadge = document.getElementById('misa-status-badge');
        this.suggestionText = document.getElementById('misa-suggestion-text');
        this.addTaskBtn = document.getElementById('misa-add-task-btn');

        // Icon Upload Elements
        this.iconWrapper = document.getElementById('misa-icon-wrapper');
        this.iconUpload = document.getElementById('misa-icon-upload');
        this.iconImg = document.getElementById('misa-icon-img');
        this.defaultIcon = document.getElementById('misa-default-icon');

        // Speech Bubble Element
        this.speechBubble = document.getElementById('misa-speech-bubble');
        this.changeGreetingTimer = null;
        this.isGeneratingGreeting = false;

        this.greetings = [
            "ふぁ〜、よく寝た。おはようございます。",
            "あ、こんにちは。今、夕飯の献立を考えていたところです。",
            "こんばんは。今日は星が綺麗ですね。",
            "んん…？あ、見られてました？ちょっと休憩してました。",
            "お疲れ様です！お茶でも淹れましょうか？",
            "あ、今日も頑張ってますね。私も見習わなきゃ。",
            "お腹空きましたね…今日のご飯は何ですか？",
            "ふふっ、なんだか今日はいいことがありそうな気がします。",
            "んー、ちょっと伸びをさせてください。うーんっ！",
            "あ、髪の毛跳ねてないですよね？大丈夫かな。",
            "今日も一日、無理せずいきましょうね。",
            "あはは、そんなに見つめられると照れちゃいます。",
            "さてと、次は何をしましょうか？",
            "たまには息抜きも必要ですよ。深呼吸してみませんか？",
            "いつも応援してますからね！フレー、フレー！"
        ];

        this.currentSuggestion = null;
        this.STORAGE_KEY = 'misa_agent_icon';

        this.initIcon();
        this.initListeners();
        this.checkGarbageDay();

        setInterval(() => this.checkGarbageDay(), 1000 * 60 * 60);
    }

    initIcon() {
        // Load custom icon from localStorage if available
        const savedIcon = localStorage.getItem(this.STORAGE_KEY);
        if (savedIcon) {
            this.iconImg.src = savedIcon;
            this.iconImg.style.display = 'block';
            this.defaultIcon.style.display = 'none';
            this.eventBus.emit('misaIconUpdated', savedIcon);
        }
    }

    initListeners() {
        // Handle greeting on icon click
        this.iconImg.addEventListener('click', (e) => {
            e.stopPropagation(); // 吹き出し表示時はアップロードを発火させない
            this.showGreeting();
        });

        this.defaultIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showGreeting();
        });

        // Trigger file upload dialog on overlay wrapper click
        document.querySelector('.icon-upload-overlay').addEventListener('click', (e) => {
            e.stopPropagation();
            this.iconUpload.click();
        });

        // Handle file selection
        this.iconUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                // Save and update UI
                localStorage.setItem(this.STORAGE_KEY, dataUrl);
                this.iconImg.src = dataUrl;
                this.iconImg.style.display = 'block';
                this.defaultIcon.style.display = 'none';
                this.eventBus.emit('misaIconUpdated', dataUrl);
            };
            reader.readAsDataURL(file);
        });

        // Add task button click
        this.addTaskBtn.addEventListener('click', () => {
            if (this.currentSuggestion) {
                // Emit event to TodoManager
                this.eventBus.emit('suggestionAccepted', this.currentSuggestion);

                // Record that this suggestion was added
                if (this.currentSuggestionId) {
                    const addedTasks = JSON.parse(localStorage.getItem('pomoToDo_misa_tasks') || '[]');
                    if (!addedTasks.includes(this.currentSuggestionId)) {
                        addedTasks.push(this.currentSuggestionId);
                        // 履歴が大きくなりすぎないように制限（直近30件）
                        if (addedTasks.length > 30) addedTasks.shift();
                        localStorage.setItem('pomoToDo_misa_tasks', JSON.stringify(addedTasks));
                        // 同期機能への連携（SyncServiceへのトリガー）
                        if (window.app && window.app.syncService) {
                            window.app.syncService.triggerSync();
                        }
                    }
                }

                this.currentSuggestion = null;
                this.currentSuggestionId = null;
                this.updateUI();
            }
        });
    }

    async showGreeting() {
        if (this.isGeneratingGreeting) return; // Prevent multiple simultaneous requests

        this.isGeneratingGreeting = true;
        let greetingText = '';

        if (this.chatService && this.chatService.hasApiKey()) {
            // Show loading state
            this.speechBubble.textContent = "考え中...";
            this.speechBubble.style.display = 'block';

            try {
                const generatedGreeting = await this.chatService.generateMisaGreeting();
                if (generatedGreeting) {
                    greetingText = generatedGreeting;
                } else {
                    // Fallback to random if API fails
                    const randomIndex = Math.floor(Math.random() * this.greetings.length);
                    greetingText = this.greetings[randomIndex];
                }
            } catch (e) {
                const randomIndex = Math.floor(Math.random() * this.greetings.length);
                greetingText = this.greetings[randomIndex];
            }
        } else {
            // Use static random greeting if no API key
            const randomIndex = Math.floor(Math.random() * this.greetings.length);
            greetingText = this.greetings[randomIndex];
        }

        this.speechBubble.textContent = greetingText;
        this.speechBubble.style.display = 'block';
        this.isGeneratingGreeting = false;

        // 既存のタイマーがあればクリア
        if (this.changeGreetingTimer) {
            clearTimeout(this.changeGreetingTimer);
        }

        // 10分(600,000ミリ秒)後に再度自律的に挨拶を更新する
        this.changeGreetingTimer = setTimeout(() => {
            this.showGreeting();
        }, 600000);
    }

    checkGarbageDay() {
        const now = new Date();
        const jstString = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
        const jstDate = new Date(jstString);

        const day = jstDate.getDay();
        const hour = jstDate.getHours();
        const minute = jstDate.getMinutes();

        const timeVal = hour + (minute / 60);

        let targetType = null;
        let isNightBefore = false;
        let isMorningOf = false;

        const dateStr = jstDate.getFullYear() + '-' + (jstDate.getMonth() + 1) + '-' + jstDate.getDate();
        let suggestionId = null;

        if (timeVal >= 22) {
            isNightBefore = true;
            targetType = this.getGarbageTypeForDay((day + 1) % 7);
            suggestionId = `garbage_${dateStr}_night`;
        } else if (timeVal <= 8.5) {
            isMorningOf = true;
            targetType = this.getGarbageTypeForDay(day);
            suggestionId = `garbage_${dateStr}_morning`;
        }

        if (targetType) {
            const addedTasks = JSON.parse(localStorage.getItem('pomoToDo_misa_tasks') || '[]');
            if (addedTasks.includes(suggestionId)) {
                targetType = null; // すでに追加済みの場合は非表示にする
            }
        }

        if (targetType) {
            this.currentSuggestionId = suggestionId;
            if (isNightBefore) {
                this.currentSuggestion = `明日は「${targetType}」のゴミの日です。忘れずに準備しましょう！`;
            } else if (isMorningOf) {
                this.currentSuggestion = `本日は「${targetType}」のゴミの日です。8:30までに出しましょう！`;
            }
        } else {
            this.currentSuggestion = null;
            this.currentSuggestionId = null;
        }

        this.updateUI();
    }

    getGarbageTypeForDay(dayIndex) {
        switch (dayIndex) {
            case 1: return '紙、段ボール';
            case 2:
            case 5: return '燃やせるゴミ';
            case 4: return 'びん、ペットボトル';
            default: return null;
        }
    }

    updateUI() {
        if (this.currentSuggestion) {
            this.statusBadge.style.display = 'block';
            this.suggestionText.textContent = this.currentSuggestion;
            this.addTaskBtn.style.display = 'inline-flex';
        } else {
            this.statusBadge.style.display = 'none';
            this.suggestionText.textContent = '現在、提案するタスクはありません。';
            this.addTaskBtn.style.display = 'none';
        }
    }
}
