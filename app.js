// ==================== TELEGRAM INIT ====================
const tg = window.Telegram?.WebApp;
let userId = null;
let username = null;

if (tg) {
    tg.expand();
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    if (tg.initDataUnsafe?.user) {
        userId = tg.initDataUnsafe.user.id;
        username = tg.initDataUnsafe.user.username || `user_${userId}`;
    }
}

// ==================== CONSTANTS ====================
const API_URL = 'https://ryoho.onrender.com';
const FULL_RECHARGE_TIME = 600000; // 10 минут в миллисекундах
const PASSIVE_INCOME_INTERVAL = 3600000; // 1 час
const CLICK_BATCH_INTERVAL = 1000; // Отправка кликов раз в секунду
const MAX_CACHE_AGE = 30000; // 30 секунд

// ==================== РЕКЛАМА И CPA ====================

// Конфигурация рекламы
const ADS_CONFIG = {
    guid: 'ТВОЙ_GUID_ОТ_МЕНЕДЖЕРА', // Получишь после регистрации
    debug: false // true для тестов
};

let adsInstance = null;

// Инициализация рекламы
async function initAds() {
    if (adsInstance) return adsInstance;
    
    try {
        adsInstance = await window.entryAds?.(ADS_CONFIG);
        console.log('✅ AdsPaw initialized');
        return adsInstance;
    } catch (e) {
        console.error('Ads init error:', e);
        return null;
    }
}

// Показ награждаемого видео
async function showRewardedAd(rewardType, rewardCallback) {
    try {
        const ads = await initAds();
        if (!ads) {
            // Fallback на старую систему
            return showLegacyRewardedAd(rewardType, rewardCallback);
        }
        
        const done = await ads.show({
            onAdShow: () => console.log('Ad shown'),
            onAdClick: () => console.log('Ad clicked'),
            onAdComplete: () => console.log('Ad completed')
        });
        
        if (done) {
            // Начисляем награду
            await rewardCallback();
            showToast('🎁 Награда получена!');
            
            // Отправляем статистику на сервер
            await fetch(`${API_URL}/api/ad-watched`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    reward_type: rewardType
                })
            });
            
            return true;
        }
    } catch (error) {
        console.error('Ad error:', error);
        showToast('❌ Реклама не загрузилась', true);
        return false;
    }
}

// Старая система как запасной вариант
async function showLegacyRewardedAd(rewardType, rewardCallback) {
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама временно недоступна', true);
        return false;
    }
    
    try {
        await window.show_10655027();
        await rewardCallback();
        showToast('🎁 Награда получена!');
        return true;
    } catch (e) {
        console.error('Legacy ad error:', e);
        return false;
    }
}

// ==================== CPA-ЗАДАНИЯ ====================

// Массив CPA-офферов (можно загружать с сервера)
const CPA_OFFERS = [
    {
        id: 'cpa_casino_1',
        title: '🎰 Регистрация в казино',
        description: 'Пройди регистрацию и получи 50,000 монет',
        reward: 50000,
        icon: '🎰',
        url: 'https://partner-link.com/123',
        color: '#ff6b6b'
    },
    {
        id: 'cpa_exchange_1',
        title: '💱 Верификация на бирже',
        description: 'Пройди KYC и получи 100,000 монет',
        reward: 100000,
        icon: '💱',
        url: 'https://partner-link.com/456',
        color: '#4ecdc4'
    },
    {
        id: 'cpa_game_1',
        title: '🎮 Установи игру-партнера',
        description: 'Скачай и получи 25,000 монет',
        reward: 25000,
        icon: '🎮',
        url: 'https://partner-link.com/789',
        color: '#45b7d1'
    }
];

// Добавление CPA-заданий в Tasks
function renderCPATasks() {
    return CPA_OFFERS.map(offer => `
        <div class="cpa-task-card" style="border-left-color: ${offer.color}">
            <div class="task-icon">${offer.icon}</div>
            <div class="task-info">
                <div class="task-title">${offer.title}</div>
                <div class="task-desc">${offer.description}</div>
                <div class="task-reward">🎁 +${formatNumber(offer.reward)} монет</div>
            </div>
            <button class="cpa-button" onclick="openCPATask('${offer.id}')">
                Выполнить
            </button>
        </div>
    `).join('');
}

