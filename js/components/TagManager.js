import { StorageService } from '../services/StorageService.js';

export class TagManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.tags = StorageService.get('tags', [
            { id: 1, name: 'Work', color: '#ef233c' },
            { id: 2, name: 'Personal', color: '#38b000' },
            { id: 3, name: 'Study', color: '#4361ee' }
        ]);
        this.selectedTagId = null;

        // DOM Elements
        this.container = document.getElementById('tags-list');
        this.drawer = document.getElementById('tag-selection-area');
        this.toggleBtn = document.getElementById('toggle-tags-btn');
        this.input = document.getElementById('new-tag-input');
        this.colorInput = document.getElementById('new-tag-color');
        this.addBtn = document.getElementById('add-tag-btn');

        this.initListeners();
        this.render();
    }

    initListeners() {
        this.toggleBtn.addEventListener('click', () => {
            const isCollapsed = this.drawer.classList.contains('collapsed');
            if (isCollapsed) {
                this.drawer.classList.remove('collapsed');
                this.toggleBtn.innerHTML = '<i class="ri-subtract-line"></i>';
            } else {
                this.drawer.classList.add('collapsed');
                this.toggleBtn.innerHTML = '<i class="ri-add-line"></i>';
            }
        });

        this.addBtn.addEventListener('click', () => this.addTag());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTag();
        });

        // Global delegate for delete
        this.container.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.tag-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const id = parseInt(deleteBtn.dataset.id, 10);
                this.deleteTag(id);
            }
        });
    }

    addTag() {
        const name = this.input.value.trim();
        const color = this.colorInput.value;

        if (!name) return;

        const tag = {
            id: Date.now(),
            name: name,
            color: color
        };

        this.tags.push(tag);
        this.save();
        this.render();
        this.input.value = '';
    }

    deleteTag(id) {
        this.tags = this.tags.filter(t => t.id !== id);
        if (this.selectedTagId === id) {
            this.selectedTagId = null;
            this.eventBus.emit('tagSelected', null);
        }
        this.save();
        this.render();
    }

    selectTag(id) {
        if (this.selectedTagId === id) {
            this.selectedTagId = null;
        } else {
            this.selectedTagId = id;
        }
        this.eventBus.emit('tagSelected', this.selectedTagId);
        this.render();
    }

    getTag(id) {
        return this.tags.find(t => t.id === id) || null;
    }

    getSelectedTag() {
        return this.selectedTagId;
    }

    save() {
        StorageService.set('tags', this.tags);
    }

    render() {
        this.container.innerHTML = '';
        this.tags.forEach(tag => {
            const pill = document.createElement('div');
            pill.className = `tag-pill ${this.selectedTagId === tag.id ? 'selected' : ''}`;
            pill.style.backgroundColor = tag.color;
            pill.onclick = (e) => {
                if (!e.target.closest('.tag-delete-btn')) {
                    this.selectTag(tag.id);
                }
            };

            pill.innerHTML = `
                <span>${this.escapeHtml(tag.name)}</span>
                <button class="tag-delete-btn" data-id="${tag.id}">
                    <i class="ri-close-line"></i>
                </button>
            `;

            this.container.appendChild(pill);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
