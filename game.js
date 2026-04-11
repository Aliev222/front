// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
window.API_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://127.0.0.1:8001'
    : 'https://ryoho.onrender.com';
window.recoveryInterval = null;

'use strict';

const DEBUG = false;
const DEBUG_LOGS_ENABLED = DEBUG;
const APP_BOOT_TS = performance.now();
const DEBUG_BOOT = {
    appStarted: false,
    firstInteractiveLogged: false,
    firstHydrationLogged: false
};
const ENABLE_MOTION_TILT = false;

function debugLog(prefix, message, payload = null) {
    if (!DEBUG_LOGS_ENABLED) return;
    if (payload === null || payload === undefined) {
        console.log(`[${prefix}] ${message}`);
        return;
    }
    console.log(`[${prefix}] ${message}`, payload);
}

function debugError(prefix, message, error) {
    if (!DEBUG_LOGS_ENABLED) return;
    console.error(`[${prefix}] ${message}`, error);
}

function debugPerfStart(scope, label, payload = null) {
    const startedAt = performance.now();
    debugLog(scope, `${label} start`, payload);
    return (ok = true, extra = null) => {
        const durationMs = Math.round(performance.now() - startedAt);
        debugLog(scope, `${label} ${ok ? 'success' : 'fail'} ${durationMs}ms`, extra);
    };
}

window.addEventListener('error', (event) => {
    debugError('error', 'window error', {
        message: event?.message,
        source: event?.filename,
        line: event?.lineno,
        column: event?.colno,
        error: event?.error?.stack || String(event?.error || '')
    });
});

window.addEventListener('unhandledrejection', (event) => {
    debugError('error', 'unhandledrejection', event?.reason);
});
debugLog('perf', 'app start', { t0Ms: Math.round(APP_BOOT_TS) });

let hasUserGesture = false;
function markUserGesture() {
    hasUserGesture = true;
}
document.addEventListener('pointerdown', markUserGesture, { capture: true, passive: true });
document.addEventListener('touchstart', markUserGesture, { capture: true, passive: true });
document.addEventListener('keydown', markUserGesture, { capture: true });

function getAudioContextForSfx() {
    if (!State.settings.sound || !hasUserGesture) return null;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!window.audioCtx) {
        try {
            window.audioCtx = new AudioContextCtor();
        } catch (_) {
            return null;
        }
    }
    if (window.audioCtx.state === 'suspended') {
        window.audioCtx.resume().catch(() => {});
    }
    return window.audioCtx;
}

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    API_URL: window.API_URL,
    CLICK_BATCH_INTERVAL: 5000,
    CLICK_BATCH_FLUSH_THRESHOLD: 500,
    CLICK_BATCH_MAX_WAIT_MS: 60000,
    CLICK_BATCH_IDLE_FLUSH_MS: 300,
    ENERGY_RECHARGE_INTERVAL: 1000,
    PASSIVE_INCOME_INTERVAL: 300000,
    PASSIVE_INCOME_MIN_GAP_MS: 300000,
    CACHE_TTL: 30000,
    ENERGY_SYNC_INTERVAL_MS: 60000,
    ENERGY_SYNC_INTERVAL_LITE_MS: 90000,
    ONLINE_HEARTBEAT_INTERVAL_MS: 120000,
    ONLINE_COUNT_REFRESH_INTERVAL_MS: 120000,
    CRASH_SYNC_INTERVAL_MS: 1200
};

window.CONFIG = CONFIG;

// ==================== TELEGRAM INIT ====================
const tg = window.Telegram?.WebApp;
let userId = null;
let username = null;
let referrerId = null;
const OWNER_ONLINE_COUNTER_USER_ID = 1507124181;
const telegramInitData = tg?.initData || '';
const telegramPlatform = (tg?.platform || '').toLowerCase();
const telegramLanguage = (tg?.initDataUnsafe?.user?.language_code || navigator.language || 'en').toLowerCase();
const savedSettings = (() => {
    try {
        return JSON.parse(localStorage.getItem('ryohoSettings') || '{}') || {};
    } catch (_) {
        return {};
    }
})();
let UI_LANG = normalizeUiLanguage(savedSettings.language || telegramLanguage || 'en');
const API_SESSION_TOKEN_KEY = 'spirit_api_session_token';
const API_SESSION_EXPIRES_AT_KEY = 'spirit_api_session_expires_at';
const AD_COOLDOWNS_STORAGE_KEY = 'spirit_ad_cooldowns';
let apiSessionToken = localStorage.getItem(API_SESSION_TOKEN_KEY) || '';
let apiSessionExpiresAt = parseInt(localStorage.getItem(API_SESSION_EXPIRES_AT_KEY) || '0', 10) || 0;
let apiSessionRefreshPromise = null;
let adsgramController = null;
let adsgramInitializedBlockId = '';
const TON_CONNECT_MANIFEST_URL = /^https?:/i.test(window.location?.origin || '')
    ? `${window.location.origin}/tonconnect-manifest.json`
    : 'https://spirix.vercel.app/tonconnect-manifest.json';
let tonConnectUI = null;
let tonWalletState = {
    connected: false,
    verified: false,
    address: '',
    masked_address: '',
    provider: '',
    app_name: '',
    connected_at: null,
    verification_error: ''
};
let tonProofPayloadState = {
    value: '',
    expiresAt: 0
};
let tasksHubTab = 'tasks';
let pendingTonWalletNotice = null;
const TELEGRAM_BOT_USERNAME = 'Ryoho_bot';

function normalizeUiLanguage(value) {
    return String(value || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function isLikelyMobileGameClient() {
    const ua = navigator.userAgent || '';
    const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
    const isDesktopUa = /(Windows NT|Macintosh|X11|CrOS|Linux x86_64)/i.test(ua) && !/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const mobilePlatforms = new Set(['android', 'ios', 'ipados']);
    const desktopPlatforms = new Set(['tdesktop', 'weba', 'webk', 'web', 'macos', 'windows', 'linux', 'unigram']);

    if (desktopPlatforms.has(telegramPlatform)) return false;
    if (mobilePlatforms.has(telegramPlatform)) return true;

    return hasTouch && isMobileUa && !isDesktopUa;
}

function getMobileAccessState() {
    const isRu = UI_LANG === 'ru';
    if (!tg?.initDataUnsafe?.user || !telegramInitData) {
        return {
            allowed: false,
            title: isRu ? 'Открой через Telegram на телефоне' : 'Open from Telegram on phone',
            text: isRu
                ? 'Эта игра доступна только внутри Telegram на мобильном устройстве.'
                : 'This game is available only inside Telegram on a mobile device.',
        };
    }

    return { allowed: true, title: '', text: '' };
}

const mobileAccessState = getMobileAccessState();

function renderMobileOnlyGate() {
    const botLink = (() => {
        try {
            const urlParams = new URLSearchParams(window.location.search || '');
            const ref = parseInt(urlParams.get('ref') || '', 10) || null;
            return ref
                ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=ref_${ref}`
                : `https://t.me/${TELEGRAM_BOT_USERNAME}`;
        } catch (_) {
            return `https://t.me/${TELEGRAM_BOT_USERNAME}`;
        }
    })();
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=0&data=${encodeURIComponent(botLink)}`;
    document.body.classList.add('device-lock-body');
    document.body.innerHTML = `
        <div class="device-lock-screen">
            <div class="device-lock-card">
                <div class="device-lock-kicker">Spirit Clicker</div>
                <h1>Game is available only on phone</h1>
                <p>Open <strong>@${TELEGRAM_BOT_USERNAME}</strong> in Telegram on your phone or scan the QR code below.</p>
                <div class="device-lock-qr-wrap">
                    <img class="device-lock-qr" src="${qrSrc}" alt="QR code to open @${TELEGRAM_BOT_USERNAME}">
                </div>
                <div class="device-lock-handle">@${TELEGRAM_BOT_USERNAME}</div>
                <a class="device-lock-link" href="${botLink}" target="_blank" rel="noopener noreferrer">Open bot</a>
            </div>
        </div>
    `;
}

const I18N = {
    en: {
        common: {
            loading: 'Loading...',
            on: 'On',
            off: 'Off',
            day: 'Day',
            night: 'Night',
            english: 'English',
            russian: 'Russian',
            player: 'Player',
            score: 'Score',
            online: 'Online',
            perHour: 'per hour',
            perTap: 'per tap',
            claim: 'Claim',
            equip: 'Equip',
            cancel: 'Cancel',
            select: 'Select',
            closeHint: 'Tap outside the window to close',
            claimFree: 'Free',
            bonusIncome: 'Bonus: +50% income'
        },
        nav: { main: 'Main', friends: 'Friends', tasks: 'Tasks', daily: 'Reward', wallet: 'Wallet', games: 'Event', skins: 'Skins', achievements: 'Achievements' },
        main: { upgrade: 'Upgrade' },
        friends: {
            title: 'Friends',
            invited: 'Invited',
            earned: 'Earned',
            referralLink: 'Your referral link',
            copyLink: 'Copy link',
            share: 'Share',
            shareText: 'Join Spirit Clicker!',
            bonuses: 'Bonuses',
            bonus1: 'Invite 1 friend — +25000 coins',
            bonus2: 'Friend income share — 5% forever',
            bonus3: 'First invited friend — special skin',
            bonus4: 'Referral income limit — 50000 per day'
        },
        tasks: {
            title: 'Tasks',
            kicker: 'Daily Boosts',
            heroTitle: 'Ad rewards with premium drops',
            heroSubtitle: 'Fast tasks, glowing payouts, instant dopamine.',
            heroLabel: 'Ghost Pass',
            heroValue: 'Hot Loot',
            readyNow: 'Ready now',
            cooldown: 'Cooldown',
            instantReward: 'Instant reward after watch',
            refreshIn: 'Refresh in {time} min',
            watch: 'Watch',
            locked: 'Locked',
            launchReward: 'Launch ad reward',
            rechargeRunning: 'Recharge running',
            liveReward: 'Live reward',
            coinsSuffix: 'coins'
        },
        daily: {
            title: 'Daily Rewards',
            subtitle: 'Login streak',
            ready: 'Claim reward',
            wait: 'Come back tomorrow',
            todayClaimed: 'Today reward has already been claimed.',
            nextReward: 'Next reward is day {day}.',
            day: 'Day {day}',
            coins: 'Coins',
            infiniteEnergy: 'Infinite energy',
            infiniteEnergyDesc: '10 minutes',
            finalTitle: 'Day 30 reward',
            finalName: 'Exclusive skin',
            finalDesc: 'Log in for all 30 days to unlock the final skin bonus.'
        },
        games: {
            title: 'Event',
            kicker: 'Weekly Prize Clash',
            heroTitle: 'Climb your league and enter the payout zone.',
            heroSubtitle: 'Only click-earned coins count. Finish inside top 50 to stay eligible.',
            drawerTab: 'Prize',
            drawerKicker: 'Weekly Prize Pool',
            drawerTitle: 'Current fund',
            drawerSeason: 'Season',
            drawerEnds: 'Ends in',
            drawerLeagues: 'League Distribution',
            drawerRewards: 'Top Rewards',
            drawerPlayer: 'Your Tournament Status',
            drawerLeague: 'League',
            drawerRank: 'Rank',
            drawerStatus: 'Status',
            drawerFootnote: 'Final reward depends on your final rank and payout eligibility.',
            leaderboardTitle: 'Leaderboard',
            finalTonTitle: 'Final TON',
            tabRules: 'Rules',
            tabLeaderboard: 'Leaderboard',
            potential: 'Ends in',
            tapToPlay: 'Weekly leagues',
            pullReels: 'Top 50 payouts',
            rollIt: 'Click coins only',
            spinNow: 'Live ranking',
            openBox: 'Level-based tiers',
            chaseMultiplier: 'Push harder',
            leagueLeaderboard: '{league} leaderboard',
            eventStatusTitle: 'Your event status',
            noWeeklyClicks: 'No weekly clicks yet',
            yourLeague: 'Your league',
            yourRank: 'Your rank',
            status: 'Status',
            noPlayersYet: 'No players in this league yet.',
            finalTonWeek: 'TON paid for each place in week {season}',
            finalTonPending: 'TON payouts for each place are shown after the week is finalized',
            finalTonEmpty: 'TON rewards are shown here after the week is finalized.',
            pendingReward: 'Pending',
            zoneStart: 'Start tapping to enter the board',
            zoneReview: 'Review pending',
            zoneTop3: 'Top 3 payout pressure',
            zonePayout: 'In payout zone',
            zoneTop50: 'Inside top 50',
            zonePlacesAway: '{places} places from payout zone',
            walletNoticeTitle: 'Tournament payout is waiting',
            walletNoticeBody: 'You finished in the payout zone, but TON cannot be sent until you connect a wallet.',
            walletNoticeLeague: 'League',
            walletNoticeSeason: 'Season',
            walletNoticeRank: 'Place',
            walletNoticeDeadline: 'Connect within {hours}h or the payout will stay blocked.',
            walletNoticeSent: 'Reminder already sent. Deadline: {date}',
            walletNoticeOpen: 'Open wallet',
            walletNoticeConnect: 'Connect wallet'
        },
        gameModals: {
            betAmount: 'Bet amount',
            numberRange: 'Number 0-36',
            flip: 'Flip',
            spin: 'Spin',
            roll: 'Roll',
            chooseAction: 'Choose an action',
            settings: 'Settings',
            theme: 'Theme',
            language: 'Language',
            sound: 'Sound',
            music: 'Music',
            vibration: 'Vibration'
        },
        wallet: {
            kicker: 'TON Payouts',
            title: 'Wallet',
            sectionTitle: 'TON Wallet',
            connected: 'Connected',
            notConnected: 'Not connected',
            connect: 'Connect Wallet',
            disconnect: 'Disconnect',
            verificationRequired: 'Verification required',
            connectedTitle: 'Automatic TON payouts are enabled for this account',
            disconnectedTitle: 'Connect wallet for automatic TON payouts',
            verificationTitle: 'Connected wallet still needs ownership verification',
            noWallet: 'No wallet connected',
            connectedSub: 'Weekly rewards will be queued to this wallet after season settlement.',
            disconnectedSub: 'Your weekly prize queue will use this address after the season is finalized.',
            verificationSub: 'Reconnect the wallet and approve verification so payouts can use this address safely.'
        },
        skins: {
            title: 'Skin',
            name: 'Skin name',
            description: 'Skin description',
            rarity: 'rarity',
            all: 'All',
            common: 'Common',
            rare: 'Rare',
            legendary: 'Legendary',
            super: 'Super'
        },
        achievements: { title: 'Achievements' }
        ,
        toasts: {
            loadDataError: 'Data loading error',
            authRequired: 'Please sign in',
            adUnavailable: 'Ad unavailable',
            adUnavailableTemp: 'Ad temporarily unavailable',
            adLoading: 'Loading ad...',
            videoLoading: 'Loading video...',
            serverError: 'Server error',
            copyError: 'Copy failed',
            linkNotLoaded: 'Link not loaded',
            linkCopied: 'Link copied!',
            rewardReceived: 'Reward received!',
            watchError: 'Video error',
            notEnoughCoins: 'Need {amount} coins',
            minBet: 'Minimum bet is 10',
            betRequired: 'Enter a bet',
            maxLevel: 'Max level reached',
            upgradeBusy: 'Upgrade is already processing',
            fullUpgradeNoCoins: 'Not enough coins for full upgrade',
            fullUpgradeMax: 'One upgrade is already at max',
            upgradeApplyError: 'Failed to apply upgrades',
            uiError: 'Interface error',
            rouletteNumber: 'Enter a number from 0 to 36',
            skinLocked: 'Skin "{name}" is not unlocked yet!',
            skinSelected: 'Skin selected!',
            skinNew: 'New skin!',
            skinUnlockError: 'Skin unlock error',
            skinSelectError: 'Skin selection error',
            skinAlreadyOwned: 'You already own this skin',
            skinClaimError: 'Claim error',
            skinAdProgress: '+1 video view for skin!',
            adNotConfirmed: 'You did not finish the ad or the reward was not confirmed.',
            starsUnavailable: 'TON payment is not available in this client',
            starsInvoiceError: 'Failed to prepare TON payment',
            starsPending: 'Waiting for TON confirmation',
            starsCancelled: 'Payment cancelled',
            starsFailed: 'TON payment failed',
            starsSuccess: 'TON payment successful',
            boostActive: 'Boost is already active!',
            boostFinished: 'Boost finished',
            megaBoostActivated: 'Boost activated for 3 minutes!',
            autoTapEnabled: 'Auto Tap 2 min',
            autoTapFallback: 'Ad unavailable, auto for 30 sec',
            autoTapError: 'Failed to enable auto',
            charmUpdated: 'Charm updated',
            energyRecovered: 'Energy restored!',
            energyFull: 'Energy fully restored!',
            cooldownsReset: 'Cooldowns reset',
            tonWalletConnected: 'TON wallet connected',
            walletConnectedTitle: 'Wallet connected',
            tonWalletSyncError: 'Failed to sync TON wallet',
            tonWalletUnavailable: 'TON wallet connection is unavailable right now',
            tonWalletOpenError: 'Failed to open TON wallet modal',
            tonWalletDisconnectError: 'Failed to disconnect TON wallet',
            tonWalletVerificationRequired: 'Wallet is connected, but ownership proof is still required',
            leaderboardLoadError: 'Failed to load leaderboard.'
        },
        skinsDyn: {
            noSkins: 'No skins',
            noDescription: 'No description',
            selected: 'SELECTED',
            select: 'SELECT',
            claim: 'CLAIM',
            upgrade: 'UPGRADE',
            watchVideo: 'WATCH VIDEO',
            buy: 'BUY',
            unavailable: 'UNAVAILABLE',
            reqLevel: 'Level {value} required',
            reqWatch: 'Watch {count} videos',
            reqWatchSkin: 'Watch {count} videos for this skin',
            reqTon: 'Buy for {price} TON',
            reqSpecial: 'Special condition',
            noBonus: 'No bonus',
            incomeBonus: 'x{value} income'
        },
        tasksList: {
            tap_surge: { title: 'Tap Surge', description: 'x2 tap income for 5 minutes', tag: 'tap', reward: 'x2 • 5 min' },
            passive_hour: { title: 'Passive Hour', description: 'x2 passive income for 60 minutes', tag: 'passive', reward: 'x2 • 60 min' },
            coin_drop: { title: 'Coin Drop', description: 'Random reward from 200 to 30,000 coins', tag: 'coins', reward: '200-30K' }
        },
        minigames: {
            coinflipSpinning: 'Flipping...',
            coinflipPlayed: 'Played!',
            coinflipWin: 'You won! +{bet}',
            coinflipLose: 'You lost',
            slotsSpinning: 'Spinning...',
            slotsJackpot: 'JACKPOT! +{win}',
            slotsLose: 'Better luck next time',
            diceRolling: 'Rolling...',
            diceWin: 'You won! x{multiplier}',
            diceLose: 'You lost',
            rouletteSpinning: 'Spinning...',
            rouletteWin: 'Landed on {number}. You won x{multiplier}',
            rouletteLose: 'Landed on {number}. You lost',
            luckyPick: 'Pick your box.',
            luckyOpening: 'Opening boxes...',
            luckyBust: 'Bust',
            luckySave: 'Save',
            luckyHit: 'Lucky hit! x{multiplier} +{profit}',
            luckySoft: 'Soft save. You kept {payout} coins.',
            luckyLost: 'Bust. You lost {bet} coins.',
            crashStart: 'Start the round and cash out before the ghost crashes.',
            crashHint: 'Catch the multiplier before it bursts.',
            crashRunning: 'Ghost is running... cash out before the crash.',
            crashStake: 'Crash target hidden. Stake: {bet}',
            crashCashout: 'Cashed out at {multiplier}x',
            crashCashoutResult: 'Ghost paid {payout} coins. Profit: +{profit}',
            crashAt: 'Crash at {multiplier}x',
            crashLost: 'Ghost crashed. You lost {bet} coins.'
        }
    },
    ru: {
        common: {
            loading: 'Загрузка...',
            on: 'Вкл',
            off: 'Выкл',
            day: 'День',
            night: 'Ночь',
            english: 'Английский',
            russian: 'Русский',
            player: 'Игрок',
            score: 'Счёт',
            online: 'Онлайн',
            perHour: 'в час',
            perTap: 'за тап',
            claim: 'Получить',
            equip: 'Надеть',
            cancel: 'Отмена',
            select: 'Выбрать',
            closeHint: 'Нажмите вне окна, чтобы закрыть',
            claimFree: 'Бесплатно',
            bonusIncome: 'Бонус: +50% к доходу'
        },
        nav: { main: 'Главная', friends: 'Друзья', tasks: 'Задания', daily: 'Награда', wallet: 'Кошелёк', games: 'Ивент', skins: 'Скины', achievements: 'Достижения' },
        main: { upgrade: 'Прокачка' },
        friends: {
            title: 'Друзья',
            invited: 'Приглашено',
            earned: 'Заработано',
            referralLink: 'Ваша реферальная ссылка',
            copyLink: 'Копировать',
            share: 'Поделиться',
            shareText: 'Присоединяйся к Spirit Clicker!',
            bonuses: 'Бонусы',
            bonus1: 'Пригласи 1 друга — +25000 монет',
            bonus2: 'Доход с друга — 5% навсегда',
            bonus3: 'Первый приглашённый друг — специальный скин',
            bonus4: 'Лимит дохода с рефералов — 50000 в день'
        },
        tasks: {
            title: 'Задания',
            kicker: 'Ежедневные бусты',
            heroTitle: 'Награды за рекламу с премиум-дропами',
            heroSubtitle: 'Быстрые задания, сочные награды и моментальный дофамин.',
            heroLabel: 'Ghost Pass',
            heroValue: 'Горячий лут',
            readyNow: 'Готово',
            cooldown: 'Кулдаун',
            instantReward: 'Мгновенная награда после просмотра',
            refreshIn: 'Обновление через {time} мин',
            watch: 'Смотреть',
            locked: 'Закрыто',
            launchReward: 'Запустить награду',
            rechargeRunning: 'Идёт перезарядка',
            liveReward: 'Живая награда',
            coinsSuffix: 'монет'
        },
        daily: {
            title: 'Ежедневные награды',
            subtitle: 'Серия входов',
            ready: 'Забрать награду',
            wait: 'Жди завтра',
            todayClaimed: 'Сегодня награда уже получена.',
            nextReward: 'Следующая — день {day}.',
            day: 'День {day}',
            coins: 'Монеты',
            infiniteEnergy: 'Бесконечная энергия',
            infiniteEnergyDesc: '10 минут',
            finalTitle: 'Награда за 30 день',
            finalName: 'Эксклюзивный скин',
            finalDesc: 'Заходи все 30 дней, чтобы открыть финальный бонусный скин.'
        },
        games: {
            title: 'Ивент',
            kicker: 'Еженедельная схватка',
            heroTitle: 'Поднимайся по лиге и заходи в зону выплат.',
            heroSubtitle: 'В зачёт идут только монеты, заработанные кликами. Топ-50 остаётся в гонке.',
            drawerTab: 'Фонд',
            drawerKicker: 'Призовой фонд недели',
            drawerTitle: 'Текущий фонд',
            drawerSeason: 'Сезон',
            drawerEnds: 'До конца',
            drawerLeagues: 'Распределение по лигам',
            drawerRewards: 'Выплаты по местам',
            drawerPlayer: 'Твой турнирный статус',
            drawerLeague: 'Лига',
            drawerRank: 'Ранг',
            drawerStatus: 'Статус',
            drawerFootnote: 'Финальная награда зависит от итогового места и допуска к выплате.',
            leaderboardTitle: 'Лидерборд',
            finalTonTitle: 'Финальный TON',
            tabRules: 'Правила',
            tabLeaderboard: 'Лидерборд',
            potential: 'До конца',
            tapToPlay: 'Еженедельные лиги',
            pullReels: 'Выплаты топ-50',
            rollIt: 'Только клик-монеты',
            spinNow: 'Живой рейтинг',
            openBox: 'Лиги по уровню',
            chaseMultiplier: 'Дави сильнее',
            leagueLeaderboard: 'Лидерборд {league}',
            eventStatusTitle: 'Твой статус в ивенте',
            noWeeklyClicks: 'Пока нет недельных кликов',
            yourLeague: 'Твоя лига',
            yourRank: 'Твой ранг',
            status: 'Статус',
            noPlayersYet: 'В этой лиге пока нет игроков.',
            finalTonWeek: 'TON за каждое место за неделю {season}',
            finalTonPending: 'TON-выплаты за места появятся после завершения недели',
            finalTonEmpty: 'TON-награды появятся здесь после завершения недели.',
            pendingReward: 'Ожидается',
            zoneStart: 'Начни кликать, чтобы попасть в таблицу',
            zoneReview: 'Идёт проверка',
            zoneTop3: 'Давление зоны топ-3',
            zonePayout: 'Ты в зоне выплат',
            zoneTop50: 'Ты внутри топ-50',
            zonePlacesAway: 'До зоны выплат: {places} мест',
            walletNoticeTitle: 'Турнирная выплата ждёт кошелёк',
            walletNoticeBody: 'Ты попал в зону выплат, но TON не отправится, пока не будет подключён кошелёк.',
            walletNoticeLeague: 'Лига',
            walletNoticeSeason: 'Сезон',
            walletNoticeRank: 'Место',
            walletNoticeDeadline: 'Подключи кошелёк в течение {hours} ч, иначе выплата останется заблокированной.',
            walletNoticeSent: 'Напоминание уже отправлено. Дедлайн: {date}',
            walletNoticeOpen: 'Открыть кошелёк',
            walletNoticeConnect: 'Подключить кошелёк'
        },
        gameModals: {
            betAmount: 'Ставка',
            numberRange: 'Число 0-36',
            flip: 'Подбросить',
            spin: 'Крутить',
            roll: 'Бросить',
            chooseAction: 'Выберите действие',
            settings: 'Настройки',
            theme: 'Тема',
            language: 'Язык',
            sound: 'Звуки',
            music: 'Музыка',
            vibration: 'Вибрация'
        },
        wallet: {
            kicker: 'TON выплаты',
            title: 'Кошелёк',
            sectionTitle: 'TON кошелёк',
            connected: 'Подключён',
            notConnected: 'Не подключён',
            connect: 'Подключить кошелёк',
            disconnect: 'Отключить',
            verificationRequired: 'Нужна проверка',
            connectedTitle: 'Автоматические TON-выплаты включены для этого аккаунта',
            disconnectedTitle: 'Подключи кошелёк для автоматических TON-выплат',
            verificationTitle: 'Подключённый кошелёк ещё не подтвердил владение',
            noWallet: 'Кошелёк не подключён',
            connectedSub: 'Недельные награды будут поставлены в очередь на этот кошелёк после завершения сезона.',
            disconnectedSub: 'Твоя недельная очередь выплат будет использовать этот адрес после завершения сезона.',
            verificationSub: 'Подключи кошелёк заново и подтверди проверку, чтобы выплаты ушли на этот адрес безопасно.'
        },
        skins: {
            title: 'Скин',
            name: 'Название скина',
            description: 'Описание скина',
            rarity: 'редкость',
            all: 'Все',
            common: 'Обычные',
            rare: 'Редкие',
            legendary: 'Легендарные',
            super: 'Супер'
        },
        achievements: { title: 'Достижения' },
        toasts: {
            loadDataError: 'Ошибка загрузки данных',
            authRequired: 'Авторизуйтесь',
            adUnavailable: 'Реклама недоступна',
            adUnavailableTemp: 'Реклама временно недоступна',
            adLoading: 'Загружаем рекламу...',
            videoLoading: 'Загружаем видео...',
            serverError: 'Ошибка сервера',
            copyError: 'Ошибка копирования',
            linkNotLoaded: 'Ссылка не загружена',
            linkCopied: 'Ссылка скопирована!',
            rewardReceived: 'Награда получена!',
            watchError: 'Ошибка при просмотре видео',
            notEnoughCoins: 'Нужно {amount} монет',
            minBet: 'Минимальная ставка 10',
            betRequired: 'Введите ставку',
            maxLevel: 'Максимальный уровень достигнут',
            upgradeBusy: 'Улучшение уже обрабатывается',
            fullUpgradeNoCoins: 'Недостаточно монет для полного апгрейда',
            fullUpgradeMax: 'Один из апгрейдов уже на максимуме',
            upgradeApplyError: 'Не удалось применить улучшения',
            uiError: 'Ошибка интерфейса',
            rouletteNumber: 'Введите число от 0 до 36',
            skinLocked: 'Скин "{name}" ещё не открыт!',
            skinSelected: 'Скин выбран!',
            skinNew: 'Новый скин!',
            skinUnlockError: 'Ошибка разблокировки',
            skinSelectError: 'Ошибка выбора скина',
            skinAlreadyOwned: 'Скин уже есть',
            skinClaimError: 'Ошибка получения',
            skinAdProgress: '+1 просмотр для скина!',
            adNotConfirmed: 'Вы не досмотрели рекламу или награда не была подтверждена.',
            starsUnavailable: 'Оплата TON недоступна в этом клиенте',
            starsInvoiceError: 'Не удалось подготовить оплату TON',
            starsPending: 'Ожидаем подтверждение TON',
            starsCancelled: 'Оплата отменена',
            starsFailed: 'Ошибка оплаты TON',
            starsSuccess: 'Оплата TON прошла успешно',
            boostActive: 'Буст уже активен!',
            boostFinished: 'Буст закончился',
            megaBoostActivated: 'Буст активирован на 3 минуты!',
            autoTapEnabled: 'Автокликер на 2 мин',
            autoTapFallback: 'Реклама недоступна, авто на 30 сек',
            autoTapError: 'Не удалось включить авто',
            charmUpdated: 'Брелок обновлен',
            energyRecovered: 'Энергия восстановлена!',
            energyFull: 'Энергия полностью восстановлена!',
            cooldownsReset: 'Кулдауны сброшены',
            tonWalletConnected: 'TON-кошелёк подключён',
            walletConnectedTitle: 'Кошелёк подключён',
            tonWalletSyncError: 'Не удалось синхронизировать TON-кошелёк',
            tonWalletUnavailable: 'Подключение TON-кошелька сейчас недоступно',
            tonWalletOpenError: 'Не удалось открыть окно TON-кошелька',
            tonWalletDisconnectError: 'Не удалось отключить TON-кошелёк',
            tonWalletVerificationRequired: 'Кошелёк подключён, но подтверждение владения ещё не завершено',
            leaderboardLoadError: 'Не удалось загрузить лидерборд.'
        },
        skinsDyn: {
            noSkins: 'Нет скинов',
            noDescription: 'Нет описания',
            selected: 'ВЫБРАН',
            select: 'ВЫБРАТЬ',
            claim: 'ПОЛУЧИТЬ',
            upgrade: 'ПРОКАЧАТЬ',
            watchVideo: 'СМОТРЕТЬ ВИДЕО',
            buy: 'КУПИТЬ',
            unavailable: 'НЕДОСТУПНО',
            reqLevel: 'Требуется уровень {value}',
            reqWatch: 'Посмотри {count} видео',
            reqWatchSkin: 'Посмотри {count} видео для этого скина',
            reqTon: 'Купить за {price} TON',
            reqSpecial: 'Условие: особое',
            noBonus: 'Бонус: нет',
            incomeBonus: 'x{value} к доходу'
        },
        tasksList: {
            tap_surge: { title: 'Тап-рывок', description: 'x2 к тапу на 5 минут', tag: 'тап', reward: 'x2 • 5 мин' },
            passive_hour: { title: 'Пассивный час', description: 'x2 к пассивному доходу на 60 минут', tag: 'пассив', reward: 'x2 • 60 мин' },
            coin_drop: { title: 'Coin Drop', description: 'Случайная награда от 200 до 30 000 монет', tag: 'коины', reward: '200-30K' }
        },
        minigames: {
            coinflipSpinning: 'Подбрасываем...',
            coinflipPlayed: 'Сыграно!',
            coinflipWin: 'Вы выиграли! +{bet}',
            coinflipLose: 'Вы проиграли',
            slotsSpinning: 'Крутим...',
            slotsJackpot: 'ДЖЕКПОТ! +{win}',
            slotsLose: 'Повезет в следующий раз',
            diceRolling: 'Бросаем...',
            diceWin: 'Вы выиграли! x{multiplier}',
            diceLose: 'Вы проиграли',
            rouletteSpinning: 'Крутим...',
            rouletteWin: 'Выпало {number}. Вы выиграли x{multiplier}',
            rouletteLose: 'Выпало {number}. Вы проиграли',
            luckyPick: 'Выбери свой бокс.',
            luckyOpening: 'Открываем боксы...',
            luckyBust: 'Пусто',
            luckySave: 'Сейв',
            luckyHit: 'Удача! x{multiplier} +{profit}',
            luckySoft: 'Мягкий сейв. Ты сохранил {payout} монет.',
            luckyLost: 'Пусто. Ты потерял {bet} монет.',
            crashStart: 'Запусти раунд и успей забрать выигрыш до краша.',
            crashHint: 'Поймай множитель до взрыва.',
            crashRunning: 'Призрак бежит... успей вывести до краша.',
            crashStake: 'Краш скрыт. Ставка: {bet}',
            crashCashout: 'Забрал на {multiplier}x',
            crashCashoutResult: 'Призрак выплатил {payout} монет. Профит: +{profit}',
            crashAt: 'Краш на {multiplier}x',
            crashLost: 'Призрак разбился. Ты потерял {bet} монет.'
        }
    }
};

function t(key, vars = {}) {
    const source = I18N[UI_LANG] || I18N.en;
    const value = key.split('.').reduce((acc, part) => acc?.[part], source) ??
        key.split('.').reduce((acc, part) => acc?.[part], I18N.en) ??
        key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}

const DAILY_REWARD_MAX_DAYS = 30;
const DAILY_REWARD_BASE_COINS = 500;
const DAILY_REWARD_SKIN_ID = 'retro.pngSP';
const GHOST_SPAWN_CHANCE = 0.003;
const GHOST_SPAWN_COOLDOWN_MIN_MS = 8 * 60 * 1000;
const GHOST_SPAWN_COOLDOWN_MAX_MS = 12 * 60 * 1000;
const GHOST_BOOST_MULTIPLIER = 5;
const GHOST_BOOST_DURATION_MS = 60 * 1000;
const MEGA_BOOST_DURATION_MS = 60 * 1000;
const AUTO_CLICK_DURATION_MS = 60 * 1000;
const AUTO_CLICK_INTERVAL_MS = 55;
const AUTO_CLICK_FEEDBACK_INTERVAL_MS = 165;
const AUTO_CLICK_COOLDOWN_STORAGE_KEY = 'autoClickCooldownUntil';
const AUTO_CLICK_COOLDOWN_MIN_MS = 10 * 60 * 1000;
const AUTO_CLICK_COOLDOWN_MAX_MS = 10 * 60 * 1000;
const SKIN_AD_COOLDOWN_MINUTES = 10;
const SOFT_ONBOARDING_STORAGE_KEY = 'softOnboardingState';
const SOFT_DISCOVERY_STORAGE_KEY = 'softOnboardingDiscoveries';
const SOCIAL_TASKS_STORAGE_KEY = 'socialTasksState';
const LEGACY_SKIN_ID_MAP = {
    'referral-special.pngSP': 'refferal.pngSP',
    'daily30.pngSP': 'retro.pngSP',
    'telegram-social.pngSP': 'telega.pngSP',
    'instagram-social.pngSP': 'insta.pngSP',
    'tiktok-social.pngSP': 'tiktok.pngSP'
};
const SOCIAL_TASKS = [
    {
        id: 'telegram_sub',
        name: 'Telegram',
        icon: '✈️',
        image: 'imgg/skins/telega.png',
        colorClass: 'telegram',
        link: 'https://t.me/Spirit_cliker',
        verifyMode: 'telegram'
    },
    {
        id: 'tiktok_sub',
        name: 'TikTok',
        icon: '🎵',
        image: 'imgg/skins/tiktok.png',
        colorClass: 'tiktok',
        link: 'https://www.tiktok.com/@spirit.cliker?_r=1&_t=ZG-94zyH9Al2Fl',
        verifyMode: 'unavailable'
    },
    {
        id: 'instagram_sub',
        name: 'Instagram',
        icon: '📸',
        image: 'imgg/skins/insta.png',
        colorClass: 'instagram',
        link: 'https://www.instagram.com/spirit_cliker/',
        verifyMode: 'unavailable'
    }
];
const ENABLE_CPA_TASKS = false;
const CPA_TASKS = ENABLE_CPA_TASKS ? [
    {
        id: 'cpa_reg_offer_1',
        name: 'Partner Offer A',
        icon: 'ID',
        image: 'imgg/coin.png',
        colorClass: 'cpa',
        link: 'https://example.com/cpa-offer-1',
        reward: 120000,
        rewardLabel: '+120,000 coins',
        title: 'Register in Partner Offer A'
    },
    {
        id: 'cpa_reg_offer_2',
        name: 'Partner Offer B',
        icon: 'ID',
        image: 'imgg/coin.png',
        colorClass: 'cpa',
        link: 'https://example.com/cpa-offer-2',
        reward: 180000,
        rewardLabel: '+180,000 coins',
        title: 'Register in Partner Offer B'
    },
    {
        id: 'cpa_reg_offer_3',
        name: 'Partner Offer C',
        icon: 'ID',
        image: 'imgg/coin.png',
        colorClass: 'cpa',
        link: 'https://example.com/cpa-offer-3',
        reward: 250000,
        rewardLabel: '+250,000 coins',
        title: 'Register in Partner Offer C'
    }
] : [];

function normalizeOwnedSkinIds(owned = []) {
    const validIds = new Set(getLocalSkins().map((skin) => skin.id));
    const normalized = [];
    const seen = new Set();
    (Array.isArray(owned) ? owned : []).forEach((id) => {
        const mapped = LEGACY_SKIN_ID_MAP[id] || id;
        if (!validIds.has(mapped) || seen.has(mapped)) return;
        seen.add(mapped);
        normalized.push(mapped);
    });
    if (!seen.has('default.pngSP')) {
        normalized.unshift('default.pngSP');
    }
    return normalized;
}

function normalizeSelectedSkinId(selectedId, ownedIds) {
    const mapped = LEGACY_SKIN_ID_MAP[selectedId] || selectedId || 'default.pngSP';
    return ownedIds.includes(mapped) ? mapped : 'default.pngSP';
}

function getDisplayLevel(rawLevel) {
    return Math.max(1, Number(rawLevel || 0) + 1);
}

function formatCooldownClock(totalSeconds) {
    const safe = Math.max(0, Math.ceil(totalSeconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function randomIntBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getAdsgramBlockId() {
    return String(window.ADSGRAM_CONFIG?.blockId || '').trim();
}

function isAdsgramReady() {
    return !!(window.Adsgram?.init && getAdsgramBlockId());
}

async function waitForAdsgramReady(timeoutMs = 2500) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (window.Adsgram?.init) {
            return true;
        }
        await sleep(100);
    }
    return false;
}

async function initAdsgramController() {
    console.log(`AD_TRACE_SDK_CHECK window.Adsgram=${!!window.Adsgram} window.Adsgram.init=${!!window.Adsgram?.init}`);
    const blockId = getAdsgramBlockId();
    console.log(`AD_TRACE_BLOCKID blockId=${blockId}`);
    if (!blockId) {
        console.log(`AD_TRACE_BLOCKID_MISSING`);
        throw new Error('Рекламный модуль не настроен');
    }

    if (!window.Adsgram?.init) {
        console.log(`AD_TRACE_SDK_WAIT_START`);
        const ready = await waitForAdsgramReady(2500);
        console.log(`AD_TRACE_SDK_WAIT_END ready=${ready}`);
        if (!ready) {
            console.log(`AD_TRACE_SDK_TIMEOUT`);
            throw new Error('Рекламный модуль ещё загружается, попробуйте ещё раз через пару секунд');
        }
    }

    console.log(`AD_TRACE_SDK_INIT_CALL blockId=${blockId}`);
    if (!adsgramController || adsgramInitializedBlockId !== blockId) {
        adsgramController = window.Adsgram.init({ blockId });
        adsgramInitializedBlockId = blockId;
        console.log(`AD_TRACE_SDK_INIT_NEW controller=${!!adsgramController}`);
    } else {
        console.log(`AD_TRACE_SDK_INIT_CACHED controller=${!!adsgramController}`);
    }

    console.log(`AD_TRACE_SDK_RETURN controller=${!!adsgramController}`);
    return adsgramController;
}

function isTaskTapBoostActive() {
    const expiresAt = parseServerDate(State.temp.taskTapBoostExpiresAt);
    return !!(expiresAt && expiresAt > new Date() && (State.temp.taskTapBoostMultiplier || 1) > 1);
}

function isTaskPassiveBoostActive() {
    const expiresAt = parseServerDate(State.temp.taskPassiveBoostExpiresAt);
    return !!(expiresAt && expiresAt > new Date() && (State.temp.taskPassiveBoostMultiplier || 1) > 1);
}

function applyTaskBoostPayload(data = {}) {
    State.temp.taskTapBoostExpiresAt = data.task_tap_boost_expires_at || State.temp.taskTapBoostExpiresAt || null;
    State.temp.taskTapBoostMultiplier = data.task_tap_boost_multiplier || (data.task_tap_boost_active ? 2 : State.temp.taskTapBoostMultiplier || 1);
    State.temp.taskPassiveBoostExpiresAt = data.task_passive_boost_expires_at || State.temp.taskPassiveBoostExpiresAt || null;
    State.temp.taskPassiveBoostMultiplier = data.task_passive_boost_multiplier || (data.task_passive_boost_active ? 2 : State.temp.taskPassiveBoostMultiplier || 1);

    if (!isTaskTapBoostActive()) {
        State.temp.taskTapBoostExpiresAt = null;
        State.temp.taskTapBoostMultiplier = 1;
    }
    if (!isTaskPassiveBoostActive()) {
        State.temp.taskPassiveBoostExpiresAt = null;
        State.temp.taskPassiveBoostMultiplier = 1;
    }
}

const tr = t;
let adsDomain = null;

if (tg) {
    tg.expand();
    if (typeof tg.disableVerticalSwipes === 'function') {
        try {
            tg.disableVerticalSwipes();
        } catch (error) {
            if (DEBUG) console.warn('disableVerticalSwipes failed:', error);
        }
    } else if ('isVerticalSwipesEnabled' in tg) {
        try {
            tg.isVerticalSwipesEnabled = false;
        } catch (error) {
            if (DEBUG) console.warn('isVerticalSwipesEnabled toggle failed:', error);
        }
    }
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    if (tg.initDataUnsafe?.user) {
        userId = tg.initDataUnsafe.user.id;
        username = tg.initDataUnsafe.user.username || `user_${userId}`;
    }
    
    const startParam = tg.initDataUnsafe?.start_param || '';
    if (startParam?.startsWith('ref_')) {
        referrerId = parseInt(startParam.replace('ref_', '')) || null;
    }
}

if (!referrerId) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refParam = urlParams.get('ref') || urlParams.get('startapp') || '';
        if (refParam.startsWith('ref_')) {
            referrerId = parseInt(refParam.replace('ref_', '')) || null;
        } else if (/^\d+$/.test(refParam)) {
            referrerId = parseInt(refParam, 10) || null;
        }
    } catch (error) {
        if (DEBUG) console.warn('Failed to parse referral params from URL:', error);
    }
}

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const isApiRequest =
        requestUrl.startsWith(CONFIG.API_URL) ||
        requestUrl.startsWith('/api/');

    if (!isApiRequest) {
        return originalFetch(input, init);
    }

    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    headers.set('X-Telegram-Platform', telegramPlatform || 'unknown');
    headers.set('X-Client-Mobile', mobileAccessState.allowed ? '1' : '0');
    if (apiSessionToken && apiSessionExpiresAt > Date.now() + 5000) {
        headers.set('Authorization', `Bearer ${apiSessionToken}`);
    } else if (telegramInitData) {
        headers.set('X-Telegram-Init-Data', telegramInitData);
    }

    return originalFetch(input, {
        ...init,
        headers
    });
};

function persistApiSession(token, expiresAtMs) {
    apiSessionToken = token || '';
    apiSessionExpiresAt = expiresAtMs || 0;
    if (apiSessionToken) {
        localStorage.setItem(API_SESSION_TOKEN_KEY, apiSessionToken);
        localStorage.setItem(API_SESSION_EXPIRES_AT_KEY, String(apiSessionExpiresAt));
    } else {
        localStorage.removeItem(API_SESSION_TOKEN_KEY);
        localStorage.removeItem(API_SESSION_EXPIRES_AT_KEY);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getStoredAdCooldownMap() {
    try {
        const raw = localStorage.getItem(AD_COOLDOWNS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

function setStoredAdCooldownMap(map) {
    localStorage.setItem(AD_COOLDOWNS_STORAGE_KEY, JSON.stringify(map || {}));
}

function getAdCooldownUntilMs(key) {
    const map = getStoredAdCooldownMap();
    const value = Number(map[key] || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function getAdCooldownRemainingMs(key) {
    return Math.max(0, getAdCooldownUntilMs(key) - Date.now());
}

function setAdCooldownUntilMs(key, valueMs) {
    const map = getStoredAdCooldownMap();
    if (valueMs > Date.now()) {
        map[key] = valueMs;
    } else {
        delete map[key];
    }
    setStoredAdCooldownMap(map);
}

function setAdCooldownFromIso(key, isoValue, fallbackMinutes = 0) {
    const parsed = parseServerDate(isoValue);
    if (parsed && !Number.isNaN(parsed.getTime())) {
        setAdCooldownUntilMs(key, parsed.getTime());
        return;
    }
    if (fallbackMinutes > 0) {
        setAdCooldownUntilMs(key, Date.now() + (fallbackMinutes * 60 * 1000));
    }
}

function isRetryableStartupError(err) {
    if (!err) return false;
    if (err.name === 'AbortError' || err.name === 'TypeError') return true;
    if (typeof err.status === 'number' && (err.status >= 500 || err.status === 429)) return true;
    return false;
}

async function runWithRetry(task, attempts = 3, initialDelayMs = 1200) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await task(attempt);
        } catch (err) {
            lastError = err;
            if (attempt >= attempts || !isRetryableStartupError(err)) {
                throw err;
            }
            await sleep(initialDelayMs * attempt);
        }
    }
    throw lastError;
}

async function ensureApiSession(forceRefresh = false) {
    const done = debugPerfStart('perf', 'ensureApiSession', { forceRefresh });
    if (!telegramInitData) {
        done(false, { reason: 'no_telegram_init_data' });
        return null;
    }
    if (!forceRefresh && apiSessionToken && apiSessionExpiresAt > Date.now() + 30000) {
        done(true, { source: 'cache' });
        return apiSessionToken;
    }
    if (apiSessionRefreshPromise) {
        done(true, { source: 'inflight' });
        return apiSessionRefreshPromise;
    }

    apiSessionRefreshPromise = (async () => {
        return runWithRetry(async () => {
            const res = await originalFetch(`${CONFIG.API_URL}/api/auth/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': telegramInitData,
                    'X-Telegram-Platform': telegramPlatform || 'unknown',
                    'X-Client-Mobile': mobileAccessState.allowed ? '1' : '0'
                },
                body: JSON.stringify({}) // Send empty body to satisfy backend
            });
            if (!res.ok) {
                persistApiSession('', 0);
                const text = await res.text().catch(() => '');
                const err = new Error(`Session auth failed: HTTP ${res.status} ${text}`);
                err.status = res.status;
                throw err;
            }
            const data = await res.json();
            const expiresAtMs = Number(data?.expires_at || 0) * 1000;
            persistApiSession(data?.token || '', expiresAtMs);
            return apiSessionToken;
        }, forceRefresh ? 2 : 3, 1500);
    })();

    try {
        const token = await apiSessionRefreshPromise;
        done(true, { hasToken: !!token });
        return token;
    } catch (err) {
        done(false, { error: err?.message });
        throw err;
    } finally {
        apiSessionRefreshPromise = null;
    }
}