// Открытие CPA-задания
async function openCPATask(offerId) {
    const offer = CPA_OFFERS.find(o => o.id === offerId);
    if (!offer) return;
    
    // Сохраняем начало перехода
    const cpaStart = {
        offerId,
        startTime: Date.now(),
        userId
    };
    localStorage.setItem(`cpa_${offerId}`, JSON.stringify(cpaStart));
    
    // Открываем ссылку
    window.open(offer.url, '_blank');
    
    // Показываем уведомление
    showToast('✅ Переход выполнен! Награда после подтверждения');
    
    // Отправляем на сервер
    try {
        await fetch(`${API_URL}/api/cpa-click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                offer_id: offerId
            })
        });
    } catch (e) {
        console.error('CPA click error:', e);
    }
    
    // Начинаем проверять статус
    startCPAVerification(offerId);
}

// Проверка статуса CPA
function startCPAVerification(offerId) {
    const checkInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/api/cpa-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    offer_id: offerId
                })
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.completed) {
                    clearInterval(checkInterval);
                    
                    // Начисляем награду
                    const offer = CPA_OFFERS.find(o => o.id === offerId);
                    if (offer) {
                        state.coins += offer.reward;
                        updateUI();
                        showToast(`💰 +${formatNumber(offer.reward)} монет!`);
                        
                        // Удаляем из localStorage
                        localStorage.removeItem(`cpa_${offerId}`);
                    }
                }
            }
        } catch (e) {
            console.error('CPA verification error:', e);
        }
    }, 5000); // Проверяем каждые 5 секунд
    
    // Останавливаем через 30 минут
    setTimeout(() => clearInterval(checkInterval), 30 * 60 * 1000);
}





// ==================== STATE ====================
const state = {
    coins: 0,
    energy: 500,
    maxEnergy: 500,
    profitPerTap: 1,
    profitPerHour: 100,
    globalLevel: 0,
    prices: { multitap: 50, profit: 40, energy: 30 },
    levels: { multitap: 0, profit: 0, energy: 0 }
};

window.state = state;

const settings = {
    theme: 'day',
    sound: true,
    vibration: true
};

let referrerId = null;
let upgradeInProgress = false;
let pendingUIUpdate = false;
let recoveryInterval = null;
let megaBoostTimer = null;
let alertTimeout = null;

// ==================== СКИНЫ ====================
let userSkins = {
    owned: ['default_SP'],
    selected: 'default_SP',
    stats: { adsWatched: 0, friendsInvited: 0, level: 0 }
};

let skinsData = [];

// ==================== ОЧЕРЕДЬ КЛИКОВ ====================
const clickBatch = {
    clicks: 0,
    totalGain: 0,
    timer: null,
    megaBoost: false
};

// ==================== REFERRAL DETECTION ====================
if (tg && tg.initDataUnsafe) {
    const startParam = tg.initDataUnsafe.start_param || '';
    if (startParam && startParam.startsWith('ref_')) {
        referrerId = parseInt(startParam.replace('ref_', '')) || null;
        if (referrerId) localStorage.setItem('ryohoReferrer', referrerId);
    }
}
if (!referrerId) {
    const saved = localStorage.getItem('ryohoReferrer');
    if (saved) referrerId = parseInt(saved) || null;
}

// ==================== UTILITIES ====================
const formatNumber = (num) => {
    num = Math.floor(num);
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
};

const showAlert = (msg, isErr = false) => {
    if (alertTimeout) {
        clearTimeout(alertTimeout);
        alertTimeout = null;
    }
    
    try {
        if (tg?.showAlert) {
            tg.showAlert(msg);
        } else {
            console.log(isErr ? '❌' : '✅', msg);
        }
    } catch (e) {
        if (e.message?.includes('Popup is already opened')) {
            console.log('⚠️ Попап уже открыт:', msg);
        } else {
            console.error('Alert error:', e);
        }
    }
    
    alertTimeout = setTimeout(() => {
        alertTimeout = null;
    }, 500);
};

const showToast = (msg, isSuccess = true) => {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isSuccess ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)'};
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 10001;
        animation: toastFade 2s forwards;
        border: 1px solid var(--purple);
        backdrop-filter: blur(5px);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
};

// ==================== STYLES FOR TOAST ====================
const toastStyles = document.createElement('style');
toastStyles.textContent = `
@keyframes toastFade {
    0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
    10% { opacity: 1; transform: translateX(-50%) translateY(0); }
    90% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
}
`;
document.head.appendChild(toastStyles);

// ==================== API CALLS ====================
const fetchWithCache = async (url, options = {}, cacheTime = 0) => {
    const cacheKey = `cache_${url}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cacheTime > 0 && cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTime) return data;
    }
    
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    
    if (cacheTime > 0) {
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    }
    
    return data;
};

// ==================== UI UPDATE ====================
const updateUI = () => {
    if (pendingUIUpdate) return;
    pendingUIUpdate = true;
    
    requestAnimationFrame(() => {
        // Баланс
        const coinEl = document.getElementById('coinBalance');
        if (coinEl) coinEl.textContent = formatNumber(state.coins);

        // Доход в час
        const hourEl = document.getElementById('profitPerHour');
        if (hourEl) hourEl.textContent = formatNumber(state.profitPerHour);
        
        // Доход за клик
        const tapEl = document.getElementById('profitPerTap');
        if (tapEl) tapEl.textContent = state.profitPerTap;

        // Энергия
        const energyFill = document.getElementById('energyFill');
        const energyText = document.getElementById('energyText');
        const maxEnergyEl = document.getElementById('maxEnergyText');
        
        if (energyFill && energyText && maxEnergyEl) {
            const percent = (state.energy / state.maxEnergy) * 100;
            energyFill.style.width = percent + '%';
            energyText.textContent = Math.floor(state.energy);
            maxEnergyEl.textContent = state.maxEnergy;
        }

        // Время восстановления
        const missing = state.maxEnergy - state.energy;
        const regenEl = document.getElementById('energyRegenInfo');
        if (regenEl) {
            if (missing > 0) {
                const totalSeconds = Math.ceil(missing * FULL_RECHARGE_TIME / 1000 / state.maxEnergy);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                regenEl.textContent = `⚡ Полное через ${minutes}м ${seconds}с`;
            } else {
                regenEl.textContent = '⚡ Energy full!';
            }
        }

        // Уровень
        state.globalLevel = state.levels.multitap;
        const globalLevelEl = document.getElementById('globalLevel');
        if (globalLevelEl) globalLevelEl.textContent = state.globalLevel;

        // Цена глобального апгрейда
        const globalPriceEl = document.getElementById('globalPrice');
        if (globalPriceEl) {
            const total = (state.prices.multitap || 0) + 
                         (state.prices.profit || 0) + 
                         (state.prices.energy || 0);
            globalPriceEl.textContent = formatNumber(total);
        }
        
        pendingUIUpdate = false;
    });
};

// ==================== ENERGY RECOVERY ====================
// ==================== ENERGY RECOVERY ====================
let energyUpdateInterval = null;

const startEnergyRecovery = () => {
    // Очищаем предыдущий интервал
    if (recoveryInterval) {
        clearInterval(recoveryInterval);
        recoveryInterval = null;
    }
    
    // Рассчитываем интервал: полное восстановление за 10 минут
    // FULL_RECHARGE_TIME = 600000 мс (10 минут)
    const intervalMs = FULL_RECHARGE_TIME / state.maxEnergy;
    console.log(`⚡ Energy recovery started: +1 every ${intervalMs}ms (${state.maxEnergy} max energy)`);
    
    // Запускаем новый интервал
    recoveryInterval = setInterval(() => {
        recoverEnergy();
    }, intervalMs);
};

const recoverEnergy = async () => {
    // ========== КРИТИЧЕСКИ ВАЖНО: ПРОВЕРКА MEGA BOOST ==========
    const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
    
    // ЕСЛИ БУСТ АКТИВЕН - ВООБЩЕ НИЧЕГО НЕ ДЕЛАЕМ!
    if (megaBoostActive) {
        console.log('⚡ Mega Boost active - energy recovery SKIPPED');
        return; // ВАЖНО: выходим сразу, не восстанавливаем энергию
    }
    
    // Если энергия уже полная - не восстанавливаем
    if (state.energy >= state.maxEnergy) {
        return;
    }
    
    if (!userId) {
        // Локальное восстановление
        state.energy = Math.min(state.maxEnergy, state.energy + 1);
        updateUI();
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/recover-energy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (res.ok) {
            const data = await res.json();
            state.energy = data.energy;
            updateUI();
        }
    } catch (e) {
        console.error('Energy recovery error:', e);
    }
};

