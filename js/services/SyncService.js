export class SyncService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.baseUrl = 'http://localhost:3005/api';
        this.token = localStorage.getItem('pomoToDo_authToken') || null;
        this.username = localStorage.getItem('pomoToDo_username') || null;
        this.isSyncing = false;

        // Expose to window for easy debugging/access if needed
        window.syncService = this;
    }

    isLoggedIn() {
        return this.token !== null;
    }

    setToken(token, username) {
        this.token = token;
        this.username = username;
        if (token) {
            localStorage.setItem('pomoToDo_authToken', token);
            localStorage.setItem('pomoToDo_username', username);
        } else {
            localStorage.removeItem('pomoToDo_authToken');
            localStorage.removeItem('pomoToDo_username');
        }
        this.eventBus.emit('authStateChanged', this.isLoggedIn());
    }

    async register(username, password) {
        try {
            const response = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Registration failed');
            return true;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Login failed');

            this.setToken(data.token, data.username);
            return true;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async logout() {
        if (!this.token) return;
        try {
            await fetch(`${this.baseUrl}/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
        } catch (e) {
            console.warn('Logout API failed, clearing local token anyway');
        }
        this.setToken(null, null);
    }

    // Collect all local storage state managed by different components
    getStateSnapshot() {
        return {
            todos: JSON.parse(localStorage.getItem('pomoToDo_todos') || '[]'),
            tags: JSON.parse(localStorage.getItem('pomoToDo_tags') || '[]'),
            stats: JSON.parse(localStorage.getItem('pomoToDo_stats') || '{}'),
            timePackage: JSON.parse(localStorage.getItem('pomoToDo_timePackage') || '{}'),
            geminiApiKey: localStorage.getItem('gemini_api_key') || '',
            systemPrompt: localStorage.getItem('gemini_system_prompt') || '',
            misaTasks: JSON.parse(localStorage.getItem('pomoToDo_misa_tasks') || '[]')
        };
    }

    // Restore state from server to local storage
    restoreState(serverData) {
        if (!serverData) return;

        if (serverData.todos) localStorage.setItem('pomoToDo_todos', JSON.stringify(serverData.todos));
        if (serverData.tags) localStorage.setItem('pomoToDo_tags', JSON.stringify(serverData.tags));
        if (serverData.stats) localStorage.setItem('pomoToDo_stats', JSON.stringify(serverData.stats));
        if (serverData.timePackage) localStorage.setItem('pomoToDo_timePackage', JSON.stringify(serverData.timePackage));
        if (serverData.geminiApiKey) localStorage.setItem('gemini_api_key', serverData.geminiApiKey);
        if (serverData.systemPrompt) localStorage.setItem('gemini_system_prompt', serverData.systemPrompt);
        if (serverData.misaTasks) localStorage.setItem('pomoToDo_misa_tasks', JSON.stringify(serverData.misaTasks));

        // Notify application to redraw with new data
        this.eventBus.emit('dataSynced');
    }

    triggerSync() {
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
            this.pushToServer();
        }, 2000); // 2秒間のデバウンス
    }

    async pushToServer() {
        if (!this.isLoggedIn() || this.isSyncing) return;

        this.isSyncing = true;
        const state = this.getStateSnapshot();

        try {
            const response = await fetch(`${this.baseUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(state)
            });

            if (response.status === 401) {
                // Token expired
                this.setToken(null, null);
            }
        } catch (error) {
            console.error('Push sync error:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    async pullFromServer() {
        if (!this.isLoggedIn() || this.isSyncing) return;

        this.isSyncing = true;
        try {
            const response = await fetch(`${this.baseUrl}/sync`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.status === 401) {
                this.setToken(null, null);
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (Object.keys(data).length > 0) {
                    this.restoreState(data);
                }
            }
        } catch (error) {
            console.error('Pull sync error:', error);
        } finally {
            this.isSyncing = false;
        }
    }
}
