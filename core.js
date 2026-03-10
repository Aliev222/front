/* ===============================
   SPIRIT CLICKER OPTIMIZED CORE
   ============================== */

'use strict';

console.log('✅ core.js starting...');
console.log('Telegram WebApp:', window.Telegram?.WebApp ? '✅' : '❌');
/* ===============================
   CONFIGURATION
   ============================== */

const CONFIG = {
    API_URL: 'https://ryoho.onrender.com',
    CLICK_BATCH_INTERVAL: 1000,
    ENERGY_RECHARGE_INTERVAL: 2000,
    PASSIVE_INCOME_INTERVAL: 3600000,
    CACHE_TTL: 30000,
    DEBOUNCE_CLICK: 50
};

/* ===============================
   STATE MANAGEMENT
   ============================== */

const State = {
    user: {
        id: null,
        username: null,
        referrerId: null
    },
    
    game: {
        coins: 0,
        energy: 500,
        maxEnergy: 500,
        profitPerTap: 1,
        profitPerHour: 100,
        level: 0,
        prices: {
            multitap: 50,
            profit: 40,
            energy: 30
        },
        levels: {
            multitap: 0,
            profit: 0,
            energy: 0
        }
    },
    
    skins: {
        owned: ['default_SP'],
        selected: 'default_SP',
        adsWatched: 0,
        friendsInvited: 0
    },
    
    settings: {
        theme: localStorage.getItem('spiritSettings') ? 
            JSON.parse(localStorage.getItem('spiritSettings')).theme || 'day' : 'day',
        sound: localStorage.getItem('spiritSettings') ? 
            JSON.parse(localStorage.getItem('spiritSettings')).sound !== undefined ? 
            JSON.parse(localStorage.getItem('spiritSettings')).sound : true : true,
        vibration: localStorage.getItem('spiritSettings') ? 
            JSON.parse(localStorage.getItem('spiritSettings')).vibration !== undefined ? 
            JSON.parse(localStorage.getItem('spiritSettings')).vibration : true : true
    },
    
    temp: {
        clickBuffer: 0,
        gainBuffer: 0,
        batchTimer: null,
        recoveryTimer: null,
        lastClick: 0
    },
    
    cache: new Map()
};

// Глобальный доступ
window.State = State;

/* ===============================
   TELEGRAM INIT
   ============================== */

const TelegramApp = {
    init() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        
        tg.expand();
        if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
        
        const user = tg.initDataUnsafe?.user;
        if (user) {
            State.user.id = user.id;
            State.user.username = user.username || `user_${user.id}`;
        }
        
        const startParam = tg.initDataUnsafe?.start_param || '';
        if (startParam?.startsWith('ref_')) {
            State.user.referrerId = parseInt(startParam.replace('ref_', '')) || null;
        }
    }
};

/* ===============================
   API MANAGER
   ============================== */

const API = {
    async request(endpoint, options = {}, retries = 2) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        try {
            const res = await fetch(CONFIG.API_URL + endpoint, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (!res.ok) {
                const error = new Error(`HTTP ${res.status}`);
                error.status = res.status;
                throw error;
            }
            
            return await res.json();
        } catch (err) {
            clearTimeout(timeout);
            
            if (retries > 0 && (err.name === 'AbortError' || err.status >= 500)) {
                await new Promise(r => setTimeout(r, 1000));
                return this.request(endpoint, options, retries - 1);
            }
            
            console.error('API Error:', err);
            throw err;
        }
    },
    
    async get(endpoint) {
        return this.request(endpoint);
    },
    
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

window.API = API;

/* ===============================
   CACHE MANAGER
   ============================== */

const Cache = {
    get(key, ttl = CONFIG.CACHE_TTL) {
        const item = State.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > ttl) {
            State.cache.delete(key);
            return null;
        }
        
        return item.data;
    },
    
    set(key, data) {
        State.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    },
    
    clear() {
        State.cache.clear();
    }
};

window.Cache = Cache;

