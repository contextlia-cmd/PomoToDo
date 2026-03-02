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
        this.authBtnContainer.style.display = 'flex';
        this.authBtnContainer.style.alignItems = 'center';
        this.authBtnContainer.style.gap = '12px';
        this.authBtnContainer.innerHTML = `
            <div class="theme-selector-container" style="position:relative;">
                <button id="theme-settings-btn" class="btn btn-icon-small" title="UI Theme Settings" style="width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-color);">
                    <i class="ri-palette-line"></i>
                </button>
                <div id="theme-dropdown" class="glass-panel" style="position:absolute; right:0; top:45px; z-index: 1000; width:max-content; padding:12px; border-radius:12px; display:none; gap:10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <button class="theme-option" data-theme-val="A" title="A: Classic Cosmic" style="background:linear-gradient(135deg, #0f0c29, #302b63); width:32px; height:32px; border-radius:50%; border:2px solid transparent; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2); transition: transform 0.2s, border-color 0.2s;"></button>
                    <button class="theme-option" data-theme-val="B" title="B: Muted Ocean" style="background:linear-gradient(135deg, #050a0f, #0d161c); width:32px; height:32px; border-radius:50%; border:2px solid transparent; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2); transition: transform 0.2s, border-color 0.2s;"></button>
                    <button class="theme-option" data-theme-val="C" title="C: Solid Zen Forest" style="background:#1e241c; width:32px; height:32px; border-radius:50%; border:2px solid transparent; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.5); transition: transform 0.2s, border-color 0.2s;"></button>
                    <button class="theme-option" data-theme-val="D" title="D: Muted Dark" style="background:#080808; width:32px; height:32px; border-radius:50%; border:2px solid transparent; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.5); transition: transform 0.2s, border-color 0.2s;"></button>
                </div>
            </div>
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
                            <label>Email</label>
                            <input type="email" id="auth-email" required autocomplete="email">
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="auth-password" required autocomplete="current-password">
                        </div>
                        <button type="submit" id="auth-submit-btn" class="btn btn-primary" style="width:100%; margin-top:1rem;">Sign In</button>
                    </form>
                    
                    <div class="auth-divider" style="text-align: center; margin: 1rem 0; position: relative;">
                        <span style="background: var(--bg-color-dark); padding: 0 10px; font-size: 0.8rem; color: #888;">OR</span>
                        <hr style="position: absolute; top: 50%; left: 0; right: 0; margin: 0; border: none; border-top: 1px solid rgba(255,255,255,0.1); z-index: -1;">
                    </div>
                    
                    <button id="auth-google-btn" class="btn" style="width:100%; background: white; color: black; display: flex; justify-content: center; align-items: center; gap: 8px;">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style="width: 18px; height: 18px;">
                        Sign In with Google
                    </button>
                    
                    <div class="auth-switch" style="margin-top: 1rem;">
                        <span id="auth-switch-text">Don't have an account? </span>
                        <a href="#" id="auth-switch-link">Register Here</a>
                    </div>
                </div>
                <div class="auth-logged-in-body hidden">
                    <p>Logged in as: <strong id="auth-logged-in-user"></strong></p>
                    <p class="text-muted" style="margin: 1rem 0; font-size: 0.85rem;">Your data is being safely synced to the server.</p>
                    <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
                        <button id="auth-force-sync-btn" class="btn btn-outline-primary" style="flex: 1;"><i class="ri-cloud-upload-line"></i> Force Sync</button>
                    </div>
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
        this.emailInput = document.getElementById('auth-email');
        this.passwordInput = document.getElementById('auth-password');
        this.errorMsg = document.getElementById('auth-error-msg');
        this.submitBtn = document.getElementById('auth-submit-btn');
        this.googleBtn = document.getElementById('auth-google-btn');
        this.switchLink = document.getElementById('auth-switch-link');
        this.switchText = document.getElementById('auth-switch-text');
        this.modalTitle = document.getElementById('auth-modal-title');

        this.unauthBody = this.modalOverlay.querySelector('.auth-body');
        this.authBody = this.modalOverlay.querySelector('.auth-logged-in-body');
        this.loggedInUserDisplay = document.getElementById('auth-logged-in-user');
        this.logoutBtn = document.getElementById('auth-logout-btn');
        this.forceSyncBtn = document.getElementById('auth-force-sync-btn');

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

        this.googleBtn.addEventListener('click', async () => {
            await this.syncService.loginWithGoogle();
        });

        this.logoutBtn.addEventListener('click', async () => {
            await this.syncService.logout();
            this.closeModal();
            // Data remains locally, user can continue as guest or login again
        });

        this.forceSyncBtn.addEventListener('click', async () => {
            const originalText = this.forceSyncBtn.innerHTML;
            this.forceSyncBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Syncing...';
            this.forceSyncBtn.disabled = true;
            try {
                await this.syncService.pushToServer();
                this.forceSyncBtn.innerHTML = '<i class="ri-check-line"></i> Success!';
                setTimeout(() => {
                    this.forceSyncBtn.innerHTML = originalText;
                    this.forceSyncBtn.disabled = false;
                }, 2000);
            } catch (e) {
                this.forceSyncBtn.innerHTML = '<i class="ri-error-warning-line"></i> Failed';
                setTimeout(() => {
                    this.forceSyncBtn.innerHTML = originalText;
                    this.forceSyncBtn.disabled = false;
                }, 2000);
            }
        });

        // Theme settings logic
        this.themeBtn = document.getElementById('theme-settings-btn');
        this.themeDropdown = document.getElementById('theme-dropdown');
        this.themeOptions = document.querySelectorAll('.theme-option');

        if (this.themeBtn && this.themeDropdown) {
            this.themeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.themeDropdown.style.display === 'none' || this.themeDropdown.style.display === '') {
                    this.themeDropdown.style.display = 'flex';
                } else {
                    this.themeDropdown.style.display = 'none';
                }
            });

            document.addEventListener('click', () => {
                if (this.themeDropdown.style.display === 'flex') {
                    this.themeDropdown.style.display = 'none';
                }
            });

            this.themeDropdown.addEventListener('click', (e) => e.stopPropagation());

            this.themeOptions.forEach(btn => {
                btn.addEventListener('click', () => {
                    const theme = btn.dataset.themeVal;
                    this.setTheme(theme);
                    this.themeDropdown.style.display = 'none';
                });
            });

            // Initial load from storage
            const loadedTheme = localStorage.getItem('pomoToDo_theme') || 'A';
            this.setTheme(loadedTheme);
        }

        // Listen for global auth state changes
        this.eventBus.on('authStateChanged', () => {
            this.updateHeaderBtn();
        });
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pomoToDo_theme', theme);

        // Let SyncService know if available
        if (window.app && window.app.syncService) {
            window.app.syncService.triggerSync();
        }

        // Update active selection UI
        this.themeOptions.forEach(btn => {
            if (btn.dataset.themeVal === theme) {
                btn.style.borderColor = 'var(--text-color)';
                btn.style.transform = 'scale(1.1)';
            } else {
                btn.style.borderColor = 'transparent';
                btn.style.transform = 'scale(1)';
            }
        });
    }

    openModal() {
        this.errorMsg.classList.add('hidden');
        this.emailInput.value = '';
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
            this.googleBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style="width: 18px; height: 18px;"> Sign In with Google`;
            this.switchText.textContent = "Don't have an account? ";
            this.switchLink.textContent = "Register Here";
        } else {
            this.modalTitle.textContent = "Create an Account";
            this.submitBtn.textContent = "Register";
            this.googleBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style="width: 18px; height: 18px;"> Sign Up with Google`;
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
        const email = this.emailInput.value.trim();
        const p = this.passwordInput.value.trim();

        if (!email || !p) {
            this.showError('Please fill out both fields.');
            return;
        }

        this.submitBtn.disabled = true;
        this.errorMsg.classList.add('hidden');

        try {
            if (this.mode === 'register') {
                await this.syncService.register(email, p);
            } else {
                await this.syncService.login(email, p);
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
