export class ChatAgent {
    constructor(chatService, eventBus = null) {
        this.chatService = chatService;
        this.eventBus = eventBus;

        // DOM Elements
        this.fab = document.getElementById('chat-fab');
        this.chatWindow = document.getElementById('chat-window');
        this.closeBtn = document.getElementById('close-chat-btn');
        this.sizeBtns = document.querySelectorAll('.size-btn');
        this.chatMisaIcon = document.getElementById('chat-misa-icon');
        this.chatDefaultIcon = document.getElementById('chat-default-icon');
        this.chatInnerMisaIcon = document.getElementById('chat-inner-misa-icon');
        this.chatInnerDefaultIcon = document.getElementById('chat-inner-default-icon');

        // Screens
        this.apiKeyScreen = document.getElementById('api-key-screen');
        this.mainChatScreen = document.getElementById('main-chat-screen');

        // API Key Input
        this.apiKeyInput = document.getElementById('api-key-input');
        this.saveApiKeyBtn = document.getElementById('save-api-key-btn');

        // Chat Area
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendChatBtn = document.getElementById('send-chat-btn');

        // Settings Controls
        this.settingsBtn = document.getElementById('settings-chat-btn');
        this.systemPromptInput = document.getElementById('system-prompt-input');
        this.savePromptBtn = document.getElementById('save-prompt-btn');

        // Move chat window to body to escape backdrop-filter containing block
        document.body.appendChild(this.chatWindow);

        this.initListeners();

        // Set initial position and track resize events
        this.updateChatPosition();
        window.addEventListener('resize', () => this.updateChatPosition());
    }