/* ===============================
   USER DATA LOADING
   ============================== */

const UserData = {
    async load() {
        if (!State.user.id) return;
        
        try {
            await API.post('/api/register', {
                user_id: State.user.id,
                username: State.user.username,
                referrer_id: State.user.referrerId
            });
            
            const cached = Cache.get(`user_${State.user.id}`);
            if (cached) {
                this.mergeData(cached);
                UI.updateAll();
                return;
            }
            
            const data = await API.get(`/api/user/${State.user.id}`);
            if (data) {
                this.mergeData(data);
                Cache.set(`user_${State.user.id}`, data);
            }
            
            await this.loadPrices();
            UI.updateAll();
            
        } catch (err) {
            console.error('Failed to load user data:', err);
        }
    },
    
    mergeData(data) {
        State.game.coins = data.coins || 0;
        State.game.energy = data.energy || 500;
        State.game.maxEnergy = data.max_energy || 500;
        State.game.profitPerTap = data.profit_per_tap || 1;
        State.game.profitPerHour = data.profit_per_hour || 100;
        State.game.levels.multitap = data.multitap_level || 0;
        State.game.levels.profit = data.profit_level || 0;
        State.game.levels.energy = data.energy_level || 0;
        
        if (data.owned_skins) State.skins.owned = data.owned_skins;
        if (data.selected_skin) State.skins.selected = data.selected_skin;
        if (data.ads_watched) State.skins.adsWatched = data.ads_watched;
    },
    
    async loadPrices() {
        if (!State.user.id) return;
        
        try {
            const prices = await API.get(`/api/upgrade-prices/${State.user.id}`);
            State.game.prices = { ...State.game.prices, ...prices };
        } catch (err) {
            console.error('Failed to load prices:', err);
        }
    },
    
    async saveProgress() {
        if (!State.user.id) return;
        
        const data = {
            coins: State.game.coins,
            energy: State.game.energy,
            selected_skin: State.skins.selected
        };
        
        Cache.set(`user_${State.user.id}`, data);
        localStorage.setItem('spiritClickerBackup', JSON.stringify(data));
    }
};

window.UserData = UserData;

/* ===============================
   CLICK ENGINE (ТОЛЬКО ОТПРАВКА)
   ============================== */

const ClickEngine = {
    async sendBatch() {
        const clicks = State.temp.clickBuffer;
        const gain = State.temp.gainBuffer;
        
        State.temp.clickBuffer = 0;
        State.temp.gainBuffer = 0;
        State.temp.batchTimer = null;
        
        if (!State.user.id || clicks === 0) return;
        
        try {
            await API.post('/api/click', {
                user_id: State.user.id,
                clicks,
                gain,
                mega_boost: document.getElementById('mega-boost-btn')?.classList.contains('active') || false
            });
        } catch (err) {
            console.log('Click batch failed, will retry:', err);
            State.temp.clickBuffer += clicks;
            State.temp.gainBuffer += gain;
        }
    },
    
    addClick(gain, megaBoostActive) {
        State.temp.clickBuffer++;
        State.temp.gainBuffer += gain;
        
        if (!State.temp.batchTimer) {
            State.temp.batchTimer = setTimeout(() => this.sendBatch(), CONFIG.CLICK_BATCH_INTERVAL);
        }
    }
};

window.ClickEngine = ClickEngine;

/* ===============================
   ENERGY SYSTEM
   ============================== */

const EnergySystem = {
    startRecovery() {
        if (State.temp.recoveryTimer) {
            clearInterval(State.temp.recoveryTimer);
        }
        
        State.temp.recoveryTimer = setInterval(() => this.recover(), CONFIG.ENERGY_RECHARGE_INTERVAL);
    },
    
    async recover() {
        const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
        if (megaBoostActive) return;
        
        if (State.game.energy >= State.game.maxEnergy) return;
        
        if (!State.user.id) {
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 1);
            UI.updateEnergy();
            return;
        }
        
        try {
            const data = await API.post('/api/recover-energy', { user_id: State.user.id });
            if (data && data.energy !== undefined) {
                State.game.energy = data.energy;
                UI.updateEnergy();
            }
        } catch (err) {
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 1);
            UI.updateEnergy();
        }
    },
    
    reset() {
        if (State.temp.recoveryTimer) {
            clearInterval(State.temp.recoveryTimer);
            this.startRecovery();
        }
    }
};