// ==================== СОСТОЯНИЕ ====================
const State = window.SpiritStore.createInitialState({
    userId,
    username,
    referrerId,
    savedSettings,
    uiLang: UI_LANG
});
const Store = window.SpiritStore.createStore(State);
let clickDomain = null;
let tapDomain = null;
let tapFeedbackRenderer = null;
let socialTasksDomain = null;
let walletEventUi = null;
let rebirthDomain = null;
let hudUi = null;
let tapAreaUi = null;
let bottomPanelUi = null;
let rebirthPanelUi = null;
let modalLayerUi = null;
const StateActions = {};

window.State = State;
window.state = State;

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function detectLitePerformanceMode() {
    try {
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
        const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
        const smallViewport = Math.min(window.innerWidth, window.innerHeight) <= 430;
        return Boolean(prefersReducedMotion || lowCpu || lowMemory || smallViewport);
    } catch (err) {
        return false;
    }
}

function isLitePerformanceMode() {
    return !!State.temp.performanceLite;
}

function applyPerformanceMode() {
    State.temp.performanceLite = detectLitePerformanceMode();
    document.body.classList.toggle('lite-performance', State.temp.performanceLite);
}

function parseServerDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string' && !/[zZ]|[+\-]\d{2}:\d{2}$/.test(value)) {
        return new Date(`${value}Z`);
    }
    return new Date(value);
}

const formatNumber = (num) => {
    const n = Math.floor(Number(num) || 0);
    return n.toLocaleString('ru-RU'); // 1.000.000 стиль
};

hudUi = window.SpiritHudUi.createHudUi({ formatNumber });
tapAreaUi = window.SpiritTapAreaUi.createTapAreaUi();
bottomPanelUi = window.SpiritBottomPanelUi.createBottomPanelUi({
    formatNumber,
    getDisplayLevel
});
rebirthPanelUi = window.SpiritRebirthPanelUi.createRebirthPanelUi();

const formatTonAmount = (nano) => {
    const value = Number(nano || 0) / 1_000_000_000;
    if (!Number.isFinite(value) || value <= 0) return '0';
    if (value >= 1000) return value.toFixed(0);
    if (value >= 100) return value.toFixed(1);
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(4);
};

function updateTopMetaBar({ fundNano = null, rank = null } = {}) {
    const fundEl = document.getElementById('top-meta-fund-value');
    const rankEl = document.getElementById('top-meta-rank');

    const normalizedFundNano = Number(fundNano);
    const hasFund = Number.isFinite(normalizedFundNano) && normalizedFundNano > 0;
    if (fundEl) fundEl.textContent = hasFund ? `${formatTonAmount(normalizedFundNano)} TON` : '-- TON';

    const normalizedRank = Number(rank);
    if (rankEl) rankEl.textContent = Number.isFinite(normalizedRank) && normalizedRank > 0 ? `#${normalizedRank}` : '#--';
}

const formatUsdFromCents = (cents) => {
    const value = Number(cents || 0) / 100;
    return new Intl.NumberFormat(UI_LANG === 'ru' ? 'ru-RU' : 'en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number.isFinite(value) ? value : 0);
};

function formatDateTimeShort(value) {
    const parsed = parseServerDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) return '';
    return new Intl.DateTimeFormat(UI_LANG === 'ru' ? 'ru-RU' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(parsed);
}

const AMBIENT_TOAST_VARIANTS = [
    {
        icon: '?',
        title: 'Spirit pulse',
        body: () => `${formatNumber(State.game.profitPerHour || 0)} per hour and still climbing.`,
        side: 'left',
        variant: 'info'
    },
    {
        icon: '?',
        title: 'Charge check',
        body: () => State.game.energy < State.game.maxEnergy * 0.28
            ? 'Energy is running thin. One refill and the combo wakes up again.'
            : 'Energy flow feels stable. Keep the tempo alive.',
        side: 'left',
        variant: 'warning'
    },
    {
        icon: '✨',
        title: 'Crew pressure',
        body: () => State.skins.friendsInvited > 0
            ? `Your ${State.skins.friendsInvited} friend${State.skins.friendsInvited > 1 ? 's are' : ' is'} boosting the run.`
            : 'Invite one friend and the squad buffs begin.',
        side: 'right',
        variant: 'reward'
    },
    {
        icon: '✨',
        title: 'Strange signal',
        body: () => 'A ghost just audited your taps and said nothing. Bad sign. Good omen.',
        side: 'right',
        variant: 'weird',
        rare: true
    },
    {
        icon: '✨',
        title: 'Soft static',
        body: () => 'The screen whispered back. Tap slower and it whispers louder.',
        side: 'left',
        variant: 'weird',
        rare: true
    },
    {
        icon: '✨',
        title: 'Focus line',
        body: () => State.game.level > 0
            ? `Level ${getDisplayLevel(State.game.level)} already looks dangerous. Keep stacking clean taps.`
            : 'The first levels come fast. Build momentum before the grind settles.',
        side: 'right',
        variant: 'info'
    }
];

const IDLE_TOAST_VARIANTS = [
    {
        icon: '✨',
        title: 'Quiet mode',
        body: 'You went silent for a minute. The spirit is waiting for the next combo.',
        side: 'left',
        variant: 'info'
    },
    {
        icon: '✨',
        title: 'Stillness',
        body: 'No taps for 60 seconds. Even ghosts started wondering if you left.',
        side: 'right',
        variant: 'weird'
    },
    {
        icon: '?',
        title: 'Wake the run',
        body: 'One clean tap and the whole loop starts breathing again.',
        side: 'left',
        variant: 'warning'
    }
];

const FAST_TAP_TOAST_VARIANTS = [
    {
        icon: '?',
        title: 'Fast hands',
        body: 'Whoa. You are tapping way faster than normal.',
        side: 'right',
        variant: 'reward'
    },
    {
        icon: '✨',
        title: 'Combo pace',
        body: 'That speed is nasty. Keep that rhythm alive.',
        side: 'left',
        variant: 'reward'
    },
    {
        icon: '✨',
        title: 'Tap burst',
        body: 'You just spiked the tempo hard.',
        side: 'right',
        variant: 'info'
    }
];

function ensureToastLayer() {
    if (State.temp.toastLayerReady && document.getElementById('toast-hud')) {
        return;
    }

    const hud = document.createElement('div');
    hud.id = 'toast-hud';
    hud.innerHTML = `
        <div class="toast-stack toast-stack-left" data-side="left"></div>
        <div class="toast-stack toast-stack-right" data-side="right"></div>
    `;
    document.body.appendChild(hud);
    State.temp.toastLayerReady = true;
    updateToastViewportOffset();
}

function updateToastViewportOffset() {
    const header = document.querySelector('.header');
    const hud = document.getElementById('toast-hud');
    if (!hud || !header) return;

    const headerRect = header.getBoundingClientRect();
    const topOffset = Math.max(72, Math.round(headerRect.bottom + 22));
    document.documentElement.style.setProperty('--toast-top-offset', `${topOffset}px`);
}

function escapeToastText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildToastMarkup({
    title = '',
    body = '',
    icon = '?',
    actionLabel = '',
    variant = 'info',
    side = 'left'
}) {
    return `
        <div class="spirit-toast__ink spirit-toast__ink-${variant}"></div>
        <div class="spirit-toast__icon">${escapeToastText(icon)}</div>
        <div class="spirit-toast__body">
            ${title ? `<div class="spirit-toast__title">${escapeToastText(title)}</div>` : ''}
            <div class="spirit-toast__text">${escapeToastText(body)}</div>
        </div>
        ${actionLabel ? `<button class="spirit-toast__action">${escapeToastText(actionLabel)}</button>` : ''}
        <div class="spirit-toast__tail spirit-toast__tail-${side}"></div>
    `;
}

function clearToastCooldown(key) {
    if (!key) return;
    delete State.temp.toastCooldowns[key];
}

function showToast(msg, isError = false, options = {}) {
    ensureToastLayer();
    updateToastViewportOffset();

    const normalized = typeof options === 'string' ? { title: options } : (options || {});
    const side = normalized.side === 'right' ? 'right' : 'left';
    const variant = normalized.variant || (isError ? 'error' : 'info');
    const duration = normalized.duration ?? 3200;
    const cooldownMs = normalized.cooldownMs ?? 0;
    const cooldownKey = normalized.key || normalized.cooldownKey || null;
    const now = Date.now();

    if (cooldownKey && State.temp.toastCooldowns[cooldownKey] && State.temp.toastCooldowns[cooldownKey] > now) {
        return null;
    }
    if (cooldownKey && cooldownMs > 0) {
        State.temp.toastCooldowns[cooldownKey] = now + cooldownMs;
    }

    const stack = document.querySelector(`.toast-stack-${side}`);
    if (!stack) return null;

    const toast = document.createElement('article');
    toast.className = `spirit-toast toast-message spirit-toast--${side} spirit-toast--${variant}`;
    toast.innerHTML = buildToastMarkup({
        title: normalized.title || '',
        body: msg,
        icon: normalized.icon || (isError ? '⚠️' : 'ℹ️'),
        actionLabel: normalized.actionLabel || '',
        variant,
        side
    });

    const actionButton = toast.querySelector('.spirit-toast__action');
    if (actionButton && typeof normalized.onAction === 'function') {
        actionButton.addEventListener('click', (event) => {
            event.stopPropagation();
            normalized.onAction();
            toast.classList.add('is-leaving');
            setTimeout(() => toast.remove(), 240);
        });
    }

    stack.prepend(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    const removeToast = () => {
        toast.classList.add('is-leaving');
        setTimeout(() => {
            toast.remove();
            if (cooldownKey && cooldownMs <= 0) {
                clearToastCooldown(cooldownKey);
            }
        }, 260);
    };

    const timer = setTimeout(removeToast, duration);

    return toast;
}

function showContextToast(options) {
    const body = typeof options.body === 'function' ? options.body() : options.body;
    return showToast(body, false, options);
}

function maybeShowAmbientToast() {
    if (document.hidden) return;
    if (document.body.classList.contains('modal-open')) return;
    if (Date.now() - State.temp.toastAmbientLastAt < 45000) return;

    const rareRoll = Math.random() < 0.22;
    const pool = AMBIENT_TOAST_VARIANTS.filter((item) => rareRoll ? item.rare : !item.rare);
    const candidate = pool[Math.floor(Math.random() * pool.length)] || AMBIENT_TOAST_VARIANTS[0];
    if (!candidate) return;

    State.temp.toastAmbientLastAt = Date.now();
    showContextToast({
        ...candidate,
        key: `ambient:${candidate.title}`,
        cooldownMs: candidate.rare ? 120000 : 70000,
        duration: candidate.rare ? 5200 : 4200
    });
}

function startAmbientToastLoop() {
    if (State.temp.toastContextTimer) {
        clearInterval(State.temp.toastContextTimer);
    }
    State.temp.toastContextTimer = setInterval(maybeShowAmbientToast, 18000);
}

function readSoftOnboardingState() {
    try {
        return JSON.parse(localStorage.getItem(SOFT_ONBOARDING_STORAGE_KEY) || '{}');
    } catch (err) {
        return {};
    }
}

function writeSoftOnboardingState(nextState) {
    localStorage.setItem(SOFT_ONBOARDING_STORAGE_KEY, JSON.stringify(nextState));
}

function readSoftDiscoveryState() {
    try {
        return JSON.parse(localStorage.getItem(SOFT_DISCOVERY_STORAGE_KEY) || '{}');
    } catch (err) {
        return {};
    }
}

function writeSoftDiscoveryState(nextState) {
    localStorage.setItem(SOFT_DISCOVERY_STORAGE_KEY, JSON.stringify(nextState));
}

function clearOnboardingHandHint() {
    State.temp.onboarding.handEl?.remove?.();
    State.temp.onboarding.handEl = null;
}

function renderOnboardingHandHint() {
    clearOnboardingHandHint();
    const step = State.temp.onboarding.step;
    const target = step === 'upgrade'
        ? document.querySelector('.upgrade-panel')
        : document.getElementById('ryoho');
    if (!target || !['tap', 'upgrade'].includes(step)) return;

    const rect = target.getBoundingClientRect();
    const hint = document.createElement('div');
    hint.className = 'onboarding-hand-hint';
    hint.innerHTML = `
        <div class="onboarding-hand-hint__bubble">${step === 'upgrade' ? 'Upgrade' : 'Tap'}</div>
        <div class="onboarding-hand-hint__hand">👉</div>
    `;
    hint.style.left = `${rect.left + rect.width * (step === 'upgrade' ? 0.78 : 0.72)}px`;
    hint.style.top = `${rect.top + rect.height * (step === 'upgrade' ? 0.45 : 0.76)}px`;
    document.body.appendChild(hint);
    State.temp.onboarding.handEl = hint;
}

function completeSoftOnboarding() {
    clearOnboardingHandHint();
    State.temp.onboarding.active = false;
    State.temp.onboarding.step = 'done';
    writeSoftOnboardingState({ step: 'done', completed: true });
}

function setSoftOnboardingStep(step) {
    State.temp.onboarding.active = step !== 'done';
    State.temp.onboarding.step = step;
    writeSoftOnboardingState({ step, completed: step === 'done' });
    if (step === 'tap') {
        renderOnboardingHandHint();
        showToast('Tap the spirit. Every run starts with your first hit.', false, {
            title: 'First move',
            icon: '✨',
            side: 'right',
            variant: 'reward',
            key: 'onboarding:tap',
            cooldownMs: 5000,
            duration: 5200
        });
        return;
    }
    clearOnboardingHandHint();
    if (step === 'upgrade') {
        renderOnboardingHandHint();
        showToast('You have enough coins now. Hit Upgrade to reach level 2.', false, {
            title: 'Level up',
            icon: '✨',
            side: 'left',
            variant: 'reward',
            key: 'onboarding:upgrade',
            cooldownMs: 5000,
            duration: 5000
        });
        return;
    }
    clearOnboardingHandHint();
    if (step === 'tasks') {
        showToast('Good. Open Tasks for fast coins, skins and social rewards.', false, {
            title: 'Next step',
            icon: '✨',
            side: 'left',
            variant: 'info',
            key: 'onboarding:tasks',
            cooldownMs: 5000,
            duration: 5000
        });
        return;
    }
    if (step === 'daily') {
        showToast('Nice. The gift button holds your daily streak. Open it next.', false, {
            title: 'Daily rewards',
            icon: '✨',
            side: 'right',
            variant: 'reward',
            key: 'onboarding:daily',
            cooldownMs: 5000,
            duration: 5000
        });
        return;
    }
    if (step === 'done') {
        showToast('You are set. Build momentum and let the run scale up.', false, {
            title: 'You are in',
            icon: '?',
            side: 'left',
            variant: 'reward',
            key: 'onboarding:done',
            cooldownMs: 5000,
            duration: 4600
        });
        completeSoftOnboarding();
    }
}

function initSoftOnboarding() {
    if (!userId) return;

    const saved = readSoftOnboardingState();
    const isCompleted = saved?.completed || saved?.step === 'done';
    if (isCompleted) {
        State.temp.onboarding.active = false;
        State.temp.onboarding.step = 'done';
        clearOnboardingHandHint();
        return;
    }

    const isFreshAccount =
        (State.game.coins || 0) <= 0 &&
        (State.daily.claimedDays || 0) === 0 &&
        (Number(State.game.level || 0) === 0);

    if (!isFreshAccount && !saved?.step) {
        writeSoftOnboardingState({ step: 'done', completed: true });
        return;
    }

    const step = saved?.step || 'tap';
    State.temp.onboarding.active = step !== 'done';
    State.temp.onboarding.step = step;
    setTimeout(() => setSoftOnboardingStep(step), 500);
}

function maybePromptUpgradeOnboarding() {
    if (!State.temp.onboarding.active) return;
    if (State.temp.onboarding.step !== 'upgrade_wait') return;
    if ((State.game.coins || 0) < getUpgradeAllPrice()) return;
    setSoftOnboardingStep('upgrade');
}

function advanceSoftOnboarding(eventName) {
    if (!State.temp.onboarding.active) return;

    if (eventName === 'tap' && State.temp.onboarding.step === 'tap') {
        setSoftOnboardingStep('upgrade_wait');
        return;
    }
    if (eventName === 'upgrade' && State.temp.onboarding.step === 'upgrade') {
        setSoftOnboardingStep('tasks');
        return;
    }
    if (eventName === 'tasks' && State.temp.onboarding.step === 'tasks') {
        setSoftOnboardingStep('daily');
        return;
    }
    if (eventName === 'daily' && State.temp.onboarding.step === 'daily') {
        setSoftOnboardingStep('done');
    }
}

function maybeShowDiscoveryToast(tab) {
    const mapping = {
        friends: {
            key: 'friends',
            title: 'Friends',
            body: 'Invite friends to unlock referral coins, passive share and the referral skin.',
            icon: '✨',
            side: 'left'
        },
        skins: {
            key: 'skins',
            title: 'Skins',
            body: 'Skins are not just cosmetic. Some of them multiply your tap income.',
            icon: '✨',
            side: 'right'
        },
        games: {
            key: 'games',
            title: 'Event',
            body: 'Push your weekly clicks, stay in the top 50 and fight for the final payouts.',
            icon: '✨',
            side: 'right'
        }
    };

    const item = mapping[tab];
    if (!item) return;

    const saved = readSoftDiscoveryState();
    if (saved[item.key]) return;
    saved[item.key] = true;
    writeSoftDiscoveryState(saved);

    showToast(item.body, false, {
        title: item.title,
        icon: item.icon,
        side: item.side,
        variant: 'info',
        key: `discovery:${item.key}`,
        cooldownMs: 5000,
        duration: 4800
    });
}

function maybeShowIdleToast() {
    if (document.hidden) return;
    if (document.body.classList.contains('modal-open')) return;
    if (State.temp.idleToastShown) return;
    if (!State.temp.lastTapAt) return;

    const idleForMs = Date.now() - State.temp.lastTapAt;
    if (idleForMs < 60000) return;

    const variant = IDLE_TOAST_VARIANTS[Math.floor(Math.random() * IDLE_TOAST_VARIANTS.length)];
    State.temp.idleToastShown = true;
    showContextToast({
        ...variant,
        key: 'idle:minute',
        cooldownMs: 30000,
        duration: 4600
    });
}

function startIdleToastLoop() {
    if (State.temp.idleToastTimer) {
        clearInterval(State.temp.idleToastTimer);
    }
    State.temp.idleToastTimer = setInterval(maybeShowIdleToast, 5000);
}

function registerTapRhythm(now, isAutoTap = false) {
    if (isAutoTap) return;

    State.temp.idleToastShown = false;
    const windowMs = 2600;
    const threshold = 12;
    const taps = State.temp.rapidTapWindow || [];
    taps.push(now);

    while (taps.length && now - taps[0] > windowMs) {
        taps.shift();
    }

    State.temp.rapidTapWindow = taps;

    if (taps.length >= threshold) {
        const variant = FAST_TAP_TOAST_VARIANTS[Math.floor(Math.random() * FAST_TAP_TOAST_VARIANTS.length)];
        showContextToast({
            ...variant,
            key: 'tap:fast',
            cooldownMs: 25000,
            duration: 3600
        });
        State.temp.rapidTapWindow = [];
    }
}

function handleReferralToast(nextCount) {
    const previousCount = State.temp.toastReferralCount;
    State.temp.toastReferralCount = nextCount;

    if (!nextCount) return;
    if (previousCount === null) {
        showToast('Friends make you stronger. Their income pressure is already feeding your run.', false, {
            title: 'Squad buff',
            icon: '✨',
            side: 'left',
            variant: 'reward',
            key: 'friends:intro',
            cooldownMs: 180000,
            duration: 4200
        });
        return;
    }
    if (nextCount > previousCount) {
        showToast(`Your crew grew to ${nextCount}. The referral flow just got louder.`, false, {
            title: 'New friend joined',
            icon: '✨',
            side: 'left',
            variant: 'reward',
            key: 'friends:joined',
            cooldownMs: 10000,
            duration: 4600
        });
    }
}

function trackTournamentToastState(rank, topLimit) {
    const numericRank = Number(rank) || 0;
    const wasInTop = State.temp.tournamentLastRank > 0 &&
        State.temp.tournamentLastTopLimit > 0 &&
        State.temp.tournamentLastRank <= State.temp.tournamentLastTopLimit;
    const isInTop = numericRank > 0 && topLimit > 0 && numericRank <= topLimit;

    if (wasInTop && !isInTop && !State.temp.tournamentDropWarned) {
        showToast(`You slipped out of the Top ${topLimit}. Push back in before the pool locks tighter.`, false, {
            title: 'Event alert',
            icon: '✨',
            side: 'right',
            variant: 'warning',
            key: 'event:drop',
            cooldownMs: 30000,
            duration: 5200
        });
        State.temp.tournamentDropWarned = true;
    }

    if (isInTop) {
        State.temp.tournamentDropWarned = false;
    }

    State.temp.tournamentLastRank = numericRank;
    State.temp.tournamentLastTopLimit = topLimit;
}

// ==================== ДОСТИЖЕНИЯ ====================
const ACHIEVEMENTS_KEY = 'ryohoAchievements';
const ACHIEVEMENTS = [
    { id: 'click_100',    title: 'Warm Up',            description: 'Make 100 taps',         icon: '🟢', condition: (s) => s.clicks >= 100,    reward: 1000 },
    { id: 'click_500',    title: 'Rhythm',             description: 'Make 500 taps',         icon: '🎯', condition: (s) => s.clicks >= 500,    reward: 2000 },
    { id: 'click_1000',   title: 'Experienced Clicker',description: 'Make 1000 taps',        icon: '🔥', condition: (s) => s.clicks >= 1000,   reward: 5000 },
    { id: 'click_5000',   title: 'Flow',               description: 'Make 5000 taps',        icon: '🌊', condition: (s) => s.clicks >= 5000,   reward: 12000 },
    { id: 'click_25000',  title: 'Tap Master',         description: 'Make 25000 taps',       icon: '🏆', condition: (s) => s.clicks >= 25000,  reward: 40000 },

    { id: 'upgrade_5',    title: 'Engineer',           description: 'Buy 5 upgrades',        icon: '🛠️', condition: (s) => s.upgrades >= 5,   reward: 2000 },
    { id: 'upgrade_15',   title: 'Architect',          description: 'Buy 15 upgrades',       icon: '🏗️', condition: (s) => s.upgrades >= 15,  reward: 8000 },
    { id: 'upgrade_30',   title: 'System Builder',     description: 'Buy 30 upgrades',       icon: '🧠', condition: (s) => s.upgrades >= 30,  reward: 20000 },

    { id: 'level_33',     title: 'Silver Gate',        description: 'Reach level 33',         icon: '🔓', condition: (s) => s.level >= 33,     reward: 5000 },
    { id: 'level_66',     title: 'Gold Pulse',         description: 'Reach level 66',         icon: '⚡', condition: (s) => s.level >= 66,     reward: 12000 },

    { id: 'referral_1',   title: 'First Friend',       description: 'Invite 1 friend',       icon: '👥', condition: (s) => s.referrals >= 1,  reward: 2000 },
    { id: 'referral_5',   title: 'Popular',            description: 'Invite 5 friends',      icon: '🤝', condition: (s) => s.referrals >= 5,  reward: 10000 },
    { id: 'referral_15',  title: 'Ambassador',         description: 'Invite 15 friends',     icon: '🌐', condition: (s) => s.referrals >= 15, reward: 25000 },

    { id: 'ads_5',        title: 'Supporter',          description: 'Watch 5 videos',        icon: '🎥', condition: (s) => s.adsWatched >= 5, reward: 5000 }
];

function loadAchievementsFromStorage() {
    try {
        const saved = localStorage.getItem(ACHIEVEMENTS_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        State.achievements = {
            ...State.achievements,
            ...parsed,
            completed: Array.from(new Set(parsed.completed || []))
        };
    } catch (e) {
        if (DEBUG) console.warn('Achievements restore failed', e);
    }
}

function saveAchievementsToStorage() {
    try {
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify({
            ...State.achievements,
            completed: Array.from(new Set(State.achievements.completed || []))
        }));
    } catch (e) {
        if (DEBUG) console.warn('Achievements save failed', e);
    }
}

function trackAchievementProgress(key, delta = 1) {
    State.achievements[key] = (State.achievements[key] || 0) + delta;
    saveAchievementsToStorage();
}

function applyServerEnergySnapshot(payload) {
    // Layer 1: update authoritative server state
    if (typeof payload.energy === 'number') {
        State.temp.serverEnergyBase = payload.energy;
    }
    if (typeof payload.max_energy === 'number') {
        State.temp.serverMaxEnergy = payload.max_energy;
        State.game.maxEnergy = payload.max_energy;
    }
    if (typeof payload.regen_seconds === 'number') {
        // Server value ignored: we enforce 5 energy/sec locally.
    }
    State.temp.energyRegenMs = 200; // 5 energy per second

    // Use server-derived timing for visual regen, not client arrival time.
    // Priority: state_updated_at > server_time > Date.now()
    let syncTimeMs = Date.now();
    if (typeof payload.state_updated_at === 'number' && payload.state_updated_at > 0) {
        syncTimeMs = payload.state_updated_at;
    } else if (typeof payload.server_time === 'string') {
        try {
            syncTimeMs = new Date(payload.server_time).getTime();
        } catch (_) { /* fall through to Date.now() */ }
    }
    State.temp.serverEnergySyncedAtMs = syncTimeMs;

    // Update visual energy from the dual-layer model
    State.game.energy = getVisualEnergy();
}

function getVisualEnergy() {
    if (!State.temp.serverEnergySyncedAtMs) {
        return State.game.energy || 0;
    }

    // Visual regen: +1 every energyRegenMs since last server sync
    const elapsed = Date.now() - State.temp.serverEnergySyncedAtMs;
    const regenGained = Math.floor(elapsed / State.temp.energyRegenMs);

    // visual = authoritative base + regen since sync - pending local spend
    const visual = State.temp.serverEnergyBase
                 + regenGained
                 - State.temp.pendingEnergySpend;

    return Math.max(0, Math.min(State.temp.serverMaxEnergy, visual));
}

function refreshEnergyUIOnly() {
    // Smooth regen tick — only update visual energy, never overwrite
    // the authoritative server base.
    const visualEnergy = getVisualEnergy();

    if (visualEnergy !== State.game.energy) {
        State.game.energy = visualEnergy;
        updateEnergyUIImmediate();
    }
}

function checkAchievements() {
    const stats = {
        clicks: State.achievements.clicks || 0,
        upgrades: State.achievements.upgrades || 0,
        games: State.achievements.games || 0,
        level: Number(getDisplayLevel(State.game.level) || 1),
        referrals: State.skins.friendsInvited || 0,
        adsWatched: State.skins.adsWatched || 0
    };
    
    let changed = false;
    ACHIEVEMENTS.forEach(achievement => {
        if (!State.achievements.completed.includes(achievement.id) && 
            achievement.condition(stats)) {
            State.achievements.completed.push(achievement.id);
            showAchievementNotification(achievement);
            changed = true;
        }
    });

    if (changed) saveAchievementsToStorage();
}

function showAchievementNotification(achievement) {
    showToast(`${achievement.title}`, false, {
        title: 'Achievement unlocked',
        icon: achievement.icon || '🏆',
        side: 'right',
        variant: 'reward',
        duration: 5000
    });
    createConfetti();
    playAchievementSound();
}

function playAchievementSound() {
    if (!State.settings.sound) return;
    try {
        const audioCtx = getAudioContextForSfx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        for (let i = 0; i < 3; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600 + i * 200, now + i * 0.1);
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        }
    } catch (err) {}
}

// ==================== API ====================
const API = window.SpiritApi.createApiClient({
    baseUrl: CONFIG.API_URL,
    fetchImpl: fetch,
    debugLog,
    debugError,
    ensureApiSession,
    hasTelegramInitData: !!telegramInitData
});

async function apiGetCached(endpoint, options = {}) {
    if (API && typeof API.cachedGet === 'function') {
        return API.cachedGet(endpoint, options);
    }
    return API.get(endpoint);
}
clickDomain = window.SpiritClickDomain.createClickDomain({
    store: Store,
    state: State,
    userId: () => userId,
    API,
    setCoins: (next) => Store.set('game.coins', next),
    applyBoostStateFromPayload,
    applyServerEnergySnapshot,
    updateUI,
    fullSyncWithServer,
    config: CONFIG
});
tapDomain = window.SpiritTapDomain.createTapDomain({
    clickDomain,
    stateActions: StateActions,
    registerTapRhythm,
    advanceSoftOnboarding,
    isMegaBoostActive,
    isDailyInfiniteEnergyActive,
    isGhostBoostActive,
    isTaskTapBoostActive,
    ghostBoostMultiplier: GHOST_BOOST_MULTIPLIER,
    getVisualEnergy,
    updateEnergyUIImmediate,
    showEnergyRecoveryModal,
    maybeSpawnLuckyGhost,
    trackAchievementProgress,
    checkAchievements,
    updateUI
});
tapFeedbackRenderer = window.SpiritTapFeedbackRenderer.createTapFeedbackRenderer({
    State,
    store: Store,
    isLitePerformanceMode,
    getAudioContextForSfx,
    tg,
    autoFeedbackIntervalMs: AUTO_CLICK_FEEDBACK_INTERVAL_MS
});
adsDomain = window.SpiritAdsDomain.createAdsDomain({
    sleep,
    debugLog,
    debugError,
    adNotConfirmedMessage: () => tr('toasts.adNotConfirmed'),
    userId: () => userId,
    API,
    State,
    store: Store,
    syncModalOpenState,
    initAdsgramController
});

function setCoins(_label, next, _payload = null) {
    clickDomain.setCoins(next);
}

function addCoins(_label, delta, _payload = null) {
    clickDomain.addCoins(delta);
}

function applyNonClickCoinsSnapshot(source, response) {
    if (!response || typeof response.coins !== 'number') {
        return;
    }

    const incomingCoins = Number(response.coins || 0);
    const incomingTs = response.state_updated_at || response.state_version || 0;
    const currentTs = State.temp.lastStateUpdatedAtMs || 0;
    const currentDelta = State.game.coinsOptimisticDelta || 0;

    // Stale response check: ignore if older than current state
    if (incomingTs > 0 && incomingTs < currentTs) {
        if (DEBUG) {
            console.log(`applyNonClickCoinsSnapshot: ignoring stale response from ${source}`, {
                incomingTs,
                currentTs,
                incomingCoins
            });
        }
        return;
    }

    // Fresh response: update confirmed base, preserve optimistic delta
    Store.set('game.coinsConfirmed', incomingCoins);
    Store.set('game.coins', incomingCoins + currentDelta);

    // Update ordering timestamp
    if (incomingTs > 0) {
        Store.set('temp.lastStateUpdatedAtMs', incomingTs);
    }

    if (DEBUG) {
        console.log(`applyNonClickCoinsSnapshot: applied from ${source}`, {
            incomingCoins,
            currentDelta,
            displayCoins: incomingCoins + currentDelta,
            incomingTs
        });
    }
}

Object.assign(StateActions, {
    setCoins(value) {
        Store.set('game.coins', Number(value || 0));
    },
    setRebirthCount(value) {
        Store.set('game.rebirthCount', Math.max(0, Number(value || 0)));
    },
    setStateVersion(version) {
        if (version > 0) {
            Store.set('temp.lastStateUpdatedAtMs', version);
        }
    },
    applyProgressSnapshot(payload = {}) {
        const legacyFallback = Math.max(
            Number(payload.multitap_level ?? 0),
            Number(payload.profit_level ?? 0),
            Number(payload.energy_level ?? 0)
        );
        let nextLevel = Number(State.game.level || 0);
        if (typeof payload.level === 'number') {
            nextLevel = payload.level;
        } else if (legacyFallback > 0 || nextLevel <= 0) {
            nextLevel = legacyFallback;
        }
        nextLevel = Math.max(0, Number(nextLevel || 0));
        Store.set('game.level', nextLevel);
        // Deprecated mirrors stay aligned for backward compatibility.
        Store.set('game.levels.multitap', nextLevel);
        Store.set('game.levels.profit', nextLevel);
        Store.set('game.levels.energy', nextLevel);
        if (typeof payload.rebirth_count === 'number') {
            Store.set('game.rebirthCount', Math.max(0, payload.rebirth_count));
        }
    },
    applyProfitSnapshot(payload = {}) {
        if (typeof payload.profit_per_tap === 'number') {
            const nextTap = Math.max(1, Number(payload.profit_per_tap || 0));
            const legacyFallback = Math.max(
                Number(payload.multitap_level ?? 0),
                Number(payload.profit_level ?? 0),
                Number(payload.energy_level ?? 0)
            );
            const baseLevelForGuard = typeof payload.level === 'number'
                ? payload.level
                : (legacyFallback > 0 ? legacyFallback : Number(State.game.level || 0));
            const expectedMinTap = Math.max(1, Number(baseLevelForGuard || 0) + 1);
            const nextRebirthCount = typeof payload.rebirth_count === 'number'
                ? Math.max(0, Number(payload.rebirth_count || 0))
                : Number(State.game.rebirthCount || 0);
            const isProgressResetPayload =
                (typeof payload.level === 'number' && payload.level < Number(State.game.level || 0)) ||
                (typeof payload.rebirth_count === 'number' && nextRebirthCount > Number(State.game.rebirthCount || 0));

            // Guard against stale/partial snapshots that can regress tap to 1
            // after hydration while progression level is already high.
            if (!isProgressResetPayload && nextTap < expectedMinTap) {
                if (DEBUG) {
                    console.warn('Ignoring regressive profit_per_tap snapshot', {
                        nextTap,
                        expectedMinTap,
                        payload
                    });
                }
            } else {
                Store.set('game.profitPerTap', nextTap);
            }
        }
        if (typeof payload.profit_per_hour === 'number') {
            Store.set('game.profitPerHour', payload.profit_per_hour);
        }
    },
    applyEnergySnapshot(payload = {}) {
        applyServerEnergySnapshot(payload);
    },
    markTapTimestamp(ts) {
        Store.set('temp.lastTapAt', ts);
    },
    setSocialTasks(next) {
        Store.set('tasks.social', next || {});
    },
    patchSocialTask(taskId, patch = {}) {
        const prev = State.tasks.social?.[taskId] || { started: false, completed: false };
        Store.set(`tasks.social.${taskId}`, { ...prev, ...patch });
    },
    setOwnedSkins(owned) {
        Store.set('skins.owned', owned || []);
    }
});

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadUserData() {
    if (!userId) return;
    const doneLoad = debugPerfStart('perf', 'startup/loadUserData', { userId });
    
    try {
        const data = await runWithRetry(async () => {
            await ensureApiSession();
            const doneUser = debugPerfStart('perf', 'startup/api_user');
            try {
                let userData = await API.get(`/api/user/${userId}`);
                doneUser(true);

                // Keep register side-effects (username sync / one-time referral attach),
                // but do not block first hydration for already existing users.
                const doneRegister = debugPerfStart('perf', 'startup/register');
                API.post('/api/register', {
                    user_id: userId,
                    username,
                    referrer_id: referrerId
                }).then(() => {
                    doneRegister(true, { deferred: true });
                }).catch((registerErr) => {
                    doneRegister(false, {
                        deferred: true,
                        error: String(registerErr?.message || registerErr || '')
                    });
                    if (DEBUG) console.warn('Deferred register failed:', registerErr);
                });

                return userData;
            } catch (err) {
                // New users can hit /api/user before account exists.
                // In that case, register once and retry /api/user immediately.
                if (err?.status === 404) {
                    const doneRegister = debugPerfStart('perf', 'startup/register');
                    await API.post('/api/register', {
                        user_id: userId,
                        username,
                        referrer_id: referrerId
                    });
                    doneRegister(true, { deferred: false, reason: 'api_user_404' });

                    const retried = await API.get(`/api/user/${userId}`);
                    doneUser(true, { retriedAfterRegister: true });
                    return retried;
                }
                doneUser(false, { error: String(err?.message || err || '') });
                throw err;
            }
        }, 3, 1800);
        
        // Ordering check: ignore stale user snapshots
        const incomingTs = data.state_updated_at || data.state_version || 0;
        const currentTs = State.temp.lastStateUpdatedAtMs || 0;
        if (incomingTs > 0 && incomingTs <= currentTs) {
            return; // stale response, ignore
        }
        if (incomingTs > 0) {
            State.temp.lastStateUpdatedAtMs = incomingTs;
        }

        setCoins('loadUserData', data.coins || 0, data);
        applyServerEnergySnapshot({
            energy: data.energy || 0,
            max_energy: data.max_energy || 500,
            regen_seconds: data.regen_seconds || 2
        });
        StateActions.applyProfitSnapshot({
            profit_per_tap: (typeof data.profit_per_tap === 'number') ? data.profit_per_tap : State.game.profitPerTap,
            profit_per_hour: (typeof data.profit_per_hour === 'number') ? data.profit_per_hour : State.game.profitPerHour,
            level: (typeof data.level === 'number') ? data.level : data.multitap_level,
            multitap_level: data.multitap_level,
            rebirth_count: data.rebirth_count
        });
        StateActions.applyProgressSnapshot({
            level: (typeof data.level === 'number') ? data.level : undefined,
            multitap_level: data.multitap_level || 0,
            profit_level: data.profit_level || 0,
            energy_level: data.energy_level || 0,
            rebirth_count: data.rebirth_count || 0
        });
        applyTaskBoostPayload(data);
        
        State.skins.owned = normalizeOwnedSkinIds(data.owned_skins || ['default.pngSP']);
        State.skins.selected = normalizeSelectedSkinId(data.selected_skin || 'default.pngSP', State.skins.owned);
        State.skins.adsWatched = data.ads_watched || 0;
        State.skins.videoViews = data.skin_ad_progress || {};
        localStorage.setItem('videoSkinViews', JSON.stringify(State.skins.videoViews));
        applyBoostStateFromPayload(data);
        setTonWalletState(data.ton_wallet || {});
        if (data.daily_infinite_energy_expires_at) {
            State.daily.infiniteEnergyExpiresAt = data.daily_infinite_energy_expires_at;
        }

        applySavedSkin();
        updateUI();
        startPerfectEnergySystem();
        if (!DEBUG_BOOT.firstHydrationLogged) {
            DEBUG_BOOT.firstHydrationLogged = true;
            debugLog('perf', `first real hydration ${Math.round(performance.now() - APP_BOOT_TS)}ms`);
        }

        Promise.allSettled([
            loadPrices(),
            loadSkinsList(),
            loadReferralData(),
            checkBoostStatus(),
            loadDailyRewardStatus()
        ]).then((secondaryLoads) => {
            secondaryLoads.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const labels = ['prices', 'skins', 'referrals', 'boost-status', 'daily-reward'];
                    if (DEBUG) console.warn(`Deferred startup load failed: ${labels[index]}`, result.reason);
                }
            });
        });
        doneLoad(true);
        
    } catch (err) {
        doneLoad(false, { error: String(err?.message || err || '') });
        console.error('Failed to load user data:', err);
        const wakingUp = isRetryableStartupError(err);
        showToast(
            wakingUp ? 'Server is waking up. Please wait a few seconds and try again.' : tr('toasts.loadDataError'),
            true,
            wakingUp ? {
                title: 'Startup delay',
                icon: '?',
                duration: 5200,
                key: 'startup-delay'
            } : {}
        );
    }
}

