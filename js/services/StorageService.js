/**
 * StorageService - Centralized LocalStorage Management
 */
export class StorageService {
    static get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error(`Error reading from localStorage [${key}]:`, e);
            return defaultValue;
        }
    }

    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            if (window.app && window.app.syncService) {
                window.app.syncService.triggerSync();
            }
        } catch (e) {
            console.error(`Error saving to localStorage [${key}]:`, e);
        }
    }

    static remove(key) {
        localStorage.removeItem(key);
        if (window.app && window.app.syncService) {
            window.app.syncService.triggerSync();
        }
    }
}