window.EnergySystem = EnergySystem;

/* ===============================
   UPGRADE SYSTEM
   ============================== */

let upgradeInProgress = false;

const UpgradeSystem = {
    async upgrade(type) {
        if (upgradeInProgress || !State.user.id) return;
        
        const price = State.game.prices[type];
        if (!price || State.game.coins < price) {
            UI.showToast(`❌ Need ${price} coins`, true);
            return;
        }
        
        upgradeInProgress = true;
        
        try {
            const result = await API.post('/api/upgrade', {
                user_id: State.user.id,
                boost_type: type
            });
            
            if (result) {
                State.game.coins = result.coins;
                State.game.levels[type] = result.new_level;
                State.game.prices[type] = result.next_cost || 0;
                
                if (result.profit_per_tap) State.game.profitPerTap = result.profit_per_tap;
                if (result.profit_per_hour) State.game.profitPerHour = result.profit_per_hour;
                if (result.max_energy) {
                    State.game.maxEnergy = result.max_energy;
                    State.game.energy = result.max_energy;
                    EnergySystem.reset();
                }
                
                UI.showToast(`✅ ${type} +${result.new_level}!`);
                UI.updateAll();
            }
        } catch (err) {
            console.error('Upgrade error:', err);
            UI.showToast('❌ Upgrade failed', true);
        } finally {
            upgradeInProgress = false;
        }
    },
    
    async upgradeAll() {
        if (upgradeInProgress || !State.user.id) return;
        
        const total = State.game.prices.multitap + State.game.prices.profit + State.game.prices.energy;
        if (State.game.coins < total) {
            UI.showToast(`❌ Need ${total} coins`, true);
            return;
        }
        
        upgradeInProgress = true;
        
        for (const type of ['multitap', 'profit', 'energy']) {
            try {
                const result = await API.post('/api/upgrade', {
                    user_id: State.user.id,
                    boost_type: type
                });
                
                if (result) {
                    State.game.coins = result.coins;
                    State.game.levels[type] = result.new_level;
                    State.game.prices[type] = result.next_cost || 0;
                    
                    if (result.profit_per_tap) State.game.profitPerTap = result.profit_per_tap;
                    if (result.profit_per_hour) State.game.profitPerHour = result.profit_per_hour;
                    if (result.max_energy) {
                        State.game.maxEnergy = result.max_energy;
                        State.game.energy = result.max_energy;
                    }
                }
            } catch (err) {
                console.error(`Upgrade ${type} failed:`, err);
            }
        }
        
        upgradeInProgress = false;
        EnergySystem.reset();
        UI.updateAll();
        UI.showToast('✅ All upgrades completed!');
    }
};

window.UpgradeSystem = UpgradeSystem;

/* ===============================
   SKINS SYSTEM
   ============================== */