async function loadPrices() {
    if (!userId) return;
    try {
        const endpoint = `/api/upgrade-prices/${userId}`;
        const applyPrices = (prices) => {
            State.game.prices = { ...State.game.prices, ...(prices || {}) };
            updateUI();
        };
        const prices = await apiGetCached(endpoint, {
            ttlMs: 60_000,
            onFresh: (freshPrices) => applyPrices(freshPrices)
        });
        applyPrices(prices);
    } catch (err) {
        console.error('Failed to load prices:', err);
    }
}

// ==================== ЛОКАЛЬНЫЕ СКИНЫ ====================
function getLocalSkins() {
    return [
        // Default
        { id: "default.pngSP", name: "Default", image: "imgg/skins/default.png", rarity: "common", bonus: { type: "multiplier", value: 1.0 }, requirement: null },
        { id: "refferal.pngSP", name: "Referral Special", image: "imgg/skins/refferal.png", rarity: "legendary", bonus: { type: "multiplier", value: 1.8 }, requirement: { type: "friends", value: 1 } },

        // Level skins (common, x1.2)
        { id: "10lvl.pngSP", name: "Level 10", image: "imgg/skins/10lvl.png", rarity: "common", bonus: { type: "multiplier", value: 1.2 }, requirement: { type: "level", value: 10 } },
        { id: "25lvl.pngSP", name: "Level 25", image: "imgg/skins/25lvl.png", rarity: "common", bonus: { type: "multiplier", value: 1.2 }, requirement: { type: "level", value: 25 } },
        { id: "50lvl.pngSP", name: "Level 50", image: "imgg/skins/50lvl.png", rarity: "common", bonus: { type: "multiplier", value: 1.2 }, requirement: { type: "level", value: 50 } },
        { id: "75lvl.pngSP", name: "Level 75", image: "imgg/skins/75lvl.png", rarity: "common", bonus: { type: "multiplier", value: 1.2 }, requirement: { type: "level", value: 75 } },
        { id: "100lvl.pngSP", name: "Level 100", image: "imgg/skins/100lvl.png", rarity: "common", bonus: { type: "multiplier", value: 1.2 }, requirement: { type: "level", value: 100 } },

        // Video skins (rare, x1.5) — 10 rewarded watches per skin
        { id: "video.pngSP",  name: "Video 1", image: "imgg/skins/video.png",  rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video.pngSP" } },
        { id: "video2.pngSP", name: "Video 2", image: "imgg/skins/video2.png", rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video2.pngSP" } },
        { id: "video3.pngSP", name: "Video 3", image: "imgg/skins/video3.png", rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video3.pngSP" } },
        { id: "video4.pngSP", name: "Video 4", image: "imgg/skins/video4.png", rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video4.pngSP" } },
        { id: "video5.pngSP", name: "Video 5", image: "imgg/skins/video5.png", rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video5.pngSP" } },
        { id: "video6.pngSP", name: "Video 6", image: "imgg/skins/video6.png", rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video6.pngSP" } },
        { id: "video7.pngSP", name: "Video 7", image: "imgg/skins/video7.png", rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video7.pngSP" } },
        { id: "video8.pngSP", name: "Video 8", image: "imgg/skins/video8.png", rarity: "rare", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "videos", count: 10, progressKey: "video8.pngSP" } },

        // Social / reward skins
        { id: "telega.pngSP", name: "Telegram Reward", image: "imgg/skins/telega.png", rarity: "legendary", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "social", value: "telegram_sub" } },
        { id: "tiktok.pngSP", name: "TikTok Reward", image: "imgg/skins/tiktok.png", rarity: "legendary", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "social", value: "tiktok_sub" } },
        { id: "insta.pngSP", name: "Instagram Reward", image: "imgg/skins/insta.png", rarity: "legendary", bonus: { type: "multiplier", value: 1.5 }, requirement: { type: "social", value: "instagram_sub" } },
        { id: "retro.pngSP", name: "Day 30 Reward", image: "imgg/skins/retro.png", rarity: "legendary", bonus: { type: "multiplier", value: 1.7 }, requirement: { type: "daily", value: 30 } },

        // TON skins (super, x2). All cost 1 TON.
        { id: "stars1.pngSP", name: "Premium 1", image: "imgg/skins/stars1.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },
        { id: "stars2.pngSP", name: "Premium 2", image: "imgg/skins/stars2.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },
        { id: "stars3.pngSP", name: "Premium 3", image: "imgg/skins/stars3.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },

        { id: "stars4.pngSP", name: "Premium 4", image: "imgg/skins/stars4.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },
        { id: "stars5.pngSP", name: "Premium 5", image: "imgg/skins/stars5.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },
        { id: "stars6.pngSP", name: "Premium 6", image: "imgg/skins/stars6.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },

        { id: "stars7.pngSP", name: "Premium 7", image: "imgg/skins/stars7.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },
        { id: "stars8.pngSP", name: "Premium 8", image: "imgg/skins/stars8.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "ton", price: 1 } },
    ];
}

async function loadSkinsList() {
    try {
        // На клиенте фиксируем актуальный список, чтобы старые серверные записи не перезаписывали имена/изображения
        const localSkins = getLocalSkins();
        State.skins.data = localSkins;
    } catch (err) {
        State.skins.data = getLocalSkins();
    }
    
    State.skins.data.forEach(skin => {
        if (skin.requirement?.type === 'level') {
            skin.requirement.current = getDisplayLevel(State.game.level);
        } else if (skin.requirement?.type === 'videos') {
            const key = skin.requirement.progressKey || skin.id;
            skin.requirement.current = State.skins.videoViews[key] || 0;
        } else if (skin.requirement?.type === 'friends') {
            skin.requirement.current = State.skins.friendsInvited || 0;
        } else if (skin.requirement?.type === 'daily') {
            skin.requirement.current = State.daily.claimedDays || 0;
        }
    });
    
    renderSkins();
    updateCollectionProgress();
}

function isDailyInfiniteEnergyActive() {
    if (!State.daily.infiniteEnergyExpiresAt) return false;
    const expiresAt = parseServerDate(State.daily.infiniteEnergyExpiresAt);
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
        State.daily.infiniteEnergyExpiresAt = null;
        return false;
    }
    const isActive = expiresAt.getTime() > Date.now();
    // Auto-cleanup expired state
    if (!isActive) {
        State.daily.infiniteEnergyExpiresAt = null;
    }
    return isActive;
}

function isMegaBoostActive() {
    if (!boostEndTime) return false;
    const isActive = boostEndTime > new Date();
    // Auto-cleanup expired state
    if (!isActive) {
        boostEndTime = null;
    }
    return isActive;
}

function isGhostBoostActive() {
    if (!State.temp.ghostBoostExpiresAt) return false;
    const expiresAt = parseServerDate(State.temp.ghostBoostExpiresAt);
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
        State.temp.ghostBoostExpiresAt = null;
        State.temp.ghostBoostActive = false;
        return false;
    }
    const isActive = expiresAt.getTime() > Date.now();
    // Auto-cleanup expired state
    if (!isActive) {
        State.temp.ghostBoostExpiresAt = null;
        State.temp.ghostBoostActive = false;
    }
    return isActive;
}

function isFreeEnergyActive() {
    return isMegaBoostActive() || isDailyInfiniteEnergyActive() || isGhostBoostActive();
}

function syncMegaBoostUi() {
    const boostBtn = document.getElementById('mega-boost-btn');
    const timerEl = document.getElementById('mega-boost-timer');
    const energyBar = document.querySelector('.energy-bar-bg');
    if (isMegaBoostActive()) {
        if (boostBtn) boostBtn.classList.add('active');
        showBoostIndicator();
        if (energyBar) energyBar.classList.add('boost-active');
    } else {
        if (boostBtn) boostBtn.classList.remove('active');
        document.querySelector('.mega-boost-indicator')?.remove();
        if (energyBar) energyBar.classList.remove('boost-active');
    }
    updateMegaBoostButtonState(boostBtn);
    updateMegaBoostTimerLabel(timerEl);
    ensureMegaBoostTimer();
}

function ensureMegaBoostTimer() {
    const boostBtn = document.getElementById('mega-boost-btn');
    const timerEl = document.getElementById('mega-boost-timer');
    const energyBar = document.querySelector('.energy-bar-bg');
    if (!isMegaBoostActive()) {
        if (boostInterval) clearInterval(boostInterval);
        boostInterval = null;
        return;
    }
    if (boostInterval) return;
    boostInterval = setInterval(() => {
        const now = new Date();
        const diff = boostEndTime - now;
        if (diff <= 0) {
            clearInterval(boostInterval);
            boostInterval = null;
            if (boostBtn) boostBtn.classList.remove('active');
            document.querySelector('.mega-boost-indicator')?.remove();
            if (energyBar) energyBar.classList.remove('boost-active');
            boostEndTime = null;
            updateMegaBoostButtonState(boostBtn);
            updateMegaBoostTimerLabel(timerEl);
            return;
        }
        updateMegaBoostTimerLabel(timerEl);
    }, 200);
}

function applyBoostStateFromPayload(payload) {
    if (!payload) return;
    if (typeof payload.mega_boost_active === 'boolean') {
        if (payload.mega_boost_active && payload.mega_boost_expires_at) {
            boostEndTime = parseServerDate(payload.mega_boost_expires_at);
        } else if (!payload.mega_boost_active) {
            // Server says boost is inactive - unconditionally clear state
            // to prevent client/server time desync issues
            boostEndTime = null;
        }
        syncMegaBoostUi();
    }
    if (payload.daily_infinite_energy_expires_at) {
        State.daily.infiniteEnergyExpiresAt = payload.daily_infinite_energy_expires_at;
    } else if (payload.daily_infinite_energy_active === false) {
        // Server says boost is inactive - unconditionally clear state
        State.daily.infiniteEnergyExpiresAt = null;
    }
    if (typeof payload.ghost_boost_active === 'boolean') {
        if (payload.ghost_boost_active && payload.ghost_boost_expires_at) {
            setGhostBoostState(true, payload.ghost_boost_expires_at);
        } else if (!payload.ghost_boost_active) {
            // Server says boost is inactive - unconditionally clear state
            setGhostBoostState(false, null);
        }
    }
}

function getRandomGhostCooldownMs() {
    return GHOST_SPAWN_COOLDOWN_MIN_MS + Math.floor(Math.random() * (GHOST_SPAWN_COOLDOWN_MAX_MS - GHOST_SPAWN_COOLDOWN_MIN_MS + 1));
}

function scheduleNextGhostSpawn() {
    State.temp.ghostNextSpawnAt = Date.now() + getRandomGhostCooldownMs();
}

function clearGhostBoostIndicator() {
    document.querySelector('.ghost-boost-indicator')?.remove();
    document.body.classList.remove('ghost-boost-active');
    document.querySelector('.energy-bar-bg')?.classList.remove('ghost-boost-active');
}

function renderGhostBoostIndicator(expiresAt) {
    const energyContainer = document.querySelector('.energy-bar-container');
    if (!energyContainer) return;

    let indicator = document.querySelector('.ghost-boost-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'ghost-boost-indicator';
        energyContainer.appendChild(indicator);
    }

    const diff = Math.max(0, parseServerDate(expiresAt) - new Date());
    const secs = Math.floor(diff / 1000);
    indicator.textContent = `👻 x${GHOST_BOOST_MULTIPLIER} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function setGhostBoostState(active, expiresAt = null) {
    State.temp.ghostBoostActive = !!active;
    State.temp.ghostBoostExpiresAt = active ? expiresAt : null;

    if (State.temp.ghostBoostInterval) {
        clearInterval(State.temp.ghostBoostInterval);
        State.temp.ghostBoostInterval = null;
    }

    if (!active || !expiresAt) {
        clearGhostBoostIndicator();
        return;
    }

    document.body.classList.add('ghost-boost-active');
    document.querySelector('.energy-bar-bg')?.classList.add('ghost-boost-active');
    renderGhostBoostIndicator(expiresAt);

    State.temp.ghostBoostInterval = setInterval(() => {
        const diff = parseServerDate(State.temp.ghostBoostExpiresAt) - new Date();
        if (diff <= 0) {
            clearInterval(State.temp.ghostBoostInterval);
            State.temp.ghostBoostInterval = null;
            State.temp.ghostBoostActive = false;
            State.temp.ghostBoostExpiresAt = null;
            clearGhostBoostIndicator();
            showToast('The ghost bonus faded. The screen feels normal again.', false, {
                title: 'Ghost boost ended',
                icon: '👻',
                side: 'right',
                variant: 'info',
                duration: 3600
            });
            return;
        }
        renderGhostBoostIndicator(State.temp.ghostBoostExpiresAt);
    }, 1000);
}

function setAdInputBlocked(blocked) {
    adsDomain.setAdInputBlocked(blocked);
}

async function syncGhostBoostStatus() {
    if (!userId) return;
    try {
        const data = await API.get(`/api/ghost-boost-status/${userId}`);
        applyBoostStateFromPayload({
            ghost_boost_active: !!data.active,
            ghost_boost_expires_at: data.expires_at || null
        });
    } catch (err) {
        console.error('Ghost boost status error:', err);
    }
}

async function requestAdActionSession(action, { logClick = true, source = 'interactive' } = {}) {
    const done = debugPerfStart('ads', 'start ad session', { action, source });
    try {
        const adSessionId = await adsDomain.requestAdActionSession(action, { logClick, source });
        done(true, { action, adSessionId });
        return adSessionId;
    } catch (err) {
        done(false, { action, error: err?.detail || err?.message || String(err) });
        throw err;
    }
}

async function startAdActionSession(action) {
    return adsDomain.startAdActionSession(action);
}

function prewarmAdActionSession(action) {
    adsDomain.prewarmAdActionSession(action);
}

async function consumeAdActionSession(action) {
    return adsDomain.consumeAdActionSession(action);
}

async function showRewardedAd(adSessionId = null) {
    return adsDomain.showRewardedAd(adSessionId, tr('toasts.adUnavailable'));
}

async function openRewardedAdWithSession(action) {
    return adsDomain.openRewardedAdWithSession(action, tr('toasts.adUnavailable'));
}

async function confirmAdsgramAdSession(adSessionId, attempts = 6, delayMs = 1500) {
    return adsDomain.confirmAdsgramAdSession(adSessionId, { attempts, delayMs });
}

function isAdConfirmationPendingError(err) {
    return adsDomain.isAdConfirmationPendingError(err);
}

function resolveRewardedAdErrorMessage(err, fallbackMessage) {
    return adsDomain.resolveRewardedAdErrorMessage(err, fallbackMessage);
}

async function claimAdActionWithRetry(claimFn, attempts = 15, delayMs = 1500) {
    return adsDomain.claimAdActionWithRetry(claimFn, { attempts, delayMs });
}

function removeLuckyGhost() {
    document.querySelector('.lucky-ghost-event')?.remove();
    State.temp.ghostSpawnVisible = false;
}

async function claimLuckyGhost(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const ghost = document.querySelector('.lucky-ghost-event');
    if (ghost?.dataset.claiming === '1') return;
    if (ghost) ghost.dataset.claiming = '1';

    if (!isAdsgramReady()) {
        removeLuckyGhost();
        showToast(tr('toasts.adUnavailable'), true, {
            title: 'Ghost escaped',
            icon: '✨',
            side: 'right',
            variant: 'error'
        });
        return;
    }

    try {
        showToast('Catch the ad and the ghost pays back with x5 taps and infinite energy.', false, {
            title: 'Lucky ghost',
            icon: '✨',
            side: 'right',
            variant: 'weird',
            duration: 3200
        });
        const adSessionId = await openRewardedAdWithSession('ghost_boost');
        const optimisticExpires = new Date(Date.now() + GHOST_BOOST_DURATION_MS).toISOString();
        setGhostBoostState(true, optimisticExpires);
        debugLog('ads', 'reward applied in UI', {
            flow: 'ghost_boost',
            optimistic: true,
            expiresAt: optimisticExpires
        });
        await confirmAdsgramAdSession(adSessionId);
        const activation = await claimAdActionWithRetry(() => API.post('/api/activate-ghost-boost', {
            user_id: userId,
            ad_session_id: adSessionId
        }));
        const expiresAt = activation?.expires_at || optimisticExpires;
        setGhostBoostState(true, expiresAt);
        debugLog('ads', 'reward applied in UI', {
            flow: 'ghost_boost',
            optimistic: false,
            expiresAt,
            multiplier: activation?.multiplier
        });
        removeLuckyGhost();
        showToast(`x${activation?.multiplier || GHOST_BOOST_MULTIPLIER} taps and infinite energy for 1 minute.`, false, {
            title: 'Ghost caught',
            icon: '✨',
            side: 'right',
            variant: 'reward',
            duration: 4800
        });
    } catch (err) {
        console.error('Ghost claim error:', err);
        setGhostBoostState(false, null);
        removeLuckyGhost();
        showToast(
            resolveRewardedAdErrorMessage(err, tr('toasts.watchError')),
            true,
            {
            title: 'Ghost lost',
            icon: '✨',
            side: 'right',
            variant: 'error'
        });
    }
}

function spawnLuckyGhost() {
    if (State.temp.ghostSpawnVisible || document.hidden || document.body.classList.contains('modal-open')) return;
    if (isAdsgramReady()) prewarmAdActionSession('ghost_boost');

    scheduleNextGhostSpawn();
    State.temp.ghostSpawnVisible = true;

    const ghost = document.createElement('button');
    ghost.type = 'button';
    ghost.className = 'lucky-ghost-event';

    const minTop = Math.max(140, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--toast-top-offset') || '96', 10) + 90);
    const maxTop = Math.max(minTop + 20, window.innerHeight - 260);
    const top = Math.round(minTop + Math.random() * Math.max(20, maxTop - minTop));
    const left = Math.round(window.innerWidth * (0.16 + Math.random() * 0.68));

    ghost.style.left = `${left}px`;
    ghost.style.top = `${top}px`;
    ghost.innerHTML = `
        <span class="lucky-ghost-event__pulse"></span>
        <span class="lucky-ghost-event__sprite">👻</span>
        <span class="lucky-ghost-event__label">x${GHOST_BOOST_MULTIPLIER}</span>
    `;
    ghost.addEventListener('click', claimLuckyGhost);
    document.body.appendChild(ghost);

    showToast('A strange ghost showed up. Tap it before it fades.', false, {
        title: 'Rare encounter',
        icon: '✨',
        side: 'right',
        variant: 'weird',
        duration: 5000
    });

    setTimeout(() => {
        if (document.body.contains(ghost)) {
            ghost.classList.add('is-leaving');
            setTimeout(removeLuckyGhost, 280);
        }
    }, 8000);
}

function maybeSpawnLuckyGhost(isAutoTap = false) {
    if (isAutoTap) return;
    if (State.temp.ghostSpawnVisible) return;
    if (isGhostBoostActive()) return;
    if (Date.now() < (State.temp.ghostNextSpawnAt || 0)) return;
    if (Math.random() > GHOST_SPAWN_CHANCE) return;
    spawnLuckyGhost();
}

function getDailyRewardMeta(day) {
    const coins = day * DAILY_REWARD_BASE_COINS;
    const isEnergyDay = day % 7 === 0 && day < DAILY_REWARD_MAX_DAYS;
    const isFinalDay = day === DAILY_REWARD_MAX_DAYS;

    return {
        day,
        coins,
        isEnergyDay,
        isFinalDay,
        title: isEnergyDay ? t('daily.infiniteEnergy') : t('daily.coins'),
        primary: isEnergyDay ? `? ${t('daily.infiniteEnergyDesc')}` : `+${formatNumber(coins)}`
    };
}

function renderDailyRewardButton() {
    const button = document.getElementById('dailyRewardsButton');
    if (!button) return;
    const dot = button.querySelector('.daily-gift-dot');
    const showReady = !!State.daily.loaded && !!State.daily.claimAvailable;
    button.title = showReady ? t('daily.ready') : t('daily.wait');
    button.classList.toggle('ready', showReady);
    if (dot) dot.style.display = showReady ? 'block' : 'none';
}

function renderDailyRewardsModal() {
    const summary = document.getElementById('dailyRewardSummary');
    const actionButton = document.getElementById('dailyRewardAction');
    const track = document.getElementById('dailyRewardTrack');
    const teaserImage = document.getElementById('dailyRewardTeaserImg');
    const title = document.getElementById('dailyRewardTitle');
    const kicker = document.getElementById('dailyRewardKicker');
    const finalKicker = document.getElementById('dailyRewardFinalKicker');
    const finalTitle = document.getElementById('dailyRewardFinalTitle');
    const finalDesc = document.getElementById('dailyRewardFinalDesc');
    if (!summary || !actionButton || !track) return;

    if (title) title.textContent = t('daily.title');
    if (kicker) kicker.textContent = t('daily.subtitle');
    if (finalKicker) finalKicker.textContent = t('daily.finalTitle');
    if (finalTitle) finalTitle.textContent = t('daily.finalName');
    if (finalDesc) finalDesc.textContent = t('daily.finalDesc');

    summary.innerHTML = `
        <div class="daily-summary-line">${State.daily.claimAvailable ? t('daily.ready') : t('daily.todayClaimed')}</div>
        <div class="daily-summary-line subtle">${t('daily.nextReward', { day: Math.min(State.daily.nextDay || 1, DAILY_REWARD_MAX_DAYS) })}</div>
    `;

    actionButton.textContent = State.daily.claimAvailable ? t('daily.ready') : t('daily.wait');
    actionButton.disabled = !State.daily.claimAvailable;

    track.innerHTML = Array.from({ length: DAILY_REWARD_MAX_DAYS }, (_, index) => {
        const meta = getDailyRewardMeta(index + 1);
        const isClaimed = meta.day <= State.daily.claimedDays;
        const isCurrent = meta.day === Math.min(State.daily.nextDay || 1, DAILY_REWARD_MAX_DAYS);

        return `
            <div class="daily-reward-card ${isClaimed ? 'claimed' : ''} ${isCurrent ? 'current' : ''}" data-day="${meta.day}">
                <div class="daily-card-day">${t('daily.day', { day: meta.day })}</div>
                <div class="daily-card-title">${meta.title}</div>
                <div class="daily-card-value">${meta.primary}</div>
            </div>
        `;
    }).join('');

    if (teaserImage) {
        teaserImage.src = 'imgg/skins/retro.png';
        teaserImage.onerror = () => { teaserImage.src = 'imgg/skins/default.png'; };
    }
}

async function loadDailyRewardStatus() {
    if (!userId) return;
    try {
        const endpoint = `/api/daily-reward/status/${userId}`;
        const applyDailyStatus = (response = {}) => {
            State.daily.claimedDays = response.claimed_days || 0;
            State.daily.claimAvailable = !!response.claim_available;
            State.daily.loaded = true;
            State.daily.nextDay = response.next_day || Math.min(State.daily.claimedDays + 1, DAILY_REWARD_MAX_DAYS);
            applyBoostStateFromPayload({
                daily_infinite_energy_active: !!response.infinite_energy_active,
                daily_infinite_energy_expires_at: response.infinite_energy_expires_at || null
            });
            State.skins.data.forEach((skin) => {
                if (skin.requirement?.type === 'daily') {
                    skin.requirement.current = State.daily.claimedDays || 0;
                }
            });
            renderDailyRewardButton();
            renderDailyRewardsModal();
            renderSkins();
            updateCollectionProgress();
        };

        const response = await apiGetCached(endpoint, {
            ttlMs: 30_000,
            onFresh: (freshResponse) => applyDailyStatus(freshResponse)
        });
        applyDailyStatus(response);
    } catch (err) {
        if (DEBUG) console.warn('Daily reward status failed', err);
        State.daily.loaded = false;
        State.daily.claimAvailable = false;
        renderDailyRewardButton();
    }
}

function openDailyRewards() {
    advanceSoftOnboarding('daily');
    renderDailyRewardsModal();
    openModal('daily-screen');
    requestAnimationFrame(() => {
        const currentCard = document.querySelector(`.daily-reward-card[data-day="${Math.min(State.daily.nextDay || 1, DAILY_REWARD_MAX_DAYS)}"]`);
        currentCard?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
}

async function claimDailyReward() {
    const actionButton = document.getElementById('dailyRewardAction');
    if (!actionButton) return;
    actionButton.disabled = true;
    actionButton.textContent = '...';

    try {
        const response = await API.post('/api/daily-reward/claim', { user_id: userId });
        applyNonClickCoinsSnapshot('claimDailyReward', response);

        if (response.skin_id) {
            State.skins.owned = normalizeOwnedSkinIds([...(State.skins.owned || []), response.skin_id]);
            await loadSkinsList();
            renderSkins();
            updateCollectionProgress();
        }

        if (response.infinite_energy_expires_at) {
            State.daily.infiniteEnergyExpiresAt = response.infinite_energy_expires_at;
        }

        if (API?.invalidateCached && userId) {
            API.invalidateCached(`/api/daily-reward/status/${userId}`);
        }

        updateUI();
        showToast(`🎁 +${formatNumber(response.coins_reward || 0)}`);
        await loadDailyRewardStatus();
    } catch (err) {
        showToast(err?.detail || tr('toasts.serverError'), true);
        const actionButton = document.getElementById('dailyRewardAction');
        if (actionButton) {
            actionButton.textContent = t('daily.ready');
            actionButton.disabled = false;
        }
    }
}

// ==================== UI ОБНОВЛЕНИЕ ====================
let pendingUI = false;

function updateEnergyUIImmediate() {
    if (!tapAreaUi) return;
    const viewModel = tapAreaUi.buildViewModel({
        visualEnergy: getVisualEnergy(),
        maxEnergy: State.game.maxEnergy || 1
    });
    tapAreaUi.render(viewModel);
}

function updateUI() {
    if (pendingUI) return;
    const done = debugPerfStart('ui', 'updateUI');
    pendingUI = true;
    
    requestAnimationFrame(() => {
        if (hudUi) {
            const hudViewModel = hudUi.buildViewModel({
                coins: State.game.coins,
                profitPerHour: State.game.profitPerHour,
                profitPerTap: State.game.profitPerTap,
                isTaskPassiveBoostActive: isTaskPassiveBoostActive(),
                taskPassiveBoostMultiplier: State.temp.taskPassiveBoostMultiplier || 1,
                isTaskTapBoostActive: isTaskTapBoostActive(),
                taskTapBoostMultiplier: State.temp.taskTapBoostMultiplier || 1
            });
            hudUi.render(hudViewModel);
        }

        updateEnergyUIImmediate();

        if (bottomPanelUi) {
            const bottomViewModel = bottomPanelUi.buildViewModel({
                rawLevel: State.game.level,
                globalPrice: State.game.prices.global || 0
            });
            bottomPanelUi.render(bottomViewModel);
        }

        if (rebirthDomain && rebirthPanelUi) {
            rebirthPanelUi.render(rebirthDomain.buildAvailabilityViewModel());
        }

        maybePromptUpgradeOnboarding();
        
        pendingUI = false;
        done(true, { coins: State.game.coins, energy: State.game.energy, maxEnergy: State.game.maxEnergy });
    });
}

// ==================== ЭНЕРГИЯ ====================
function startPerfectEnergySystem() {
    if (State.temp.syncTimer) {
        clearInterval(State.temp.syncTimer);
    }

    if (State.temp.energyUiTimer) {
        clearInterval(State.temp.energyUiTimer);
    }

    // Плавное обновление UI
    State.temp.energyUiTimer = setInterval(() => {
        refreshEnergyUIOnly();
    }, isLitePerformanceMode() ? 400 : 250);

    // Редкий sync с сервером
    State.temp.syncTimer = setInterval(() => {
        if (!userId) return;
        syncEnergyWithServer();
    }, isLitePerformanceMode() ? CONFIG.ENERGY_SYNC_INTERVAL_LITE_MS : CONFIG.ENERGY_SYNC_INTERVAL_MS);
}

async function syncEnergyWithServer() {
    if (!userId) return;
    if (document.hidden) return;

    // SUPPRESSION: Do not sync if there is active tapping or a batch in flight.
    // - pendingEnergySpend > 0: Local taps are pending; server energy is stale (too high).
    // - clickBatchInFlight: Batch sent but response not received; server energy is stale.
    // Syncing during these states causes visible upward energy jumps.
    if (State.temp.pendingEnergySpend > 0 || State.temp.clickBatchInFlight) {
        return;
    }

    try {
        const data = await API.post('/api/sync-energy', { user_id: userId });

        // Ordering check: ignore stale responses
        const incomingTs = data.state_updated_at || data.state_version || 0;
        const currentTs = State.temp.lastStateUpdatedAtMs || 0;
        if (incomingTs > 0 && incomingTs <= currentTs) {
            return; // stale response, ignore
        }
        if (incomingTs > 0) {
            State.temp.lastStateUpdatedAtMs = incomingTs;
        }

        applyServerEnergySnapshot(data);
        updateUI();
    } catch (e) {
        console.error('Energy sync error:', e);
    }
}

async function fullSyncWithServer() {
    if (!userId) return;

    try {
        const data = await API.get(`/api/user/${userId}`);

        // Ordering check: ignore stale responses
        const incomingTs = data.state_updated_at || data.state_version || 0;
        const currentTs = State.temp.lastStateUpdatedAtMs || 0;
        if (incomingTs > 0 && incomingTs <= currentTs) {
            return; // stale response, ignore entirely
        }
        StateActions.setStateVersion(incomingTs);

        // BUGFIX: Correct balance reconciliation without double count
        // Server coins are authoritative snapshot at state_updated_at
        // Any optimistic delta from clicks AFTER that timestamp should be preserved
        const incomingCoins = Number(data.coins || 0);
        const currentConfirmed = State.game.coinsConfirmed || 0;
        const currentDelta = State.game.coinsOptimisticDelta || 0;
        const currentDisplay = State.game.coins || 0;
        
        // If incoming coins >= current display, server has caught up with all our clicks
        // Reset delta to 0 and use server coins as new confirmed base
        if (incomingCoins >= currentDisplay) {
            Store.set('game.coinsConfirmed', incomingCoins);
            Store.set('game.coinsOptimisticDelta', 0);
            Store.set('game.coins', incomingCoins);
        }
        // If incoming coins >= current confirmed but < current display,
        // server has caught up partially - use server as new confirmed, keep remaining delta
        else if (incomingCoins >= currentConfirmed) {
            const remainingDelta = currentDisplay - incomingCoins;
            Store.set('game.coinsConfirmed', incomingCoins);
            Store.set('game.coinsOptimisticDelta', Math.max(0, remainingDelta));
            Store.set('game.coins', incomingCoins + Math.max(0, remainingDelta));
        }
        // else: server coins are stale (< current confirmed), ignore entirely
        
        StateActions.applyProfitSnapshot(data);
        StateActions.applyProgressSnapshot(data);

        applyBoostStateFromPayload(data);
        
        // Apply energy only if timestamp is newer than current energy sync
        if (typeof data.energy === 'number') {
            const energyTs = incomingTs;
            const currentEnergyTs = State.temp.serverEnergySyncedAtMs || 0;
            if (energyTs > currentEnergyTs) {
                applyServerEnergySnapshot(data);
            }
        } else {
            applyServerEnergySnapshot(data);
        }
        
        updateUI();
    } catch (e) {
        console.error('Full sync error:', e);
    }
}

// ==================== КЛИКИ ====================
let lastBatchTime = 0;

async function sendClickBatch() {
    await clickDomain.sendClickBatch();
}

async function waitForClickBatchSettle(timeoutMs = 1200) {
    const startedAt = Date.now();
    while (State.temp.clickBatchInFlight) {
        if (Date.now() - startedAt >= timeoutMs) {
            return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return true;
}

async function syncCoinsBeforeUpgrade() {
    if (State.temp.clickBuffer > 0) {
        await clickDomain.sendClickBatch({ force: true });
    }
    await waitForClickBatchSettle(1200);
}

function hasPendingOptimisticCoins() {
    return Number(State.game.coinsOptimisticDelta || 0) > 0
        || Number(State.temp.clickBuffer || 0) > 0
        || Boolean(State.temp.clickBatchInFlight);
}

async function postUpgradeWithAutoSyncRetry(path, payload) {
    try {
        return await API.post(path, payload);
    } catch (err) {
        if (err?.status === 400 && err?.detail === 'Not enough coins' && hasPendingOptimisticCoins()) {
            await syncCoinsBeforeUpgrade();
            return await API.post(path, payload);
        }
        throw err;
    }
}

function buildTapInputContext(e) {
    const target = (e && e.target && e.target.closest) ? e.target : null;
    if (target && target.closest(
        'button, a, .nav-item, .settings-btn, .modal-close, ' +
        '.mini-boost-button, .auto-boost-button, .skin-category, .skin-card, .task-button, ' +
        '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
        '.modal-screen, .modal-content, .game-modal, .game-modal-content, .badge-card, ' +
        '.skin-detail-modal, .energy-recovery-modal, .ad-input-blocker, ' +
        '.prize-pool-shell, .prize-pool-drawer, .prize-pool-tab, .prize-pool-backdrop'
    )) return null;

    if (e.cancelable) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    if (e.touches && e.touches[0]) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
}

function handleTap(e) {
    const done = debugPerfStart('ui', 'handleTap');
    if (!DEBUG_BOOT.firstInteractiveLogged) {
        DEBUG_BOOT.firstInteractiveLogged = true;
        debugLog('perf', `first interactive ${Math.round(performance.now() - APP_BOOT_TS)}ms`);
    }
    if (State.temp.adInputBlocked) return;
    if (hasBlockingOverlayActive()) return;
    const isAutoTap = !!e?.syntheticAuto;
    const coords = buildTapInputContext(e);
    if (!coords) return;

    const tapTime = Date.now();
    const result = tapDomain.processTap({
        isAutoTap,
        tapTime,
        coords
    });
    if (!result?.ok) {
        done(false, { reason: result?.reason || 'tap_blocked' });
        return;
    }

    queueTapFeedback(result.payload);
    done(true, {
        autoTap: isAutoTap,
        previewGain: result.payload.previewGain,
        freeEnergyActive: result.payload.freeEnergyActive
    });
}

function queueTapFeedback({
    clientX,
    clientY,
    isAutoTap,
    previewGain,
    ghostBoostActive,
    dailyInfiniteEnergyActive,
    megaBoostActive
}) {
    tapFeedbackRenderer.render({
        clientX,
        clientY,
        isAutoTap,
        previewGain,
        ghostBoostActive,
        dailyInfiniteEnergyActive,
        megaBoostActive
    });
}

// ==================== СИНХРОНИЗАЦИЯ ====================
let syncTimer = null;
const SYNC_INTERVAL = 15000;

async function forceSync() {
    if (State.temp.clickBuffer > 0) {
        await sendClickBatch();
    }

    await fullSyncWithServer();
}

function startSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(forceSync, SYNC_INTERVAL);
}

// ==================== СКИНЫ ====================
let currentFilter = 'all';
let skinsDomain = window.SpiritSkinsDomain.createSkinsDomain({
    State,
    store: Store,
    API,
    tr,
    showToast,
    applySavedSkin,
    renderSkins,
    closeSkinDetail,
    setCharmImageFromSkin,
    updateCollectionProgress,
    userId: () => userId,
    isAdsgramReady,
    getAdCooldownRemainingMs,
    formatCooldownClock,
    openSkinDetail,
    openRewardedAdWithSession,
    confirmAdsgramAdSession,
    claimAdActionWithRetry,
    setAdCooldownFromIso,
    trackAchievementProgress,
    checkAchievements,
    resolveRewardedAdErrorMessage,
    debugLog
});

function getSkinById(id) {
    return State.skins.data.find(s => s.id === id);
}

function applySavedSkin() {
    const done = debugPerfStart('ui', 'applySavedSkin');
    const img = document.querySelector('.click-image');
    if (!img) {
        done(false, { reason: 'missing .click-image' });
        return;
    }
    
    const skin = getSkinById(State.skins.selected);
    const nextSrc = skin?.image || 'imgg/skins/default.png';
    if (img.dataset.skinSrc !== nextSrc) {
        img.dataset.skinSrc = nextSrc;
        img.src = nextSrc;
    }
    img.onerror = () => img.src = 'imgg/skins/default.png';
    done(true, { skinId: State.skins.selected, hasSkin: !!skin });
}

function renderSkins() {
    const grid = document.getElementById('skins-grid');
    if (!grid) return;
    
    let filtered = State.skins.data;
    if (currentFilter && currentFilter !== 'all') {
        filtered = filtered.filter(s => s.rarity === currentFilter);
    }
    
    if (!filtered || filtered.length === 0) {
        grid.innerHTML = `<div class="loading">${tr('skinsDyn.noSkins')}</div>`;
        return;
    }
    
    grid.innerHTML = filtered.map(skin => {
        const isOwned = State.skins.owned.includes(skin.id);
        const isSelected = State.skins.selected === skin.id;
        const isLocked = !isOwned;
        
        return `
            <div class="skin-card ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}" 
                 data-id="${skin.id}" onclick="openSkinDetail('${skin.id}')">
                <div class="skin-image">
                    <img src="${skin.image}" alt="${skin.name}" 
                         onerror="this.src='imgg/skins/default.png'">
                </div>
                <div class="skin-name">${skin.name}</div>
                <div class="skin-rarity ${skin.rarity}">${skin.rarity}</div>
                ${isLocked ? '<div class="skin-lock">🔒</div>' : ''}
                ${isSelected ? '<div class="skin-selected-badge">?</div>' : ''}
            </div>
        `;
    }).join('');
}

function filterSkins(category, event) {
    currentFilter = category;
    
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    else {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(category) || 
                (category === 'all' && btn.textContent === 'All')) {
                btn.classList.add('active');
            }
        });
    }
    
    renderSkins();
}

function selectSkin(id) {
    const skin = getSkinById(id);
    if (!skin) return;
    
    if (State.skins.owned.includes(id)) selectActiveSkin(id);
    else showToast(tr('toasts.skinLocked', { name: skin.name }), true);
}

async function selectSkinInternal(id, { closeDetail = false } = {}) {
    return skinsDomain.selectSkinInternal(id, { closeDetail });
}

async function selectActiveSkin(id) {
    await selectSkinInternal(id);
}

async function unlockSkinInternal(skinId, {
    closeDetail = false,
    applyCharm = false,
    showAlreadyOwnedToast = false,
    errorToastKey = 'toasts.skinUnlockError'
} = {}) {
    return skinsDomain.unlockSkinInternal(skinId, {
        closeDetail,
        applyCharm,
        showAlreadyOwnedToast,
        errorToastKey
    });
}

async function unlockSkin(id) {
    await unlockSkinInternal(id);
}

function openSkins() {
    openModal('skins-screen');
    requestAnimationFrame(() => {
        renderSkins();
    });
}

function getSkinEffect(skinId) {
    const skin = State.skins.data.find(s => s.id === skinId);
    if (!skin) return null;
    
    switch(skin.rarity) {
        case 'legendary': return { color: '#FFD700', particleColor: ['#FFD700', '#FFA500', '#FF4500'], particleCount: 15 };
        case 'super': return { color: '#FF6B6B', particleColor: ['#FF6B6B', '#FF8E8E', '#FFB6B6'], particleCount: 10 };
        case 'rare': return { color: '#4ECDC4', particleColor: ['#4ECDC4', '#6ED4CC', '#8EDBD4'], particleCount: 8 };
        default: return { color: '#7F49B4', particleColor: ['#7F49B4', '#9B6BDF', '#B88CE8'], particleCount: 5 };
    }
}

function openSkinDetail(skinId) {
    const skin = State.skins.data.find(s => s.id === skinId);
    if (!skin) return;
    
    const modal = document.getElementById('skin-detail-modal');
    if (!modal) return;
    modal.classList.add('active');
    syncModalOpenState();
    
    requestAnimationFrame(() => {
        const isOwned = State.skins.owned.includes(skin.id);
        const isSelected = State.skins.selected === skin.id;
        
        const detailImg = document.getElementById('skin-detail-img');
        detailImg.src = skin.image || 'imgg/clickimg.png';
        detailImg.dataset.skinId = skin.id;
        document.getElementById('skin-detail-name').textContent = skin.name || tr('skins.title');
        
        const rarityEl = document.getElementById('skin-detail-rarity');
        rarityEl.textContent = skin.rarity || 'common';
        rarityEl.className = 'skin-rarity-badge ' + (skin.rarity || 'common');
        
        const descriptionEl = document.getElementById('skin-detail-description');
        const descriptionText = (skin.description || '').trim();
        if (descriptionEl) {
            if (descriptionText) {
                descriptionEl.textContent = descriptionText;
                descriptionEl.style.display = '';
            } else {
                descriptionEl.textContent = '';
                descriptionEl.style.display = 'none';
            }
        }
        
        const bonusEl = document.getElementById('skin-detail-bonus');
        if (skin.bonus) {
            if (skin.bonus.type === 'multiplier') bonusEl.innerHTML = tr('skinsDyn.incomeBonus', { value: skin.bonus.value });
            else bonusEl.innerHTML = `? +${skin.bonus.value || 0}`;
        } else {
            bonusEl.innerHTML = tr('skinsDyn.noBonus');
        }
        
        const reqBlock = document.getElementById('skin-requirement-block');
        const reqText = document.getElementById('skin-requirement-text');
        const reqProgress = document.getElementById('skin-requirement-progress');
        const progressText = document.getElementById('requirement-progress-text');
        const progressFill = document.getElementById('requirement-progress-fill');
        const actionBtn = document.getElementById('skin-action-btn');
        actionBtn.disabled = false;
        
        if (isOwned) {
            reqBlock.style.display = 'none';
            actionBtn.textContent = isSelected ? tr('skinsDyn.selected') : tr('skinsDyn.select');
            actionBtn.onclick = isSelected ? closeSkinDetail : () => selectSkinFromDetail(skin.id);
        } else {
            reqBlock.style.display = 'block';
            
            if (skin.requirement?.type === 'level') {
                const current = getDisplayLevel(State.game.level);
                const value = skin.requirement.value || 1;
                const percent = Math.min(100, (current / value) * 100);
                
                reqText.textContent = tr('skinsDyn.reqLevel', { value });
                progressText.textContent = `${current}/${value}`;
                progressFill.style.width = percent + '%';
                reqProgress.style.display = 'flex';
                
                actionBtn.textContent = current >= value ? tr('skinsDyn.claim') : tr('skinsDyn.upgrade');
                actionBtn.onclick = current >= value ? () => unlockSkinFromDetail(skin.id) : () => {
                    closeSkinDetail();
                    switchTab('main');
                };
            } else if (skin.requirement?.type === 'ads') {
                const current = State.skins.adsWatched || 0;
                const count = skin.requirement.count || 1;
                const percent = Math.min(100, (current / count) * 100);
                
                reqText.textContent = tr('skinsDyn.reqWatch', { count });
                progressText.textContent = `${current}/${count}`;
                progressFill.style.width = percent + '%';
                reqProgress.style.display = 'flex';
                
                actionBtn.textContent = current >= count ? tr('skinsDyn.claim') : tr('skinsDyn.watchVideo');
                actionBtn.onclick = current >= count ? () => unlockSkinFromDetail(skin.id) : () => watchAdForSkin(skin.id);
            } else if (skin.requirement?.type === 'videos') {
                const key = skin.requirement.progressKey || skin.id;
                const current = State.skins.videoViews[key] || 0;
                const count = skin.requirement.count || 10;
                const percent = Math.min(100, (current / count) * 100);
                const cooldownRemainingMs = getAdCooldownRemainingMs(`skin:${key}`);

                reqText.textContent = tr('skinsDyn.reqWatchSkin', { count });
                progressText.textContent = `${current}/${count}`;
                progressFill.style.width = percent + '%';
                reqProgress.style.display = 'flex';

                if (current >= count) {
                    actionBtn.textContent = tr('skinsDyn.claim');
                    actionBtn.onclick = () => unlockSkinFromDetail(skin.id);
                } else if (cooldownRemainingMs > 0) {
                    actionBtn.textContent = `Cooldown ${formatCooldownClock(cooldownRemainingMs / 1000)}`;
                    actionBtn.onclick = null;
                    actionBtn.disabled = true;
                } else {
                    actionBtn.textContent = tr('skinsDyn.watchVideo');
                    actionBtn.onclick = () => watchAdForSkin(skin.id);
                }
            } else if (skin.requirement?.type === 'ton') {
                reqText.textContent = tr('skinsDyn.reqTon', { price: skin.requirement.price });
                reqProgress.style.display = 'none';
                actionBtn.textContent = tr('skinsDyn.buy');
                actionBtn.onclick = () => buySkinWithTon(skin);
            } else {
                reqText.textContent = tr('skinsDyn.reqSpecial');
                reqProgress.style.display = 'none';
                actionBtn.textContent = tr('skinsDyn.unavailable');
            }
        }
    });
}

function closeSkinDetail() {
    document.getElementById('skin-detail-modal')?.classList.remove('active');
    syncModalOpenState();
}

async function selectSkinFromDetail(skinId) {
    await selectSkinInternal(skinId, { closeDetail: true });
}

async function unlockSkinFromDetail(skinId) {
    await unlockSkinInternal(skinId, {
        closeDetail: true,
        applyCharm: true,
        showAlreadyOwnedToast: true,
        errorToastKey: 'toasts.skinClaimError'
    });
}

async function buySkinWithTon(skin) {
    if (!userId) {
        showToast(tr('toasts.authRequired'), true);
        return;
    }

    if (!tonConnectUI) {
        showToast(tr('toasts.tonWalletUnavailable'), true);
        return;
    }

    if (!tonConnectUI?.wallet?.account?.address) {
        showToast(tr('toasts.tonWalletUnavailable'), true);
        await connectTonWallet();
        return;
    }

    try {
        const response = await API.post('/api/skins/ton-invoice', {
            user_id: userId,
            skin_id: skin.id
        });

        if (!response?.transaction?.messages?.length) {
            showToast(tr('toasts.starsInvoiceError'), true);
            return;
        }

        await tonConnectUI.sendTransaction(response.transaction);

        let unlocked = false;
        let lastErr = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            try {
                const confirm = await API.post('/api/skins/ton-purchase-confirm', {
                    user_id: userId,
                    skin_id: skin.id
                });
                if (confirm?.success && confirm?.unlocked) {
                    unlocked = true;
                    break;
                }
            } catch (confirmErr) {
                lastErr = confirmErr;
                if ((confirmErr?.detail || '').includes('Payment not found yet')) {
                    await new Promise((resolve) => setTimeout(resolve, 1800));
                    continue;
                }
                throw confirmErr;
            }
        }

        if (!unlocked) {
            throw lastErr || new Error('Payment not found yet');
        }

        showToast(tr('toasts.starsSuccess'));
        await loadUserData();
        renderSkins();
        updateCollectionProgress();
        openSkinDetail(skin.id);
    } catch (err) {
        if (err?.detail === 'Skin already owned') {
            showToast(tr('toasts.skinAlreadyOwned'));
            await loadUserData();
            renderSkins();
            updateCollectionProgress();
            openSkinDetail(skin.id);
            return;
        }

        showToast(err?.detail || tr('toasts.starsInvoiceError'), true);
    }
}

async function watchAdForSkin(skinId) {
    await skinsDomain.watchAdForSkin(skinId);
}

function updateCollectionProgress() {
    const validIds = new Set(State.skins.data.map((skin) => skin.id));
    const collected = normalizeOwnedSkinIds(State.skins.owned).filter((id) => validIds.has(id)).length;
    const total = State.skins.data.length || 21;
    const percent = (collected / total) * 100;
    
    document.getElementById('skins-collected').textContent = collected;
    document.getElementById('skins-total').textContent = total;
    document.getElementById('skins-progress-fill').style.width = percent + '%';
}

// ==================== УЛУЧШЕНИЯ ====================
let upgradeInProgress = false;
let queuedUpgradeAllCount = 0;
let nextUpgradeRequestAt = 0;
const UPGRADE_REQUEST_GAP_MS = 380;

function getUpgradeAllPrice() {
    return State.game.prices.global || 0;
}

function triggerUpgradeHaptics() {
    if (!State.settings.vibration) return;

    try {
        if (tg?.HapticFeedback) {
            let pulses = 0;
            const interval = setInterval(() => {
                try {
                    tg.HapticFeedback.impactOccurred(pulses > 4 ? 'heavy' : 'medium');
                } catch (err) {}
                pulses += 1;
                if (pulses >= 7) clearInterval(interval);
            }, 320);
        } else if (navigator.vibrate) {
            navigator.vibrate([180, 80, 220, 90, 260, 100, 320, 120, 360]);
        }
    } catch (err) {}
}

function triggerUpgradeBurst() {
    if (isLitePerformanceMode()) return;

    const wrapper = document.querySelector('.click-button-wrapper');
    if (!wrapper) return;

    let layer = wrapper.querySelector('.upgrade-burst-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.className = 'upgrade-burst-layer';
        wrapper.prepend(layer);
    }

    layer.innerHTML = '';
    layer.classList.remove('is-active');
    layer.offsetWidth;

    for (let i = 0; i < 16; i += 1) {
        const spark = document.createElement('span');
        spark.className = 'upgrade-spark';
        spark.style.setProperty('--spark-angle', `${(360 / 16) * i + (Math.random() * 16 - 8)}deg`);
        spark.style.setProperty('--spark-distance', `${150 + Math.random() * 75}px`);
        spark.style.setProperty('--spark-delay', `${Math.random() * 0.7}s`);
        spark.style.setProperty('--spark-duration', `${1.6 + Math.random() * 0.8}s`);
        spark.style.setProperty('--spark-scale', `${0.8 + Math.random() * 0.6}`);
        layer.appendChild(spark);
    }

    layer.classList.add('is-active');
    clearTimeout(layer.cleanupTimer);
    layer.cleanupTimer = setTimeout(() => {
        layer.classList.remove('is-active');
        layer.innerHTML = '';
    }, 4000);
}

function playUpgradeCelebration() {
    playUpgradeSound();
    triggerUpgradeHaptics();
    triggerUpgradeBurst();
}

async function upgradeBoost(type, internal = false) {
    if (upgradeInProgress && !internal) return;
    if (!userId) return;
    
    const price = State.game.prices[type];
    if (!price || State.game.coins < price) {
        showToast(tr('toasts.notEnoughCoins', { amount: price }), true);
        return;
    }

    if (!internal) upgradeInProgress = true;
    
    try {
        const result = await postUpgradeWithAutoSyncRetry('/api/upgrade', {
            user_id: userId,
            boost_type: type
        });
        
        if (result) {
            applyNonClickCoinsSnapshot('upgradeBoost', result);
            State.game.level = Number(
                result.level
                ?? result.new_level
                ?? result.levels?.multitap
                ?? State.game.level
            );
            State.game.levels.multitap = State.game.level;
            State.game.levels.profit = State.game.level;
            State.game.levels.energy = State.game.level;
            State.game.prices.global = result.next_cost || 0;
            State.game.prices.multitap = result.next_cost || 0;
            State.game.prices.profit = result.next_cost || 0;
            State.game.prices.energy = result.next_cost || 0;
            if (API?.setCached && userId) {
                API.setCached(`/api/upgrade-prices/${userId}`, {
                    global: State.game.prices.global || 0,
                    multitap: State.game.prices.multitap || 0,
                    profit: State.game.prices.profit || 0,
                    energy: State.game.prices.energy || 0
                });
            }
            trackAchievementProgress('upgrades', 1);
            
        if (result.profit_per_tap) State.game.profitPerTap = result.profit_per_tap;
        if (result.profit_per_hour) State.game.profitPerHour = result.profit_per_hour;
        if (result.max_energy) {
            State.game.maxEnergy = result.max_energy;
            // Upgrade refills energy to max — update authoritative base
            State.temp.serverEnergyBase = result.max_energy;
            State.temp.serverMaxEnergy = result.max_energy;
            // Use server_time if available, otherwise fall back to Date.now()
            if (result.server_time) {
                try {
                    State.temp.serverEnergySyncedAtMs = new Date(result.server_time).getTime();
                } catch (_) {
                    State.temp.serverEnergySyncedAtMs = Date.now();
                }
            } else {
                State.temp.serverEnergySyncedAtMs = Date.now();
            }
            State.temp.pendingEnergySpend = 0;
            State.game.energy = result.max_energy;
        }
        playUpgradeCelebration();
        updateUI();
        checkAchievements();
        advanceSoftOnboarding('upgrade');
    }
    } catch (err) {
        if (err.status === 429) {
            showToast(tr('toasts.upgradeBusy'), true);
            return;
        }
        if (err.status === 400 && err.detail === 'Max level reached') {
            showToast(tr('toasts.maxLevel'), true);
            return;
        }
        if (err.status === 400 && err.detail === 'Not enough coins') {
            showToast(tr('toasts.notEnoughCoins', { amount: price }), true);
            return;
        }
        showToast(`${tr('toasts.serverError')}${err.status ? ' ' + err.status : ''}`, true);
    } finally {
        if (!internal) upgradeInProgress = false;
    }
}

async function upgradeAll(internal = false) {
    if (!userId) return;

    if (upgradeInProgress) {
        queuedUpgradeAllCount = Math.min(queuedUpgradeAllCount + 1, 25);
        return;
    }

    upgradeInProgress = true;
    try {
        const total = getUpgradeAllPrice();
        if (State.game.coins < total) {
            if (!internal) {
                showToast(tr('toasts.notEnoughCoins', { amount: formatNumber(total) }), true);
            }
            queuedUpgradeAllCount = 0;
            return;
        }

        nextUpgradeRequestAt = Date.now() + UPGRADE_REQUEST_GAP_MS;
        const result = await postUpgradeWithAutoSyncRetry('/api/upgrade-all', {
            user_id: userId,
            boost_type: 'global'
        });
        
        if (!result) {
            showToast(tr('toasts.upgradeApplyError'), true);
            return;
        }
        
        applyNonClickCoinsSnapshot('upgradeAll', result);
        State.game.level = Number(
            result.level
            ?? result.new_level
            ?? result.levels?.multitap
            ?? State.game.level
        );
        State.game.levels.multitap = State.game.level;
        State.game.levels.profit = State.game.level;
        State.game.levels.energy = State.game.level;
        State.game.prices = { ...State.game.prices, ...(result.prices || {}) };
        if (result.next_cost) {
            State.game.prices.global = result.next_cost;
            State.game.prices.multitap = result.next_cost;
            State.game.prices.profit = result.next_cost;
            State.game.prices.energy = result.next_cost;
            if (API?.setCached && userId) {
                API.setCached(`/api/upgrade-prices/${userId}`, {
                    global: State.game.prices.global || 0,
                    multitap: State.game.prices.multitap || 0,
                    profit: State.game.prices.profit || 0,
                    energy: State.game.prices.energy || 0
                });
            }
        }
        State.game.profitPerTap = result.profit_per_tap ?? State.game.profitPerTap;
        State.game.profitPerHour = result.profit_per_hour ?? State.game.profitPerHour;
        State.game.maxEnergy = result.max_energy ?? State.game.maxEnergy;
        // Energy refill sets energy to max — update authoritative base
        State.temp.serverEnergyBase = result.max_energy ?? State.game.maxEnergy;
        State.temp.serverMaxEnergy = result.max_energy ?? State.game.maxEnergy;
        // Use server_time if available, otherwise fall back to Date.now()
        if (result.server_time) {
            try {
                State.temp.serverEnergySyncedAtMs = new Date(result.server_time).getTime();
            } catch (_) {
                State.temp.serverEnergySyncedAtMs = Date.now();
            }
        } else {
            State.temp.serverEnergySyncedAtMs = Date.now();
        }
        State.temp.pendingEnergySpend = 0;
        State.game.energy = State.game.maxEnergy;
        trackAchievementProgress('upgrades', 3);
        playUpgradeCelebration();
        updateUI();
        checkAchievements();
        advanceSoftOnboarding('upgrade');
    } catch (err) {
        if (err.status === 429) {
            if (internal || queuedUpgradeAllCount > 0) {
                queuedUpgradeAllCount = Math.min(queuedUpgradeAllCount + 1, 25);
                return;
            }
            return;
        }
        if (err.status === 400 && err.detail === 'Not enough coins') {
            if (!internal) {
                showToast(tr('toasts.fullUpgradeNoCoins'), true);
            }
            queuedUpgradeAllCount = 0;
            return;
        }
        if (err.status === 400 && err.detail === 'Max level reached') {
            if (!internal) {
                showToast(tr('toasts.fullUpgradeMax'), true);
            }
            queuedUpgradeAllCount = 0;
            return;
        }
        showToast(`${tr('toasts.serverError')}${err.status ? ' ' + err.status : ''}`, true);
    } finally {
        upgradeInProgress = false;
        if (queuedUpgradeAllCount > 0) {
            queuedUpgradeAllCount -= 1;
            const delay = Math.max(40, nextUpgradeRequestAt - Date.now());
            setTimeout(() => upgradeAll(true), delay);
        }
    }
}

function playUpgradeSound() {
    if (!State.settings.sound) return;
    try {
        const audioCtx = getAudioContextForSfx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        for (let i = 0; i < 3; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400 + i * 200, now + i * 0.1);
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        }
    } catch (err) {}
}

// ==================== ВИДЕО-ЗАДАНИЯ ====================
const VIDEO_TASKS = [
    {
        id: 'tap_surge',
        title: 'Tap Surge',
        description: 'x2 tap income for 5 minutes',
        reward: 'x2 • 5 min',
        icon: '✨',
        type: 'tap_boost',
        cooldown: 75,
        lastUsed: null,
        category: 'boost',
        tag: 'tap',
        completed: false,
        available: true
    },
    {
        id: 'passive_hour',
        title: 'Passive Hour',
        description: 'x2 passive income for 60 minutes',
        reward: 'x2 • 60 min',
        icon: '?',
        type: 'passive_boost',
        cooldown: 240,
        lastUsed: null,
        category: 'passive',
        tag: 'passive',
        completed: false,
        available: true
    },
    {
        id: 'coin_drop',
        title: 'Coin Drop',
        description: 'Random reward from 200 to 30,000 coins',
        reward: '200-30K',
        icon: '✨',
        type: 'coin_drop',
        cooldown: 60,
        lastUsed: null,
        category: 'coins',
        tag: 'drop',
        completed: false,
        available: true
    }
];

const SOCIAL_COMPLETED_COLLAPSED_KEY = 'socialCompletedCollapsed';
const FORCE_COLLAPSE_COMPLETED_SOCIAL_TASKS = true;

function persistSocialTasksState() {
    const payload = {};
    Object.entries(State.tasks.social || {}).forEach(([taskId, taskState]) => {
        payload[taskId] = { completed: !!taskState?.completed };
    });
    localStorage.setItem(SOCIAL_TASKS_STORAGE_KEY, JSON.stringify(payload));
}

function isCompletedSocialTasksCollapsed() {
    if (FORCE_COLLAPSE_COMPLETED_SOCIAL_TASKS) return true;
    const raw = localStorage.getItem(SOCIAL_COMPLETED_COLLAPSED_KEY);
    // Default to collapsed so completed tasks stay closed unless user expands manually.
    if (raw === null) return true;
    return raw === '1';
}

function toggleCompletedSocialTasks() {
    if (FORCE_COLLAPSE_COMPLETED_SOCIAL_TASKS) {
        localStorage.setItem(SOCIAL_COMPLETED_COLLAPSED_KEY, '1');
        renderVideoTasks();
        return;
    }
    const nextValue = isCompletedSocialTasksCollapsed() ? '0' : '1';
    localStorage.setItem(SOCIAL_COMPLETED_COLLAPSED_KEY, nextValue);
    renderVideoTasks();
}

function setCompletedSocialTasksCollapsed(collapsed = true) {
    if (FORCE_COLLAPSE_COMPLETED_SOCIAL_TASKS) {
        localStorage.setItem(SOCIAL_COMPLETED_COLLAPSED_KEY, '1');
        return;
    }
    localStorage.setItem(SOCIAL_COMPLETED_COLLAPSED_KEY, collapsed ? '1' : '0');
}

rebirthDomain = window.SpiritRebirthDomain.createRebirthDomain({
    State,
    store: Store,
    userId: () => userId,
    API,
    openModal,
    closeModal,
    setConfirmBusy: (...args) => modalLayerUi?.setRebirthConfirmBusy(...args),
    showToast,
    updateUI,
    formatNumber,
    StateActions
});

socialTasksDomain = window.SpiritSocialTasksDomain.createSocialTasksDomain({
    State,
    StateActions,
    API,
    SOCIAL_TASKS,
    CPA_TASKS,
    userId: () => userId,
    tg,
    persistSocialTasksState,
    isCompletedSocialTasksCollapsed,
    setCompletedSocialTasksCollapsed,
    renderVideoTasks,
    showToast,
    tr,
    applyNonClickCoinsSnapshot,
    normalizeOwnedSkinIds,
    loadSkinsList,
    renderSkins,
    updateCollectionProgress,
    updateUI,
    DEBUG
});

async function loadSocialTasksStatus() {
    return socialTasksDomain.loadSocialTasksStatus();
}

function renderSocialTasksMarkup() {
    return socialTasksDomain.renderSocialTasksMarkup();
}

function startSocialTask(taskId) {
    return socialTasksDomain.startSocialTask(taskId);
}

function startCpaTask(taskId) {
    return socialTasksDomain.startCpaTask(taskId);
}

async function claimSocialTask(taskId) {
    return socialTasksDomain.claimSocialTask(taskId);
}

async function loadVideoTasks() {
    const done = debugPerfStart('ui', 'tasks load');
    const container = document.getElementById('tasks-list');
    if (!container) {
        done(false, { reason: 'tasks-list missing' });
        return;
    }

    renderVideoTasks();

    Promise.allSettled([
        loadSocialTasksStatus(),
        userId
            ? apiGetCached(`/api/video-tasks/status/${userId}`, {
                ttlMs: 45_000,
                onFresh: (freshVideoStatus) => {
                    tasksEventsDomain.applyVideoTaskStatus(freshVideoStatus);
                    renderVideoTasks();
                }
            })
            : Promise.resolve(null)
    ]).then(([socialResult, videoResult]) => {
        if (videoResult.status === 'fulfilled' && videoResult.value) {
            tasksEventsDomain.applyVideoTaskStatus(videoResult.value);
        } else if (videoResult.status === 'rejected') {
            if (DEBUG) console.warn('Video task status failed', videoResult.reason);
            tasksEventsDomain.resetVideoTaskStatus();
        }
        renderVideoTasks();
        done(true, { social: socialResult.status, video: videoResult.status });
    });
}

function renderVideoTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;

    const socialMarkup = renderSocialTasksMarkup();
    const videoMarkup = VIDEO_TASKS.map(task => {
        const view = tasksEventsDomain.buildVideoTaskViewModel(task, {
            I18N,
            UI_LANG,
            tFn: t
        });
        const available = view.available;
        const timeLeft = view.timeLeft;

        return `
            <div class="task-card task-card-simple ${available ? 'ready' : 'cooldown'}" data-category="${task.category}">
                <div class="task-copy-simple">
                    <div class="task-title">${view.title}</div>
                    <div class="task-desc">${view.stateText}</div>
                </div>
                <div class="task-actions-simple">
                    <span class="task-reward-pill task-reward-pill-simple">${view.rewardLabel}</span>
                    <button class="task-action task-action-simple ${task.category}" onclick="handleVideoTask('${task.id}')" ${!available ? 'disabled' : ''}>
                        ${available ? `🎬 ${view.actionLabel}` : `⏳ ${view.actionLabel}`}
                    </button>
                </div>
                ${!available && timeLeft > 0 ? `
                    <div class="task-note-simple">? ${t('tasks.refreshIn', { time: timeLeft })}</div>
                ` : ''}
                ${available ? `
                    <div class="task-note-simple">${t('tasks.launchReward')}</div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `${socialMarkup}${videoMarkup}`;
}
async function handleVideoTask(taskId) {
    return watchVideoForTask(taskId);
}

function giveRandomReward() {
    const rewards = [
        { type: 'coins', value: 1000 },
        { type: 'coins', value: 2000 },
        { type: 'coins', value: 5000 },
        { type: 'energy', value: 50 },
        { type: 'boost', multiplier: 2, minutes: 5 },
        { type: 'skin_chance', rarity: 'common' }
    ];
    
    const random = rewards[Math.floor(Math.random() * rewards.length)];
    
    switch(random.type) {
        case 'coins':
            addCoins('randomReward', random.value, { reward: random.value });
            showToast(`💰 +${random.value} ${tr('tasks.coinsSuffix')}`);
            break;
        case 'energy':
            // Visual-only energy reward (task/ad bonus). Does NOT affect
            // authoritative gameplay energy — just a temporary visual bonus.
            // Do NOT clear pendingEnergySpend — that would lose track of
            // real gameplay energy spent on taps.
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + random.value);
            showToast(`⚡ +${random.value} energy!`);
            break;
        case 'boost':
            activateCustomBoost(random.multiplier, random.minutes);
            break;
        case 'skin_chance':
            showToast(tr('toasts.serverError'), true);
            break;
    }
}
function activateCustomBoost(multiplier, minutes) {
    // Сохраняем оригинальный доход
    if (!State.temp.originalProfit) {
        State.temp.originalProfit = State.game.profitPerTap;
    }
    
    // Увеличиваем доход
    State.game.profitPerTap *= multiplier;
    showToast(`🚀 x${multiplier} for ${minutes} min!`);
    
    // Возвращаем обратно через N минут
    setTimeout(() => {
        State.game.profitPerTap = State.temp.originalProfit;
        State.temp.originalProfit = null;
        updateUI();
        showToast(tr('toasts.boostFinished'));
    }, minutes * 60 * 1000);
    
    updateUI();
}

async function watchVideoForTask(taskId) {
    console.log(`AD_TRACE_TASK_START taskId=${taskId}`);
    const task = VIDEO_TASKS.find(t => t.id === taskId);
    if (!task || task.completed || !task.available) {
        console.log(`AD_TRACE_TASK_SKIP taskId=${taskId} completed=${task?.completed} available=${task?.available}`);
        return;
    }
    
    if (!isAdsgramReady()) {
        console.log(`AD_TRACE_TASK_NOT_READY taskId=${taskId}`);
        showToast(tr('toasts.adUnavailableTemp'), true);
        return;
    }
    
    showToast(tr('toasts.videoLoading'));
    
    try {
        console.log(`AD_TRACE_TASK_OPEN_START taskId=${taskId}`);
        const adSessionId = await openRewardedAdWithSession('video_task');
        console.log(`AD_TRACE_TASK_OPEN_END taskId=${taskId} sessionId=${adSessionId}`);
        await confirmAdsgramAdSession(adSessionId);
        console.log(`AD_TRACE_TASK_CONFIRM_END taskId=${taskId}`);
        trackAchievementProgress('adsWatched', 1);

        const response = await claimAdActionWithRetry(() => claimVideoReward(task, adSessionId));
        console.log(`AD_TRACE_TASK_CLAIM_END taskId=${taskId} coins=${response?.coins}`);
        if (API?.invalidateCached && userId) {
            API.invalidateCached(`/api/video-tasks/status/${userId}`);
        }

        if (typeof response?.coins === 'number') {
            applyNonClickCoinsSnapshot('watchVideoForTask', response);
            debugLog('ads', 'reward applied in UI', { flow: 'video_task', taskId: task.id, coins: response.coins });
        }

        applyTaskBoostPayload(response);
        updateUI();
        await loadVideoTasks();
        showToast(response?.message || tr('toasts.rewardReceived'), false, {
            title: task.title,
            variant: 'reward',
            side: task.category === 'passive' ? 'right' : 'left'
        });
        createConfetti();
        console.log(`AD_TRACE_TASK_SUCCESS taskId=${taskId}`);
    } catch (error) {
        console.log(`AD_TRACE_TASK_ERROR taskId=${taskId} error=${error?.message} stack=${error?.stack}`);
        console.error('Video error:', error);
        showToast(
            isAdConfirmationPendingError(error)
                ? tr('toasts.adNotConfirmed')
                : (error?.detail || error?.message || tr('toasts.watchError')),
            true
        );
    }
}

async function claimVideoReward(task, adSessionId) {
    if (!userId) {
        throw new Error(tr('toasts.authRequired'));
    }

    return API.post('/api/video-tasks/claim', {
        user_id: userId,
        ad_session_id: adSessionId,
        task_id: task.id
    });
}

// ==================== РЕФЕРАЛЫ ====================
async function loadReferralData() {
    if (!userId) return;
    try {
        const link = `https://t.me/Ryoho_bot?start=ref_${userId}`;
        const linkEl = document.getElementById('referral-link');
        if (linkEl) linkEl.textContent = link;

        const endpoint = `/api/referral-data/${userId}`;
        const applyReferralData = (data = {}) => {
            document.getElementById('referral-count').textContent = data.count || 0;
            document.getElementById('referral-earnings').textContent = data.earnings || 0;
            
            State.skins.friendsInvited = data.count || 0;
            handleReferralToast(State.skins.friendsInvited);
            State.skins.data.forEach((skin) => {
                if (skin.requirement?.type === 'friends') {
                    skin.requirement.current = State.skins.friendsInvited || 0;
                }
            });
            renderSkins();
            updateCollectionProgress();
            checkAchievements();
        };

        const data = await apiGetCached(endpoint, {
            ttlMs: 60_000,
            onFresh: (freshData) => applyReferralData(freshData)
        });
        applyReferralData(data);
    } catch (err) {
        console.error('Referral error:', err);
    }
}

function copyReferralLink() {
    const linkEl = document.getElementById('referral-link');
    const linkText = linkEl?.textContent?.trim();
    if (!linkText || linkText === 'loading...' || linkText === t('common.loading')) {
        showToast(tr('toasts.linkNotLoaded'), true);
        return;
    }
    navigator.clipboard?.writeText(linkText)
        .then(() => showToast(tr('toasts.linkCopied')))
        .catch(() => showToast(tr('toasts.copyError'), true));
}

function shareReferral() {
    const linkEl = document.getElementById('referral-link');
    const linkText = linkEl?.textContent?.trim();
    if (!linkText || linkText === 'loading...' || linkText === t('common.loading')) {
        showToast(tr('toasts.linkNotLoaded'), true);
        return;
    }
    const shareText = `🔥 ${t('friends.shareText')}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(linkText)}&text=${encodeURIComponent(shareText)}`, '_blank');
}

// ==================== НАСТРОЙКИ ====================
function loadSettings() {
    document.documentElement.lang = UI_LANG;
    applyTheme();
    updateSettingsUI();
}

function saveSettings() {
    localStorage.setItem('ryohoSettings', JSON.stringify(State.settings));
    const bgm = State.temp.bgm.audio;
    if (bgm) {
        State.temp.bgm.enabled = State.settings.music;
        if (State.settings.music) bgm.play().catch(() => {});
        else bgm.pause();
    }
}

function applyTheme() {
    if (State.settings.theme === 'night') document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');
}

function toggleTheme() {
    State.settings.theme = State.settings.theme === 'day' ? 'night' : 'day';
    saveSettings();
    applyTheme();
    updateSettingsUI();
}

function toggleSound() {
    State.settings.sound = !State.settings.sound;
    saveSettings();
    updateSettingsUI();
}

function toggleMusic() {
    State.settings.music = !State.settings.music;
    saveSettings();
    updateSettingsUI();
}

function toggleVibration() {
    State.settings.vibration = !State.settings.vibration;
    saveSettings();
    updateSettingsUI();
    if (State.settings.vibration && navigator.vibrate) navigator.vibrate(50);
}

function setLanguage(language) {
    const nextLang = normalizeUiLanguage(language);
    if (nextLang === UI_LANG) return;
    UI_LANG = nextLang;
    State.settings.language = nextLang;
    saveSettings();
    document.documentElement.lang = nextLang;
    window.location.reload();
}

function updateSettingsUI() {
    const isNight = State.settings.theme === 'night';
    const soundOn = State.settings.sound;
    const musicOn = State.settings.music;
    const vibOn = State.settings.vibration;
    const lang = normalizeUiLanguage(State.settings.language || UI_LANG);
    
    setToggle('themeTrack', isNight);
    setIcon('themeIcon', isNight ? '🌙' : '☀️');
    setLabel('themeLabel', isNight ? t('common.night') : t('common.day'));
    setLabel('languageLabel', lang === 'ru' ? t('common.russian') : t('common.english'));
    
    setToggle('soundTrack', soundOn);
    setIcon('soundIcon', soundOn ? '🔊' : '🔇');
    setLabel('soundLabel', soundOn ? t('common.on') : t('common.off'));

    setToggle('musicTrack', musicOn);
    setIcon('musicIcon', musicOn ? '🎵' : '🔇');
    setLabel('musicLabel', musicOn ? t('common.on') : t('common.off'));
    
    setToggle('vibTrack', vibOn);
    setIcon('vibIcon', vibOn ? '📳' : '📴');
    setLabel('vibLabel', vibOn ? t('common.on') : t('common.off'));

    document.getElementById('lang-en-btn')?.classList.toggle('active', lang === 'en');
    document.getElementById('lang-ru-btn')?.classList.toggle('active', lang === 'ru');
}

function setToggle(id, active) {
    const el = document.getElementById(id);
    if (el) active ? el.classList.add('active') : el.classList.remove('active');
}

function setIcon(id, icon) {
    const el = document.getElementById(id);
    if (el) el.textContent = icon;
}

function setLabel(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function applyStaticTranslations() {
    const textMap = [
        ['[data-ui="header-tasks-label"]', 'nav.tasks'],
        ['[data-ui="header-daily-label"]', 'nav.daily'],
        ['[data-ui="hud-per-hour-label"]', 'common.perHour'],
        ['[data-ui="hud-per-tap-label"]', 'common.perTap'],
        
        ['[data-ui="bottom-upgrade-title"]', 'main.upgrade'],
        ['[data-ui="nav-main-label"]', 'nav.main'],
        ['[data-ui="nav-friends-label"]', 'nav.friends'],
        ['[data-ui="nav-wallet-label"]', 'nav.wallet'],
        ['[data-ui="nav-games-label"]', 'nav.games'],
        ['[data-ui="nav-skins-label"]', 'nav.skins'],
        ['#friends-screen .modal-header h2', 'friends.title'],
        ['#friends-screen .stat-small:nth-child(1) .stat-small-label', 'friends.invited'],
        ['#friends-screen .stat-small:nth-child(2) .stat-small-label', 'friends.earned'],
        ['#friends-screen .referral-link-label', 'friends.referralLink'],
        ['#friends-screen .btn-primary', 'friends.copyLink'],
        ['#friends-screen .btn-secondary', 'friends.share'],
        ['#friends-screen .referral-rules h3', 'friends.bonuses'],
        ['#friends-screen .referral-rules li:nth-child(1)', 'friends.bonus1'],
        ['#friends-screen .referral-rules li:nth-child(2)', 'friends.bonus2'],
        ['#friends-screen .referral-rules li:nth-child(3)', 'friends.bonus3'],
        ['#friends-screen .referral-rules li:nth-child(4)', 'friends.bonus4'],
        ['#tasks-screen .modal-kicker', 'tasks.kicker'],
        ['#tasks-screen .modal-header-copy h2', 'achievements.title'],
        ['#tasks-hub-tab-tasks', 'nav.tasks'],
        ['#tasks-hub-tab-achievements', 'achievements.title'],
        ['#tasks-screen .tasks-hero-title', 'tasks.heroTitle'],
        ['#tasks-screen .tasks-hero-subtitle', 'tasks.heroSubtitle'],
        ['#tasks-screen .tasks-hero-badge-label', 'tasks.heroLabel'],
        ['#tasks-screen .tasks-hero-badge-value', 'tasks.heroValue'],
        ['#tasks-screen .tasks-list .loading', 'common.loading'],
        ['#dailyRewardKicker', 'daily.subtitle'],
        ['#dailyRewardTitle', 'daily.title'],
        ['#dailyRewardFinalKicker', 'daily.finalTitle'],
        ['#dailyRewardFinalTitle', 'daily.finalName'],
        ['#dailyRewardFinalDesc', 'daily.finalDesc'],
        ['#games-screen .modal-kicker', 'games.kicker'],
        ['#games-screen .modal-header-copy h2', 'games.title'],
        ['#games-screen .games-hero-title', 'games.heroTitle'],
        ['#games-screen .games-hero-subtitle', 'games.heroSubtitle'],
        ['#games-screen .games-hero-jackpot-label', 'games.potential'],
        ['#prize-pool-tab-text', 'games.drawerTab'],
        ['#prize-pool-kicker', 'games.drawerKicker'],
        ['#prize-pool-title', 'games.drawerTitle'],
        ['#prize-pool-season-label', 'games.drawerSeason'],
        ['#prize-pool-ends-label', 'games.drawerEnds'],
        ['#prize-pool-leagues-title', 'games.drawerLeagues'],
        ['#prize-pool-rules-title', 'games.drawerRewards'],
        ['#prize-pool-player-title', 'games.drawerPlayer'],
        ['#prize-pool-player-league-label', 'games.drawerLeague'],
        ['#prize-pool-player-rank-label', 'games.drawerRank'],
        ['#prize-pool-player-zone-label', 'games.drawerStatus'],
        ['#prize-pool-footnote', 'games.drawerFootnote'],
        ['#event-leaderboard-panel .event-section-card:nth-child(1) .event-section-head h3', 'games.leaderboardTitle'],
        ['#event-leaderboard-panel .event-section-card:nth-child(2) .event-section-head h3', 'games.finalTonTitle'],
        ['#wallet-modal-kicker', 'wallet.kicker'],
        ['#wallet-modal-title', 'wallet.title'],
        ['#wallet-section-title', 'wallet.sectionTitle'],
        ['#settings-modal-title', 'gameModals.settings'],
        ['#themeTitle', 'gameModals.theme'],
        ['#languageTitle', 'gameModals.language'],
        ['#soundTitle', 'gameModals.sound'],
        ['#musicTitle', 'gameModals.music'],
        ['#vibrationTitle', 'gameModals.vibration'],
        ['.skins-title', 'skins.title'],
        ['.skin-filters .filter-btn:nth-child(1)', 'skins.all'],
        ['.skin-filters .filter-btn:nth-child(2)', 'skins.common'],
        ['.skin-filters .filter-btn:nth-child(3)', 'skins.rare'],
        ['.skin-filters .filter-btn:nth-child(4)', 'skins.legendary'],
        ['.skin-filters .filter-btn:nth-child(5)', 'skins.super'],
        ['#skin-detail-name', 'skins.name'],
        ['#skin-detail-description', 'skins.description'],
        ['#skin-detail-rarity', 'skins.rarity'],
        ['#skin-detail-bonus', 'common.bonusIncome'],
        ['#skin-action-btn', 'common.claim']
    ];

    textMap.forEach(([selector, key]) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = t(key);
    });

    const dailyButton = document.getElementById('dailyRewardsButton');
    if (dailyButton) dailyButton.setAttribute('title', t('daily.title'));
    const settingsButton = document.getElementById('settingsOpenButton');
    if (settingsButton) settingsButton.setAttribute('title', t('gameModals.settings'));

    const referralLink = document.getElementById('referral-link');
    if (referralLink && referralLink.textContent.trim().toLowerCase() === 'loading...') {
        referralLink.textContent = t('common.loading');
    }

    document.querySelectorAll('#event-leaderboard-list .loading, #event-results-list .loading').forEach((el) => {
        el.textContent = t('common.loading');
    });
}

const modalManager = window.SpiritModalManager.createModalManager({
    modalSelector: '.modal-screen',
    activeClass: 'active',
    blockingSelector: '.modal-screen.active, .skin-detail-modal.active, .energy-recovery-modal, .ad-input-blocker',
    bodyClass: 'modal-open',
    onOpen: (id) => debugLog('ui', 'modal open', { id })
});
modalLayerUi = window.SpiritModalLayerUi.createModalLayerUi({
    modalManager
});
const tasksEventsDomain = window.SpiritTasksEventsDomain.createTasksEventsDomain({
    t,
    VIDEO_TASKS,
    DEBUG
});

function hasBlockingOverlayActive() {
    return modalLayerUi.hasBlockingOverlayActive();
}

function syncModalOpenState() {
    modalLayerUi.syncBodyClass();
}

// ==================== НАВИГАЦИЯ ====================
function openModal(id) {
    modalLayerUi.openModal(id);
}

function closeModal(id) {
    modalLayerUi.closeModal(id);
}

function openRebirthConfirm() {
    if (!rebirthDomain) return;
    rebirthDomain.openConfirmModal();
}

async function confirmRebirth() {
    if (!rebirthDomain) return;
    await rebirthDomain.confirmRebirth();
}

function switchTab(tab, el) {
    if (bottomPanelUi) {
        bottomPanelUi.setActiveTab(tab);
    } else {
        document.querySelectorAll('[data-ui-nav-item]').forEach((node) => node.classList.remove('active'));
        document.querySelectorAll('.nav-bar .nav-item').forEach((node) => node.classList.remove('active'));
        if (el) el.classList.add('active');
    }
    
    modalLayerUi.clearModals();
    
    if (tab === 'main') return;
    
    const modalId = `${tab}-screen`;
    openModal(modalId);
    maybeShowDiscoveryToast(tab);
    
    if (tab === 'friends') loadReferralData();
    if (tab === 'skins') openSkins();
    if (tab === 'games') {
        renderEventImmediatePlaceholder();
        requestAnimationFrame(() => {
            loadTournamentData();
        });
    }
    if (tab === 'wallet') renderTonWalletState();
    if (tab === 'tasks') {
        advanceSoftOnboarding('tasks');
        renderVideoTasks();
        loadVideoTasks();
    }
}

function renderEventImmediatePlaceholder() {
    tasksEventsDomain.renderEventImmediatePlaceholder();
}

function openSettings() {
    openModal('settings-screen');
}

function closeSettings() {
    closeModal('settings-screen');
}

function closeSettingsOutside(e) {
    const box = document.getElementById('settings-modal-box');
    if (box && !box.contains(e.target)) closeSettings();
}

function openTasksModal() {
    debugLog('ui', 'tasks open', { source: 'openTasksModal' });
    openModal('tasks-screen');
    advanceSoftOnboarding('tasks');
    switchTaskHubTab('tasks');
}

function renderTasksImmediatePlaceholder() {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    if (container.innerHTML && container.innerHTML.trim().length > 0) return;
    const loadingText = t('common.loading');
    container.innerHTML = `
        <div class="task-card task-card-simple ready">
            <div class="task-copy-simple">
                <div class="task-title">${loadingText}</div>
                <div class="task-desc">${loadingText}</div>
            </div>
            <div class="task-actions-simple">
                <span class="task-reward-pill task-reward-pill-simple">${loadingText}</span>
                <button class="task-action task-action-simple" disabled>${loadingText}</button>
            </div>
        </div>
        <div class="task-card task-card-simple ready">
            <div class="task-copy-simple">
                <div class="task-title">${loadingText}</div>
                <div class="task-desc">${loadingText}</div>
            </div>
            <div class="task-actions-simple">
                <span class="task-reward-pill task-reward-pill-simple">${loadingText}</span>
                <button class="task-action task-action-simple" disabled>${loadingText}</button>
            </div>
        </div>
    `;
}

function switchTaskHubTab(tab = 'tasks') {
    tasksHubTab = tab === 'achievements' ? 'achievements' : 'tasks';

    const tasksTabBtn = document.getElementById('tasks-hub-tab-tasks');
    const achievementsTabBtn = document.getElementById('tasks-hub-tab-achievements');
    const tasksPanel = document.getElementById('tasks-panel');
    const achievementsPanel = document.getElementById('achievements-panel');

    tasksTabBtn?.classList.toggle('active', tasksHubTab === 'tasks');
    achievementsTabBtn?.classList.toggle('active', tasksHubTab === 'achievements');
    tasksPanel?.classList.toggle('active', tasksHubTab === 'tasks');
    achievementsPanel?.classList.toggle('active', tasksHubTab === 'achievements');

    if (tasksHubTab === 'tasks') {
        renderTasksImmediatePlaceholder();
        requestAnimationFrame(() => {
            renderVideoTasks();
            loadVideoTasks();
        });
        return;
    }

    renderAchievements();
}

// ==================== ТУРНИР ====================
let tournamentTimer = null;
let onlineHeartbeatTimer = null;
let onlineCountTimer = null;
let eventSelectedLeague = null;
let eventOverviewCache = null;
let eventHubTab = 'rules';
let prizePoolDrawerOpen = false;
const EVENT_LEAGUE_ORDER = ['bronze', 'silver', 'gold', 'diamond'];
const EVENT_LEAGUE_PRIORITY = { bronze: 1, silver: 2, gold: 3, diamond: 4 };
const EVENT_LEAGUE_META = {
    bronze: { label: { en: 'Bronze', ru: 'Бронза' }, range: { en: 'Lvl 1-32', ru: 'Ур. 1-32' }, className: 'bronze' },
    silver: { label: { en: 'Silver', ru: 'Серебро' }, range: { en: 'Lvl 33-65', ru: 'Ур. 33-65' }, className: 'silver' },
    gold: { label: { en: 'Gold', ru: 'Золото' }, range: { en: 'Lvl 66-99', ru: 'Ур. 66-99' }, className: 'gold' },
    diamond: { label: { en: 'Diamond', ru: 'Алмаз' }, range: { en: 'Lvl 100+', ru: 'Ур. 100+' }, className: 'diamond' }
};

function getEventLeagueMeta(league) {
    const raw = EVENT_LEAGUE_META[(league || 'bronze').toLowerCase()] || EVENT_LEAGUE_META.bronze;
    return {
        ...raw,
        label: raw.label?.[UI_LANG] || raw.label?.en || '',
        range: raw.range?.[UI_LANG] || raw.range?.en || ''
    };
}

function deriveEventLeague(level) {
    const numericLevel = Number(level || 1);
    if (numericLevel >= 100) return 'diamond';
    if (numericLevel >= 66) return 'gold';
    if (numericLevel >= 33) return 'silver';
    return 'bronze';
}

function resolveCurrentPlayerLeague(dbLeague) {
    const fromDb = String(dbLeague || '').toLowerCase();
    const fromLevel = deriveEventLeague(getDisplayLevel(State.game.level) || 1);
    const dbPriority = EVENT_LEAGUE_PRIORITY[fromDb] || 0;
    const levelPriority = EVENT_LEAGUE_PRIORITY[fromLevel] || 0;
    return levelPriority > dbPriority ? fromLevel : (fromDb || fromLevel);
}

function switchEventHubTab(tab = 'leaderboard') {
    eventHubTab = 'leaderboard';

    const rulesTabBtn = document.getElementById('event-hub-tab-rules');
    const leaderboardTabBtn = document.getElementById('event-hub-tab-leaderboard');
    const rulesPanel = document.getElementById('event-rules-panel');
    const leaderboardPanel = document.getElementById('event-leaderboard-panel');

    rulesTabBtn?.classList.remove('active');
    leaderboardTabBtn?.classList.add('active');
    rulesPanel?.classList.remove('active');
    leaderboardPanel?.classList.add('active');
}

function setPrizePoolDrawerOpen(nextOpen) {
    prizePoolDrawerOpen = !!nextOpen;
    const shell = document.getElementById('prize-pool-shell');
    const drawer = document.getElementById('prize-pool-drawer');
    const tab = document.getElementById('prize-pool-tab');
    const backdrop = document.getElementById('prize-pool-backdrop');
    shell?.classList.toggle('open', prizePoolDrawerOpen);
    backdrop?.classList.toggle('active', prizePoolDrawerOpen);
    drawer?.setAttribute('aria-hidden', prizePoolDrawerOpen ? 'false' : 'true');
    tab?.setAttribute('aria-expanded', prizePoolDrawerOpen ? 'true' : 'false');
}

function openPrizePoolDrawer() {
    setPrizePoolDrawerOpen(true);
}

function closePrizePoolDrawer() {
    setPrizePoolDrawerOpen(false);
}

function togglePrizePoolDrawer() {
    setPrizePoolDrawerOpen(!prizePoolDrawerOpen);
}

window.openPrizePoolDrawer = openPrizePoolDrawer;
window.closePrizePoolDrawer = closePrizePoolDrawer;
window.togglePrizePoolDrawer = togglePrizePoolDrawer;

function formatEventTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const days = Math.floor(value / 86400);
    const hours = Math.floor((value % 86400) / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${secs}s`;
}

function getEventZoneText(player) {
    if (!player || !Number(player.score || 0)) return tr('games.zoneStart');
    if (player.fraud_flag) return tr('games.zoneReview');
    if (player.rank <= 3) return tr('games.zoneTop3');
    if (player.rank <= 50 && player.eligible_for_payout) return tr('games.zonePayout');
    if (player.rank <= 50) return tr('games.zoneTop50');
    return tr('games.zonePlacesAway', { places: player.rank - 50 });
}

walletEventUi = window.SpiritWalletEventUi.createWalletEventUi({
    t,
    getTonWalletState: () => tonWalletState,
    getPendingTonWalletNotice: () => pendingTonWalletNotice,
    buildPendingTonWalletNoticeHtml
});

function setTonWalletState(wallet = {}) {
    tonWalletState = {
        connected: !!wallet?.connected,
        verified: !!wallet?.verified,
        address: wallet?.address || '',
        masked_address: wallet?.masked_address || '',
        provider: wallet?.provider || '',
        app_name: wallet?.app_name || '',
        connected_at: wallet?.connected_at || null,
        verification_error: wallet?.verification_error || ''
    };
    renderTonWalletState();
}

function renderTonWalletState() {
    walletEventUi.renderTonWalletState();
}

function openWalletPayoutScreen() {
    openModal('wallet-screen');
}

window.openWalletPayoutScreen = openWalletPayoutScreen;

function buildPendingTonWalletNoticeHtml(notice) {
    const meta = getEventLeagueMeta(notice?.league);
    const deadlineText = notice?.reminder_sent_at && notice?.deadline_at
        ? tr('games.walletNoticeSent', { date: formatDateTimeShort(notice.deadline_at) })
        : tr('games.walletNoticeDeadline', { hours: notice?.hours_until_deadline || 72 });

    return `
        <div class="event-wallet-notice-head">
            <div>
                <div class="event-wallet-notice-title">${tr('games.walletNoticeTitle')}</div>
                <div class="event-wallet-notice-sub">${tr('games.walletNoticeBody')}</div>
            </div>
            <span class="event-wallet-notice-badge">${tr('games.walletNoticeRank')} #${Number(notice?.rank || 0)}</span>
        </div>
        <div class="event-wallet-notice-meta">
            <span>${tr('games.walletNoticeLeague')}: ${meta.label}</span>
            <span>${tr('games.walletNoticeSeason')}: ${notice?.season_key || '--'}</span>
        </div>
        <div class="event-wallet-notice-deadline">${deadlineText}</div>
        <div class="event-wallet-notice-actions">
            <button class="btn-primary" onclick="openWalletPayoutScreen()">${tr('games.walletNoticeOpen')}</button>
            <button class="btn-secondary" onclick="connectTonWallet()">${tr('games.walletNoticeConnect')}</button>
        </div>
    `;
}

function renderPendingTonWalletNotice(notice = null) {
    pendingTonWalletNotice = notice || null;
    walletEventUi.renderPendingTonWalletNotice(notice);
}

function buildTonProofRequestValue(payload) {
    const value = (payload || '').trim();
    if (!value) return null;
    return { tonProof: value };
}

async function loadTonWalletStatus() {
    if (!userId) return;
    try {
        const response = await API.get(`/api/ton/wallet/${userId}`);
        setTonWalletState(response?.wallet || {});
    } catch (err) {
        console.error('TON wallet status error:', err);
    }
}

async function prepareTonProofPayload(force = false) {
    if (!userId || !tonConnectUI?.setConnectRequestParameters) return null;
    const now = Date.now();
    if (!force && tonProofPayloadState.value && tonProofPayloadState.expiresAt - now > 60_000) {
        const requestValue = buildTonProofRequestValue(tonProofPayloadState.value);
        tonConnectUI.setConnectRequestParameters({
            state: 'ready',
            value: requestValue
        });
        return tonProofPayloadState.value;
    }
    try {
        tonConnectUI.setConnectRequestParameters({ state: 'loading' });
        const response = await API.get(`/api/ton/wallet/proof-payload/${userId}`);
        const payload = response?.payload || '';
        if (!payload) {
            tonConnectUI.setConnectRequestParameters(null);
            return null;
        }
        tonProofPayloadState = {
            value: payload,
            expiresAt: Number(response?.expires_at || 0) * 1000
        };
        const requestValue = buildTonProofRequestValue(payload);
        tonConnectUI.setConnectRequestParameters({
            state: 'ready',
            value: requestValue
        });
        return payload;
    } catch (err) {
        console.error('TON proof payload error:', err);
        tonProofPayloadState = { value: '', expiresAt: 0 };
        try {
            tonConnectUI.setConnectRequestParameters(null);
        } catch (_) {}
        return null;
    }
}

function getTonProofPayload(wallet) {
    const proofItem =
        wallet?.connectItems?.tonProof ||
        tonConnectUI?.wallet?.connectItems?.tonProof ||
        null;
    if (!proofItem) return null;
    if (proofItem.proof) return proofItem.proof;
    if (proofItem.payload && proofItem.signature && proofItem.domain) return proofItem;
    return null;
}

async function syncConnectedTonWallet(wallet) {
    const address = wallet?.account?.address || '';
    if (!userId || !address) return;
    const response = await API.post('/api/ton/wallet/connect', {
        user_id: userId,
        wallet_address: address,
        wallet_provider: wallet?.provider || '',
        wallet_app_name: wallet?.device?.appName || wallet?.device?.app_name || '',
        wallet_network: wallet?.account?.chain || '',
        wallet_public_key: wallet?.account?.publicKey || '',
        wallet_state_init: wallet?.account?.walletStateInit || '',
        ton_proof: getTonProofPayload(wallet)
    });
    setTonWalletState(response?.wallet || {});
}

async function initTonWalletBridge() {
    if (!window.TON_CONNECT_UI?.TonConnectUI) return;
    try {
        tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
            manifestUrl: TON_CONNECT_MANIFEST_URL,
            language: UI_LANG === 'ru' ? 'ru' : 'en'
        });
        if (userId) {
            prepareTonProofPayload().catch(() => {});
        }

        tonConnectUI.onStatusChange(async (wallet) => {
            try {
                if (wallet?.account?.address) {
                    await syncConnectedTonWallet(wallet);
                    if (tonWalletState.verified) {
                        showToast(t('toasts.tonWalletConnected'), false, {
                            title: t('toasts.walletConnectedTitle'),
                            icon: '✨',
                            side: 'right',
                            key: 'ton:connected',
                            cooldownMs: 4000
                        });
                    } else {
                        showToast(tonWalletState.verification_error || t('toasts.tonWalletVerificationRequired'), true);
                    }
                } else if (userId && tonWalletState.connected) {
                    const response = await API.post('/api/ton/wallet/disconnect', { user_id: userId });
                    setTonWalletState(response?.wallet || {});
                } else {
                    setTonWalletState({});
                }
            } catch (err) {
                console.error('TON wallet sync error:', err);
                setTonWalletState({});
                if (tonConnectUI) {
                    try {
                        await tonConnectUI.disconnect();
                    } catch (_) {}
                }
                showToast(err?.message || t('toasts.tonWalletSyncError'), true);
            }
        });

        if (tonConnectUI.connectionRestored && typeof tonConnectUI.connectionRestored.then === 'function') {
            tonConnectUI.connectionRestored.then(async () => {
                if (tonConnectUI?.wallet?.account?.address && userId) {
                    await loadTonWalletStatus();
                }
            }).catch(() => {});
        }
    } catch (err) {
        console.error('TON Connect init error:', err);
    }
}

async function connectTonWallet() {
    if (!tonConnectUI) {
        showToast(t('toasts.tonWalletUnavailable'), true);
        return;
    }
    try {
        const restoredWalletAddress = tonConnectUI?.wallet?.account?.address || '';
        if (restoredWalletAddress && tonWalletState.connected && !tonWalletState.verified) {
            try {
                await tonConnectUI.disconnect();
            } catch (_) {}
        }

        const hasFreshProof = tonProofPayloadState.value && tonProofPayloadState.expiresAt - Date.now() > 60_000;
        let proofPayload = tonProofPayloadState.value;
        if (!hasFreshProof || !tonWalletState.verified) {
            proofPayload = await prepareTonProofPayload(true);
        }
        if (!proofPayload && !tonWalletState.verified) {
            showToast(t('toasts.tonWalletUnavailable'), true);
            return;
        }

        const walletScreen = document.getElementById('wallet-screen');
        if (walletScreen?.classList.contains('active')) {
            closeModal('wallet-screen');
            await new Promise((resolve) => setTimeout(resolve, 80));
        }
        await tonConnectUI.openModal();
    } catch (err) {
        console.error('TON wallet modal error:', err);
        showToast(t('toasts.tonWalletOpenError'), true);
    }
}

async function disconnectTonWallet() {
    try {
        if (userId) {
            const response = await API.post('/api/ton/wallet/disconnect', { user_id: userId });
            setTonWalletState(response?.wallet || {});
        } else {
            setTonWalletState({});
        }
    } catch (err) {
        console.error('TON wallet disconnect error:', err);
        showToast(t('toasts.tonWalletDisconnectError'), true);
        return;
    }

    if (tonConnectUI) {
        try {
            await tonConnectUI.disconnect();
        } catch (err) {
            if (DEBUG) console.warn('TON Connect SDK disconnect error:', err);
        }
    }
}

function buildEventLeagueSplitsMarkup(fundSplits = {}) {
    return EVENT_LEAGUE_ORDER.map((league) => {
        const meta = getEventLeagueMeta(league);
        const pct = Math.round((Number(fundSplits[league] || 0) * 100));
        return `
            <div class="event-league-card ${meta.className}">
                <span class="event-league-name">${meta.label}</span>
                <span class="event-league-range">${meta.range}</span>
                <span class="event-league-share">${pct}%</span>
            </div>
        `;
    }).join('');
}

function renderEventLeagueSplits(fundSplits = {}) {
    const host = document.getElementById('event-league-splits');
    if (!host) return;
    host.innerHTML = buildEventLeagueSplitsMarkup(fundSplits);
}

function buildEventPayoutGridMarkup(payoutSplits = null, top3Splits = {}, restSplit = 0) {
    const top = payoutSplits?.top || top3Splits || {};
    const ranges = Array.isArray(payoutSplits?.ranges) ? payoutSplits.ranges : [];
    const topLabel = UI_LANG === 'ru' ? 'Топ' : 'Top';
    const ranksLabel = UI_LANG === 'ru' ? 'Места' : 'Ranks';
    const sharedLabel = UI_LANG === 'ru' ? 'общий пул' : 'shared';
    const rules = [
        { label: `${topLabel} 1`, value: `${Math.round(Number(top[1] || 0) * 100)}%` },
        { label: `${topLabel} 2`, value: `${Math.round(Number(top[2] || 0) * 100)}%` },
        { label: `${topLabel} 3`, value: `${Math.round(Number(top[3] || 0) * 100)}%` },
    ];

    if (ranges.length) {
        ranges.forEach((range) => {
            rules.push({
                label: `${ranksLabel} ${range.start}-${range.end}`,
                value: `${Math.round(Number(range.share || 0) * 100)}% ${sharedLabel}`
            });
        });
    } else {
        rules.push({ label: `${ranksLabel} 4-50`, value: `${Math.round(Number(restSplit || 0) * 100)}% ${sharedLabel}` });
    }

    return rules.map((rule) => `
        <div class="event-payout-card">
            <span class="event-payout-label">${rule.label}</span>
            <span class="event-payout-value">${rule.value}</span>
        </div>
    `).join('');
}

function renderEventPayoutGrid(payoutSplits = null, top3Splits = {}, restSplit = 0) {
    const host = document.getElementById('event-payout-grid');
    if (!host) return;
    host.innerHTML = buildEventPayoutGridMarkup(payoutSplits, top3Splits, restSplit);
}

function renderEventLeagueTabs(selectedLeague) {
    const host = document.getElementById('event-league-tabs');
    if (!host) return;
    host.innerHTML = EVENT_LEAGUE_ORDER.map((league) => {
        const meta = getEventLeagueMeta(league);
        return `
            <button
                type="button"
                class="event-league-tab ${meta.className} ${league === selectedLeague ? 'active' : ''}"
                onclick="selectEventLeague('${league}')"
            >
                ${meta.label}
            </button>
        `;
    }).join('');
}

function buildPrizePoolLeagueMarkup(fundSplits = {}) {
    return EVENT_LEAGUE_ORDER.map((league) => {
        const meta = getEventLeagueMeta(league);
        const pct = Math.round((Number(fundSplits[league] || 0) * 100));
        return `
            <div class="prize-pool-league-row">
                <span class="prize-pool-league-name">${meta.label}</span>
                <span class="prize-pool-league-share">${pct}%</span>
            </div>
        `;
    }).join('');
}

function buildPrizePoolRuleMarkup(payoutSplits = null, top3Splits = {}, restSplit = 0) {
    const top = payoutSplits?.top || top3Splits || {};
    const ranges = Array.isArray(payoutSplits?.ranges) ? payoutSplits.ranges : [];
    const topLabel = UI_LANG === 'ru' ? 'Топ' : 'Top';
    const rules = [
        { label: `${topLabel} 1`, value: `${Math.round(Number(top[1] || 0) * 100)}%` },
        { label: `${topLabel} 2`, value: `${Math.round(Number(top[2] || 0) * 100)}%` },
        { label: `${topLabel} 3`, value: `${Math.round(Number(top[3] || 0) * 100)}%` },
    ];
    if (ranges.length) {
        ranges.forEach((range) => {
            rules.push({
                label: `${range.start}-${range.end}`,
                value: `${Math.round(Number(range.share || 0) * 100)}%`
            });
        });
    } else {
        rules.push({ label: '4-50', value: `${Math.round(Number(restSplit || 0) * 100)}%` });
    }
    return rules.map((rule) => `
        <div class="prize-pool-rule-row">
            <span class="prize-pool-rule-label">${rule.label}</span>
            <span class="prize-pool-rule-value">${rule.value}</span>
        </div>
    `).join('');
}

function renderPrizePoolDrawer(data) {
    const tabTextEl = document.getElementById('prize-pool-tab-text');
    const kickerEl = document.getElementById('prize-pool-kicker');
    const titleEl = document.getElementById('prize-pool-title');
    const amountEl = document.getElementById('prize-pool-amount');
    const seasonLabelEl = document.getElementById('prize-pool-season-label');
    const seasonValueEl = document.getElementById('prize-pool-season-value');
    const endsLabelEl = document.getElementById('prize-pool-ends-label');
    const endsValueEl = document.getElementById('prize-pool-ends-value');
    const leaguesTitleEl = document.getElementById('prize-pool-leagues-title');
    const leaguesHost = document.getElementById('prize-pool-leagues');
    const rulesTitleEl = document.getElementById('prize-pool-rules-title');
    const rulesHost = document.getElementById('prize-pool-rules');
    const playerTitleEl = document.getElementById('prize-pool-player-title');
    const playerLeagueLabelEl = document.getElementById('prize-pool-player-league-label');
    const playerLeagueEl = document.getElementById('prize-pool-player-league');
    const playerRankLabelEl = document.getElementById('prize-pool-player-rank-label');
    const playerRankEl = document.getElementById('prize-pool-player-rank');
    const playerZoneLabelEl = document.getElementById('prize-pool-player-zone-label');
    const playerZoneEl = document.getElementById('prize-pool-player-zone');
    const footnoteEl = document.getElementById('prize-pool-footnote');

    if (tabTextEl) tabTextEl.textContent = tr('games.drawerTab');
    if (kickerEl) kickerEl.textContent = tr('games.drawerKicker');
    if (titleEl) titleEl.textContent = tr('games.drawerTitle');
    if (seasonLabelEl) seasonLabelEl.textContent = tr('games.drawerSeason');
    if (endsLabelEl) endsLabelEl.textContent = tr('games.drawerEnds');
    if (leaguesTitleEl) leaguesTitleEl.textContent = tr('games.drawerLeagues');
    if (rulesTitleEl) rulesTitleEl.textContent = tr('games.drawerRewards');
    if (playerTitleEl) playerTitleEl.textContent = tr('games.drawerPlayer');
    if (playerLeagueLabelEl) playerLeagueLabelEl.textContent = tr('games.drawerLeague');
    if (playerRankLabelEl) playerRankLabelEl.textContent = tr('games.drawerRank');
    if (playerZoneLabelEl) playerZoneLabelEl.textContent = tr('games.drawerStatus');
    if (footnoteEl) footnoteEl.textContent = tr('games.drawerFootnote');

    if (!data) {
        if (amountEl) amountEl.textContent = formatUsdFromCents(0);
        if (seasonValueEl) seasonValueEl.textContent = '--';
        if (endsValueEl) endsValueEl.textContent = '--';
        if (leaguesHost) leaguesHost.innerHTML = '';
        if (rulesHost) rulesHost.innerHTML = '';
        if (playerLeagueEl) playerLeagueEl.textContent = '--';
        if (playerRankEl) playerRankEl.textContent = '--';
        if (playerZoneEl) playerZoneEl.textContent = '--';
        return;
    }

    const player = data?.player || null;
    const league = resolveCurrentPlayerLeague(player?.league);
    const meta = getEventLeagueMeta(league);

    if (amountEl) amountEl.textContent = formatUsdFromCents(data?.payout_fund_cents || 0);
    if (seasonValueEl) seasonValueEl.textContent = data?.season_key || '--';
    if (endsValueEl) endsValueEl.textContent = formatEventTime(data?.time_left_seconds || 0);
    if (leaguesHost) leaguesHost.innerHTML = buildPrizePoolLeagueMarkup(data?.fund_splits || {});
    if (rulesHost) rulesHost.innerHTML = buildPrizePoolRuleMarkup(data?.payout_splits || null, data?.top3_splits || {}, data?.rest_split || 0);
    if (playerLeagueEl) playerLeagueEl.textContent = meta.label;
    if (playerRankEl) playerRankEl.textContent = player?.rank ? `#${player.rank}` : '--';
    if (playerZoneEl) playerZoneEl.textContent = getEventZoneText(player);
}

function renderEventOverview(data) {
    eventOverviewCache = data || null;
    const player = data?.player || null;
    const league = resolveCurrentPlayerLeague(player?.league);
    const meta = getEventLeagueMeta(league);
    const fundNano = Number(
        data?.payout_fund_nano ??
        data?.fund_nano ??
        (typeof data?.payout_fund_ton === 'number' ? data.payout_fund_ton * 1_000_000_000 : null) ??
        (typeof data?.payout_fund === 'number' ? data.payout_fund * 1_000_000_000 : null)
    );

    const leagueEl = document.getElementById('event-player-league');
    const rankEl = document.getElementById('event-player-rank');
    const scoreEl = document.getElementById('event-player-score');
    const zoneEl = document.getElementById('event-player-zone');
    const subtitleEl = document.getElementById('event-board-subtitle');

    if (leagueEl) leagueEl.textContent = meta.label;
    if (rankEl) rankEl.textContent = player?.rank ? `#${player.rank}` : '--';
    if (scoreEl) scoreEl.textContent = formatNumber(player?.score || 0);
    if (zoneEl) zoneEl.textContent = getEventZoneText(player);
    if (subtitleEl) subtitleEl.textContent = tr('games.leagueLeaderboard', { league: meta.label });

    updateTopMetaBar({ fundNano, rank: player?.rank });
    renderEventLeagueSplits(data?.fund_splits || {});
    renderEventPayoutGrid(data?.payout_splits || null, data?.top3_splits || {}, data?.rest_split || 0);
    renderPrizePoolDrawer(data);
    renderTonWalletState();
    trackTournamentToastState(player?.rank || 9999, 50);
}

function renderEventLeaderboard(players = [], league = 'bronze') {
    const meta = getEventLeagueMeta(league);
    const list = document.getElementById('event-leaderboard-list');
    const highlight = document.getElementById('event-player-highlight');
    const subtitleEl = document.getElementById('event-board-subtitle');
    const player = eventOverviewCache?.player || null;

    if (subtitleEl) subtitleEl.textContent = tr('games.leagueLeaderboard', { league: meta.label });

    if (list) {
        const normalizeUsername = (raw) => String(raw || '').replace(/^@+/, '').trim();
        const buildAvatar = (entry) => {
            const displayLevel = Number(entry?.display_level || 1);
            const uid = Number(entry?.user_id || 0);
            const uname = normalizeUsername(entry?.username);
            const tgPhotoUrl = (uid > 0 && Number(userId) === uid)
                ? String(tg?.initDataUnsafe?.user?.photo_url || '')
                : '';
            const usernameAvatarUrl = uname ? `https://t.me/i/userpic/320/${uname}.jpg` : '';
            const proxyAvatarUrl = `${CONFIG.API_URL}/api/avatar/${uid}`;
            const primaryAvatarUrl = tgPhotoUrl || usernameAvatarUrl || proxyAvatarUrl;
            const fallbackAvatarUrl = primaryAvatarUrl === proxyAvatarUrl ? '' : proxyAvatarUrl;
            return `
                <img
                    class="event-avatar-img"
                    src="${primaryAvatarUrl}"
                    data-fallback-src="${fallbackAvatarUrl}"
                    alt="Player avatar"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    style="width:100%;height:100%;object-fit:cover;border-radius:12px;"
                    onerror="
                        if (this.dataset.fallbackTried !== '1' && this.dataset.fallbackSrc) {
                            this.dataset.fallbackTried = '1';
                            this.src = this.dataset.fallbackSrc;
                        } else {
                            this.style.display='none';
                            if (this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';
                        }
                    "
                />
                <span class="event-avatar-fallback" style="display:none;">${displayLevel}</span>
            `;
        };

        const visible = Array.isArray(players) ? players.slice(0, 10) : [];
        list.innerHTML = visible.length
            ? visible.map((entry) => `
                <div class="leaderboard-item leaderboard-item-rank-${entry.rank} ${Number(entry.user_id) === Number(userId) ? 'current-player' : ''}">
                    <span class="player-rank">${entry.rank}</span>
                    <div class="player-avatar event-rank-badge ${meta.className}">${buildAvatar(entry)}</div>
                    <span class="player-name">${entry.username ? `@${entry.username}` : t('common.player')}</span>
                    <span class="player-score">${formatNumber(entry.score || 0)}</span>
                </div>
            `).join('')
            : `<div class="loading">${t('games.noPlayersYet')}</div>`;
    }

    if (highlight) {
        if (!player) {
            highlight.innerHTML = `<div class="rank-info"><span class="rank-label">${t('games.eventStatusTitle')}</span><span class="rank-value">${t('games.noWeeklyClicks')}</span></div>`;
        } else {
            const playerMeta = getEventLeagueMeta(player.league);
            highlight.innerHTML = `
                <div class="rank-info">
                    <span class="rank-label">${t('games.yourLeague')}</span>
                    <span class="rank-value">${playerMeta.label}</span>
                </div>
                <div class="rank-info">
                    <span class="rank-label">${t('games.yourRank')}</span>
                    <span class="rank-value">#${player.rank || '--'}</span>
                </div>
                <div class="rank-info">
                    <span class="rank-label">${t('games.status')}</span>
                    <span class="rank-value">${getEventZoneText(player)}</span>
                </div>
            `;
        }
    }
}

function renderEventResults(players = [], season = null) {
    const subtitleEl = document.getElementById('event-results-subtitle');
    const list = document.getElementById('event-results-list');
    if (!list) return;

    if (subtitleEl) {
        subtitleEl.textContent = season?.season_key
            ? tr('games.finalTonWeek', { season: season.season_key })
            : tr('games.finalTonPending');
    }

    if (!season || !Array.isArray(players) || !players.length) {
        list.innerHTML = `<div class="loading">${t('games.finalTonEmpty')}</div>`;
        return;
    }

    list.innerHTML = players.map((entry) => `
        <div class="event-results-row leaderboard-item-rank-${entry.rank} ${Number(entry.user_id) === Number(userId) ? 'current-player' : ''}">
            <span class="event-results-rank">#${entry.rank}</span>
            <span class="event-results-player" title="${entry.username ? `@${entry.username}` : t('common.player')}">${entry.username ? `@${entry.username}` : t('common.player')}</span>
            <span class="event-results-stars">${Number(entry.ton_amount_nano || 0) > 0 ? `${formatTonAmount(entry.ton_amount_nano)} TON` : t('games.pendingReward')}</span>
        </div>
    `).join('');
}

async function loadEventResults(league) {
    try {
        const endpoint = `/api/weekly-tournament/results/${league}?limit=50`;
        const applyResults = (response) => {
            renderEventResults(response?.players || [], response?.season || null);
        };
        const response = await apiGetCached(endpoint, {
            ttlMs: 45_000,
            onFresh: (freshResponse) => applyResults(freshResponse)
        });
        applyResults(response);
    } catch (err) {
        console.error('Event results error:', err);
        renderEventResults([], null);
    }
}

async function fetchTournamentOverview() {
    if (!userId) return null;
    const endpoint = `/api/weekly-tournament/overview/${userId}`;
    const overview = await apiGetCached(endpoint, {
        ttlMs: 25_000,
        onFresh: (freshOverview) => {
            if (!freshOverview?.success) return;
            if (!eventSelectedLeague) {
                eventSelectedLeague = resolveCurrentPlayerLeague(freshOverview?.player?.league);
            }
            renderPendingTonWalletNotice(freshOverview?.pending_ton_notice || null);
            renderEventOverview(freshOverview);
            updateOnlineCounterVisibility();
        }
    });
    if (overview?.success && !eventSelectedLeague) {
        eventSelectedLeague = resolveCurrentPlayerLeague(overview?.player?.league);
    }
    return overview?.success ? overview : null;
}

async function loadTournamentPrizePoolData({ silent = false } = {}) {
    return tasksEventsDomain.loadTournamentPrizePoolData({
        silent,
        fetchTournamentOverview,
        renderPrizePoolDrawer
    });
}

async function selectEventLeague(league) {
    const done = debugPerfStart('ui', 'leaderboard load', { league });
    eventSelectedLeague = EVENT_LEAGUE_ORDER.includes(league) ? league : 'bronze';
    renderEventLeagueTabs(eventSelectedLeague);
    try {
        const list = document.getElementById('event-leaderboard-list');
        const resultsList = document.getElementById('event-results-list');
        if (list) list.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
        if (resultsList) resultsList.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
        const endpoint = `/api/weekly-tournament/leaderboard/${eventSelectedLeague}?limit=10`;
        const applyLeaderboard = (response) => {
            renderEventLeaderboard(response?.players || [], eventSelectedLeague);
        };
        const response = await apiGetCached(endpoint, {
            ttlMs: 25_000,
            onFresh: (freshResponse) => applyLeaderboard(freshResponse)
        });
        applyLeaderboard(response);
        loadEventResults(eventSelectedLeague).catch((err) => {
            console.error('Event results error:', err);
            renderEventResults([], null);
        });
        done(true, { league: eventSelectedLeague, rows: (response?.players || []).length });
    } catch (err) {
        console.error('Event leaderboard error:', err);
        const list = document.getElementById('event-leaderboard-list');
        if (list) list.innerHTML = `<div class="loading">${t('toasts.leaderboardLoadError')}</div>`;
        renderEventResults([], null);
        done(false, { league: eventSelectedLeague, error: String(err?.message || err || '') });
    }
}

window.selectEventLeague = selectEventLeague;

function setOnlineCount(count) {
    return;
}

function canSeeOnlineCounter() {
    return Number(userId || 0) === OWNER_ONLINE_COUNTER_USER_ID;
}

function updateOnlineCounterVisibility() {
    return;
}

async function sendOnlineHeartbeat() {
    if (!userId) return;
    try {
        // Use API.post to ensure Bearer token is included
        await API.post('/api/online/heartbeat', {
            user_id: userId
        });
    } catch (err) {
        if (DEBUG) console.warn('Online heartbeat failed:', err);
    }
}

async function refreshOnlineCount() {
    if (!canSeeOnlineCounter()) return;
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/online/count`);
        const data = await res.json();
        if (data.success) setOnlineCount(data.online_now);
    } catch (err) {
        if (DEBUG) console.warn('Online count failed:', err);
    }
}

function startOnlinePresence() {
    if (!userId) return;
    updateOnlineCounterVisibility();
    if (!onlineHeartbeatTimer) {
        sendOnlineHeartbeat();
        onlineHeartbeatTimer = setInterval(sendOnlineHeartbeat, CONFIG.ONLINE_HEARTBEAT_INTERVAL_MS);
    }
    if (!canSeeOnlineCounter()) return;
    if (!onlineCountTimer) {
        refreshOnlineCount();
        onlineCountTimer = setInterval(refreshOnlineCount, CONFIG.ONLINE_COUNT_REFRESH_INTERVAL_MS);
    }
}

async function loadTournamentData() {
    return tasksEventsDomain.loadTournamentData({
        fetchTournamentOverview,
        renderPendingTonWalletNotice,
        renderEventOverview,
        updateOnlineCounterVisibility,
        eventSelectedLeague: () => eventSelectedLeague,
        deriveEventLeague,
        State,
        selectEventLeague,
        startTournamentTimer
    });
}

function startTournamentTimer(seconds) {
    if (tournamentTimer) clearInterval(tournamentTimer);
    
    const timerEl = document.getElementById('event-season-timer');
    const drawerTimerEl = document.getElementById('prize-pool-ends-value');
    if (!timerEl && !drawerTimerEl) return;
    
    let remaining = Math.max(0, Number(seconds) || 0);
    const syncTimerText = (value) => {
        const text = formatEventTime(value);
        if (timerEl) timerEl.textContent = text;
        if (drawerTimerEl) drawerTimerEl.textContent = text;
    };
    syncTimerText(remaining);
    
    tournamentTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(tournamentTimer);
            if (timerEl) timerEl.textContent = 'Finished';
            if (drawerTimerEl) drawerTimerEl.textContent = UI_LANG === 'ru' ? 'Завершён' : 'Finished';
            loadTournamentPrizePoolData({ silent: true });
            loadTournamentData();
            return;
        }
        syncTimerText(remaining);
    }, 1000);
}

// ==================== ЭНЕРГИЯ - МОДАЛКА ====================
function showEnergyRecoveryModal() {
    if (document.querySelector('.energy-recovery-modal')) return;
    if (isAdsgramReady()) prewarmAdActionSession('energy_refill_max');
    const cooldownRemainingMs = getAdCooldownRemainingMs('energy_refill');
    
    const modal = document.createElement('div');
    modal.className = 'energy-recovery-modal';
    modal.innerHTML = `
        <div class="modal-content glass">
            <button class="modal-close" onclick="closeEnergyRecoveryModal()">?</button>
            <h3>? Energy is empty!</h3>
            <p>Watch an ad and restore energy to maximum</p>
            <button class="btn-primary" onclick="recoverEnergyWithAd()" ${cooldownRemainingMs > 0 ? 'disabled' : ''}>
                ${cooldownRemainingMs > 0 ? `⏳ Cooldown ${formatCooldownClock(cooldownRemainingMs / 1000)}` : '⚡ Restore to max'}
            </button>
            <button class="btn-secondary" onclick="closeEnergyRecoveryModal()">
                ? Wait
            </button>
        </div>
    `;
    document.body.appendChild(modal);
    syncModalOpenState();
}

function closeEnergyRecoveryModal() {
    const modal = document.querySelector('.energy-recovery-modal');
    if (modal) modal.remove();
    syncModalOpenState();
}

async function recoverEnergyWithAd() {
    console.log(`AD_TRACE_ENERGY_START`);
    closeEnergyRecoveryModal();

    const cooldownRemainingMs = getAdCooldownRemainingMs('energy_refill');
    if (cooldownRemainingMs > 0) {
        console.log(`AD_TRACE_ENERGY_COOLDOWN cooldownMs=${cooldownRemainingMs}`);
        showToast(`Energy refill cooldown ${formatCooldownClock(cooldownRemainingMs / 1000)}`, true);
        return;
    }

    if (!isAdsgramReady()) {
        console.log(`AD_TRACE_ENERGY_NOT_READY`);
        showToast(tr('toasts.adUnavailable'), true);
        return;
    }

    try {
        showToast(tr('toasts.adLoading'));
        console.log(`AD_TRACE_ENERGY_OPEN_START`);
        const adSessionId = await openRewardedAdWithSession('energy_refill_max');
        console.log(`AD_TRACE_ENERGY_OPEN_END sessionId=${adSessionId}`);
        await confirmAdsgramAdSession(adSessionId);
        console.log(`AD_TRACE_ENERGY_CONFIRM_END`);
        const data = await claimAdActionWithRetry(() => API.post('/api/update-energy', {
            user_id: userId,
            ad_session_id: adSessionId
        }));
        console.log(`AD_TRACE_ENERGY_CLAIM_END energy=${data?.energy}`);

        // BUGFIX: Clear pending energy spend BEFORE applying snapshot
        // This ensures visual energy shows full immediately
        State.temp.pendingEnergySpend = 0;
        applyServerEnergySnapshot(data);
        debugLog('ads', 'reward applied in UI', { flow: 'energy_refill', energy: data?.energy, maxEnergy: data?.max_energy });
        setAdCooldownFromIso('energy_refill', data?.cooldown_until || null, Number(data?.cooldown_minutes || 10));
        updateUI();
        showToast(tr('toasts.energyRecovered'));
        console.log(`AD_TRACE_ENERGY_SUCCESS`);
    } catch (err) {
        console.log(`AD_TRACE_ENERGY_ERROR error=${err?.message} stack=${err?.stack}`);
        console.error('Energy recover error:', err);
        showToast(
            resolveRewardedAdErrorMessage(err, tr('toasts.serverError')),
            true
        );
    }
}

// ==================== MEGA BOOST ====================
let boostEndTime = null;
let boostInterval = null;
let megaBoostCooldownUntil = null;

function updateMegaBoostButtonState(button = document.getElementById('mega-boost-btn')) {
    if (!button) return;
    const now = new Date();
    const cooldownActive = !!(megaBoostCooldownUntil && megaBoostCooldownUntil > now);
    const boostActive = !!(boostEndTime && boostEndTime > now);
    button.disabled = cooldownActive || boostActive;
    button.dataset.state = boostActive ? 'active' : (cooldownActive ? 'cooldown' : 'ready');
}

function updateMegaBoostTimerLabel(timerEl = document.getElementById('mega-boost-timer')) {
    if (!timerEl) return;

    const now = new Date();
    const boostActive = !!(boostEndTime && boostEndTime > now);
    const cooldownActive = !!(megaBoostCooldownUntil && megaBoostCooldownUntil > now);

    if (boostActive) {
        timerEl.style.display = 'block';
        const diff = Math.max(0, boostEndTime - now);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        return;
    }

    if (cooldownActive) {
        timerEl.style.display = 'block';
        const cooldownDiff = Math.max(0, megaBoostCooldownUntil - now);
        timerEl.textContent = `CD ${formatCooldownClock(cooldownDiff / 1000)}`;
        return;
    }

    timerEl.style.display = 'none';
}

async function activateMegaBoost() {
    console.log(`AD_TRACE_BOOST_START`);
    if (!userId) {
        console.log(`AD_TRACE_BOOST_NO_USER`);
        showToast(tr('toasts.authRequired'), true);
        return;
    }
    if (isAdsgramReady()) prewarmAdActionSession('mega_boost');
    
    const boostBtn = document.getElementById('mega-boost-btn');
    if (boostBtn?.classList.contains('active')) {
        console.log(`AD_TRACE_BOOST_ALREADY_ACTIVE`);
        showToast(tr('toasts.boostActive'), true);
        return;
    }

    if (megaBoostCooldownUntil && megaBoostCooldownUntil > new Date()) {
        console.log(`AD_TRACE_BOOST_COOLDOWN`);
        showToast(`Mega boost cooldown ${formatCooldownClock((megaBoostCooldownUntil - new Date()) / 1000)}`, true);
        return;
    }

    try {
        const status = await API.get(`/api/mega-boost-status/${userId}`);
        megaBoostCooldownUntil = parseServerDate(status?.cooldown_until) || null;
        if (status?.cooldown_active && megaBoostCooldownUntil && megaBoostCooldownUntil > new Date()) {
            console.log(`AD_TRACE_BOOST_STATUS_COOLDOWN`);
            showToast(`Mega boost cooldown ${formatCooldownClock((megaBoostCooldownUntil - new Date()) / 1000)}`, true);
            return;
        }
        if (status?.active) {
            console.log(`AD_TRACE_BOOST_STATUS_ACTIVE`);
            showToast(tr('toasts.boostActive'), true);
            return;
        }
    } catch (err) {
        console.log(`AD_TRACE_BOOST_STATUS_ERROR error=${err?.message}`);
    }
    
    if (!isAdsgramReady()) {
        console.log(`AD_TRACE_BOOST_NOT_READY`);
        showToast(tr('toasts.adUnavailable'), true);
        return;
    }
    
    showToast(tr('toasts.adLoading'));

    (async () => {
        try {
            console.log(`AD_TRACE_BOOST_OPEN_START`);
            const adSessionId = await openRewardedAdWithSession('mega_boost');
            console.log(`AD_TRACE_BOOST_OPEN_END sessionId=${adSessionId}`);
            boostEndTime = new Date(Date.now() + MEGA_BOOST_DURATION_MS);
            if (boostBtn) boostBtn.classList.add('active');
            syncMegaBoostUi();
            showToast(tr('toasts.megaBoostActivated'));
            debugLog('ads', 'reward applied in UI', {
                flow: 'mega_boost',
                optimistic: true,
                expiresAt: boostEndTime?.toISOString?.()
            });
            console.log(`AD_TRACE_BOOST_CONFIRM_START`);
            await confirmAdsgramAdSession(adSessionId);
            console.log(`AD_TRACE_BOOST_CONFIRM_END`);
            const activation = await claimAdActionWithRetry(() => API.post('/api/activate-mega-boost', {
                user_id: userId,
                ad_session_id: adSessionId
            }));
            console.log(`AD_TRACE_BOOST_CLAIM_END`);

            if (activation?.already_active && activation.expires_at) {
                boostEndTime = parseServerDate(activation.expires_at);
            } else {
                boostEndTime = parseServerDate(activation?.expires_at) || boostEndTime;
            }
            megaBoostCooldownUntil = parseServerDate(activation?.cooldown_until) || megaBoostCooldownUntil;
            setAdCooldownFromIso('mega_boost', activation?.cooldown_until || null, Number(activation?.cooldown_minutes || 10));
            debugLog('ads', 'reward applied in UI', {
                flow: 'mega_boost',
                optimistic: false,
                expiresAt: activation?.expires_at,
                cooldownUntil: activation?.cooldown_until
            });
            
            syncMegaBoostUi();
            console.log(`AD_TRACE_BOOST_SUCCESS`);
        } catch (err) {
            console.log(`AD_TRACE_BOOST_ERROR error=${err?.message} stack=${err?.stack}`);
            boostEndTime = null;
            syncMegaBoostUi();
            showToast(
                resolveRewardedAdErrorMessage(err, tr('toasts.watchError')),
                true
            );
        }
    })();
}

function showBoostIndicator() {
    const oldIndicator = document.querySelector('.mega-boost-indicator');
    if (oldIndicator) oldIndicator.remove();
    
    const energyContainer = document.querySelector('.energy-bar-container');
    if (energyContainer) {
        const indicator = document.createElement('div');
        indicator.className = 'mega-boost-indicator';
        indicator.innerHTML = '🚀 MEGA BOOST ACTIVE';
        energyContainer.appendChild(indicator);
    }
}

async function checkBoostStatus() {
    if (!userId) return;
    
    try {
        const data = await API.get(`/api/mega-boost-status/${userId}`);
        megaBoostCooldownUntil = parseServerDate(data.cooldown_until) || null;
        setAdCooldownFromIso('mega_boost', data?.cooldown_until || null);
        applyBoostStateFromPayload({
            mega_boost_active: !!data.active,
            mega_boost_expires_at: data.expires_at || null
        });
        await syncGhostBoostStatus();
    } catch (err) {
        console.error('Boost status error:', err);
    }
}

// ==================== МИНИ-ИГРЫ ====================
const MINI_GAMES_ENABLED = false;

function notifyMiniGamesDisabled() {
    showToast('Mini-games are temporarily unavailable.', true);
}

const ROULETTE_RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const ROULETTE_WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
let rouletteWheelRotation = 0;
let rouletteBallRotation = 0;
let rouletteAnimationFrame = null;
const miniGameLocks = {
    coinflip: false,
    slots: false,
    dice: false,
    wheel: false
};

async function postMiniGameRequest(endpoint, payload) {
    try {
        const data = await API.post(endpoint, payload);
        if (data.success === false) {
            throw new Error(data.detail || data.message || 'Server error');
        }
        return data;
    } catch (err) {
        throw new Error(err?.detail || err?.message || 'Server error');
    }
}

function openGame(game) {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    document.querySelectorAll('.game-modal').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(`game-${game}`);
    if (game === 'wheel') initRouletteVisuals();
    if (game === 'luckybox') resetLuckyBoxBoard();
    if (game === 'crash' && !crashGhostState.active) resetCrashGhostUI();
    if (modal) modal.classList.add('active');
}

function closeGame(game) {
    if (!MINI_GAMES_ENABLED) return;
    const modal = document.getElementById(`game-${game}`);
    if (game === 'wheel') {
        cancelAnimationFrame(rouletteAnimationFrame);
        rouletteAnimationFrame = null;
        document.getElementById('roulette-plate')?.classList.remove('spinning');
        miniGameLocks.wheel = false;
    }
    if (modal) modal.classList.remove('active');
}

function toggleNumberInput() {
    if (!MINI_GAMES_ENABLED) return;
    const betType = document.getElementById('wheel-color')?.value;
    const numberInput = document.getElementById('wheel-number');
    if (numberInput) numberInput.style.display = betType === 'number' ? 'block' : 'none';
}

function initRouletteVisuals() {
    const plate = document.getElementById('roulette-plate');
    if (!plate || plate.querySelector('.roulette-labels')) return;

    const sectorAngle = 360 / 37;
    const pocketGradient = ROULETTE_WHEEL_ORDER.map((num, index) => {
        const start = (index * sectorAngle).toFixed(4);
        const end = ((index + 1) * sectorAngle).toFixed(4);
        const color = num === 0
            ? '#1f9b58'
            : ROULETTE_RED_NUMBERS.includes(num)
                ? '#d7332f'
                : '#17181e';
        return `${color} ${start}deg ${end}deg`;
    }).join(', ');

    plate.style.background = `conic-gradient(from -90deg, ${pocketGradient})`;

    const labelsWrap = document.createElement('div');
    labelsWrap.className = 'roulette-labels';

    ROULETTE_WHEEL_ORDER.forEach((num, index) => {
        const label = document.createElement('span');
        const angle = ((index + 0.5) * sectorAngle) - 90;
        label.className = 'roulette-label';
        if (num === 0) label.classList.add('green');
        else if (ROULETTE_RED_NUMBERS.includes(num)) label.classList.add('red');
        else label.classList.add('dark');
        label.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translate(0, -110px) rotate(${-angle}deg)`;
        label.textContent = String(num);
        labelsWrap.appendChild(label);
    });

    const pointer = document.createElement('div');
    pointer.className = 'roulette-pointer';
    plate.appendChild(labelsWrap);
    plate.appendChild(pointer);
}

function setRouletteVisualResult(resultNumber) {
    const wheel = document.getElementById('wheel');
    const plate = document.getElementById('roulette-plate');
    const ball = document.getElementById('roulette-ball');
    if (!wheel || !ball || !plate) return;

    const sectorAngle = 360 / 37;
    const wheelIndex = ROULETTE_WHEEL_ORDER.indexOf(resultNumber);
    const targetCenter = (wheelIndex + 0.5) * sectorAngle;
    const normalizedWheel = ((rouletteWheelRotation % 360) + 360) % 360;
    const targetWheelNormalized = (360 - targetCenter) % 360;
    const delta = (targetWheelNormalized - normalizedWheel + 360) % 360;
    rouletteWheelRotation += delta;
    rouletteBallRotation = 0;

    plate.style.transform = `rotate(${rouletteWheelRotation}deg)`;
    ball.style.transform = `translate(-50%, -126px) rotate(${rouletteBallRotation}deg)`;
    wheel.textContent = resultNumber;

    if (resultNumber === 0) wheel.style.color = '#b8aa8a';
    else if (ROULETTE_RED_NUMBERS.includes(resultNumber)) wheel.style.color = '#9a7477';
    else wheel.style.color = '#4c4b57';
}

function getRouletteNumberFromState(wheelRotation, ballRotation) {
    const sectorAngle = 360 / 37;
    const wheelNormalized = ((wheelRotation % 360) + 360) % 360;
    const ballNormalized = ((ballRotation % 360) + 360) % 360;
    const relative = ((ballNormalized - wheelNormalized) % 360 + 360) % 360;
    const centered = (relative + sectorAngle / 2) % 360;
    const wheelIndex = Math.floor(centered / sectorAngle) % 37;
    return ROULETTE_WHEEL_ORDER[wheelIndex];
}

function animateRouletteToResult(resultNumber, duration = 8600) {
    const wheel = document.getElementById('wheel');
    const plate = document.getElementById('roulette-plate');
    const ball = document.getElementById('roulette-ball');
    if (!wheel || !ball || !plate) {
        setRouletteVisualResult(resultNumber);
        return Promise.resolve(resultNumber);
    }

    const sectorAngle = 360 / 37;
    const targetIndex = ROULETTE_WHEEL_ORDER.indexOf(resultNumber);
    const targetCenter = (targetIndex + 0.5) * sectorAngle;
    const currentWheelNormalized = ((rouletteWheelRotation % 360) + 360) % 360;
    const targetWheelNormalized = (360 - targetCenter) % 360;
    const wheelDelta = (targetWheelNormalized - currentWheelNormalized + 360) % 360;

    const startWheel = rouletteWheelRotation;
    const startBall = rouletteBallRotation;
    const finalWheel = startWheel + 1980 + wheelDelta;
    const fastBallTarget = startBall - 3240;
    const settleBallTarget = 0;

    cancelAnimationFrame(rouletteAnimationFrame);
    const startTime = performance.now();

    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
    const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    return new Promise(resolve => {
        const step = now => {
            const progress = Math.min((now - startTime) / duration, 1);
            const wheelPhase = 0.92;
            const ballFastPhase = 0.72;

            if (progress < wheelPhase) {
                const local = progress / wheelPhase;
                rouletteWheelRotation = startWheel + (finalWheel - startWheel) * easeOutExpo(local);
            } else {
                rouletteWheelRotation = finalWheel;
            }

            if (progress < ballFastPhase) {
                const local = progress / ballFastPhase;
                rouletteBallRotation = startBall + (fastBallTarget - startBall) * easeOutQuart(local);
            } else {
                const local = (progress - ballFastPhase) / (1 - ballFastPhase);
                rouletteBallRotation = fastBallTarget + (settleBallTarget - fastBallTarget) * easeOutCubic(local);
            }

            plate.style.transform = `rotate(${rouletteWheelRotation}deg)`;
            ball.style.transform = `translate(-50%, -126px) rotate(${rouletteBallRotation}deg)`;
            wheel.textContent = String(getRouletteNumberFromState(rouletteWheelRotation, rouletteBallRotation));

            if (progress < 1) {
                rouletteAnimationFrame = requestAnimationFrame(step);
                return;
            }

            rouletteAnimationFrame = null;
            rouletteWheelRotation = finalWheel;
            rouletteBallRotation = 0;
            plate.style.transform = `rotate(${rouletteWheelRotation}deg)`;
            ball.style.transform = `translate(-50%, -126px) rotate(0deg)`;
            const landedNumber = getRouletteNumberFromState(rouletteWheelRotation, rouletteBallRotation);
            wheel.textContent = String(landedNumber);
            if (landedNumber === 0) wheel.style.color = '#b8aa8a';
            else if (ROULETTE_RED_NUMBERS.includes(landedNumber)) wheel.style.color = '#9a7477';
            else wheel.style.color = '#4c4b57';
            resolve(landedNumber);
        };

        rouletteAnimationFrame = requestAnimationFrame(step);
    });
}

async function playCoinflip() {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    if (miniGameLocks.coinflip) return;
    const betInput = document.getElementById('coin-bet');
    if (!betInput) return;
    
    const bet = parseInt(betInput.value);
    if (Number.isNaN(bet)) return showToast(tr('toasts.betRequired'), true);
    if (bet > State.game.coins) return showToast(tr('toasts.notEnoughCoins', { amount: bet }), true);
    if (bet < 10) return showToast(tr('toasts.minBet'), true);

    const resultEl = document.getElementById('coin-result');
    const coin = document.getElementById('coin');
    
    resultEl.textContent = tr('minigames.coinflipSpinning');
    coin.classList.add('flipping');
    playSound('coinflip');
    miniGameLocks.coinflip = true;
    
    setTimeout(async () => {
        try {
            if (userId) {
                const data = await postMiniGameRequest('/api/game/coinflip', { user_id: userId, bet });
                coin.classList.remove('flipping');
                
                if ((data.message || '').toLowerCase().includes('won')) {
                    coin.classList.add('win');
                    setTimeout(() => coin.classList.remove('win'), 1000);
                    createConfetti();
                    spawnGameParticles(document.querySelector('#game-coinflip .coin-3d'), 'win');
                    playSound('win');
                } else {
                    shakeGameModal('coinflip');
                    spawnGameParticles(document.querySelector('#game-coinflip .coin-3d'), 'lose');
                    playSound('lose');
                }
                
                resultEl.textContent = data.message || tr('minigames.coinflipPlayed');
                setCoins('coinflip', data.coins, data);
                trackAchievementProgress('games', 1);
                checkAchievements();
                updateUI();
                
            } else {
                const win = Math.random() < 0.5;
                coin.classList.remove('flipping');
                if (win) {
                    addCoins('coinflipLocalWin', bet, { bet });
                    coin.classList.add('win');
                    setTimeout(() => coin.classList.remove('win'), 1000);
                    resultEl.textContent = tr('minigames.coinflipWin', { bet });
                    createConfetti();
                    spawnGameParticles(document.querySelector('#game-coinflip .coin-3d'), 'win');
                    playSound('win');
                } else {
                    addCoins('coinflipLocalLose', -bet, { bet });
                    resultEl.textContent = tr('minigames.coinflipLose');
                    shakeGameModal('coinflip');
                    spawnGameParticles(document.querySelector('#game-coinflip .coin-3d'), 'lose');
                    playSound('lose');
                }
                updateUI();
            }
        } catch (err) {
            coin.classList.remove('flipping');
            resultEl.textContent = `? ${err.message || tr('toasts.serverError')}`;
            playSound('lose');
            showToast(`? ${err.message || tr('toasts.serverError')}`, true);
        } finally {
            miniGameLocks.coinflip = false;
        }
    }, 1500);
}

async function playSlots() {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    if (miniGameLocks.slots) return;
    const betInput = document.getElementById('slots-bet');
    if (!betInput) return;
    
    const bet = parseInt(betInput.value);
    if (Number.isNaN(bet)) return showToast(tr('toasts.betRequired'), true);
    if (bet > State.game.coins) return showToast(tr('toasts.notEnoughCoins', { amount: bet }), true);
    if (bet < 10) return showToast(tr('toasts.minBet'), true);

    const resultEl = document.getElementById('slots-result');
    const slot1 = document.getElementById('slot1');
    const slot2 = document.getElementById('slot2');
    const slot3 = document.getElementById('slot3');
    
    const symbols = ['CH', 'LM', 'OR', '77', 'DM', 'ST'];
    
    resultEl.textContent = tr('minigames.slotsSpinning');
    playSound('spin');
    [slot1, slot2, slot3].forEach(el => el?.classList.add('spinning'));
    miniGameLocks.slots = true;
    
    let spins = 0;
    const maxSpins = 15;
    const spinInterval = setInterval(() => {
        setSlotSymbol(slot1, symbols[Math.floor(Math.random() * symbols.length)]);
        setSlotSymbol(slot2, symbols[Math.floor(Math.random() * symbols.length)]);
        setSlotSymbol(slot3, symbols[Math.floor(Math.random() * symbols.length)]);
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            
            if (userId) {
                postMiniGameRequest('/api/game/slots', { user_id: userId, bet })
                .then(data => {
                    setSlotSymbol(slot1, data.slots?.[0]);
                    setSlotSymbol(slot2, data.slots?.[1]);
                    setSlotSymbol(slot3, data.slots?.[2]);
                    [slot1, slot2, slot3].forEach(el => el?.classList.remove('spinning'));
                    resultEl.textContent = data.message;
                    
                    if (data.message.includes('JACKPOT') || data.message.includes('won')) {
                        playSound('win');
                        createConfetti();
                        spawnGameParticles(document.querySelector('#game-slots .slots-container'), 'win');
                    } else {
                        shakeGameModal('slots');
                        spawnGameParticles(document.querySelector('#game-slots .slots-container'), 'lose');
                        playSound('lose');
                    }
                    
                    setCoins('slots', data.coins, data);
                    updateUI();
                })
                .catch(err => {
                    [slot1, slot2, slot3].forEach(el => el?.classList.remove('spinning'));
                    resultEl.textContent = `? ${err.message || tr('toasts.serverError')}`;
                    playSound('lose');
                })
                .finally(() => {
                    miniGameLocks.slots = false;
                });
            } else {
                const s1 = symbols[Math.floor(Math.random() * symbols.length)];
                const s2 = symbols[Math.floor(Math.random() * symbols.length)];
                const s3 = symbols[Math.floor(Math.random() * symbols.length)];
                
                setSlotSymbol(slot1, s1);
                setSlotSymbol(slot2, s2);
                setSlotSymbol(slot3, s3);
                [slot1, slot2, slot3].forEach(el => el?.classList.remove('spinning'));
                
                if (s1 === s2 && s2 === s3) {
                    const win = bet * 5;
                    addCoins('slotsLocalWin', win, { bet, win });
                    trackAchievementProgress('games', 1);
                    resultEl.textContent = tr('minigames.slotsJackpot', { win });
                    playSound('win');
                    createConfetti();
                    spawnGameParticles(document.querySelector('#game-slots .slots-container'), 'win');
                    checkAchievements();
                } else {
                    addCoins('slotsLocalLose', -bet, { bet });
                    resultEl.textContent = tr('minigames.slotsLose');
                    shakeGameModal('slots');
                    spawnGameParticles(document.querySelector('#game-slots .slots-container'), 'lose');
                    playSound('lose');
                }
                updateUI();
                miniGameLocks.slots = false;
            }
        }
    }, 100);
}

async function playDice() {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    if (miniGameLocks.dice) return;
    const betInput = document.getElementById('dice-bet');
    const predSelect = document.getElementById('dice-prediction');
    
    if (!betInput || !predSelect) return;
    
    const bet = parseInt(betInput.value);
    const pred = predSelect.value;
    
    if (Number.isNaN(bet)) return showToast(tr('toasts.betRequired'), true);
    if (bet > State.game.coins) return showToast(tr('toasts.notEnoughCoins', { amount: bet }), true);
    if (bet < 10) return showToast(tr('toasts.minBet'), true);

    const resultEl = document.getElementById('dice-result');
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    
    const diceFaces = ['1', '2', '3', '4', '5', '6'];
    
    resultEl.textContent = tr('minigames.diceRolling');
    playSound('dice');
    dice1?.classList.add('roll');
    dice2?.classList.add('roll');
    miniGameLocks.dice = true;
    
    let spins = 0;
    const maxSpins = 12;
    
    const spinInterval = setInterval(() => {
        setDiceSymbol(dice1, diceFaces[Math.floor(Math.random() * 6)]);
        setDiceSymbol(dice2, diceFaces[Math.floor(Math.random() * 6)]);
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            
            if (userId) {
                postMiniGameRequest('/api/game/dice', { user_id: userId, bet, prediction: pred })
                .then(data => {
                    setDiceSymbol(dice1, diceFaces[data.dice1 - 1]);
                    setDiceSymbol(dice2, diceFaces[data.dice2 - 1]);
                    dice1?.classList.remove('roll');
                    dice2?.classList.remove('roll');
                    resultEl.textContent = data.message;
                    
                    if (data.message.includes('won')) {
                        createConfetti();
                        spawnGameParticles(document.querySelector('#game-dice .dice-container'), 'win');
                        playSound('win');
                    } else {
                        shakeGameModal('dice');
                        spawnGameParticles(document.querySelector('#game-dice .dice-container'), 'lose');
                        playSound('lose');
                    }
                    
                    trackAchievementProgress('games', 1);
                    checkAchievements();
                    setCoins('dice', data.coins, data);
                    updateUI();
                })
                .catch(err => {
                    dice1?.classList.remove('roll');
                    dice2?.classList.remove('roll');
                    resultEl.textContent = `? ${err.message || tr('toasts.serverError')}`;
                    playSound('lose');
                })
                .finally(() => {
                    miniGameLocks.dice = false;
                });
            } else {
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                const sum = d1 + d2;
                
                setDiceSymbol(dice1, diceFaces[d1 - 1]);
                setDiceSymbol(dice2, diceFaces[d2 - 1]);
                dice1?.classList.remove('roll');
                dice2?.classList.remove('roll');
                
                let win = false;
                if (pred === '7' && sum === 7) win = true;
                if (pred === 'even' && sum % 2 === 0) win = true;
                if (pred === 'odd' && sum % 2 === 1) win = true;
                
                if (win) {
                    const multiplier = pred === '7' ? 5 : 2;
                    addCoins('diceLocalWin', bet * multiplier, { bet, multiplier });
                    resultEl.textContent = tr('minigames.diceWin', { multiplier });
                    playSound('win');
                    spawnGameParticles(document.querySelector('#game-dice .dice-container'), 'win');
                    trackAchievementProgress('games', 1);
                    checkAchievements();
                } else {
                    addCoins('diceLocalLose', -bet, { bet });
                    resultEl.textContent = tr('minigames.diceLose');
                    shakeGameModal('dice');
                    spawnGameParticles(document.querySelector('#game-dice .dice-container'), 'lose');
                    playSound('lose');
                }
                updateUI();
                miniGameLocks.dice = false;
            }
        }
    }, 70);
}

async function playWheel() {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    if (miniGameLocks.wheel) return;
    try {
        const betInput = document.getElementById('wheel-bet');
        if (!betInput) return showToast(tr('toasts.uiError'), true);
        
        const bet = parseInt(betInput.value);
        const betType = document.getElementById('wheel-color')?.value;
        const betNumber = document.getElementById('wheel-number')?.value;
        
        if (isNaN(bet) || bet < 10) return showToast(tr('toasts.minBet'), true);
        if (bet > State.game.coins) return showToast(tr('toasts.notEnoughCoins', { amount: bet }), true);
        if (betType === 'number') {
            const parsedNumber = parseInt(betNumber, 10);
            if (Number.isNaN(parsedNumber) || parsedNumber < 0 || parsedNumber > 36) {
                return showToast(tr('toasts.rouletteNumber'), true);
            }
        }

        const resultEl = document.getElementById('wheel-result');
        const wheel = document.getElementById('wheel');
        const plate = document.getElementById('roulette-plate');
        
        if (!resultEl || !wheel) return showToast(tr('toasts.uiError'), true);
        
        resultEl.textContent = tr('minigames.rouletteSpinning');
        playSound('spin');
        
        plate?.classList.add('spinning');
        miniGameLocks.wheel = true;
        
        if (userId) {
            postMiniGameRequest('/api/game/roulette', {
                    user_id: userId,
                    bet: bet,
                    bet_type: betType,
                    bet_value: betType === 'number' ? parseInt(betNumber) : null
                })
            .then(async data => {
                const landedNumber = await animateRouletteToResult(data.result_number);
                plate?.classList.remove('spinning');
                const isWinMessage = data.message?.includes('won');
                
                resultEl.textContent = isWinMessage
                    ? `🎯 Landed on ${landedNumber}. ${data.message || 'You won'}`
                    : `🎯 Landed on ${landedNumber}. ${data.message || 'You lost'}`;
                
                if (isWinMessage) {
                    createConfetti();
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'win');
                    playSound('win');
                } else {
                    shakeGameModal('wheel');
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'lose');
                    playSound('lose');
                }
                
                setCoins('roulette', data.coins, data);
                trackAchievementProgress('games', 1);
                checkAchievements();
                updateUI();
            })
            .catch(err => {
                plate?.classList.remove('spinning');
                console.error('Roulette error:', err);
                resultEl.textContent = `? ${err.message || tr('toasts.serverError')}`;
                playSound('lose');
            })
            .finally(() => {
                miniGameLocks.wheel = false;
            });
        } else {
            const visualIndex = Math.floor(Math.random() * 37);
            const result = ROULETTE_WHEEL_ORDER[visualIndex];
            
            animateRouletteToResult(result).then(landedNumber => {
                plate?.classList.remove('spinning');
                
                let win = false;
                if (betType === 'red' && ROULETTE_RED_NUMBERS.includes(landedNumber)) win = true;
                if (betType === 'black' && landedNumber !== 0 && !ROULETTE_RED_NUMBERS.includes(landedNumber)) win = true;
                if (betType === 'green' && landedNumber === 0) win = true;
                if (betType === 'number' && landedNumber === parseInt(betNumber)) win = true;
                
                if (win) {
                    const multiplier = betType === 'number' || betType === 'green' ? 35 : 2;
                    addCoins('rouletteLocalWin', bet * multiplier, { bet, multiplier });
                    resultEl.textContent = tr('minigames.rouletteWin', { number: landedNumber, multiplier });
                    playSound('win');
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'win');
                    trackAchievementProgress('games', 1);
                    checkAchievements();
                } else {
                    addCoins('rouletteLocalLose', -bet, { bet });
                    resultEl.textContent = tr('minigames.rouletteLose', { number: landedNumber });
                    shakeGameModal('wheel');
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'lose');
                    playSound('lose');
                }
                updateUI();
            }).catch(err => {
                plate?.classList.remove('spinning');
                resultEl.textContent = `? ${err.message || tr('toasts.serverError')}`;
                playSound('lose');
            }).finally(() => {
                miniGameLocks.wheel = false;
            });
        }
        
    } catch (err) {
        miniGameLocks.wheel = false;
        console.error('Roulette error:', err);
        showToast(tr('toasts.serverError'), true);
    }
}

let luckyBoxBusy = false;
const crashGhostState = {
    active: false,
    bet: 0,
    multiplier: 1,
    crashAt: null,
    sessionId: null,
    startedAt: 0,
    interval: null,
    settled: false
};

function spawnGameParticles(target, tone = 'soft') {
    if (!target || isLitePerformanceMode()) return;

    const burst = document.createElement('div');
    burst.className = 'game-particle-burst';
    const palette = {
        win: ['rgba(255,255,255,0.9)', 'rgba(224,217,207,0.95)', 'rgba(180,171,193,0.9)'],
        soft: ['rgba(255,255,255,0.72)', 'rgba(208,201,189,0.74)', 'rgba(180,171,193,0.72)'],
        lose: ['rgba(214,208,201,0.54)', 'rgba(180,171,193,0.48)', 'rgba(255,255,255,0.4)']
    }[tone] || ['rgba(255,255,255,0.72)'];

    for (let i = 0; i < 10; i++) {
        const particle = document.createElement('span');
        particle.className = 'game-particle';
        particle.style.left = `${46 + Math.random() * 8}%`;
        particle.style.top = `${42 + Math.random() * 12}%`;
        particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 120}px`);
        particle.style.setProperty('--ty', `${(Math.random() - 0.7) * 110}px`);
        particle.style.background = palette[Math.floor(Math.random() * palette.length)];
        particle.style.animationDelay = `${Math.random() * 0.12}s`;
        burst.appendChild(particle);
    }

    target.appendChild(burst);
    setTimeout(() => burst.remove(), 1000);
}

function shakeGameModal(game) {
    const modal = document.querySelector(`#game-${game} .game-modal-content`);
    if (!modal) return;
    modal.classList.remove('shake-loss');
    void modal.offsetWidth;
    modal.classList.add('shake-loss');
    setTimeout(() => modal.classList.remove('shake-loss'), 450);
}

function setSlotSymbol(slotEl, value) {
    if (!slotEl) return;
    const symbolEl = slotEl.querySelector('.slot-symbol');
    const symbolMap = {
        CH: '🍒',
        LM: '🍋',
        OR: '🍊',
        '77': '7️⃣',
        DM: '💎',
        ST: '⭐',
        '🍒': '🍒',
        '🍋': '🍋',
        '🍊': '🍊',
        '7️⃣': '7️⃣',
        '💎': '💎',
        '⭐': '⭐'
    };
    const resolved = symbolMap[value] || value;
    if (symbolEl) symbolEl.textContent = resolved;
    else slotEl.textContent = resolved;
}

function setDiceSymbol(diceEl, value) {
    if (!diceEl) return;
    const face = Math.max(1, Math.min(6, parseInt(value, 10) || 1));
    diceEl.dataset.face = String(face);
    diceEl.innerHTML = '';

    const pipLayouts = {
        1: ['pip-center'],
        2: ['pip-top-left', 'pip-bottom-right'],
        3: ['pip-top-left', 'pip-center', 'pip-bottom-right'],
        4: ['pip-top-left', 'pip-top-right', 'pip-bottom-left', 'pip-bottom-right'],
        5: ['pip-top-left', 'pip-top-right', 'pip-center', 'pip-bottom-left', 'pip-bottom-right'],
        6: ['pip-top-left', 'pip-top-right', 'pip-middle-left', 'pip-middle-right', 'pip-bottom-left', 'pip-bottom-right']
    };

    pipLayouts[face].forEach(cls => {
        const pip = document.createElement('span');
        pip.className = `dice-pip ${cls}`;
        diceEl.appendChild(pip);
    });
}

function resetLuckyBoxBoard() {
    document.querySelectorAll('.lucky-box-card').forEach((card, index) => {
        card.disabled = false;
        card.classList.remove('opened', 'winning', 'losing', 'refund');
        card.dataset.multiplier = '';
        const label = card.querySelector('.lucky-box-label');
        if (label) label.textContent = `Box ${index + 1}`;
    });
    const resultEl = document.getElementById('luckybox-result');
    if (resultEl) resultEl.textContent = tr('minigames.luckyPick');
}

function playLuckyBox(boxIndex) {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    if (luckyBoxBusy) return;

    const betInput = document.getElementById('luckybox-bet');
    const resultEl = document.getElementById('luckybox-result');
    const cards = Array.from(document.querySelectorAll('.lucky-box-card'));
    if (!betInput || !resultEl || !cards.length) return;

    const bet = parseInt(betInput.value, 10);
    if (Number.isNaN(bet) || bet < 10) return showToast(tr('toasts.minBet'), true);
    if (bet > State.game.coins) return showToast(tr('toasts.notEnoughCoins', { amount: bet }), true);

    luckyBoxBusy = true;
    cards.forEach(card => card.disabled = true);
    resultEl.textContent = tr('minigames.luckyOpening');
    playSound('spin');

    const outcomes = [0, 0.8, 1.6, 3.5];
    const shuffled = outcomes.sort(() => Math.random() - 0.5);

    cards.forEach((card, index) => {
        card.classList.add('opened');
        card.dataset.multiplier = String(shuffled[index]);
    });

    setTimeout(async () => {
        try {
            let outcomeList = shuffled;
            let multiplier = shuffled[boxIndex];
            let payout = Math.floor(bet * multiplier);
            let outcomeType = multiplier > 1 ? 'win' : multiplier === 0.8 ? 'refund' : 'lose';

            if (userId) {
                const data = await postMiniGameRequest('/api/game/luckybox', {
                    user_id: userId,
                    bet,
                    box_index: boxIndex
                });
                outcomeList = Array.isArray(data.outcomes) && data.outcomes.length === 4 ? data.outcomes : outcomeList;
                multiplier = Number(data.multiplier ?? outcomeList[boxIndex] ?? 0);
                payout = Number(data.payout ?? Math.floor(bet * multiplier));
                outcomeType = data.outcome || outcomeType;
                if (typeof data.coins === 'number') {
                    setCoins('luckybox', data.coins, data);
                }
                resultEl.textContent = data.message || resultEl.textContent;
            } else {
                setCoins('luckyboxLocal', State.game.coins - bet + payout, { bet, payout });
            }

            cards.forEach((card, index) => {
                const mult = Number(outcomeList[index] ?? 0);
                card.dataset.multiplier = String(mult);
                const label = card.querySelector('.lucky-box-label');
                if (label) {
                    label.textContent = mult === 0 ? tr('minigames.luckyBust') : mult === 0.8 ? tr('minigames.luckySave') : `x${mult}`;
                }
            });

            const selectedCard = cards[boxIndex];
            if (outcomeType === 'win') {
                selectedCard.classList.add('winning');
                if (!userId) resultEl.textContent = tr('minigames.luckyHit', { multiplier, profit: payout - bet });
                createConfetti(selectedCard);
                spawnGameParticles(selectedCard, 'win');
                playSound('win');
            } else if (outcomeType === 'refund') {
                selectedCard.classList.add('refund');
                if (!userId) resultEl.textContent = tr('minigames.luckySoft', { payout });
                spawnGameParticles(selectedCard, 'soft');
                playSound('coinflip');
            } else {
                selectedCard.classList.add('losing');
                if (!userId) resultEl.textContent = tr('minigames.luckyLost', { bet });
                shakeGameModal('luckybox');
                spawnGameParticles(selectedCard, 'lose');
                playSound('lose');
            }

            trackAchievementProgress('games', 1);
            checkAchievements();
            updateUI();
        } catch (err) {
            resultEl.textContent = `? ${err.message || tr('toasts.serverError')}`;
            playSound('lose');
        } finally {
            setTimeout(() => {
                luckyBoxBusy = false;
                resetLuckyBoxBoard();
            }, 2200);
        }
    }, 850);
}

function resetCrashGhostUI() {
    const multiplierEl = document.getElementById('crash-multiplier');
    const statusEl = document.getElementById('crash-status');
    const resultEl = document.getElementById('crash-result');
    const fillEl = document.getElementById('crash-track-fill');
    const runnerEl = document.getElementById('crash-ghost-runner');
    const startBtn = document.getElementById('crash-start-btn');
    const cashBtn = document.getElementById('crash-cashout-btn');

    if (multiplierEl) multiplierEl.textContent = '1.00x';
    if (statusEl) statusEl.textContent = tr('minigames.crashStart');
    if (resultEl) resultEl.textContent = tr('minigames.crashHint');
    if (fillEl) fillEl.style.width = '0%';
    if (runnerEl) runnerEl.style.left = '0%';
    document.querySelector('#game-crash .crash-track')?.classList.remove('danger');
    if (startBtn) startBtn.disabled = false;
    if (cashBtn) {
        cashBtn.disabled = true;
        cashBtn.setAttribute('disabled', 'disabled');
    }
    crashGhostState.multiplier = 1;
    crashGhostState.crashAt = null;
    crashGhostState.sessionId = null;
    crashGhostState.startedAt = 0;
    crashGhostState.settled = false;
}

function stopCrashGhostTracking() {
    if (crashGhostState.interval) {
        clearInterval(crashGhostState.interval);
        crashGhostState.interval = null;
    }
}

async function syncCrashGhostRound() {
    if (!userId || !crashGhostState.active || !crashGhostState.sessionId) return;

    try {
        const response = await API.get(`/api/game/crash/status/${userId}/${crashGhostState.sessionId}`);
        if (!response?.active) {
            if (response?.crashed) {
                finalizeCrashGhostRound({
                    crashed: true,
                    crashAt: response.crash_at || response.multiplier || crashGhostState.multiplier,
                    coins: State.game.coins
                });
            } else {
                stopCrashGhostTracking();
                crashGhostState.active = false;
            }
            return;
        }

        crashGhostState.multiplier = Number(response.multiplier || crashGhostState.multiplier || 1);
        updateCrashGhostVisuals();
    } catch (err) {
        console.error('Crash Ghost status error:', err);
    }
}

function startCrashGhostTracking() {
    stopCrashGhostTracking();
    syncCrashGhostRound();
    crashGhostState.interval = setInterval(syncCrashGhostRound, CONFIG.CRASH_SYNC_INTERVAL_MS);
}

function finalizeCrashGhostRound(result = {}) {
    stopCrashGhostTracking();

    const statusEl = document.getElementById('crash-status');
    const resultEl = document.getElementById('crash-result');
    const startBtn = document.getElementById('crash-start-btn');
    const cashBtn = document.getElementById('crash-cashout-btn');
    const runnerEl = document.getElementById('crash-ghost-runner');

    const crashed = !!result.crashed;
    const cashedOut = !crashed;
    crashGhostState.settled = true;

    if (typeof result.coins === 'number') {
        setCoins('crashFinalize', result.coins, result);
    }

    if (cashedOut) {
        const multiplier = Number(result.multiplier || crashGhostState.multiplier || 1).toFixed(2);
        const payout = Number(result.payout || 0);
        const profit = Number(result.profit || 0);
        if (statusEl) statusEl.textContent = tr('minigames.crashCashout', { multiplier });
        if (resultEl) resultEl.textContent = tr('minigames.crashCashoutResult', { payout, profit });
        if (runnerEl) runnerEl.classList.add('ghost-safe');
        createConfetti(document.getElementById('game-crash'));
        spawnGameParticles(document.querySelector('#game-crash .crash-track'), 'win');
        playSound('win');
    } else {
        const crashAt = Number(result.crashAt || crashGhostState.crashAt || crashGhostState.multiplier || 1).toFixed(2);
        if (statusEl) statusEl.textContent = tr('minigames.crashAt', { multiplier: crashAt });
        if (resultEl) resultEl.textContent = tr('minigames.crashLost', { bet: crashGhostState.bet });
        if (runnerEl) runnerEl.classList.add('ghost-crashed');
        shakeGameModal('crash');
        spawnGameParticles(document.querySelector('#game-crash .crash-track'), 'lose');
        playSound('lose');
    }

    trackAchievementProgress('games', 1);
    checkAchievements();
    updateUI();
    crashGhostState.active = false;

    if (startBtn) startBtn.disabled = false;
    if (cashBtn) {
        cashBtn.disabled = true;
        cashBtn.setAttribute('disabled', 'disabled');
    }

    setTimeout(() => {
        runnerEl?.classList.remove('ghost-safe', 'ghost-crashed');
        resetCrashGhostUI();
    }, 1800);
}

async function startCrashGhost() {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    if (crashGhostState.active) return;

    const betInput = document.getElementById('crash-bet');
    const statusEl = document.getElementById('crash-status');
    const resultEl = document.getElementById('crash-result');
    const startBtn = document.getElementById('crash-start-btn');
    const cashBtn = document.getElementById('crash-cashout-btn');
    if (!betInput || !statusEl || !resultEl) return;

    const bet = parseInt(betInput.value, 10);
    if (Number.isNaN(bet) || bet < 10) return showToast(tr('toasts.minBet'), true);
    if (bet > State.game.coins) return showToast(tr('toasts.notEnoughCoins', { amount: bet }), true);

    try {
        const response = await API.post('/api/game/crash/start', {
            user_id: userId,
            bet
        });

        crashGhostState.active = true;
        crashGhostState.settled = false;
        crashGhostState.bet = bet;
        crashGhostState.multiplier = Number(response.multiplier || 1);
        crashGhostState.sessionId = response.session_id || null;
        crashGhostState.startedAt = parseServerDate(response.server_started_at)?.getTime?.() || Date.now();
        crashGhostState.crashAt = null;

        if (typeof response.coins === 'number') {
            setCoins('crashCashout', response.coins, response);
            updateUI();
        }

        if (startBtn) startBtn.disabled = true;
        if (cashBtn) {
            cashBtn.disabled = false;
            cashBtn.removeAttribute('disabled');
        }
        statusEl.textContent = tr('minigames.crashRunning');
        resultEl.textContent = tr('minigames.crashStake', { bet });
        playSound('spin');
        updateCrashGhostVisuals();
        startCrashGhostTracking();
    } catch (err) {
        showToast(err?.detail || err?.message || tr('toasts.serverError'), true);
    }
}

function updateCrashGhostVisuals() {
    const multiplierEl = document.getElementById('crash-multiplier');
    const fillEl = document.getElementById('crash-track-fill');
    const runnerEl = document.getElementById('crash-ghost-runner');
    const trackEl = document.querySelector('#game-crash .crash-track');
    const percent = Math.min(((crashGhostState.multiplier - 1) / 5) * 100, 100);

    if (multiplierEl) multiplierEl.textContent = `${crashGhostState.multiplier.toFixed(2)}x`;
    if (fillEl) fillEl.style.width = `${percent}%`;
    if (runnerEl) runnerEl.style.left = `${percent}%`;
    if (trackEl) trackEl.classList.remove('danger');
}

async function cashOutCrashGhost() {
    if (!MINI_GAMES_ENABLED) {
        notifyMiniGamesDisabled();
        return;
    }
    if (!crashGhostState.active || crashGhostState.settled) return;

    const cashBtn = document.getElementById('crash-cashout-btn');
    if (cashBtn) {
        cashBtn.disabled = true;
        cashBtn.setAttribute('disabled', 'disabled');
    }
    crashGhostState.settled = true;

    try {
        const response = await API.post('/api/game/crash/cashout', {
            user_id: userId,
            session_id: crashGhostState.sessionId
        });
        finalizeCrashGhostRound({
            crashed: !!response.crashed,
            crashAt: response.crash_at,
            multiplier: response.multiplier,
            payout: response.payout,
            profit: response.profit,
            coins: response.coins
        });
    } catch (err) {
        crashGhostState.settled = false;
        if (cashBtn) {
            cashBtn.disabled = false;
            cashBtn.removeAttribute('disabled');
        }
        showToast(err?.detail || err?.message || tr('toasts.serverError'), true);
    }
}

// ==================== КОНФЕТТИ ====================
function createConfetti(container = document.body) {
    if (isLitePerformanceMode()) return;

    const targetContainer = container || document.body;
    const rect = targetContainer.getBoundingClientRect();
    
    for (let i = 0; i < 24; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            const left = rect.left + Math.random() * rect.width;
            const top = rect.top - 10;
            
            confetti.style.cssText = `
                position: fixed;
                left: ${left}px;
                top: ${top}px;
                width: 8px;
                height: 8px;
                background: ${['#7F49B4', '#FFD700', '#FF6B6B', '#4ECDC4'][Math.floor(Math.random() * 4)]};
                border-radius: 50%;
                pointer-events: none;
                z-index: 20000;
                animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
                box-shadow: 0 0 10px currentColor;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }, i * 50);
    }
}

const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(360deg);
        }
    }
`;
document.head.appendChild(confettiStyle);

// ==================== ЗВУКИ ====================
function playSound(type) {
    if (!State.settings.sound) return;
    
    try {
        const audioCtx = getAudioContextForSfx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        switch(type) {
            case 'win':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                break;
            case 'lose':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                break;
            case 'spin':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                break;
            case 'dice':
                osc.type = 'square';
                osc.frequency.setValueAtTime(200, now);
                for (let i = 0; i < 5; i++) {
                    osc.frequency.setValueAtTime(200 + i * 100, now + i * 0.1);
                }
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                break;
        }
        
        osc.start(now);
        osc.stop(now + 0.6);
    } catch (err) {}
}

// ==================== АЧИВКИ ====================
function openAchievements() {
    openModal('tasks-screen');
    switchTaskHubTab('achievements');
}

function renderAchievements() {
    const list = document.getElementById('tasks-achievements-list');
    if (!list) return;
    
    const stats = {
        clicks: State.achievements.clicks || 0,
        upgrades: State.achievements.upgrades || 0,
        games: State.achievements.games || 0,
        referrals: State.skins.friendsInvited || 0,
        adsWatched: State.skins.adsWatched || 0
    };

    const targetFromId = (id) => {
        if (id.includes('click')) return parseInt(id.split('_')[1]);
        if (id.startsWith('upgrade_')) return parseInt(id.split('_')[1]);
        if (id.startsWith('games_')) return parseInt(id.split('_')[1]);
        if (id.startsWith('level_')) return parseInt(id.split('_')[1]);
        if (id.startsWith('referral_')) return parseInt(id.split('_')[1]);
        if (id.startsWith('ads_')) return parseInt(id.split('_')[1]);
        return 0;
    };
    
    list.innerHTML = ACHIEVEMENTS.map(achievement => {
        const completed = State.achievements.completed.includes(achievement.id);

        const current = achievement.id.startsWith('click') ? stats.clicks :
                        achievement.id.startsWith('upgrade') ? stats.upgrades :
                        achievement.id.startsWith('games') ? stats.games :
                        achievement.id.startsWith('level') ? stats.level :
                        achievement.id.startsWith('referral') ? stats.referrals :
                        achievement.id.startsWith('ads') ? stats.adsWatched : 0;
        const total = achievement.target || targetFromId(achievement.id);
        const percent = total ? Math.min(100, (current / total) * 100) : 100;
        
        return `
            <div class="achievement-item ${completed ? 'completed' : ''}">
                <div class="achievement-icon ${completed ? 'completed' : ''}">${achievement.icon}</div>
                <div class="achievement-info">
                    <h3>${achievement.title}</h3>
                    <p>${achievement.description}</p>
                    ${!completed ? `
                        <div class="achievement-progress-bar">
                            <div class="achievement-progress-fill" style="width: ${percent}%"></div>
                        </div>
                        <div class="achievement-progress-text">${current}/${total}</div>
                    ` : `<div class="achievement-reward">? +${achievement.reward}</div>`}
                </div>
                ${completed ? '<div class="achievement-check">?</div>' : ''}
            </div>
        `;
    }).join('');
    
    updateAchievementsProgress();
}

function updateAchievementsProgress() {
    const completed = State.achievements.completed.length;
    const total = ACHIEVEMENTS.length;
    const percent = (completed / total) * 100;
    
    const completedEl = document.getElementById('tasks-achievements-completed');
    const totalEl = document.getElementById('tasks-achievements-total');
    const fillEl = document.getElementById('tasks-achievements-progress-fill');
    if (completedEl) completedEl.textContent = completed;
    if (totalEl) totalEl.textContent = total;
    if (fillEl) fillEl.style.width = percent + '%';
}

// ==================== ОБРАБОТЧИК КЛИКОВ ====================
let globalTapPointerHandler = null;
let globalTapTouchHandler = null;
let globalTapClickHandler = null;

function setupGlobalClickHandler() {
    const ignoreSelector =
        'button, a, .nav-item, .settings-btn, .modal-close, ' +
        '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
        '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
        '.modal-screen, .modal-content, .game-modal, .game-modal-content, .auto-boost-button, ' +
        '.skin-detail-modal, .energy-recovery-modal, .ad-input-blocker, ' +
        '.prize-pool-shell, .prize-pool-drawer, .prize-pool-tab, .prize-pool-backdrop';

    if (globalTapPointerHandler) {
        document.removeEventListener('pointerdown', globalTapPointerHandler);
        globalTapPointerHandler = null;
    }
    if (globalTapTouchHandler) {
        document.removeEventListener('touchstart', globalTapTouchHandler);
        globalTapTouchHandler = null;
    }
    if (globalTapClickHandler) {
        document.removeEventListener('click', globalTapClickHandler);
        globalTapClickHandler = null;
    }

    if (window.PointerEvent) {
        globalTapPointerHandler = function(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (hasBlockingOverlayActive()) return;
            if (e.target.closest(ignoreSelector)) return;
            handleTap(e);
        };
        document.addEventListener('pointerdown', globalTapPointerHandler, { passive: false });
        return;
    }

    globalTapTouchHandler = function(e) {
        if (hasBlockingOverlayActive()) return;
        if (e.target.closest(ignoreSelector)) return;
        handleTap(e);
    };
    globalTapClickHandler = function(e) {
        if (hasBlockingOverlayActive()) return;
        if (e.target.closest(ignoreSelector)) return;
        handleTap(e);
    };

    document.addEventListener('touchstart', globalTapTouchHandler, { passive: false });
    document.addEventListener('click', globalTapClickHandler);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
window.SpiritBootstrap.run({
    DEBUG,
    APP_BOOT_TS,
    DEBUG_BOOT,
    debugPerfStart,
    mobileAccessState,
    renderMobileOnlyGate,
    applyPerformanceMode,
    applyStaticTranslations,
    ensureToastLayer,
    updateToastViewportOffset,
    loadAchievementsFromStorage,
    loadSettings,
    setupGlobalClickHandler,
    initTonWalletBridge,
    initBgm,
    initAdsgramController,
    initAutoClicker,
    initBadgePhysics,
    userId,
    loadUserData,
    loadTournamentPrizePoolData,
    loadTonWalletStatus,
    checkOfflinePassiveIncome,
    startOnlinePresence,
    sendClickBatch,
    State,
    updateUI,
    CONFIG,
    startAmbientToastLoop,
    startIdleToastLoop,
    applySavedSkin,
    initSoftOnboarding,
    renderOnboardingHandHint
});

// ==================== ENERGY CHARM (GYRO) ====================
function initEnergyCharm() {
    const charm = document.getElementById('energyCharm');
    const chain = document.querySelector('.energy-chain');
    if (!charm) return;

    let idleTimer = null;
    let lastMotion = Date.now();
    let allowTilt = true;
    let dragging = false;
    let dragStart = { x: 0, y: 0 };

    const tilt = { x: 0, y: 0, r: 0 };
    const dragOffset = { x: 0, y: 0 };

    const physics = {
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        baseLen: 60
    };
    let renderRot = 0;
    let lastTs = performance.now();

    const setIdle = () => {
        if (Date.now() - lastMotion > 2000) {
            charm.classList.add('idle');
        }
    };

    const handleTilt = (ax = 0, ay = 0) => {
        if (!allowTilt) return;
        lastMotion = Date.now();
        charm.classList.remove('idle');
        const clamp = (v, m) => Math.max(-m, Math.min(m, v));
        tilt.r = clamp(ax * 7, 18);
        tilt.x = clamp(ax * 6, 24);
        tilt.y = clamp(-ay * 8, 22);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(setIdle, 1500);
    };

    let motionAttached = false;
    const attachMotion = () => {
        if (motionAttached) return;
        window.addEventListener('devicemotion', (e) => {
            const acc = e.accelerationIncludingGravity || e.acceleration || {};
            handleTilt(acc.x || 0, acc.y || 0);
        });
        motionAttached = true;
    };

    const requestMotionPermission = async () => {
        if (!ENABLE_MOTION_TILT) return;
        if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const p = await DeviceMotionEvent.requestPermission();
                if (p === 'granted') attachMotion();
            } catch (e) {}
        } else if (window.DeviceMotionEvent) {
            attachMotion();
        }
    };

    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    charm.addEventListener('pointerdown', async (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        await requestMotionPermission();
        dragging = true;
        State.temp.charmDragging = true;
        allowTilt = false;
        charm.classList.remove('idle');
        dragStart = { x: e.clientX, y: e.clientY };
        physics.vel.x = physics.vel.y = 0;
        dragOffset.x = dragOffset.y = 0;
        charm.setPointerCapture(e.pointerId);
    });
    charm.addEventListener('pointermove', (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (!dragging) return;
        let dx = e.clientX - dragStart.x;
        let dy = e.clientY - dragStart.y;
        const max = 140;
        const len = Math.hypot(dx, dy);
        if (len > max) {
            dx = dx / len * max;
            dy = dy / len * max;
        }
        dragOffset.x = clamp(dx, 48);
        dragOffset.y = clamp(dy, 64);
        tilt.r = clamp(dx * 0.4, 18);
    });
    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        State.temp.charmDragging = false;
        allowTilt = true;
        charm.classList.add('idle');
        dragOffset.x = dragOffset.y = 0;
        tilt.r = 0;
    };
    charm.addEventListener('pointerup', endDrag);
    charm.addEventListener('pointercancel', endDrag);
    ['click','touchstart','touchend','pointerup'].forEach(ev => {
        charm.addEventListener(ev, (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        }, true);
    });

    // start motion if available
    requestMotionPermission();
    charm.classList.add('idle');

    // плавная анимация/инерция
    const animate = (ts) => {
        const dt = Math.min(0.04, (ts - lastTs) / 1000 || 0.016);
        lastTs = ts || performance.now();

        const targetX = tilt.x + dragOffset.x;
        const targetY = tilt.y + dragOffset.y + 6; // лёгкое провисание

        const stiffness = 18;
        const damping = 5.2;
        const gravity = 18;

        const ax = (targetX - physics.pos.x) * stiffness - physics.vel.x * damping;
        const ay = (targetY - physics.pos.y) * stiffness - physics.vel.y * damping + gravity;

        physics.vel.x += ax * dt;
        physics.vel.y += ay * dt;
        physics.pos.x += physics.vel.x * dt;
        physics.pos.y += physics.vel.y * dt;

        // ограничиваем растяжение, чтобы цепь не вылетала
        const ropeX = physics.pos.x;
        const ropeY = physics.baseLen + physics.pos.y;
        const ropeLen = Math.max(30, Math.hypot(ropeX, ropeY));
        const angleRad = Math.atan2(ropeX, ropeY);
        const angleDeg = angleRad * 180 / Math.PI;

        // визуальный поворот брелка
        const targetRot = angleDeg * 0.6 + tilt.r * 0.4;
        renderRot += (targetRot - renderRot) * 0.18;

        // деформация: растягиваем по вертикали при натяжении, немного плющим при возврате
        const stretchY = Math.max(0.7, Math.min(1.5, 1 + (ropeLen - physics.baseLen) / 160));
        const stretchX = 1 / stretchY;
        const tiltX = Math.max(-6, Math.min(6, physics.vel.y * -0.08));

        charm.style.transform = `translate(calc(-50% + ${ropeX}px), ${ropeY}px) rotate(${renderRot}deg) rotateX(${tiltX}deg) scale(${stretchX}, ${stretchY})`;
        if (chain) {
            const scaleY = ropeLen / physics.baseLen;
            chain.style.transform = `rotate(${angleDeg}deg) scaleY(${scaleY})`;
        }
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
}

function setCharmImageFromSkin(skinId) {
    const skin = State.skins.data.find(s => s.id === skinId);
    const img = document.querySelector('.energy-ghost-img');
    if (skin?.image && img) img.src = skin.image;
}

function setCharmFromDetail() {
    const currentId = document.getElementById('skin-detail-img')?.dataset.skinId || State.skins.selected;
    if (!currentId) return;
    setCharmImageFromSkin(currentId);
    showToast(tr('toasts.charmUpdated'));
}

// ==================== BGM ====================
function initBgm() {
    const bgmState = State.temp.bgm;
    if (bgmState.audio) return;
    const audio = new Audio('audio/bgm.mp3');
    audio.loop = true;
    audio.volume = 0.12;
    audio.preload = 'auto';
    bgmState.audio = audio;
    bgmState.enabled = State.settings.music;

    const playBgm = () => {
        if (!bgmState.enabled || !bgmState.audio) return;
        bgmState.audio.play().catch(() => {});
    };

    document.addEventListener('pointerdown', playBgm, { once: true });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') playBgm();
        else bgmState.audio?.pause();
    });
}

