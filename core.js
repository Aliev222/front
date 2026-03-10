/* ===============================
   SPIRIT CLICKER OPTIMIZED CORE
   ============================== */

'use strict';

/* ===============================
   CONFIGURATION
   ============================== */

const CONFIG = {
    API_URL: 'https://ryoho.onrender.com',
    CLICK_BATCH_INTERVAL: 1000,      // Отправка кликов раз в секунду
    ENERGY_RECHARGE_INTERVAL: 2000,   // +1 энергия каждые 2 секунды
    PASSIVE_INCOME_INTERVAL: 3600000, // 1 час
    CACHE_TTL: 30000,                  // 30 секунд
    MAX_BATCH_SIZE: 100,                // Максимум кликов в батче
    DEBOUNCE_CLICK: 50,                 // Минимальный интервал между кликами (мс)
    TOAST_DURATION: 2500
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
        profitPerHour: 0,
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
        theme: 'day',
        sound: true,
        vibration: true
    },
    
    // Временные данные
    temp: {
        clickBuffer: 0,
        gainBuffer: 0,
        batchTimer: null,
        recoveryTimer: null,
        lastClick: 0
    },
    
    cache: new Map()
};

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
        
        // Реферальный параметр
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

/* ===============================
   USER DATA LOADING
   ============================== */

const UserData = {
    async load() {
        if (!State.user.id) return;
        
        try {
            // Регистрация
            await API.post('/api/register', {
                user_id: State.user.id,
                username: State.user.username,
                referrer_id: State.user.referrerId
            });
            
            // Загрузка данных
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
        State.game.profitPerHour = data.profit_per_hour || 0;
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

/* ===============================
   CLICK ENGINE
   ============================== */

const ClickEngine = {
    lastClickTime: 0,
    pendingEffects: [],
    
    handle(x, y, element = null) {
        const now = Date.now();
        
        // Дебаунс кликов
        if (now - this.lastClickTime < CONFIG.DEBOUNCE_CLICK) return;
        this.lastClickTime = now;
        
        // Проверка энергии
        if (State.game.energy <= 0) {
            UI.showToast('⚡ Нет энергии!', true);
            return;
        }
        
        // Расчет дохода
        let gain = State.game.profitPerTap;
        
        // Бонус скина
        const skin = this.getActiveSkin();
        if (skin?.bonus) {
            if (skin.bonus.type === 'multiplier') {
                gain *= skin.bonus.value;
            }
        }
        
        // Проверка буста
        const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
        if (megaBoostActive) gain *= 2;
        
        gain = Math.floor(gain);
        
        // Обновление состояния
        State.game.coins += gain;
        if (!megaBoostActive) {
            State.game.energy = Math.max(0, State.game.energy - 1);
        }
        
        // Визуальные эффекты
        Effects.spawnFloatingText(`+${gain}`, x, y, megaBoostActive);
        Effects.sparkle(x, y);
        
        // Вибрация
        if (State.settings.vibration) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            } else if (navigator.vibrate) {
                navigator.vibrate(20);
            }
        }
        
        // Звук
        if (State.settings.sound) {
            Audio.play('click', megaBoostActive);
        }
        
        // Буферизация для отправки
        this.bufferClick(gain);
        
        UI.updateGame();
    },
    
    bufferClick(gain) {
        State.temp.clickBuffer++;
        State.temp.gainBuffer += gain;
        
        if (!State.temp.batchTimer) {
            State.temp.batchTimer = setTimeout(() => this.sendBatch(), CONFIG.CLICK_BATCH_INTERVAL);
        }
    },
    
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
    
    getActiveSkin() {
        return window.skinsData?.find(s => s.id === State.skins.selected);
    }
};

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
        // Проверка буста
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
            // Локальное восстановление при ошибке
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

/* ===============================
   UPGRADE SYSTEM
   ============================== */

const UpgradeSystem = {
    async upgrade(type) {
        if (window.upgradeInProgress || !State.user.id) return;
        
        const price = State.game.prices[type];
        if (!price || State.game.coins < price) {
            UI.showToast(`❌ Need ${price} coins`, true);
            return;
        }
        
        window.upgradeInProgress = true;
        
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
                Effects.playUpgrade();
                UI.updateAll();
            }
        } catch (err) {
            console.error('Upgrade error:', err);
            UI.showToast('❌ Upgrade failed', true);
        } finally {
            window.upgradeInProgress = false;
        }
    },
    
    async upgradeAll() {
        if (window.upgradeInProgress || !State.user.id) return;
        
        const total = Object.values(State.game.prices).reduce((a, b) => a + b, 0);
        if (State.game.coins < total) {
            UI.showToast(`❌ Need ${total} coins`, true);
            return;
        }
        
        window.upgradeInProgress = true;
        
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
        
        window.upgradeInProgress = false;
        EnergySystem.reset();
        UI.updateAll();
        Effects.playUpgrade();
        UI.showToast('✅ All upgrades completed!');
    }
};