const SkinsSystem = {
    skinsData: [],
    
    async load() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/skins/list`);
            if (res.ok) {
                const data = await res.json();
                this.skinsData = data.skins || [];
                return this.skinsData;
            }
        } catch (err) {
            console.error('Failed to load skins:', err);
        }
        return [];
    },
    
    getSkinById(id) {
        return this.skinsData.find(s => s.id === id);
    },
    
    getRarityName(rarity) {
        const names = { common: 'Обычный', rare: 'Редкий', legendary: 'Легендарный', super: 'Супер редкий' };
        return names[rarity] || rarity;
    },
    
    isUnlocked(skin) {
        if (State.skins.owned.includes(skin.id)) return true;
        
        const req = skin.requirement;
        if (!req) return false;
        
        if (req.type === 'free') return true;
        if (req.type === 'ads') return State.skins.adsWatched >= (req.count || 0);
        return false;
    },
    
    async unlock(id, method = 'ads') {
        if (!State.user.id || State.skins.owned.includes(id)) return;
        
        try {
            const res = await API.post('/api/unlock-skin', {
                user_id: State.user.id,
                skin_id: id,
                method
            });
            
            if (res.success) {
                State.skins.owned = res.owned_skins;
                if (res.selected_skin) {
                    State.skins.selected = res.selected_skin;
                }
                UI.showToast('✅ Новый скин разблокирован!');
                return true;
            }
        } catch (err) {
            console.error('Failed to unlock skin:', err);
            UI.showToast('❌ Ошибка разблокировки', true);
        }
        return false;
    },
    
    async select(id) {
        const skin = this.getSkinById(id);
        if (!skin) return false;
        
        if (!State.skins.owned.includes(id) && !this.isUnlocked(skin)) {
            UI.showToast(`❌ ${skin.name} еще не открыт!`, true);
            return false;
        }
        
        if (!State.skins.owned.includes(id)) {
            const unlocked = await this.unlock(id, 'free');
            if (!unlocked) return false;
        }
        
        if (State.user.id) {
            try {
                await API.post('/api/select-skin', {
                    user_id: State.user.id,
                    skin_id: id
                });
            } catch (err) {
                console.error('Failed to sync skin selection:', err);
            }
        }
        
        State.skins.selected = id;
        UI.showToast(`✨ Скин "${skin.name}" выбран!`);
        return true;
    }
};

window.SkinsSystem = SkinsSystem;

/* ===============================
   UI SYSTEM (МИНИМАЛЬНЫЙ ДЛЯ CORE)
   ============================== */

const UI = {
    updateGame() {
        const coinEl = document.getElementById('coinBalance');
        if (coinEl) coinEl.textContent = Math.floor(State.game.coins);
        
        const tapEl = document.getElementById('profitPerTap');
        if (tapEl) tapEl.textContent = State.game.profitPerTap;
        
        const hourEl = document.getElementById('profitPerHour');
        if (hourEl) hourEl.textContent = State.game.profitPerHour;
        
        this.updateEnergy();
        this.updateUpgradePanel();
    },
    
    updateEnergy() {
        const energyText = document.getElementById('energyText');
        const maxEnergyEl = document.getElementById('maxEnergyText');
        const energyFill = document.getElementById('energyFill');
        
        if (energyText) energyText.textContent = Math.floor(State.game.energy);
        if (maxEnergyEl) maxEnergyEl.textContent = State.game.maxEnergy;
        
        if (energyFill) {
            const percent = (State.game.energy / State.game.maxEnergy) * 100;
            energyFill.style.width = percent + '%';
        }
        
        const regenEl = document.getElementById('energyRegenInfo');
        if (regenEl) {
            const missing = State.game.maxEnergy - State.game.energy;
            if (missing > 0) {
                const seconds = Math.ceil(missing * CONFIG.ENERGY_RECHARGE_INTERVAL / 1000);
                regenEl.textContent = `⚡ +1/${CONFIG.ENERGY_RECHARGE_INTERVAL/1000}с (${seconds}с)`;
            } else {
                regenEl.textContent = '⚡ Energy full!';
            }
        }
    },
    
    updateUpgradePanel() {
        const levelEl = document.getElementById('globalLevel');
        if (levelEl) levelEl.textContent = State.game.levels.multitap;
        
        const priceEl = document.getElementById('globalPrice');
        if (priceEl) {
            const total = State.game.prices.multitap + State.game.prices.profit + State.game.prices.energy;
            priceEl.textContent = total;
        }
    },
    
    updateAll() {
        this.updateGame();
        this.updateEnergy();
        this.updateUpgradePanel();
    },
    
    showToast(msg, isError = false) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: ${isError ? 'rgba(244, 67, 54, 0.9)' : 'rgba(76, 175, 80, 0.9)'};
            color: white;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 10001;
            animation: toastFade 2s forwards;
            backdrop-filter: blur(5px);
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
};

window.UI = UI;

/* ===============================
   REFERRAL SYSTEM
   ============================== */

const ReferralSystem = {
    async loadData() {
        if (!State.user.id) return;
        
        try {
            const data = await API.get(`/api/referral-data/${State.user.id}`);
            
            const countEl = document.getElementById('referral-count');
            const earnEl = document.getElementById('referral-earnings');
            
            if (countEl) countEl.textContent = data.count || 0;
            if (earnEl) earnEl.textContent = data.earnings || 0;
            
            State.skins.friendsInvited = data.count || 0;
            
            const linkEl = document.getElementById('referral-link');
            if (linkEl) {
                linkEl.textContent = `https://t.me/Ryoho_bot?start=ref_${State.user.id}`;
            }
        } catch (err) {
            console.error('Referral error:', err);
        }
    },
    
    copyLink() {
        const linkEl = document.getElementById('referral-link');
        if (!linkEl?.textContent || linkEl.textContent === 'loading...') {
            UI.showToast('❌ Ссылка не загружена', true);
            return;
        }
        
        navigator.clipboard?.writeText(linkEl.textContent)
            .then(() => UI.showToast('✅ Ссылка скопирована!'))
            .catch(() => UI.showToast('❌ Ошибка копирования', true));
    },
    
    share() {
        const linkEl = document.getElementById('referral-link');
        if (!linkEl?.textContent || linkEl.textContent === 'loading...') {
            UI.showToast('❌ Ссылка не загружена', true);
            return;
        }
        
        const text = encodeURIComponent('🎮 Присоединяйся к Spirit Clicker!');
        window.open(`https://t.me/share/url?url=${encodeURIComponent(linkEl.textContent)}&text=${text}`, '_blank');
    }
};