function initMainTapButtonUx() {
    const tapButton = document.getElementById('ryoho');
    if (!tapButton || tapButton.dataset.uxBound === '1') return;
    tapButton.dataset.uxBound = '1';

    const pressOn = () => tapButton.classList.add('is-pressed');
    const pressOff = () => tapButton.classList.remove('is-pressed');

    tapButton.addEventListener('pointerdown', pressOn, { passive: true });
    tapButton.addEventListener('pointerup', pressOff, { passive: true });
    tapButton.addEventListener('pointercancel', pressOff, { passive: true });
    tapButton.addEventListener('pointerleave', pressOff, { passive: true });

    tapButton.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        pressOn();
        tapButton.click();
        setTimeout(pressOff, 120);
    });
}

// ==================== AUTO CLICKER ====================
function initAutoClicker() {
    const autoBtn = document.getElementById('auto-boost-btn');
    if (!autoBtn) return;

    const autoState = State.temp.auto;
    const timerLabel = document.getElementById('auto-boost-timer');
    const getStoredCooldownUntil = () => {
        const raw = Number(localStorage.getItem(AUTO_CLICK_COOLDOWN_STORAGE_KEY) || 0);
        return Number.isFinite(raw) && raw > 0 ? raw : 0;
    };
    const setStoredCooldownUntil = (value) => {
        if (value > 0) localStorage.setItem(AUTO_CLICK_COOLDOWN_STORAGE_KEY, String(value));
        else localStorage.removeItem(AUTO_CLICK_COOLDOWN_STORAGE_KEY);
    };
    const getCooldownRemainingMs = () => Math.max(0, getStoredCooldownUntil() - Date.now());
    const updateAutoButtonState = () => {
        const active = autoState.enabledUntil > Date.now();
        const cooldown = getCooldownRemainingMs() > 0;
        autoBtn.disabled = active || cooldown;
        autoBtn.dataset.state = active ? 'active' : (cooldown ? 'cooldown' : 'ready');
    };

    const disableAutoLocal = () => {
        autoState.enabledUntil = 0;
        autoBtn.classList.remove('active');
        if (timerLabel) {
            timerLabel.textContent = '';
            timerLabel.style.display = 'none';
        }
        updateAutoButtonState();
        updateEffect();
        if (autoState.timer) clearInterval(autoState.timer);
        autoState.timer = null;
    };

    const ensureEffect = () => {
        if (autoState.effect) return autoState.effect;
        const el = document.createElement('div');
        el.className = 'auto-pointer-effect';
        document.body.appendChild(el);
        autoState.effect = el;
        return el;
    };

    const updateEffect = () => {
        if (isLitePerformanceMode()) {
            if (autoState.effect) autoState.effect.style.display = 'none';
            return;
        }
        const el = ensureEffect();
        el.style.left = autoState.point.x + 'px';
        el.style.top = autoState.point.y + 'px';
        el.style.display = autoState.fingerDown && autoState.enabledUntil > Date.now() ? 'block' : 'none';
    };

    const loop = () => {
        if (autoState.timer) clearInterval(autoState.timer);
        autoState.timer = setInterval(() => {
            if (Date.now() > autoState.enabledUntil) {
                autoBtn.classList.remove('active');
                autoState.enabledUntil = 0;
                const cooldownLeft = getCooldownRemainingMs();
                if (timerLabel) {
                    timerLabel.textContent = cooldownLeft > 0 ? `CD ${formatCooldownClock(cooldownLeft / 1000)}` : '';
                    timerLabel.style.display = cooldownLeft > 0 ? 'block' : 'none';
                }
                updateAutoButtonState();
                updateEffect();
            } else {
                const remaining = Math.max(0, autoState.enabledUntil - Date.now());
                const sec = Math.ceil(remaining / 1000);
                if (timerLabel) {
                    timerLabel.textContent = sec + 's';
                    timerLabel.style.display = 'block';
                }
                updateAutoButtonState();
                if (autoState.fingerDown && !State.temp.adInputBlocked) {
                    handleTap({
                        clientX: autoState.point.x,
                        clientY: autoState.point.y,
                        preventDefault: () => {},
                        syntheticAuto: true
                    });
                    updateEffect();
                }
            }
        }, AUTO_CLICK_INTERVAL_MS);
    };

    const enableAuto = (ms) => {
        autoState.enabledUntil = Date.now() + ms;
        const cooldownMs = randomIntBetween(AUTO_CLICK_COOLDOWN_MIN_MS, AUTO_CLICK_COOLDOWN_MAX_MS);
        setStoredCooldownUntil(Date.now() + cooldownMs);
        autoBtn.classList.add('active');
        updateAutoButtonState();
        loop();
    };

     window.toggleAutoClick = async function toggleAutoClick() {
         console.log(`AD_TRACE_AUTO_START`);
         if (!autoBtn) {
             console.log(`AD_TRACE_AUTO_NO_BTN`);
             return;
         }
         if (autoState.enabledUntil > Date.now()) {
             console.log(`AD_TRACE_AUTO_ALREADY_ACTIVE`);
             return;
         }
         if (isAdsgramReady()) prewarmAdActionSession('autoclicker');
         const cooldownRemainingMs = getCooldownRemainingMs();
         if (cooldownRemainingMs > 0) {
             console.log(`AD_TRACE_AUTO_COOLDOWN cooldownMs=${cooldownRemainingMs}`);
             showToast(`Auto click cooldown ${formatCooldownClock(cooldownRemainingMs / 1000)}`, true);
             updateAutoButtonState();
             return;
         }

         const enable = () => { 
             console.log(`AD_TRACE_AUTO_ENABLE`);
             showToast(tr('toasts.autoTapEnabled')); 
             enableAuto(AUTO_CLICK_DURATION_MS); 
         };

         if (!isAdsgramReady()) {
             console.log(`AD_TRACE_AUTO_NOT_READY`);
             showToast(tr('toasts.adUnavailable'), true);
             return;
         }
         showToast(tr('toasts.adLoading'));
         try {
             console.log(`AD_TRACE_AUTO_OPEN_START`);
             const adSessionId = await openRewardedAdWithSession('autoclicker');
             console.log(`AD_TRACE_AUTO_OPEN_END sessionId=${adSessionId}`);
             debugLog('ads', 'reward applied in UI', {
                 flow: 'autoclicker',
                 optimistic: true,
                 duration: AUTO_CLICK_DURATION_MS / 1000
             });
             console.log(`AD_TRACE_AUTO_CONFIRM_START`);
             await confirmAdsgramAdSession(adSessionId);
             console.log(`AD_TRACE_AUTO_CONFIRM_END`);
             const activation = await claimAdActionWithRetry(() => API.post('/api/autoclicker/activate', {
                 user_id: userId,
                 ad_session_id: adSessionId
             }));
             console.log(`AD_TRACE_AUTO_CLAIM_END`);
             enable();
             debugLog('ads', 'reward applied in UI', {
                 flow: 'autoclicker',
                 optimistic: false,
                 duration: activation?.duration_seconds
             });
             console.log(`AD_TRACE_AUTO_SUCCESS`);
         } catch (e) {
             console.log(`AD_TRACE_AUTO_ERROR error=${e?.message} stack=${e?.stack}`);
             disableAutoLocal();
             showToast(
                 resolveRewardedAdErrorMessage(e, tr('toasts.autoTapError')),
                 true
             );
         }
     };

    const pointerDown = (e) => {
        autoState.fingerDown = true;
        autoState.point = { x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0 };
        updateEffect();
    };
    const pointerMove = (e) => {
        if (!autoState.fingerDown) return;
        autoState.point = { x: e.clientX || e.touches?.[0]?.clientX || autoState.point.x, y: e.clientY || e.touches?.[0]?.clientY || autoState.point.y };
        updateEffect();
    };
    const pointerUp = () => {
        autoState.fingerDown = false;
        updateEffect();
    };

    document.addEventListener('pointerdown', pointerDown);
    document.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('pointercancel', pointerUp);
    if (timerLabel) timerLabel.style.display = 'none';
    updateAutoButtonState();
    loop();
}