// Функция для принудительного сброса энергии (например, после апгрейда)
const resetEnergyRecovery = () => {
    if (energyUpdateInterval) {
        clearInterval(energyUpdateInterval);
        startEnergyRecovery();
    }
};

// ==================== CLICK HANDLER ====================
async function handleTap(e) {
    // Игнорируем клики по интерактивным элементам
    const target = e.target;
    if (target.closest('button, a, .nav-item, .settings-btn, .modal-close, .mini-boost-button, .skin-category, .skin-card, .task-button, .btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card')) {
        return;
    }
    if (e.cancelable) e.preventDefault();

    // Координаты для анимации
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Проверка Mega Boost
    const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
    
    // 👇 ВОТ ЗДЕСЬ ДОБАВЛЯЕМ ПРОВЕРКУ ЭНЕРГИИ И ВСПЛЫВАЮЩЕЕ ОКНО
    if (!megaBoostActive && state.energy < 1) {
        showEnergyRecoveryModal(); // ПОКАЗЫВАЕМ ОКНО
        return; // ВЫХОДИМ ИЗ ФУНКЦИИ, НЕ КЛИКАЕМ
    }

    // Расчет дохода
    let gain = state.profitPerTap;
    
    // Бонус скина
    const skin = getSkinById(userSkins.selected);
    if (skin && skin.bonus && skin.bonus.type === 'multiplier') {
        gain *= skin.bonus.value;
    }
    
    // Mega Boost
    if (megaBoostActive) gain *= 2;
    gain = Math.floor(gain);

    // Мгновенное обновление UI
    state.coins += gain;
    if (!megaBoostActive) {
        state.energy = Math.max(0, state.energy - 1);
    }
    updateUI();

    // Анимация касания
    try {
        const effect = document.createElement('div');
        effect.className = 'tap-effect-global';
        effect.style.left = clientX + 'px';
        effect.style.top = clientY + 'px';
        effect.innerHTML = megaBoostActive ? `+${gain} 🔥` : `+${gain}`;
        if (megaBoostActive) {
            effect.style.color = '#ffaa00';
            effect.style.fontWeight = 'bold';
            effect.style.textShadow = '0 0 10px #ff0';
        }
        document.body.appendChild(effect);
        setTimeout(() => effect.remove(), 300);
    } catch (err) {}

    // Вибрация
    vibrateClick();

    // Звук
    if (settings.sound) {
        playClickSound(megaBoostActive);
    }

    // Отправка в очередь (только если есть userId)
    if (userId) {
        clickBatch.clicks++;
        clickBatch.totalGain += gain;
        clickBatch.megaBoost = megaBoostActive;
        
        if (!clickBatch.timer) {
            clickBatch.timer = setTimeout(sendClickBatch, CLICK_BATCH_INTERVAL);
        }
    } 
}

// Отправка накопленных кликов
async function sendClickBatch() {
    if (clickBatch.clicks === 0 || !userId) {
        clickBatch.timer = null;
        return;
    }

    try {
        await fetch(`${API_URL}/api/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                clicks: clickBatch.clicks,
                gain: clickBatch.totalGain,
                mega_boost: clickBatch.megaBoost
            })
        });
    } catch (e) {
        console.log('Click batch error:', e);
    }

    // Сброс
    clickBatch.clicks = 0;
    clickBatch.totalGain = 0;
    clickBatch.timer = null;
}

// Звук клика
function playClickSound(megaBoostActive) {
    try {
        if (!window.audioCtx) {
            window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const audioCtx = window.audioCtx;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const now = audioCtx.currentTime;
        
        if (megaBoostActive) {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(650, now);
            osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
            gainNode.gain.setValueAtTime(0.25, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);

            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1200, now);
            osc2.frequency.exponentialRampToValueAtTime(800, now + 0.05);
            gain2.gain.setValueAtTime(0.1, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc2.start(now);
            osc2.stop(now + 0.1);
        }
    } catch (e) {}
}

function showEnergyRecoveryModal() {
    // Проверяем, не открыта ли уже модалка
    if (document.querySelector('.energy-recovery-modal')) return;
    
    const modal = document.createElement('div');
    modal.className = 'energy-recovery-modal';
    modal.innerHTML = `
        <div class="modal-content glass">
            <button class="modal-close" onclick="closeEnergyModal()">✕</button>
            <h3>⚡ Энергия закончилась!</h3>
            <p>Выберите способ восстановления:</p>
            
            <div class="recovery-options">
                <div class="recovery-option ad" onclick="recoverEnergyWithAd()">
                    <div class="option-icon">📺</div>
                    <div class="option-text">
                        <strong>+50 энергии</strong>
                        <small>Посмотреть рекламу</small>
                    </div>
                </div>
                
                <div class="recovery-option wait" onclick="closeEnergyModal()">
                    <div class="option-icon">⏳</div>
                    <div class="option-text">
                        <strong>Подождать</strong>
                        <small id="recovery-time">Восстановление...</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обновляем время восстановления
    updateRecoveryTime();
}

function updateRecoveryTime() {
    const timeEl = document.getElementById('recovery-time');
    if (!timeEl) return;
    
    const missing = state.maxEnergy - state.energy;
    const seconds = Math.ceil(missing * 600 / state.maxEnergy);
    
    if (seconds < 60) {
        timeEl.textContent = `⏳ ${seconds} сек`;
    } else {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timeEl.textContent = `⏳ ${minutes} мин ${secs} сек`;
    }
}

async function recoverEnergyWithAd() {
    closeEnergyModal();
    
    // Проверяем, какая функция доступна
    if (typeof showRewardedAd === 'function') {
        // Новая система с колбэком
        const success = await showRewardedAd('energy', async () => {
            state.energy = Math.min(state.maxEnergy, state.energy + 50);
            updateUI();
        });
    } 
    else if (typeof showRewardedVideo === 'function') {
        // Старая система
        await showRewardedVideo();
        state.energy = Math.min(state.maxEnergy, state.energy + 50);
        updateUI();
        showToast('⚡ +50 энергии!');
    }
    else {
        showToast('📺 Реклама временно недоступна', true);
    }
}

function closeEnergyModal() {
    const modal = document.querySelector('.energy-recovery-modal');
    if (modal) modal.remove();
}


// ==================== USER DATA LOADING ====================
const loadUserData = async () => {
    if (!userId) return;
    
    try {
        // Регистрация
        await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, username, referrer_id: referrerId })
        });

        // Загрузка данных
        const data = await fetchWithCache(`${API_URL}/api/user/${userId}`, {}, MAX_CACHE_AGE);
        
        state.coins = data.coins || 0;
        state.energy = data.energy || 500;
        state.maxEnergy = data.max_energy || 500;
        state.profitPerTap = data.profit_per_tap || 1;
        state.profitPerHour = data.profit_per_hour || 100;
        state.levels.multitap = data.multitap_level || 0;
        state.levels.profit = data.profit_level || 0;
        state.levels.energy = data.energy_level || 0;
        
        userSkins.owned = data.owned_skins || ['default_SP'];
        userSkins.selected = data.selected_skin || 'default_SP';
        userSkins.stats.adsWatched = data.ads_watched || 0;

        await loadUpgradePrices();
        await loadSkinsList();
        await loadReferralData();
        await checkMegaBoostStatus();
        await checkOfflinePassiveIncome();

        applySavedSkin();
        updateUI();
        startEnergyRecovery();
        
    } catch (e) {
        console.error('Error loading user data:', e);
    }
};