    initListeners() {
        // Handle Misa Icon Synchronization
        if (this.eventBus) {
            this.eventBus.on('misaIconUpdated', (iconDataUrl) => {
                if (this.chatMisaIcon && this.chatDefaultIcon && iconDataUrl) {
                    this.chatMisaIcon.src = iconDataUrl;
                    this.chatMisaIcon.style.display = 'block';
                    this.chatDefaultIcon.style.display = 'none';
                }
                if (this.chatInnerMisaIcon && this.chatInnerDefaultIcon && iconDataUrl) {
                    this.chatInnerMisaIcon.src = iconDataUrl;
                    this.chatInnerMisaIcon.style.display = 'block';
                    this.chatInnerDefaultIcon.style.display = 'none';
                }
            });

            // Listen for music window opening to close chat player
            this.eventBus.on('musicWindowOpened', () => {
                if (!this.chatWindow.classList.contains('collapsed')) {
                    this.closeChat();
                }
            });
        }

        // Toggle Chat Window
        this.fab.addEventListener('click', () => this.toggleChat());
        this.closeBtn.addEventListener('click', () => this.closeChat());

        // Toggle Settings
        this.settingsBtn.addEventListener('click', () => this.toggleSettings());

        // Size Control
        this.sizeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = e.currentTarget.dataset.size;
                if (!size) return; // ignore settings btn which uses size-btn class for style

                this.setChatSize(size);

                // Update active state
                this.sizeBtns.forEach(b => {
                    if (b.dataset.size) b.classList.remove('active');
                });
                e.currentTarget.classList.add('active');
            });
        });

        // Save API Key
        this.saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
        this.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSaveApiKey();
        });

        // Save System Prompt
        this.savePromptBtn.addEventListener('click', () => this.handleSaveSystemPrompt());

        // Send Message
        this.sendChatBtn.addEventListener('click', () => this.handleSendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });

        // Load initial state
        if (this.chatService.hasApiKey()) {
            this.apiKeyInput.value = this.chatService.getApiKey();
        }
        if (this.chatService.getSystemPrompt()) {
            this.systemPromptInput.value = this.chatService.getSystemPrompt();
        }
    }

    toggleChat() {
        const isCollapsed = this.chatWindow.classList.contains('collapsed');
        if (isCollapsed) {
            this.chatWindow.classList.remove('collapsed');

            if (this.eventBus) {
                this.eventBus.emit('chatWindowOpened');
            }

            // Return to appropriate screen
            this.checkApiKeyAndSetScreen();
        } else {
            this.closeChat();
        }
    }

    closeChat() {
        this.chatWindow.classList.add('collapsed');
        // Ensure settings screen is closed when reopened
        this.isSettingsOpen = false;
    }

    toggleSettings() {
        this.isSettingsOpen = !this.isSettingsOpen;
        if (this.isSettingsOpen) {
            this.apiKeyScreen.style.display = 'flex';
            this.mainChatScreen.style.display = 'none';
        } else {
            this.checkApiKeyAndSetScreen();
        }
    }

    setChatSize(sizeName) {
        // Remove existing size classes
        this.chatWindow.classList.remove('chat-size-small', 'chat-size-medium', 'chat-size-large');
        // Add new size class
        this.chatWindow.classList.add(`chat-size-${sizeName}`);

        // Update position based on size change
        this.updateChatPosition();
    }

    updateChatPosition() {
        if (!this.chatWindow.classList.contains('chat-size-large')) {
            const fabRect = this.fab.getBoundingClientRect();
            // Position relative to FAB (small/medium)
            this.chatWindow.style.top = `${fabRect.bottom + 10}px`;
            this.chatWindow.style.right = `${window.innerWidth - fabRect.right}px`;
            this.chatWindow.style.bottom = 'auto';
            this.chatWindow.style.left = 'auto';
            this.chatWindow.style.transformOrigin = 'top right';
        } else {
            // For large size, we rely on the CSS fixed centering, so clear JS inline styles
            this.chatWindow.style.top = '';
            this.chatWindow.style.right = '';
            this.chatWindow.style.bottom = '';
            this.chatWindow.style.left = '';
            this.chatWindow.style.transformOrigin = 'center center';
        }
    }

    checkApiKeyAndSetScreen() {
        if (this.chatService.hasApiKey() && !this.isSettingsOpen) {
            this.apiKeyScreen.style.display = 'none';
            this.mainChatScreen.style.display = 'flex';
        } else {
            this.apiKeyScreen.style.display = 'flex';
            this.mainChatScreen.style.display = 'none';
            this.isSettingsOpen = true; // Always true if no API key
        }
    }

    handleSaveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (key) {
            this.chatService.setApiKey(key);
            // Optionally close settings if they were intentionally opened
            if (this.isSettingsOpen && this.chatService.hasApiKey()) {
                this.toggleSettings();
            } else {
                this.checkApiKeyAndSetScreen();
            }
        }
    }

    handleSaveSystemPrompt() {
        const prompt = this.systemPromptInput.value.trim();
        this.chatService.setSystemPrompt(prompt);

        const originalText = this.savePromptBtn.textContent;
        this.savePromptBtn.textContent = 'Saved!';
        setTimeout(() => {
            this.savePromptBtn.textContent = originalText;
        }, 2000);
    }

    async handleSendMessage() {
        const text = this.chatInput.value.trim();
        if (!text) return;

        // Clear input and show user message
        this.chatInput.value = '';
        this.appendMessage('user', text);

        // Show loading indicator
        this.showLoading();

        try {
            const reply = await this.chatService.sendMessage(text);
            this.hideLoading();
            this.appendMessage('ai', reply);
        } catch (error) {
            this.hideLoading();
            this.appendMessage('ai', `エラーが発生しました: ${error.message}`);
        }
    }

    appendMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}-message`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Simple markdown parsing for the response (bold and linebreaks)
        if (role === 'ai') {
            let processedContent = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            contentDiv.innerHTML = processedContent;
        } else {
            contentDiv.textContent = content;
        }

        msgDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(msgDiv);

        this.scrollToBottom();
    }

    showLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message typing-indicator-wrapper';
        loadingDiv.id = 'chat-typing-indicator';

        loadingDiv.innerHTML = `
            <div class="message-content typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        this.chatMessages.appendChild(loadingDiv);
        this.scrollToBottom();
    }

    hideLoading() {
        const loadingDiv = document.getElementById('chat-typing-indicator');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 10);
    }
}
