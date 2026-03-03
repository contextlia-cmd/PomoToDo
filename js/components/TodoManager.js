import { StorageService } from '../services/StorageService.js';

export class TodoManager {
    constructor(eventBus, tagManager) {
        this.eventBus = eventBus;
        this.tagManager = tagManager;
        this.todos = StorageService.get('todos', []);
        this.todos.sort((a, b) => {
            if (a.completed === b.completed) {
                return b.id - a.id;
            }
            return a.completed ? 1 : -1;
        });

        this.todoList = document.getElementById('todo-list');
        this.todoInput = document.getElementById('todo-input');
        this.addBtn = document.getElementById('add-todo-btn');
        this.todoCount = document.getElementById('todo-count');

        this.initListeners();
        this.render();
    }

    initListeners() {
        this.addBtn.addEventListener('click', () => this.addTodo());
        this.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });

        // Listen for suggestions accepted from Misa Agent
        this.eventBus.on('suggestionAccepted', (suggestion) => {
            this.todoInput.value = suggestion;
            this.addTodo();
        });

        // Delegate clicks for toggle and delete
        this.todoList.addEventListener('click', (e) => {
            const checkBtn = e.target.closest('.todo-check');
            const delBtn = e.target.closest('.todo-delete');

            if (checkBtn) {
                const id = parseInt(checkBtn.dataset.id, 10);
                this.toggleTodo(id);
            } else if (delBtn) {
                const id = parseInt(delBtn.dataset.id, 10);
                this.deleteTodo(id);
            }
        });
    }

    addTodo() {
        const text = this.todoInput.value.trim();
        if (!text) return;

        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            tagId: this.tagManager.getSelectedTag() // Get selected tag ID
        };

        this.todos.unshift(todo); // Add to top
        this.save();
        this.render();
        this.todoInput.value = '';
    }

    toggleTodo(id) {
        this.todos = this.todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
        );
        this.save();
        this.render();
    }

    deleteTodo(id) {
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.save();
        this.render();
    }

    save() {
        // 未完了を上に、完了済みを下に。同じ状態なら新しい操作順（IDの降順）
        this.todos.sort((a, b) => {
            if (a.completed === b.completed) {
                return b.id - a.id;
            }
            return a.completed ? 1 : -1;
        });
        StorageService.set('todos', this.todos);
        this.updateCount();
    }

    updateCount() {
        const activeCount = this.todos.filter(t => !t.completed).length;
        this.todoCount.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''}`;
    }

    render() {
        this.todoList.innerHTML = '';
        this.todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

            // Resolve Tag
            let tagHtml = '';
            if (todo.tagId) {
                const tag = this.tagManager.getTag(todo.tagId);
                if (tag) {
                    tagHtml = `<span class="todo-tag-indicator" style="background-color: ${tag.color}">${this.escapeHtml(tag.name)}</span>`;
                }
            }

            li.innerHTML = `
                <div class="todo-check" data-id="${todo.id}">
                    <i class="ri-check-line"></i>
                </div>
                <span class="todo-text">
                    ${this.escapeHtml(todo.text)}
                    ${tagHtml}
                </span>
                <button class="todo-delete" data-id="${todo.id}">
                    <i class="ri-delete-bin-line"></i>
                </button>
            `;

            this.todoList.appendChild(li);
        });

        this.updateCount();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