const loadUpgradePrices = async () => {
    if (!userId) return;
    try {
        const prices = await fetchWithCache(`${API_URL}/api/upgrade-prices/${userId}`, {}, 10000);
        state.prices = { ...state.prices, ...prices };
        updateUI();
    } catch (e) {
        console.error('Error loading prices:', e);
    }
};

const loadSkinsList = async () => {
    try {
        const res = await fetch(`${API_URL}/api/skins/list`);
        if (res.ok) {
            const data = await res.json();
            skinsData = data.skins;
        }
    } catch (e) {
        console.error('Error loading skins list:', e);
    }
};

// ==================== UPGRADES ====================
const upgradeBoost = async (type) => {
    if (upgradeInProgress || !userId) return;
    
    const price = state.prices[type];
    if (!price) return;
    
    if (state.coins < price) {
        showAlert(`❌ Need ${formatNumber(price)} coins`, true);
        return;
    }

    upgradeInProgress = true;
    
    try {
        const res = await fetch(`${API_URL}/api/upgrade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, boost_type: type })
        });
        
        if (res.ok) {
            const result = await res.json();
            state.coins = result.coins;
            state.levels[type] = result.new_level;
            state.prices[type] = result.next_cost;
            
            if (result.profit_per_tap) state.profitPerTap = result.profit_per_tap;
            if (result.profit_per_hour) state.profitPerHour = result.profit_per_hour;
            if (result.max_energy) {
                state.maxEnergy = result.max_energy;
                state.energy = result.max_energy;
                startEnergyRecovery();
            }
            
            showAlert(`✅ ${type} upgraded to level ${result.new_level}!`);
            updateUI();
        }
    } catch (e) {
        console.error('Upgrade error:', e);
        showAlert('❌ Server error', true);
    } finally {
        upgradeInProgress = false;
    }
};

const upgradeAll = async () => {
    if (upgradeInProgress || !userId) return;

    const totalPrice = (state.prices.multitap || 0) + (state.prices.profit || 0) + (state.prices.energy || 0);
    if (state.coins < totalPrice) {
        showAlert('❌ Не хватает монет ' + formatNumber(totalPrice), true);
        return;
    }

    upgradeInProgress = true;
    const types = ['multitap', 'profit', 'energy'];
    let upgraded = false;

    for (const type of types) {
        try {
            const res = await fetch(`${API_URL}/api/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, boost_type: type })
            });
            
            if (res.ok) {
                const result = await res.json();
                state.coins = result.coins;
                state.levels[type] = result.new_level;
                state.prices[type] = result.next_cost;
                
                if (result.profit_per_tap) state.profitPerTap = result.profit_per_tap;
                if (result.profit_per_hour) state.profitPerHour = result.profit_per_hour;
                if (result.max_energy) {
                    state.maxEnergy = result.max_energy;
                    state.energy = result.max_energy;
                }
                upgraded = true;
            }
        } catch (e) {
            console.error('Upgrade error', type, e);
        }
    }

    upgradeInProgress = false;
    
    if (upgraded) {
        startEnergyRecovery();
        updateUI();
        showAlert('✅ All upgrades completed!');
    } else {
        showAlert('❌ Server error', true);
    }
};

// ==================== MEGA BOOST ====================
const activateMegaBoost = async () => {
    if (!userId) {
        showAlert('❌ Auth error', true);
        return;
    }
    
    const boostBtn = document.getElementById('mega-boost-btn');
    if (boostBtn?.classList.contains('active')) {
        showAlert('⚡ MEGA BOOST already active!', true);
        return;
    }
    
    if (typeof window.show_10655027 !== 'function') {
        showAlert('❌ Ads temporarily unavailable', true);
        return;
    }
    
    try {
        if (boostBtn) boostBtn.classList.add('disabled');
        await window.show_10655027();
        
        const res = await fetch(`${API_URL}/api/activate-mega-boost`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.already_active) {
                showAlert(data.message, true);
            } else {
                showAlert('🔥 ' + data.message);
                activateMegaBoostUI();
                if (data.expires_at) {
                    startMegaBoostTimer(new Date(data.expires_at));
                }
                showMegaBoostEffect();
                await checkMegaBoostStatus();
            }
        }
    } catch (error) {
        console.error('Boost error:', error);
        showAlert('❌ Ad loading failed', true);
    } finally {
        if (boostBtn) boostBtn.classList.remove('disabled');
    }
};

const checkMegaBoostStatus = async () => {
    if (!userId) return;
    try {
        const res = await fetch(`${API_URL}/api/mega-boost-status/${userId}`);
        if (res.ok) {
            const data = await res.json();
            updateMegaBoostUI(data);
        }
    } catch (e) {
        console.error('Boost status error:', e);
    }
};

const updateMegaBoostUI = (boostData) => {
    const boostBtn = document.getElementById('mega-boost-btn');
    const timerEl = document.getElementById('mega-boost-timer');
    if (!boostBtn || !timerEl) return;
    
    if (boostData?.active) {
        boostBtn.classList.add('active');
        timerEl.style.display = 'block';
        startMegaBoostTimer(new Date(boostData.expires_at));
        showBoostIndicator();
    } else {
        boostBtn.classList.remove('active');
        timerEl.style.display = 'none';
        timerEl.textContent = '5:00';
        const indicator = document.querySelector('.mega-boost-indicator');
        if (indicator) indicator.remove();
    }
};

