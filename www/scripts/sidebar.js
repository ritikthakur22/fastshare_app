// sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    const defaultSeed = '#8FB996';
    const presetColors = [
        ['#84E6F8', 'Frosted blue'],
        ['#DE4D86', 'Blush rose'],
        ['#4545BA', 'Royal blue'],
        ['#E8C2CA', 'Pastel petal'],
        ['#C6CA53', 'Golden sand'],
        ['#BE95C4', 'Lilac'],
        ['#8FB996', 'Muted teal'],
        ['#C98BB9', 'Orchid'],
    ];

    const toHex = (value) => Math.round(value).toString(16).padStart(2, '0');
    const hexToHsl = (hex) => {
        const value = hex.replace('#', '');
        const r = parseInt(value.slice(0, 2), 16) / 255;
        const g = parseInt(value.slice(2, 4), 16) / 255;
        const b = parseInt(value.slice(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
        let hue = 0;
        if (delta) {
            if (max === r) hue = ((g - b) / delta) % 6;
            else if (max === g) hue = (b - r) / delta + 2;
            else hue = (r - g) / delta + 4;
            hue = Math.round(hue * 60 + 360) % 360;
        }
        const lightness = (max + min) / 2;
        const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
        return { hue, saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
    };
    const hsl = (hue, saturation, lightness) => `hsl(${(hue + 360) % 360} ${Math.max(0, Math.min(100, saturation))}% ${Math.max(0, Math.min(100, lightness))}%)`;
    const contrastColor = (hex) => {
        const value = hex.replace('#', '');
        const channel = (offset) => parseInt(value.slice(offset, offset + 2), 16) / 255;
        const linear = (channelValue) => channelValue <= 0.03928 ? channelValue / 12.92 : ((channelValue + 0.055) / 1.055) ** 2.4;
        const luminance = 0.2126 * linear(channel(0)) + 0.7152 * linear(channel(2)) + 0.0722 * linear(channel(4));
        return luminance > 0.45 ? '#1.1.12' : '#ffffff';
    };
    const applyColor = () => {
        const colorInput = document.getElementById('setting-color');
        const color = /^#[0-9a-f]{6}$/i.test(colorInput.value) ? colorInput.value : defaultSeed;
        const { hue, saturation, lightness } = hexToHsl(color);
        const root = document.documentElement.style;
        const roles = {
            '--primary-color': color,
            '--primary-on-color': contrastColor(color),
            '--primary-container-color': hsl(hue, Math.min(100, saturation + 10), 92),
            '--primary-container-on-color': hsl(hue, Math.max(25, saturation), 18),
            '--paired-device-color': hsl(hue + 18, Math.max(45, saturation), Math.max(35, Math.min(55, lightness))),
            '--public-room-color': hsl(hue + 56, Math.max(55, saturation), Math.max(42, Math.min(58, lightness))),
            '--ws-peer-color': hsl(hue - 38, Math.max(55, saturation), Math.max(45, Math.min(62, lightness))),
            '--btn-disabled-color': hsl(hue, Math.min(20, saturation), 42),
        };
        Object.entries(roles).forEach(([name, value]) => root.setProperty(name, value));
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
        window.setNativeSystemBars?.(color);
    };
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
                    <div class="app-color-picker">
                        <input type="hidden" id="setting-color" value="#8FB996">
                        <div class="app-color-presets" role="group" aria-label="Preset app colors">
                            ${presetColors.map(([color, label]) => `<button type="button" class="app-color-preset" data-color="${color}" title="${label}" aria-label="${label}" style="--preset-color: ${color};"></button>`).join('')}
                        </div>
                    </div>
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
                <div class="sidebar-item-desc" style="line-height: 1.5; font-size: 14px;">
                    <b>Name:</b> FastShare<br>
                    <b>Package:</b> com.crdy.fastshare<br>
                    <b>Version:</b> 1.1.12<br>
                    <b>Contact:</b> <a href="mailto:ritikthakur@duck.com" style="color: var(--sidebar-primary);">ritikthakur@duck.com</a><br>
                    <b>GitHub:</b> <a href="https://github.com/ritikthakur22/FastShare" onclick="window.open(this.href, '_system'); return false;" style="color: var(--sidebar-primary);">ritikthakur22/FastShare</a><br>
                    <b>Portfolio:</b> <a href="https://ritikthakur.com.np" onclick="window.open(this.href, '_system'); return false;" style="color: var(--sidebar-primary);">ritikthakur.com.np</a><br>
                    <a href="https://docs.google.com/document/d/1oFZcr9ay7BewS7WNaIM0HNQDbZHaV-uLAxA7LTQDOIQ/edit?usp=sharing" onclick="window.open(this.href, '_system'); return false;" style="color: var(--sidebar-primary);">Privacy Policy</a> | <a href="https://docs.google.com/document/d/1Wv_7CyEoj02Tlq5ygovSfIkPNRyaaUTh8cdrSaS7rtk/edit?usp=sharing" onclick="window.open(this.href, '_system'); return false;" style="color: var(--sidebar-primary);">Terms of Use</a>
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

    const savedColor = localStorage.getItem('setting-color');
    loadSetting('setting-color', savedColor && savedColor.toUpperCase() !== '#519E8A' ? savedColor : defaultSeed);
    if (!savedColor || savedColor.toUpperCase() === '#519E8A') {
        localStorage.setItem('setting-color', defaultSeed);
    }
    applyColor();
    // Load theme from the key that main app uses
    const savedTheme = localStorage.getItem('theme');
    document.getElementById('setting-theme').value = savedTheme ? savedTheme : 'auto';
    loadSetting('setting-gallery', false, true);
    loadSetting('setting-autodownload', false, true);
    loadSetting('setting-icon', 'auto');
    loadSetting('setting-wss', '');

    // Save Settings
    const saveSetting = (e) => {
        const el = e.target;
        const isCheckbox = el.type === 'checkbox';
        
        // For theme, we let the button click handlers update localStorage and apply the theme
        if (el.id === 'setting-theme') {
            const currentTheme = localStorage.getItem('theme') || 'auto';
            if (currentTheme !== el.value) {
                if (el.value === 'light') document.getElementById('theme-light').click();
                if (el.value === 'dark') document.getElementById('theme-dark').click();
                if (el.value === 'auto') document.getElementById('theme-auto').click();
            }
        } else {
            localStorage.setItem(el.id, isCheckbox ? el.checked : el.value);
        }
        
        if (el.id === 'setting-color') {
            applyColor();
        }
    };

    document.querySelectorAll('.sidebar-drawer input, .sidebar-drawer select').forEach(el => {
        el.addEventListener('change', saveSetting);
        el.addEventListener('input', saveSetting);
    });

    document.querySelectorAll('.app-color-preset').forEach(button => {
        button.addEventListener('click', () => {
            const colorInput = document.getElementById('setting-color');
            colorInput.value = button.dataset.color;
            colorInput.dispatchEvent(new Event('input', { bubbles: true }));
            colorInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    document.getElementById('setting-restart').addEventListener('click', () => {
        window.location.reload();
    });
});