// ==================== ПОДВЕСКА БРЕЛКА ====================
function initBadgePhysics() {
    const card = document.getElementById('badgeCard');
    const ropeCanvas = document.getElementById('badgeRope');
    const wrap = document.querySelector('.badge-wrap');
    const bar = document.querySelector('.energy-bar-container');
    // временно отключаем отображение брелка, но оставляем код на месте
    if (wrap) wrap.style.display = 'none';
    return;

    // (оставлено для будущего включения)
    if (!card || !ropeCanvas || !wrap || !bar) return;

    const ctx = ropeCanvas.getContext('2d');

    const params = {
        ropeLength: 110,
        maxStretch: 100,
        stiffness: 120,
        damping: 2.4,
        gravity: 2000, // px/s^2
        mass: 2.0,
        angularDamping: 6.0,
        dragFollow: 60,
    };

    const state = {
        pos: { x: 0, y: params.ropeLength },
        vel: { x: 0, y: 0 },
        rot: 0,
        rotVel: 0,
        tiltX: 0,
        tiltY: 0,
        dragging: false,
        dragTarget: { x: 0, y: 0 },
        lastTs: performance.now(),
        anchor: { x: 0, y: 0 }
    };

    const resizeCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        ropeCanvas.width = Math.round(window.innerWidth * dpr);
        ropeCanvas.height = Math.round(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const updateAnchor = () => {
        const br = bar.getBoundingClientRect();
        state.anchor.x = br.right - 24;
        state.anchor.y = br.top + 4;
    };

    const updateWrap = () => {
        resizeCanvas();
        updateAnchor();
    };

    updateWrap();
    window.addEventListener('resize', updateWrap);
    window.addEventListener('scroll', updateAnchor, { passive: true });

    const pointerToLocal = (e) => {
        const rect = ropeCanvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        return { x: x, y: y };
    };

    const startDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.dragging = true;
        const p = pointerToLocal(e);
        state.dragTarget = { x: p.x - state.anchor.x, y: p.y - state.anchor.y };
    };
    const moveDrag = (e) => {
        if (!state.dragging) return;
        e.preventDefault();
        e.stopPropagation();
        const p = pointerToLocal(e);
        state.dragTarget = { x: p.x - state.anchor.x, y: p.y - state.anchor.y };
    };
    const endDrag = (e) => {
        if (!state.dragging) return;
        e.preventDefault();
        e.stopPropagation();
        state.dragging = false;
    };

    ['pointerdown', 'touchstart'].forEach(ev => card.addEventListener(ev, startDrag, { passive: false }));
    ['pointermove', 'touchmove'].forEach(ev => card.addEventListener(ev, moveDrag, { passive: false }));
    ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach(ev => window.addEventListener(ev, endDrag, { passive: false }));

    const integrate = (dt) => {
        // drag force towards target while dragging
        if (state.dragging) {
            const dx = state.dragTarget.x - state.pos.x;
            const dy = state.dragTarget.y - state.pos.y;
            state.vel.x += dx * params.dragFollow * dt;
            state.vel.y += dy * params.dragFollow * dt;
        } else {
            // gravity
            state.vel.y += params.gravity * dt;
        }

        // spring to limit rope length (soft constraint)
        const len = Math.hypot(state.pos.x, state.pos.y);
        const maxLen = params.ropeLength + params.maxStretch;
        const over = len - params.ropeLength;
        if (over > 0) {
            const stretch = Math.min(over, params.maxStretch);
            const k = params.stiffness / params.mass;
            const nx = state.pos.x / (len || 1);
            const ny = state.pos.y / (len || 1);
            state.vel.x -= nx * k * stretch * dt;
            state.vel.y -= ny * k * stretch * dt;
        }

        // damping
        const damp = Math.exp(-params.damping * dt);
        state.vel.x *= damp;
        state.vel.y *= damp;

        state.pos.x += state.vel.x * dt;
        state.pos.y += state.vel.y * dt;

        // rotation from velocity change
        const targetRot = Math.atan2(state.pos.x, state.pos.y) * 0.6 + state.vel.x * 0.0008;
        const rotDamp = Math.exp(-params.angularDamping * dt);
        state.rotVel += (targetRot - state.rot) * 18 * dt;
        state.rotVel *= rotDamp;
        state.rot += state.rotVel * dt;

        // slight 3D tilt from velocity
        state.tiltX += ((-state.vel.y * 0.003) - state.tiltX) * 8 * dt;
        state.tiltY += ((state.vel.x * 0.003) - state.tiltY) * 8 * dt;
    };

    const render = () => {
        ctx.clearRect(0, 0, ropeCanvas.width, ropeCanvas.height);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const grad = ctx.createLinearGradient(state.anchor.x, state.anchor.y, state.anchor.x + state.pos.x, state.anchor.y + state.pos.y);
        grad.addColorStop(0, '#d9cff8');
        grad.addColorStop(1, '#6c5ce7');
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(state.anchor.x, state.anchor.y);
        ctx.quadraticCurveTo(
            state.anchor.x + state.pos.x * 0.25,
            state.anchor.y + state.pos.y * 0.35,
            state.anchor.x + state.pos.x,
            state.anchor.y + state.pos.y
        );
        ctx.stroke();
    };

    const loop = (ts) => {
        const dt = Math.min(0.033, (ts - state.lastTs) / 1000 || 0.016);
        state.lastTs = ts || performance.now();
        integrate(dt);
        render();
        const tx = state.anchor.x + state.pos.x - card.offsetWidth / 2;
        const ty = state.anchor.y + state.pos.y - card.offsetHeight / 2;
        const rz = state.rot;
        const rx = state.tiltX;
        const ry = state.tiltY;
        card.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotateZ(${rz}rad) rotateX(${rx}rad) rotateY(${ry}rad)`;
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

// ==================== ПАССИВНЫЙ ДОХОД ====================
let passiveIncomeInFlight = false;
let lastPassiveIncomeCheckAtMs = 0;

async function checkOfflinePassiveIncome({ silent = false, force = false } = {}) {
    if (!userId) return;
    if (!force && passiveIncomeInFlight) return;
    if (!force && silent && document.hidden) return;

    const nowMs = Date.now();
    const minGapMs = Number(CONFIG.PASSIVE_INCOME_MIN_GAP_MS || 120000);
    if (!force && (nowMs - lastPassiveIncomeCheckAtMs) < minGapMs) {
        return;
    }

    passiveIncomeInFlight = true;
    lastPassiveIncomeCheckAtMs = nowMs;
    try {
        const data = await API.post('/api/passive-income', { user_id: userId });
        if (data.income > 0) {
            // Apply passive income as authoritative snapshot, preserving optimistic delta
            applyNonClickCoinsSnapshot('passiveIncome', data);
            updateUI();
            if (!silent) {
                showToast(data.message || `+${formatNumber(data.income)} passive income`);
            }
        }
    } catch (e) {
        console.error('Passive income error:', e);
    } finally {
        passiveIncomeInFlight = false;
    }
}


// ==================== ЭКСПОРТ ====================
window.handleTap = handleTap;
window.upgradeBoost = upgradeBoost;
window.upgradeAll = upgradeAll;
window.openGame = openGame;
window.closeGame = closeGame;
window.toggleNumberInput = toggleNumberInput;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.copyReferralLink = copyReferralLink;
window.shareReferral = shareReferral;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.closeSettingsOutside = closeSettingsOutside;
window.openTasksModal = openTasksModal;
window.openRebirthConfirm = openRebirthConfirm;
window.confirmRebirth = confirmRebirth;
window.switchTaskHubTab = switchTaskHubTab;
window.setLanguage = setLanguage;
window.toggleTheme = toggleTheme;
window.toggleSound = toggleSound;
window.toggleMusic = toggleMusic;
window.toggleVibration = toggleVibration;
window.activateMegaBoost = activateMegaBoost;
window.initMainTapButtonUx = initMainTapButtonUx;
window.selectSkin = selectSkin;
window.filterSkins = filterSkins;
window.openSkins = openSkins;
window.showToast = showToast;
window.State = State;
window.state = State;
window.startPerfectEnergySystem = startPerfectEnergySystem;
window.forceSync = forceSync;
window.sendClickBatch = sendClickBatch;
window.syncEnergyWithServer = syncEnergyWithServer;
window.fullSyncWithServer = fullSyncWithServer;
window.recoverEnergyWithAd = recoverEnergyWithAd;
window.closeEnergyRecoveryModal = closeEnergyRecoveryModal;
window.openAchievements = openAchievements;
window.openDailyRewards = openDailyRewards;
window.claimDailyReward = claimDailyReward;
window.watchVideoForTask = watchVideoForTask;
window.startSocialTask = startSocialTask;
window.startCpaTask = startCpaTask;
window.claimSocialTask = claimSocialTask;
window.toggleCompletedSocialTasks = toggleCompletedSocialTasks;
window.checkBoostStatus = checkBoostStatus;
window.closeSkinDetail = closeSkinDetail;
window.openSkinDetail = openSkinDetail;
window.unlockSkinFromDetail = unlockSkinFromDetail;
window.selectSkinFromDetail = selectSkinFromDetail;
window.connectTonWallet = connectTonWallet;
window.disconnectTonWallet = disconnectTonWallet;

