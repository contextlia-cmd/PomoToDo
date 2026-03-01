import { EventBus } from './services/EventBus.js?v=5';
import { TagManager } from './components/TagManager.js?v=5';
import { StatsManager } from './components/StatsManager.js?v=5';
import { PomodoroTimer } from './components/PomodoroTimer.js?v=5';
import { TimePackage } from './components/TimePackage.js?v=5';
import { TodoManager } from './components/TodoManager.js?v=5';
import { LinkManager } from './components/LinkManager.js?v=5';
import { MisaAgent } from './agents/MisaAgent.js?v=5';
import { GeminiChatService } from './services/GeminiChatService.js?v=5';
import { SyncService } from './services/SyncService.js?v=5';
import { ChatAgent } from './agents/ChatAgent.js?v=5';
import { AuthAgent } from './agents/AuthAgent.js?v=5';
import { MusicPlayer } from './components/MusicPlayer.js?v=5';

class App {
    async init() {
        // Initialize Core Services
        this.eventBus = new EventBus();
        this.syncService = new SyncService(this.eventBus);
        this.chatService = new GeminiChatService();

        // Pull data from server before initializing components
        if (this.syncService.isLoggedIn()) {
            await this.syncService.pullFromServer();
        }

        // Initialize Components
        this.tagManager = new TagManager(this.eventBus);
        this.statsManager = new StatsManager(this.eventBus, this.tagManager);
        this.timer = new PomodoroTimer(this.eventBus, this.tagManager);
        this.timePackage = new TimePackage(this.eventBus);
        this.todoManager = new TodoManager(this.eventBus, this.tagManager);
        this.linkManager = new LinkManager();
        this.musicPlayer = new MusicPlayer(this.eventBus);

        // Initialize Agents
        this.authAgent = new AuthAgent(this.syncService, this.eventBus);
        this.chatAgent = new ChatAgent(this.chatService, this.eventBus);
        this.misaAgent = new MisaAgent(this.eventBus, this.chatService);

        // Listen for global data syncs to refresh UI and components
        this.eventBus.on('dataSynced', () => {
            // Re-initialize or refresh components that rely heavily on local storage
            // In a better architecture, components would reactively update, but here we can just reload the page for a clean state
            console.log("Data synced from server! Reloading page to apply...");
            window.location.reload();
        });

        console.log("PomoToDo App Initialized successfully.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