const startMegaBoostTimer = (expiresAt) => {
    if (megaBoostTimer) clearInterval(megaBoostTimer);
    
    const timerEl = document.getElementById('mega-boost-timer');
    const boostBtn = document.getElementById('mega-boost-btn');
    if (!timerEl || !boostBtn) return;
    
    timerEl.style.display = 'block';
    
    megaBoostTimer = setInterval(() => {
        const now = new Date();
        const diff = expiresAt - now;
        
        if (diff <= 0) {
            clearInterval(megaBoostTimer);
            boostBtn.classList.remove('active');
            timerEl.style.display = 'none';
            timerEl.textContent = '5:00';
            const indicator = document.querySelector('.mega-boost-indicator');
            if (indicator) indicator.remove();
            showAlert('⏰ MEGA BOOST ended!', false);
            return;
        }
        
        const totalSeconds = Math.floor(diff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (totalSeconds < 10) {
            timerEl.classList.add('urgent');
        } else {
            timerEl.classList.remove('urgent');
        }
    }, 200);
};

const activateMegaBoostUI = () => {
    showBoostIndicator();
    const boostBtn = document.getElementById('mega-boost-btn');
    if (boostBtn) boostBtn.classList.add('active');
};

const showBoostIndicator = () => {
    const oldIndicator = document.querySelector('.mega-boost-indicator');
    if (oldIndicator) oldIndicator.remove();
    
    const energyContainer = document.querySelector('.energy-bar-container');
    if (energyContainer) {
        const indicator = document.createElement('div');
        indicator.className = 'mega-boost-indicator';
        indicator.innerHTML = '🔥🚀 MEGA BOOST ACTIVE 🚀🔥';
        energyContainer.appendChild(indicator);
    }
};

const showMegaBoostEffect = () => {
    const overlay = document.createElement('div');
    overlay.className = 'mega-boost-overlay';
    overlay.innerHTML = `
        <div class="mega-boost-effect">
            <span class="effect-emoji">🔥🚀</span>
            <span class="effect-text">MEGA BOOST</span>
            <span class="effect-emoji">🚀🔥</span>
            <div class="effect-desc">x2 coins + infinite energy</div>
            <div class="effect-duration">5 minutes</div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2500);
};

// ==================== SETTINGS ====================
const loadSettings = () => {
    try {
        const saved = localStorage.getItem('ryohoSettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            settings.theme = parsed.theme || 'day';
            settings.sound = parsed.sound !== undefined ? parsed.sound : true;
            settings.vibration = parsed.vibration !== undefined ? parsed.vibration : true;
        }
    } catch(e) {}
    
    applyTheme();
    updateSettingsUI();
};

const saveSettings = () => {
    try { localStorage.setItem('ryohoSettings', JSON.stringify(settings)); } catch(e) {}
};

const applyTheme = () => {
    if (settings.theme === 'night') {
        document.body.classList.add('night-mode');
    } else {
        document.body.classList.remove('night-mode');
    }
};

const toggleTheme = () => {
    settings.theme = settings.theme === 'day' ? 'night' : 'day';
    saveSettings();
    applyTheme();
    updateSettingsUI();
};

const toggleSound = () => {
    settings.sound = !settings.sound;
    saveSettings();
    updateSettingsUI();
    if (settings.sound) {
        const audio = new Audio('pop.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    }
};

const toggleVibration = () => {
    settings.vibration = !settings.vibration;
    saveSettings();
    updateSettingsUI();
    if (settings.vibration && navigator.vibrate) navigator.vibrate(50);
};

const vibrateClick = () => {
    if (!settings.vibration) return;
    try {
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        else if (navigator.vibrate) navigator.vibrate(20);
    } catch (e) {}
};

const openSettings = () => document.getElementById('settings-screen')?.classList.add('active');
const closeSettings = () => document.getElementById('settings-screen')?.classList.remove('active');
const closeSettingsOutside = (e) => {
    const box = document.getElementById('settings-modal-box');
    if (box && !box.contains(e.target)) closeSettings();
};

const updateSettingsUI = () => {
    const isNight = settings.theme === 'night';
    const soundOn = settings.sound;
    const vibOn = settings.vibration;
    
    setToggle('themeTrack', 'themeThumb', isNight);
    setEl('themeIcon', isNight ? '🌙' : '☀️');
    setEl('themeLabel', isNight ? 'Night' : 'Day');
    
    setToggle('soundTrack', 'soundThumb', soundOn);
    setEl('soundIcon', soundOn ? '🔊' : '🔇');
    setEl('soundLabel', soundOn ? 'On' : 'Off');
    
    setToggle('vibTrack', 'vibThumb', vibOn);
    setEl('vibIcon', vibOn ? '📳' : '📴');
    setEl('vibLabel', vibOn ? 'On' : 'Off');
};

const setToggle = (trackId, thumbId, active) => {
    const track = document.getElementById(trackId);
    if (track) active ? track.classList.add('active') : track.classList.remove('active');
};

const setEl = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};

// ==================== REFERRALS ====================
const loadReferralData = async () => {
    if (!userId) return;
    
    try {
        const link = `https://t.me/Ryoho_bot?start=ref_${userId}`;
        const linkEl = document.getElementById('referral-link');
        if (linkEl) linkEl.textContent = link;

        const data = await fetchWithCache(`${API_URL}/api/referral-data/${userId}`, {}, 30000);
        
        const countEl = document.getElementById('referral-count');
        const earnEl = document.getElementById('referral-earnings');
        if (countEl) countEl.textContent = data.count || 0;
        if (earnEl) earnEl.textContent = formatNumber(data.earnings || 0);
        
        userSkins.stats.friendsInvited = data.count || 0;
    } catch (e) {
        console.error('Referral error:', e);
    }
};

const copyReferralLink = () => {
    const linkEl = document.getElementById('referral-link');
    if (!linkEl) return;
    
    const link = linkEl.textContent;
    if (!link || link === 'loading...') {
        showAlert('❌ Link not loaded', true);
        return;
    }
    
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(() => showAlert('✅ Link copied!'));
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        showAlert('✅ Link copied!');
    }
};