window.ReferralSystem = ReferralSystem;

/* ===============================
   SETTINGS SYSTEM
   ============================== */

const SettingsSystem = {
    load() {
        try {
            const saved = localStorage.getItem('spiritSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                State.settings = { ...State.settings, ...parsed };
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
        
        this.applyTheme();
        this.updateUI();
    },
    
    save() {
        try {
            localStorage.setItem('spiritSettings', JSON.stringify(State.settings));
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    },
    
    toggleTheme() {
        State.settings.theme = State.settings.theme === 'day' ? 'night' : 'day';
        this.applyTheme();
        this.updateUI();
        this.save();
    },
    
    applyTheme() {
        if (State.settings.theme === 'night') {
            document.body.classList.add('night-mode');
        } else {
            document.body.classList.remove('night-mode');
        }
    },
    
    toggleSound() {
        State.settings.sound = !State.settings.sound;
        this.updateUI();
        this.save();
    },
    
    toggleVibration() {
        State.settings.vibration = !State.settings.vibration;
        this.updateUI();
        this.save();
    },
    
    updateUI() {
        const isNight = State.settings.theme === 'night';
        const soundOn = State.settings.sound;
        const vibOn = State.settings.vibration;
        
        this.setToggle('themeTrack', isNight);
        this.setIcon('themeIcon', isNight ? '🌙' : '☀️');
        this.setLabel('themeLabel', isNight ? 'Night' : 'Day');
        
        this.setToggle('soundTrack', soundOn);
        this.setIcon('soundIcon', soundOn ? '🔊' : '🔇');
        this.setLabel('soundLabel', soundOn ? 'On' : 'Off');
        
        this.setToggle('vibTrack', vibOn);
        this.setIcon('vibIcon', vibOn ? '📳' : '📴');
        this.setLabel('vibLabel', vibOn ? 'On' : 'Off');
    },
    
    setToggle(id, active) {
        const el = document.getElementById(id);
        if (el) {
            if (active) el.classList.add('active');
            else el.classList.remove('active');
        }
    },
    
    setIcon(id, icon) {
        const el = document.getElementById(id);
        if (el) el.textContent = icon;
    },
    
    setLabel(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
};

window.SettingsSystem = SettingsSystem;

/* ===============================
   NAVIGATION
   ============================== */

const Navigation = {
    openModal(id) {
        document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        }
    },
    
    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    },
    
    switchTab(tab, el) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        if (el) el.classList.add('active');
        
        document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
        document.body.classList.remove('modal-open');
        
        if (tab === 'main') return;
        
        const modalId = `${tab}-screen`;
        this.openModal(modalId);
        
        if (tab === 'friends') ReferralSystem.loadData();
        if (tab === 'skins') window.dispatchEvent(new CustomEvent('openSkins'));
    }
};

window.Navigation = Navigation;

/* ===============================
   GAME FUNCTIONS (ДЛЯ APP.JS)
   ============================== */

// Эти функции будут вызываться из app.js
window.handleTap = function(clientX, clientY, megaBoostActive, gain) {
    // Обновляем состояние
    State.game.coins += gain;
    if (!megaBoostActive) {
        State.game.energy = Math.max(0, State.game.energy - 1);
    }
    
    // Отправляем на сервер
    ClickEngine.addClick(gain, megaBoostActive);
    
    // Обновляем UI
    UI.updateAll();
    
    return {
        coins: State.game.coins,
        energy: State.game.energy
    };
};

window.upgradeBoost = (type) => UpgradeSystem.upgrade(type);
window.upgradeAll = () => UpgradeSystem.upgradeAll();

window.recoverEnergy = () => EnergySystem.recover();
window.startEnergyRecovery = () => EnergySystem.startRecovery();

window.selectSkin = (id) => SkinsSystem.select(id);
window.getSkinById = (id) => SkinsSystem.getSkinById(id);

window.copyReferralLink = () => ReferralSystem.copyLink();
window.shareReferral = () => ReferralSystem.share();

window.toggleTheme = () => SettingsSystem.toggleTheme();
window.toggleSound = () => SettingsSystem.toggleSound();
window.toggleVibration = () => SettingsSystem.toggleVibration();

window.openModal = (id) => Navigation.openModal(id);
window.closeModal = (id) => Navigation.closeModal(id);
window.switchTab = (tab, el) => Navigation.switchTab(tab, el);
window.openSettings = () => Navigation.openModal('settings-screen');
window.closeSettings = () => Navigation.closeModal('settings-screen');
window.closeSettingsOutside = (e) => {
    const box = document.getElementById('settings-modal-box');
    if (box && !box.contains(e.target)) Navigation.closeModal('settings-screen');
};

/* ===============================
   TASKS (ЗАГЛУШКИ)
   ============================== */

window.loadTasks = async () => {
    const container = document.getElementById('tasks-list');
    if (container) {
        container.innerHTML = '<div class="loading">Задачи появятся позже</div>';
    }
};

window.completeTask = (taskId) => {
    UI.showToast('✅ Задание выполнено!');
};

/* ===============================
   MINI-GAMES (ЗАГЛУШКИ)
   ============================== */

window.openGame = (game) => {
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.add('active');
};

window.closeGame = (game) => {
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.remove('active');
};

window.toggleNumberInput = () => {
    const betType = document.getElementById('wheel-color')?.value;
    const numberInput = document.getElementById('wheel-number');
    if (numberInput) {
        numberInput.style.display = betType === 'number' ? 'block' : 'none';
    }
};

window.playCoinflip = async () => {
    const bet = parseInt(document.getElementById('coin-bet')?.value || 0);
    if (bet > State.game.coins || bet < 10) {
        UI.showToast('❌ Недостаточно монет', true);
        return;
    }
    
    if (!State.user.id) {
        UI.showToast('❌ Авторизуйтесь', true);
        return;
    }
    
    try {
        const data = await API.post('/api/game/coinflip', {
            user_id: State.user.id,
            bet
        });
        
        State.game.coins = data.coins;
        UI.updateAll();
        
        document.getElementById('coin-result').textContent = data.message || '🎮 Сыграно!';
    } catch (err) {
        UI.showToast('❌ Ошибка игры', true);
    }
};

window.playSlots = async () => {
    const bet = parseInt(document.getElementById('slots-bet')?.value || 0);
    if (bet > State.game.coins || bet < 10) {
        UI.showToast('❌ Недостаточно монет', true);
        return;
    }
    
    if (!State.user.id) {
        UI.showToast('❌ Авторизуйтесь', true);
        return;
    }
    
    try {
        const data = await API.post('/api/game/slots', {
            user_id: State.user.id,
            bet
        });
        
        State.game.coins = data.coins;
        UI.updateAll();
        
        document.getElementById('slot1').textContent = data.slots?.[0] || '🍒';
        document.getElementById('slot2').textContent = data.slots?.[1] || '🍒';
        document.getElementById('slot3').textContent = data.slots?.[2] || '🍒';
        document.getElementById('slots-result').textContent = data.message || '🎮 Сыграно!';
    } catch (err) {
        UI.showToast('❌ Ошибка игры', true);
    }
};

window.playDice = async () => {
    const bet = parseInt(document.getElementById('dice-bet')?.value || 0);
    const pred = document.getElementById('dice-prediction')?.value;
    
    if (bet > State.game.coins || bet < 10) {
        UI.showToast('❌ Недостаточно монет', true);
        return;
    }
    
    if (!State.user.id) {
        UI.showToast('❌ Авторизуйтесь', true);
        return;
    }
    
    try {
        const data = await API.post('/api/game/dice', {
            user_id: State.user.id,
            bet,
            prediction: pred
        });
        
        State.game.coins = data.coins;
        UI.updateAll();
        
        const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        document.getElementById('dice1').textContent = faces[(data.dice1 || 1) - 1];
        document.getElementById('dice2').textContent = faces[(data.dice2 || 1) - 1];
        document.getElementById('dice-result').textContent = data.message || '🎮 Сыграно!';
    } catch (err) {
        UI.showToast('❌ Ошибка игры', true);
    }
};

window.playWheel = async () => {
    const bet = parseInt(document.getElementById('wheel-bet')?.value || 0);
    const betType = document.getElementById('wheel-color')?.value;
    const betNumber = parseInt(document.getElementById('wheel-number')?.value);
    
    if (bet > State.game.coins || bet < 10) {
        UI.showToast('❌ Недостаточно монет', true);
        return;
    }
    
    if (!State.user.id) {
        UI.showToast('❌ Авторизуйтесь', true);
        return;
    }
    
    try {
        const data = await API.post('/api/game/roulette', {
            user_id: State.user.id,
            bet,
            bet_type: betType,
            bet_value: betType === 'number' ? betNumber : null
        });
        
        State.game.coins = data.coins;
        UI.updateAll();
        
        document.getElementById('wheel').textContent = data.result_number || '0';
        document.getElementById('wheel-result').textContent = data.message || '🎮 Сыграно!';
    } catch (err) {
        UI.showToast('❌ Ошибка игры', true);
    }
};

/* ===============================
   MEGA BOOST (ЗАГЛУШКА)
   ============================== */

window.activateMegaBoost = () => {
    UI.showToast('🔥 Буст будет позже');
};

/* ===============================
   INITIALIZATION
   ============================== */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Spirit Clicker Core starting...');
    
    TelegramApp.init();
    SettingsSystem.load();
    
    if (State.user.id) {
        await UserData.load();
        EnergySystem.startRecovery();
        await SkinsSystem.load();
        await ReferralSystem.loadData();
    }
    
    // Обработчик для открытия скинов
    window.addEventListener('openSkins', async () => {
        await SkinsSystem.load();
        Navigation.openModal('skins-screen');
    });
    
    // Автосохранение
    setInterval(() => UserData.saveProgress(), 10000);
    
    console.log('✅ Spirit Clicker Core loaded', State.user.id ? `for user ${State.user.id}` : '');
});

// Экспорт для совместимости
window.showToast = UI.showToast;