/* ===============================
   SKINS SYSTEM
   ============================== */

const SkinsSystem = {
    async init() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/skins/list`);
            if (res.ok) {
                window.skinsData = await res.json();
                this.renderGrid();
            }
        } catch (err) {
            console.error('Failed to load skins:', err);
        }
    },
    
    renderGrid(filter = 'all') {
        const grid = document.getElementById('skins-grid');
        if (!grid || !window.skinsData) return;
        
        const filtered = filter === 'all' 
            ? window.skinsData 
            : window.skinsData.filter(s => s.rarity === filter);
        
        grid.innerHTML = filtered.map(skin => {
            const unlocked = this.isUnlocked(skin);
            const owned = State.skins.owned.includes(skin.id);
            const selected = State.skins.selected === skin.id;
            
            return `
                <div class="skin-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}" 
                     data-id="${skin.id}" onclick="window.selectSkin('${skin.id}')">
                    ${!unlocked ? '<div class="skin-lock">🔒</div>' : ''}
                    ${owned && selected ? '<div class="skin-equipped">✓</div>' : ''}
                    <div class="skin-image">
                        <img src="${skin.image}" alt="${skin.name}" loading="lazy"
                             onerror="this.src='imgg/clickimg.png'">
                    </div>
                    <div class="skin-name">${skin.name}</div>
                    <div class="skin-rarity ${skin.rarity}">${this.getRarityName(skin.rarity)}</div>
                </div>
            `;
        }).join('');
    },
    
    isUnlocked(skin) {
        if (State.skins.owned.includes(skin.id)) return true;
        
        const req = skin.requirement;
        if (!req) return false;
        
        if (req.type === 'free') return true;
        if (req.type === 'ads') return State.skins.adsWatched >= (req.count || 0);
        if (req.type === 'special') {
            if (req.description?.includes('50 друзей')) {
                return State.skins.friendsInvited >= 50;
            }
            if (req.description?.includes('100 уровня')) {
                return State.game.level >= 100;
            }
        }
        return false;
    },
    
    getRarityName(rarity) {
        const names = { common: 'Обычный', rare: 'Редкий', legendary: 'Легендарный', super: 'Супер редкий' };
        return names[rarity] || rarity;
    },
    
    async select(id) {
        const skin = window.skinsData?.find(s => s.id === id);
        if (!skin) return;
        
        if (!State.skins.owned.includes(id) && !this.isUnlocked(skin)) {
            UI.showToast(`❌ ${skin.name} еще не открыт!`, true);
            return;
        }
        
        if (!State.skins.owned.includes(id)) {
            await this.unlock(id, 'ads');
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
        this.updateClickerImage(id);
        UI.updateSkinsGrid();
        UI.showToast(`✨ Скин "${skin.name}" выбран!`);
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
                    this.updateClickerImage(res.selected_skin);
                }
                UI.showToast('✅ Новый скин разблокирован!');
                UI.updateSkinsGrid();
            }
        } catch (err) {
            console.error('Failed to unlock skin:', err);
            UI.showToast('❌ Ошибка разблокировки', true);
        }
    },
    
    updateClickerImage(id) {
        const img = document.querySelector('.click-image');
        if (!img) return;
        
        const skin = window.skinsData?.find(s => s.id === id);
        img.src = (skin?.image || 'imgg/skins/default_SP.png') + '?t=' + Date.now();
        img.onerror = () => { img.src = 'imgg/clickimg.png'; };
    }
};

/* ===============================
   AUDIO SYSTEM
   ============================== */

const Audio = {
    ctx: null,
    sounds: {},
    
    init() {
        if (!State.settings.sound) return;
        
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') {
                document.addEventListener('click', () => this.ctx.resume(), { once: true });
            }
        } catch (e) {
            console.warn('Web Audio not supported');
        }
    },
    
    play(type, special = false) {
        if (!State.settings.sound || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const now = this.ctx.currentTime;
        
        if (type === 'click') {
            if (special) {
                // Мощный звук для буста
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            } else {
                // Обычный звук
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(650, now);
                osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            }
        } else if (type === 'upgrade') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.05);
            osc.frequency.setValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    }
};

/* ===============================
   EFFECTS SYSTEM
   ============================== */

const Effects = {
    floatingPool: [],
    maxPoolSize: 10,
    
    spawnFloatingText(text, x, y, special = false) {
        let el = this.floatingPool.pop();
        if (!el) {
            el = document.createElement('div');
            el.className = 'floating-text';
        }
        
        el.textContent = text;
        if (special) {
            el.style.color = '#ffaa00';
            el.style.fontWeight = 'bold';
            el.style.textShadow = '0 0 10px #ff0';
        } else {
            el.style.color = '';
            el.style.fontWeight = '';
            el.style.textShadow = '';
        }
        
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        
        requestAnimationFrame(() => {
            el.style.transform = 'translateY(-50px)';
            el.style.opacity = '0';
        });
        
        setTimeout(() => {
            if (el.parentNode) el.remove();
            if (this.floatingPool.length < this.maxPoolSize) {
                this.floatingPool.push(el);
            }
        }, 800);
    },
    
    sparkle(x, y) {
        const count = 5;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'sparkle-particle';
            particle.style.left = (x + (Math.random() - 0.5) * 50) + 'px';
            particle.style.top = (y + (Math.random() - 0.5) * 50) + 'px';
            particle.style.backgroundColor = `hsl(${Math.random() * 60 + 30}, 100%, 70%)`;
            particle.style.width = particle.style.height = (Math.random() * 6 + 4) + 'px';
            
            document.body.appendChild(particle);
            
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 30;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance - 20;
            
            requestAnimationFrame(() => {
                particle.style.transform = `translate(${tx}px, ${ty}px)`;
                particle.style.opacity = '0';
            });
            
            setTimeout(() => particle.remove(), 600);
        }
    },
    
    playUpgrade() {
        const el = document.querySelector('.upgrade-panel');
        if (!el) return;
        
        el.classList.add('upgrade-bounce');
        setTimeout(() => el.classList.remove('upgrade-bounce'), 300);
    },
    
    playBonus() {
        const el = document.querySelector('.balance-container');
        if (!el) return;
        
        el.classList.add('bonus-flash');
        setTimeout(() => el.classList.remove('bonus-flash'), 400);
    }
};

/* ===============================
   UI SYSTEM
   ============================== */

const UI = {
    updateGame() {
        const coinEl = document.getElementById('coinBalance');
        if (coinEl) coinEl.textContent = Math.floor(State.game.coins);
        
        const tapEl = document.getElementById('profitPerTap');
        if (tapEl) tapEl.textContent = State.game.profitPerTap;
        
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
                regenEl.textContent = `⚡ +1/${CONFIG.ENERGY_RECHARGE_INTERVAL/1000}с (${seconds}с до полной)`;
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
    
    updateSkinsGrid() {
        SkinsSystem.renderGrid();
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

/* ===============================
   SETTINGS SYSTEM
   ============================== */

const Settings = {
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
        
        if (tab === 'friends') window.loadReferralData?.();
        if (tab === 'tasks') window.loadTasks?.();
        if (tab === 'skins') {
            SkinsSystem.renderGrid();
            this.openModal(modalId);
        }
    }
};

/* ===============================
   INITIALIZATION
   ============================== */

document.addEventListener('DOMContentLoaded', () => {
    TelegramApp.init();
    Settings.load();
    Audio.init();
    
    if (State.user.id) {
        UserData.load().then(() => {
            EnergySystem.startRecovery();
            SkinsSystem.init();
            window.loadReferralData?.();
            window.loadTasks?.();
        });
    }
    
    // Клик по всей игровой области
    const gameContainer = document.querySelector('.game-container');
    const clickLayer = document.querySelector('.game-click-layer');
    const clickButton = document.getElementById('ryoho');
    
    const clickHandler = (e) => {
        // Игнорируем клики по интерактивным элементам
        if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
            '.skin-category, .task-button, .btn-primary, .btn-secondary, ' +
            '.toggle-wrap, .upgrade-panel, .game-card, .modal-screen *')) {
            return;
        }
        
        e.preventDefault();
        
        let x, y;
        if (e.touches) {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        
        ClickEngine.handle(x, y, e.target);
    };
    
    if (gameContainer) {
        gameContainer.addEventListener('click', clickHandler);
        gameContainer.addEventListener('touchstart', clickHandler, { passive: false });
    }
    
    // Автосохранение
    setInterval(() => UserData.saveProgress(), 10000);
    
    console.log('✅ Spirit Clicker Core initialized');
});

/* ===============================
   EXPORTS
   ============================== */

// Глобальные переменные
window.State = State;
window.CONFIG = CONFIG;

// Основные функции
window.handleTap = (e) => {
    let x, y;
    if (e.touches) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }
    ClickEngine.handle(x, y, e.target);
};

window.upgradeBoost = (type) => UpgradeSystem.upgrade(type);
window.upgradeAll = () => UpgradeSystem.upgradeAll();

// Навигация
window.openModal = (id) => Navigation.openModal(id);
window.closeModal = (id) => Navigation.closeModal(id);
window.switchTab = (tab, el) => Navigation.switchTab(tab, el);

// Скины
window.filterSkins = (category) => SkinsSystem.renderGrid(category);
window.selectSkin = (id) => SkinsSystem.select(id);

// Настройки
window.toggleTheme = () => Settings.toggleTheme();
window.toggleSound = () => Settings.toggleSound();
window.toggleVibration = () => Settings.toggleVibration();
window.openSettings = () => Navigation.openModal('settings-screen');
window.closeSettings = () => Navigation.closeModal('settings-screen');
window.closeSettingsOutside = (e) => {
    const box = document.getElementById('settings-modal-box');
    if (box && !box.contains(e.target)) Navigation.closeModal('settings-screen');
};

// Энергия
window.recoverEnergy = () => EnergySystem.recover();

// Заглушки для совместимости
window.copyReferralLink = () => {
    navigator.clipboard.writeText(`https://t.me/Ryoho_bot?start=ref_${State.user.id || ''}`);
    UI.showToast('✅ Link copied!');
};