const shareReferral = () => {
    const linkEl = document.getElementById('referral-link');
    if (!linkEl) return;
    
    const link = linkEl.textContent;
    if (!link || link === 'loading...') {
        showAlert('❌ Link not loaded', true);
        return;
    }
    
    const text = encodeURIComponent('🎮 Join Ryoho Clicker!');
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`, '_blank');
};

// ==================== TASKS ====================
const loadTasks = async () => {
    if (!userId) return;
    
    try {
        const tasks = await fetchWithCache(`${API_URL}/api/tasks/${userId}`, {}, 10000);
        renderTasks(tasks);
    } catch (e) {
        console.error('Tasks error:', e);
        renderTasks([]);
    }
};

const renderTasks = (tasks) => {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    
    const videoTask = {
        id: "watch_video",
        title: "📺 Watch Video",
        description: "Watch ad and get coins",
        reward: "5000 coins",
        icon: "📺",
        completed: false
    };
    
    const allTasks = [videoTask, ...(tasks || [])];
    
    if (allTasks.length === 0) {
        container.innerHTML = '<div class="loading">No tasks</div>';
        return;
    }
    
    container.innerHTML = allTasks.map(t => {
        if (t.id === 'watch_video') {
            return `
                <div class="task-card">
                    <div class="task-icon">📺</div>
                    <div class="task-info">
                        <div class="task-title">${t.title}</div>
                        <div class="task-desc">${t.description}</div>
                        <div class="task-reward">🎁 ${t.reward}</div>
                    </div>
                    <button class="task-button" onclick="showRewardedVideo()">Watch</button>
                </div>
            `;
        } else {
            return `
                <div class="task-card ${t.completed ? 'completed' : ''}">
                    <div class="task-icon">${t.icon}</div>
                    <div class="task-info">
                        <div class="task-title">${t.title}</div>
                        <div class="task-desc">${t.description}</div>
                        <div class="task-reward">🎁 ${t.reward}</div>
                    </div>
                    ${t.completed 
                        ? '<button class="task-button completed" disabled>✅ Done</button>' 
                        : `<button class="task-button" onclick="completeTask('${t.id}')">Do</button>`}
                </div>
            `;
        }
    }).join('');
};

const completeTask = async (taskId) => {
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/complete-task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, task_id: taskId })
        });
        
        if (res.ok) {
            const data = await res.json();
            showToast(data.message);
            if (data.coins) {
                state.coins = data.coins;
                updateUI();
            }
            loadTasks();
        } else {
            showAlert('❌ Task failed', true);
        }
    } catch (e) {
        console.error('Task error:', e);
        showAlert('❌ Server error', true);
    }
};

// ==================== REWARDED VIDEO ====================
const showRewardedVideo = async () => {
    if (!userId) return;
    
    if (typeof window.show_10655027 !== 'function') {
        showAlert('❌ Ads unavailable', true);
        return;
    }
    
    try {
        await window.show_10655027();
        
        const res = await fetch(`${API_URL}/api/reward-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (res.ok) {
            const data = await res.json();
            showToast('📺 +5000 coins!');
            state.coins = data.coins;
            userSkins.stats.adsWatched = data.ads_watched;
            updateUI();
            checkSkinUnlockByAds();
        }
    } catch (error) {
        console.error('Video error:', error);
        showAlert('❌ Ad failed', true);
    }
};

const showRewardedVideoForSkin = async (skinId, event) => {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (!userId) return false;
    
    if (typeof window.show_10655027 !== 'function') {
        showAlert('❌ Ads unavailable', true);
        return false;
    }
    
    try {
        await window.show_10655027();
        
        const res = await fetch(`${API_URL}/api/reward-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (res.ok) {
            const data = await res.json();
            state.coins = data.coins;
            userSkins.stats.adsWatched = data.ads_watched;
            updateUI();
            showToast('📺 +5000 coins!');

            const skin = getSkinById(skinId);
            if (skin?.requirement?.type === 'ads' && 
                userSkins.stats.adsWatched >= skin.requirement.count) {
                await unlockSkin(skinId, 'ads');
            }
            
            if (document.getElementById('skins-screen')?.classList.contains('active')) {
                renderSkins();
            }
            return true;
        }
    } catch (error) {
        console.error('Video error:', error);
        showAlert('❌ Ad failed', true);
    }
    return false;
};

const checkSkinUnlockByAds = () => {
    skinsData.forEach(skin => {
        if (skin.requirement?.type === 'ads' && !userSkins.owned.includes(skin.id)) {
            if (userSkins.stats.adsWatched >= skin.requirement.count) {
                unlockSkin(skin.id, 'ads');
            }
        }
    });
};

// ==================== PASSIVE INCOME ====================
const checkOfflinePassiveIncome = async () => {
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/passive-income`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.income > 0) {
                state.coins = data.coins;
                updateUI();
                showToast(`💰 +${data.income} coins (offline income)!`);
            }
        }
    } catch (e) {
        console.error('Passive income error:', e);
    }
};

