export class AuthAgent {
    constructor(syncService, eventBus) {
        this.syncService = syncService;
        this.eventBus = eventBus;

        // Modal DOM Elements to be created
        this.initDOM();
        this.initListeners();
    }

    initDOM() {
        // Create Header Auth Button
        this.authBtnContainer = document.createElement('div');
        this.authBtnContainer.className = 'auth-btn-container';
        this.authBtnContainer.innerHTML = `
            <button id="header-auth-btn" class="btn btn-outline-primary">
                <i class="ri-user-line"></i> <span id="auth-btn-text">Login</span>
            </button>
        `;

        // Find header and append
        const header = document.querySelector('.app-header');
        if (header) {
            // Adjust header flex layout slightly to fit button on right
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.appendChild(this.authBtnContainer);
        }

        // Create Auth Modal
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'auth-modal-overlay hidden';
        this.modalOverlay.innerHTML = `
            <div class="auth-modal">
                <div class="auth-header">
                    <h3 id="auth-modal-title">Sign In to PomoToDo</h3>
                    <button id="auth-close-btn" class="btn-icon-small"><i class="ri-close-line"></i></button>
                </div>
                <div class="auth-body">
                    <div id="auth-error-msg" class="auth-error hidden"></div>
                    <form id="auth-form">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" id="auth-username" required autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="auth-password" required autocomplete="current-password">
                        </div>
                        <button type="submit" id="auth-submit-btn" class="btn btn-primary" style="width:100%; margin-top:1rem;">Sign In</button>
                    </form>
                    <div class="auth-switch">
                        <span id="auth-switch-text">Don't have an account? </span>
                        <a href="#" id="auth-switch-link">Register Here</a>
                    </div>
                </div>
                <div class="auth-logged-in-body hidden">
                    <p>Logged in as: <strong id="auth-logged-in-user"></strong></p>
                    <p class="text-muted" style="margin: 1rem 0; font-size: 0.85rem;">Your data is being safely synced to the server.</p>
                    <button id="auth-logout-btn" class="btn btn-danger" style="width:100%;">Log Out</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.modalOverlay);

        // Bind DOM references
        this.headerBtn = document.getElementById('header-auth-btn');
        this.btnText = document.getElementById('auth-btn-text');
        this.closeBtn = document.getElementById('auth-close-btn');
        this.form = document.getElementById('auth-form');
        this.usernameInput = document.getElementById('auth-username');
        this.passwordInput = document.getElementById('auth-password');
        this.errorMsg = document.getElementById('auth-error-msg');
        this.submitBtn = document.getElementById('auth-submit-btn');
        this.switchLink = document.getElementById('auth-switch-link');
        this.switchText = document.getElementById('auth-switch-text');
        this.modalTitle = document.getElementById('auth-modal-title');

        this.unauthBody = this.modalOverlay.querySelector('.auth-body');
        this.authBody = this.modalOverlay.querySelector('.auth-logged-in-body');
        this.loggedInUserDisplay = document.getElementById('auth-logged-in-user');
        this.logoutBtn = document.getElementById('auth-logout-btn');

        this.mode = 'login'; // 'login' or 'register'

        this.updateHeaderBtn();
    }

    initListeners() {
        this.headerBtn.addEventListener('click', () => this.openModal());
        this.closeBtn.addEventListener('click', () => this.closeModal());

        this.switchLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMode();
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });

        this.logoutBtn.addEventListener('click', async () => {
            await this.syncService.logout();
            this.closeModal();
            // Data remains locally, user can continue as guest or login again
        });

        // Listen for global auth state changes
        this.eventBus.on('authStateChanged', () => {
            this.updateHeaderBtn();
        });
    }

    openModal() {
        this.errorMsg.classList.add('hidden');
        this.usernameInput.value = '';
        this.passwordInput.value = '';

        if (this.syncService.isLoggedIn()) {
            this.unauthBody.classList.add('hidden');
            this.authBody.classList.remove('hidden');
            this.loggedInUserDisplay.textContent = this.syncService.username;
            this.modalTitle.textContent = "Account Settings";
        } else {
            this.authBody.classList.add('hidden');
            this.unauthBody.classList.remove('hidden');
            this.setMode('login');
        }

        this.modalOverlay.classList.remove('hidden');
    }

    closeModal() {
        this.modalOverlay.classList.add('hidden');
    }

    setMode(newMode) {
        this.mode = newMode;
        if (this.mode === 'login') {
            this.modalTitle.textContent = "Sign In to PomoToDo";
            this.submitBtn.textContent = "Sign In";
            this.switchText.textContent = "Don't have an account? ";
            this.switchLink.textContent = "Register Here";
        } else {
            this.modalTitle.textContent = "Create an Account";
            this.submitBtn.textContent = "Register";
            this.switchText.textContent = "Already have an account? ";
            this.switchLink.textContent = "Sign In Here";
        }
    }

    toggleMode() {
        this.setMode(this.mode === 'login' ? 'register' : 'login');
        this.errorMsg.classList.add('hidden');
    }

    showError(msg) {
        this.errorMsg.textContent = msg;
        this.errorMsg.classList.remove('hidden');
    }

    async handleSubmit() {
        const u = this.usernameInput.value.trim();
        const p = this.passwordInput.value.trim();

        if (!u || !p) {
            this.showError('Please fill out both fields.');
            return;
        }

        this.submitBtn.disabled = true;
        this.errorMsg.classList.add('hidden');

        try {
            if (this.mode === 'register') {
                await this.syncService.register(u, p);
                // Auto login after register
                await this.syncService.login(u, p);
            } else {
                await this.syncService.login(u, p);
            }

            // Login successful
            this.closeModal();
            // Pull server data immediately after fresh login
            await this.syncService.pullFromServer();

        } catch (err) {
            this.showError(err.message);
        } finally {
            this.submitBtn.disabled = false;
        }
    }

    updateHeaderBtn() {
        if (this.syncService.isLoggedIn()) {
            this.btnText.textContent = this.syncService.username;
            this.headerBtn.classList.remove('btn-outline-primary');
            this.headerBtn.classList.add('btn-primary');
            this.headerBtn.querySelector('i').className = 'ri-user-settings-fill';
        } else {
            this.btnText.textContent = "Login";
            this.headerBtn.classList.remove('btn-primary');
            this.headerBtn.classList.add('btn-outline-primary');
            this.headerBtn.querySelector('i').className = 'ri-user-line';
        }
    }
}