window.shareReferral = () => {
    const text = encodeURIComponent('🎮 Join Spirit Clicker!');
    window.open(`https://t.me/share/url?url=https://t.me/Ryoho_bot?start=ref_${State.user.id || ''}&text=${text}`, '_blank');
};

window.loadReferralData = async () => {
    if (!State.user.id) return;
    try {
        const data = await API.get(`/api/referral-data/${State.user.id}`);
        const countEl = document.getElementById('referral-count');
        const earnEl = document.getElementById('referral-earnings');
        if (countEl) countEl.textContent = data.count || 0;
        if (earnEl) earnEl.textContent = data.earnings || 0;
    } catch (err) {
        console.error('Referral error:', err);
    }
};

window.loadTasks = async () => {
    // Заглушка для задач
};

window.completeTask = (taskId) => {
    UI.showToast('✅ Task completed!');
};

// Мини-игры (заглушки для совместимости)
window.openGame = (game) => {
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.add('active');
};

window.closeGame = (game) => {
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.remove('active');
};

window.playCoinflip = () => UI.showToast('🎮 Coinflip coming soon!');
window.playSlots = () => UI.showToast('🎮 Slots coming soon!');
window.playDice = () => UI.showToast('🎮 Dice coming soon!');
window.playWheel = () => UI.showToast('🎮 Roulette coming soon!');
window.toggleNumberInput = () => {};

console.log('✅ Spirit Clicker Core fully loaded');