setInterval(async () => {
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/passive-income`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.income > 0) {
                state.coins = data.coins;
                updateUI();
                showToast(data.message);
            }
        }
    } catch (e) {
        console.error('Passive income error:', e);
    }
}, PASSIVE_INCOME_INTERVAL);

// ==================== SKINS ====================
function getSkinById(skinId) {
    return skinsData.find(s => s.id === skinId);
}

function getRarityName(rarity) {
    const names = { common: 'Обычный', rare: 'Редкий', legendary: 'Легендарный', super: 'Супер редкий' };
    return names[rarity] || rarity;
}

function isSkinUnlocked(skin) {
    if (userSkins.owned.includes(skin.id)) return true;
    
    const req = skin.requirement;
    if (!req) return false;
    
    if (req.type === 'free') return true;
    if (req.type === 'ads') return userSkins.stats.adsWatched >= req.count;
    if (req.type === 'special') {
        if (skin.id === 'King_SP') return userSkins.stats.friendsInvited >= 50;
        if (skin.id === 'Shadow_SP') return state.globalLevel >= 100;
    }
    return false;
}

function getSkinProgress(skin) {
    const req = skin.requirement;
    if (!req) return 0;
    
    if (req.type === 'ads' && req.count) {
        return Math.min(userSkins.stats.adsWatched, req.count);
    }
    if (req.type === 'special') {
        if (skin.id === 'King_SP') return Math.min(userSkins.stats.friendsInvited, 50);
        if (skin.id === 'Shadow_SP') return Math.min(state.globalLevel, 100);
    }
    return 0;
}

async function unlockSkin(skinId, method = 'ads') {
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/unlock-skin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, skin_id: skinId, method })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                userSkins.owned = data.owned_skins;
                userSkins.selected = data.selected_skin;
                showToast('✅ Новый скин разблокирован!');
                
                if (document.getElementById('skins-screen')?.classList.contains('active')) {
                    renderSkins();
                }
                applySavedSkin();
            }
        }
    } catch (e) {
        console.error('Unlock skin error:', e);
    }
}

async function selectActiveSkin(skinId) {
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/select-skin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, skin_id: skinId })
        });
        
        if (res.ok) {
            const data = await res.json();
            userSkins.selected = data.selected_skin;
            applySavedSkin();
            
            if (document.getElementById('skins-screen')?.classList.contains('active')) {
                renderSkins();
            }
            showToast(`✨ Скин выбран!`);
        }
    } catch (e) {
        console.error('Select skin error:', e);
    }
}

function applySavedSkin() {
    const clickImage = document.querySelector('.click-image');
    if (!clickImage) return;
    
    const skin = getSkinById(userSkins.selected);
    if (skin) {
        clickImage.src = skin.image + '?t=' + Date.now();
        clickImage.onerror = () => {
            clickImage.src = 'imgg/clickimg.png';
        };
    } else {
        clickImage.src = 'imgg/clickimg.png';
    }
}

function openSkins() {
    loadSkinsList().then(() => {
        renderSkins();
        openModal('skins-screen');
    });
}

function renderSkins(filter = 'all') {
    const grid = document.getElementById('skins-grid');
    if (!grid) return;
    
    let filteredSkins = skinsData;
    if (filter !== 'all') {
        filteredSkins = skinsData.filter(s => s.rarity === filter);
    }
    
    grid.innerHTML = filteredSkins.map(skin => {
        const unlocked = isSkinUnlocked(skin);
        const owned = userSkins.owned.includes(skin.id);
        const selected = userSkins.selected === skin.id;
        const progress = getSkinProgress(skin);
        const req = skin.requirement;

        let requirementText = '';
        let progressPercent = 0;
        let actionButton = '';

        if (!unlocked && req) {
            if (req.type === 'ads' && req.count) {
                progressPercent = (progress / req.count) * 100;
                requirementText = `<div class="requirement-item">📺 ${progress}/${req.count}</div>`;
                actionButton = `<button class="skin-video-btn" onclick="showRewardedVideoForSkin('${skin.id}', event)">📺 Смотреть</button>`;
            } else if (req.type === 'special') {
                progressPercent = (progress / req.total) * 100;
                requirementText = `<div class="requirement-item">🎯 ${progress}/${req.total}</div>`;
            } else if (req.type === 'cpa') {
                actionButton = `<button class="skin-cpa-btn" onclick="completeCPASkinFor('${skin.id}', event)">🔗 Перейти</button>`;
            }
        } else if (unlocked && !owned) {
            actionButton = `<button class="skin-unlock-btn" onclick="unlockSkin('${skin.id}', 'ads')">🎁 Получить</button>`;
        } else if (owned && !selected) {
            actionButton = `<button class="skin-select-btn" onclick="selectActiveSkin('${skin.id}')">Выбрать</button>`;
        } else if (owned && selected) {
            actionButton = `<div class="skin-selected-badge">✓ Выбран</div>`;
        }

        return `
            <div class="skin-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}" onclick="selectSkin('${skin.id}')">
                ${!unlocked ? '<div class="skin-lock">🔒</div>' : ''}
                <div class="skin-image">
                    <img src="${skin.image}" alt="${skin.name}" onerror="this.src='imgg/clickimg.png'">
                </div>
                <div class="skin-name">${skin.name}</div>
                <div class="skin-rarity ${skin.rarity}">${getRarityName(skin.rarity)}</div>
                <div class="skin-description">${skin.description}</div>
                ${requirementText ? `<div class="skin-requirements">${requirementText}</div>` : ''}
                ${!unlocked && progressPercent > 0 ? `
                    <div class="skin-progress-bar">
                        <div class="skin-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                ` : ''}
                ${actionButton ? `<div class="skin-action">${actionButton}</div>` : ''}
            </div>
        `;
    }).join('');
}

function selectSkin(skinId) {
    const skin = getSkinById(skinId);
    if (!skin) return;
    
    const unlocked = isSkinUnlocked(skin);
    const owned = userSkins.owned.includes(skin.id);
    
    if (owned) {
        selectActiveSkin(skin.id);
    } else if (unlocked) {
        unlockSkin(skin.id, 'ads');
    } else {
        showAlert(`❌ Скин "${skin.name}" еще не разблокирован!`, true);
    }
}

function filterSkins(category, event) {
    document.querySelectorAll('.skin-category').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    renderSkins(category);
}

function completeCPASkinFor(skinId, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    
    const skin = getSkinById(skinId);
    if (!skin?.requirement?.url) return;
    
    window.open(skin.requirement.url, '_blank');
    showToast('✅ Переход выполнен! Скин будет разблокирован после подтверждения');
    
    setTimeout(async () => {
        if (!userSkins.owned.includes(skin.id)) {
            await unlockSkin(skin.id, 'cpa');
        }
    }, 5000);
}

// ==================== MINI-GAMES ====================
const openGame = (game) => {
    document.querySelectorAll('.game-modal').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.add('active');
};

const closeGame = (game) => {
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.remove('active');
};

const toggleNumberInput = () => {
    const betType = document.getElementById('wheel-color')?.value;
    const numberInput = document.getElementById('wheel-number');
    if (numberInput) numberInput.style.display = betType === 'number' ? 'block' : 'none';
};

const playCoinflip = async () => {
    const betInput = document.getElementById('coin-bet');
    if (!betInput) return;
    
    const bet = parseInt(betInput.value);
    if (bet > state.coins) { showAlert('❌ Not enough coins', true); return; }
    if (bet < 10) { showAlert('❌ Min bet 10', true); return; }

    const resultEl = document.getElementById('coin-result');
    resultEl.textContent = '🪙 Flipping...';
    
    const coin = document.getElementById('coin');
    coin.classList.add('flipping');
    
    setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/api/game/coinflip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, bet })
            });
            const data = await res.json();
            coin.classList.remove('flipping');
            resultEl.textContent = data.message;
            state.coins = data.coins;
            updateUI();
        } catch {
            coin.classList.remove('flipping');
            resultEl.textContent = '❌ Error';
        }
    }, 1500);
};

const playSlots = async () => {
    const betInput = document.getElementById('slots-bet');
    if (!betInput) return;
    
    const bet = parseInt(betInput.value);
    if (bet > state.coins) { showAlert('❌ Not enough coins', true); return; }
    if (bet < 10) { showAlert('❌ Min bet 10', true); return; }

    const resultEl = document.getElementById('slots-result');
    resultEl.textContent = '🎰 Spinning...';
    
    const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎'];
    const slot1 = document.getElementById('slot1');
    const slot2 = document.getElementById('slot2');
    const slot3 = document.getElementById('slot3');
    
    let spins = 0;
    const maxSpins = 10;
    
    const interval = setInterval(() => {
        slot1.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        slot2.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        slot3.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(interval);
            
            fetch(`${API_URL}/api/game/slots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, bet })
            })
            .then(res => res.json())
            .then(data => {
                slot1.textContent = data.slots[0];
                slot2.textContent = data.slots[1];
                slot3.textContent = data.slots[2];
                resultEl.textContent = data.message;
                state.coins = data.coins;
                updateUI();
            })
            .catch(() => resultEl.textContent = '❌ Error');
        }
    }, 100);
};

