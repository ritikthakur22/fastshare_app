// sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    // Inject Sidebar HTML
    const sidebarHTML = `
        <div id="sidebar-overlay" class="sidebar-overlay"></div>
        <div id="sidebar" class="sidebar-drawer">
            <div class="sidebar-header">
                <img src="images/android-chrome-192x192.png" alt="FastShare" class="logo">
                <h2>FastShare</h2>
            </div>
            
            <div class="sidebar-section">
                <div class="sidebar-section-title">General</div>
                <div class="sidebar-item">
                    <div class="sidebar-item-text">
                        <span class="sidebar-item-label">Theme</span>
                    </div>
                    <select id="setting-theme" class="mat-select">
                        <option value="auto">Auto</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>
                <div class="sidebar-item">
                    <div class="sidebar-item-text">
                        <span class="sidebar-item-label">App Color</span>
                    </div>
                    <input type="color" id="setting-color" class="mat-input" value="#519E8A" style="width: 50px; padding: 0;">
                </div>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-section-title">Receive</div>
                <div class="sidebar-item">
                    <div class="sidebar-item-text">
                        <span class="sidebar-item-label">Save to Gallery</span>
                        <span class="sidebar-item-desc">Media files only</span>
                    </div>
                    <label class="mat-switch">
                        <input type="checkbox" id="setting-gallery">
                        <span class="mat-slider"></span>
                    </label>
                </div>
                <div class="sidebar-item">
                    <div class="sidebar-item-text">
                        <span class="sidebar-item-label">Auto Download</span>
                        <span class="sidebar-item-desc">Skip accept prompt</span>
                    </div>
                    <label class="mat-switch">
                        <input type="checkbox" id="setting-autodownload">
                        <span class="mat-slider"></span>
                    </label>
                </div>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-section-title">Network</div>
                <div class="sidebar-item">
                    <div class="sidebar-item-text">
                        <span class="sidebar-item-label">Device Icon</span>
                    </div>
                    <select id="setting-icon" class="mat-select">
                        <option value="auto">Auto detect</option>
                        <option value="phone-iphone">Phone</option>
                        <option value="desktop-mac">Laptop</option>
                    </select>
                </div>
                <div class="sidebar-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                    <div class="sidebar-item-text">
                        <span class="sidebar-item-label">Signaling Server URL</span>
                        <span class="sidebar-item-desc">Leave blank for default Render cloud</span>
                    </div>
                    <input type="text" id="setting-wss" class="mat-input" placeholder="wss://fastshare-ja1a.onrender.com" style="width: 100%; box-sizing: border-box;">
                </div>
                <button id="setting-restart" class="mat-btn" style="background: #e74c3c;">Restart App</button>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-section-title">About</div>
                <div class="sidebar-item-desc" style="line-height: 1.5;">
                    <b>Name:</b> FastShare<br>
                    <b>Package:</b> com.crdy.fastshare<br>
                    <b>Version:</b> 1.0.0<br>
                    <b>Contact:</b> <a href="mailto:ritikthakur@duck.com" style="color: var(--sidebar-primary);">ritikthakur@duck.com</a><br>
                    <a href="#" style="color: var(--sidebar-primary);">Privacy Policy</a> | <a href="#" style="color: var(--sidebar-primary);">Terms of Use</a>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', sidebarHTML);

    const overlay = document.getElementById('sidebar-overlay');
    const drawer = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menu-btn');

    // Toggle logic
    const toggleSidebar = () => {
        overlay.classList.toggle('active');
        drawer.classList.toggle('active');
    };

    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    overlay.addEventListener('click', toggleSidebar);

    // Load Settings
    const loadSetting = (id, defaultVal, isCheckbox = false) => {
        const el = document.getElementById(id);
        const saved = localStorage.getItem(id);
        if (isCheckbox) {
            el.checked = saved !== null ? saved === 'true' : defaultVal;
        } else {
            el.value = saved !== null ? saved : defaultVal;
        }
    };

    loadSetting('setting-theme', 'auto');
    loadSetting('setting-color', '#519E8A');
    loadSetting('setting-gallery', false, true);
    loadSetting('setting-autodownload', false, true);
    loadSetting('setting-icon', 'auto');
    loadSetting('setting-wss', '');

    // Apply color immediately
    const applyColor = () => {
        document.documentElement.style.setProperty('--primary', document.getElementById('setting-color').value);
    };
    applyColor();

    // Save Settings
    const saveSetting = (e) => {
        const el = e.target;
        const isCheckbox = el.type === 'checkbox';
        
        // For theme, we let the button click handlers update localStorage and apply the theme
        if (el.id === 'setting-theme') {
            if (el.value === 'light') document.getElementById('theme-light').click();
            if (el.value === 'dark') document.getElementById('theme-dark').click();
            if (el.value === 'auto') document.getElementById('theme-auto').click();
        } else {
            localStorage.setItem(el.id, isCheckbox ? el.checked : el.value);
            if (el.id === 'setting-color') {
                applyColor();
            }
        }
    };

    document.querySelectorAll('.sidebar-drawer input, .sidebar-drawer select').forEach(el => {
        el.addEventListener('change', saveSetting);
        el.addEventListener('input', saveSetting);
    });

    document.getElementById('setting-restart').addEventListener('click', () => {
        window.location.reload();
    });
});
