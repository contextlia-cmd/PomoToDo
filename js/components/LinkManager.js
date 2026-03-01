import { StorageService } from '../services/StorageService.js';

export class LinkManager {
    constructor() {
        this.links = StorageService.get('links', []);
        this.linksContainer = document.getElementById('links-container');
        this.titleInput = document.getElementById('link-title-input');
        this.urlInput = document.getElementById('link-url-input');
        this.addBtn = document.getElementById('add-link-btn');

        this.initListeners();
        this.render();
    }

    initListeners() {
        this.addBtn.addEventListener('click', () => this.addLink());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addLink();
        });

        this.linksContainer.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.link-delete');
            if (delBtn) {
                e.preventDefault();
                const id = parseInt(delBtn.dataset.id, 10);
                this.deleteLink(id);
            }
        });
    }

    addLink() {
        const title = this.titleInput.value.trim();
        let url = this.urlInput.value.trim();

        if (!title || !url) return;

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const link = {
            id: Date.now(),
            title: title,
            url: url
        };

        this.links.push(link);
        this.save();
        this.render();

        this.titleInput.value = '';
        this.urlInput.value = '';
    }

    deleteLink(id) {
        this.links = this.links.filter(link => link.id !== id);
        this.save();
        this.render();
    }

    save() {
        StorageService.set('links', this.links);
        if (window.app && window.app.syncService) window.app.syncService.triggerSync();
    }

    getFavicon(url) {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch (e) {
            return 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.glyph.json';
        }
    }

    render() {
        this.linksContainer.innerHTML = '';
        this.links.forEach(link => {
            const a = document.createElement('a');
            a.className = 'link-card';
            a.href = link.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            a.innerHTML = `
                <button class="link-delete" data-id="${link.id}">
                    <i class="ri-close-line"></i>
                </button>
                <div class="link-icon">
                    <img src="${this.getFavicon(link.url)}" alt="icon" style="width: 24px; height: 24px; border-radius: 4px;">
                </div>
                <div class="link-title">${this.escapeHtml(link.title)}</div>
            `;

            this.linksContainer.appendChild(a);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