const playDice = async () => {
    const betInput = document.getElementById('dice-bet');
    const predSelect = document.getElementById('dice-prediction');
    if (!betInput || !predSelect) return;
    
    const bet = parseInt(betInput.value);
    const pred = predSelect.value;
    
    if (bet > state.coins) { showAlert('❌ Not enough coins', true); return; }
    if (bet < 10) { showAlert('❌ Min bet 10', true); return; }

    const resultEl = document.getElementById('dice-result');
    resultEl.textContent = '🎲 Rolling...';
    
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    
    let spins = 0;
    const maxSpins = 15;
    
    const interval = setInterval(() => {
        dice1.textContent = diceFaces[Math.floor(Math.random() * 6)];
        dice2.textContent = diceFaces[Math.floor(Math.random() * 6)];
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(interval);
            
            fetch(`${API_URL}/api/game/dice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, bet, prediction: pred })
            })
            .then(res => res.json())
            .then(data => {
                dice1.textContent = diceFaces[data.dice1-1];
                dice2.textContent = diceFaces[data.dice2-1];
                resultEl.textContent = data.message;
                state.coins = data.coins;
                updateUI();
            })
            .catch(() => resultEl.textContent = '❌ Error');
        }
    }, 70);
};

const playWheel = async () => {
    const betInput = document.getElementById('wheel-bet');
    const betType = document.getElementById('wheel-color').value;
    const betNumber = document.getElementById('wheel-number')?.value;
    
    if (!betInput) return;
    const bet = parseInt(betInput.value);
    
    if (bet > state.coins) { showAlert('❌ Not enough coins', true); return; }
    if (bet < 10) { showAlert('❌ Min bet 10', true); return; }

    const resultEl = document.getElementById('wheel-result');
    resultEl.textContent = '🎡 Spinning...';
    
    const wheel = document.getElementById('wheel');
    
    let spins = 0;
    const maxSpins = 20;
    
    const spinInterval = setInterval(() => {
        wheel.textContent = Math.floor(Math.random() * 37);
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            
            fetch(`${API_URL}/api/game/roulette`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    bet: bet,
                    bet_type: betType,
                    bet_value: betType === 'number' ? parseInt(betNumber) : null
                })
            })
            .then(res => res.json())
            .then(data => {
                wheel.textContent = data.result_number;
                resultEl.textContent = data.message;
                state.coins = data.coins;
                updateUI();
            })
            .catch(() => resultEl.textContent = '❌ Error');
        }
    }, 100);
};

// ==================== NAVIGATION ====================
const openModal = (modalId) => {
    document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
};

const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
};

const switchTab = (tab, el) => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');
    
    if (tab === 'main') return;
    
    const modalId = `${tab}-screen`;
    openModal(modalId);
    
    if (tab === 'friends') loadReferralData();
    if (tab === 'tasks') loadTasks();
    if (tab === 'skins') openSkins();
};

// ==================== INITIALIZATION ====================
if (userId) {
    loadUserData();
    loadReferralData();
} else {
    const saved = localStorage.getItem('ryohoGame');
    if (saved) {
        try { Object.assign(state, JSON.parse(saved)); } catch(e) {}
    }
    updateUI();
}

window.addEventListener('beforeunload', () => {
    localStorage.setItem('ryohoLastVisit', Date.now().toString());
    if (!userId) {
        localStorage.setItem('ryohoGame', JSON.stringify(state));
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    applySavedSkin();
});

// ==================== GLOBAL FUNCTIONS ====================
window.state = state;
window.handleTap = handleTap;
window.upgradeBoost = upgradeBoost;
window.upgradeAll = upgradeAll;
window.openGame = openGame;
window.closeGame = closeGame;
window.playCoinflip = playCoinflip;
window.playSlots = playSlots;
window.playDice = playDice;
window.playWheel = playWheel;
window.toggleNumberInput = toggleNumberInput;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.copyReferralLink = copyReferralLink;
window.shareReferral = shareReferral;
window.completeTask = completeTask;
window.showRewardedVideo = showRewardedVideo;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.closeSettingsOutside = closeSettingsOutside;
window.toggleTheme = toggleTheme;
window.toggleSound = toggleSound;
window.toggleVibration = toggleVibration;
window.activateMegaBoost = activateMegaBoost;
window.showRewardedVideoForSkin = showRewardedVideoForSkin;
window.selectActiveSkin = selectActiveSkin;
window.filterSkins = filterSkins;
window.selectSkin = selectSkin;
window.getSkinById = getSkinById;
window.openSkins = openSkins;
window.completeCPASkinFor = completeCPASkinFor;
window.state = state;
window.handleTap = handleTap;
window.recoverEnergy = recoverEnergy;  // ← ДОБАВЬ ЭТУ СТРОКУ
window.upgradeBoost = upgradeBoost;
window.upgradeAll = upgradeAll;

console.log('✅ Ryoho Clicker fully initialized with new architecture');