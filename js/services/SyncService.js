import { supabase } from './SupabaseConfig.js';

export class SyncService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.token = localStorage.getItem('pomoToDo_authToken') || null;
        this.username = localStorage.getItem('pomoToDo_username') || null;
        this.isSyncing = false;

        window.syncService = this;

        // Listen to auth state changes from Supabase
        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                const username = session.user.user_metadata?.username || session.user.email.split('@')[0];
                this.setToken(session.access_token, username);
            } else {
                this.setToken(null, null);
            }
        });
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
        // Supabase requires email, so we append a dummy domain if username doesn't have one
        const email = username.includes('@') ? username : `${username}@pomotodo.com`;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) throw new Error(error.message);
        return true;
    }

    async login(username, password) {
        const email = username.includes('@') ? username : `${username}@pomotodo.com`;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                throw new Error("ユーザー名またはパスワードが間違っています。");
            }
            throw new Error(error.message);
        }
        return true;
    }

    async logout() {
        await supabase.auth.signOut();
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
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                this.setToken(null, null);
                return;
            }

            const { error } = await supabase
                .from('user_data')
                .upsert({ id: user.id, data: state });

            if (error) {
                console.error("Supabase upsert error:", error);
                throw error;
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
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                this.setToken(null, null);
                return;
            }

            const { data, error } = await supabase
                .from('user_data')
                .select('data')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                throw error;
            }

            if (data && data.data) {
                this.restoreState(data.data);
            }
        } catch (error) {
            console.error('Pull sync error:', error);
        } finally {
            this.isSyncing = false;
        }
    }
}
