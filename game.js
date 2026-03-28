// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
window.API_URL = 'https://ryoho.onrender.com';
window.recoveryInterval = null;

'use strict';

console.log('🚀 game.js загружен', new Date().toLocaleTimeString());

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    API_URL: window.API_URL,
    CLICK_BATCH_INTERVAL: 1000,
    ENERGY_RECHARGE_INTERVAL: 1000,
    PASSIVE_INCOME_INTERVAL: 60000,
    CACHE_TTL: 30000
};

window.CONFIG = CONFIG;

// ==================== TELEGRAM INIT ====================
const tg = window.Telegram?.WebApp;
let userId = null;
let username = null;
let referrerId = null;
const OWNER_ONLINE_COUNTER_USER_ID = 1507124181;
const telegramInitData = tg?.initData || '';
const telegramLanguage = (tg?.initDataUnsafe?.user?.language_code || navigator.language || 'en').toLowerCase();
const UI_LANG = 'en';

const I18N = {
    en: {
        common: {
            loading: 'Loading...',
            on: 'On',
            off: 'Off',
            day: 'Day',
            night: 'Night',
            player: 'Player',
            score: 'Score',
            online: 'Online',
            claim: 'Claim',
            equip: 'Equip',
            cancel: 'Cancel',
            select: 'Select',
            closeHint: 'Tap outside the window to close',
            claimFree: 'Free',
            bonusIncome: 'Bonus: +50% income'
        },
        nav: { main: 'Main', friends: 'Friends', tasks: 'Tasks', games: 'Games', skins: 'Skins', tournament: 'Tournament', achievements: 'Achievements' },
        main: { upgrade: 'Upgrade' },
        tournament: {
            title: 'Tournament',
            prizePool: 'Prize Pool: 100,000 coins',
            rank: 'Your rank:',
            score: 'Your score:',
            finished: 'Tournament finished'
        },
        friends: {
            title: 'Friends',
            invited: 'Invited',
            earned: 'Earned',
            referralLink: 'Your referral link',
            copyLink: 'Copy link',
            share: 'Share',
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
            title: 'Mini-Games',
            kicker: 'Neon Casino',
            heroTitle: 'One tap in. All risk. Pure premium chaos.',
            heroSubtitle: 'Pick a table, chase the glow, spike your coin balance.',
            potential: 'Potential',
            tapToPlay: 'Tap to play',
            pullReels: 'Pull the reels',
            rollIt: 'Roll it',
            spinNow: 'Spin now',
            openBox: 'Open a box',
            chaseMultiplier: 'Chase multiplier'
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
            sound: 'Sound',
            music: 'Music',
            vibration: 'Vibration'
        },
        skins: { title: 'Skin', name: 'Skin name', description: 'Skin description', rarity: 'rarity' },
        achievements: { title: 'Achievements' }
        ,
        toasts: {
            loadDataError: '⚠️ Data loading error',
            authRequired: '❌ Please sign in',
            adUnavailable: '❌ Ad unavailable',
            adUnavailableTemp: '❌ Ad temporarily unavailable',
            adLoading: '📺 Loading ad...',
            videoLoading: '📺 Loading video...',
            serverError: '❌ Server error',
            copyError: '❌ Copy failed',
            linkNotLoaded: '❌ Link not loaded',
            linkCopied: '✅ Link copied!',
            rewardReceived: '✅ Reward received!',
            watchError: '❌ Video error',
            notEnoughCoins: '❌ Need {amount} coins',
            minBet: '❌ Minimum bet is 10',
            betRequired: '❌ Enter a bet',
            maxLevel: '⚠️ Max level reached',
            upgradeBusy: '⏳ Upgrade is already processing',
            fullUpgradeNoCoins: '❌ Not enough coins for full upgrade',
            fullUpgradeMax: '⚠️ One upgrade is already at max',
            upgradeApplyError: '❌ Failed to apply upgrades',
            uiError: '❌ Interface error',
            rouletteNumber: '❌ Enter a number from 0 to 36',
            skinLocked: '❌ Skin "{name}" is not unlocked yet!',
            skinSelected: '✨ Skin selected!',
            skinNew: '✅ New skin!',
            skinUnlockError: '❌ Skin unlock error',
            skinSelectError: '❌ Skin selection error',
            skinAlreadyOwned: '✅ You already own this skin',
            skinClaimError: '❌ Claim error',
            skinAdProgress: '✅ +1 video view for skin!',
            starsUnavailable: '❌ Stars payments are not available in this client',
            starsInvoiceError: '❌ Failed to create payment invoice',
            starsPending: '⏳ Waiting for payment confirmation',
            starsCancelled: 'ℹ️ Payment cancelled',
            starsFailed: '❌ Payment failed',
            starsSuccess: '✅ Payment successful',
            boostActive: '⚡ Boost is already active!',
            boostFinished: '⏰ Boost finished',
            megaBoostActivated: '🔥 BOOST ACTIVATED FOR 3 MINUTES!',
            autoTapEnabled: '✅ Auto Tap 2 min',
            autoTapFallback: 'ℹ️ Ad unavailable, auto for 30 sec',
            autoTapError: '❌ Failed to enable auto',
            charmUpdated: '✅ Charm updated',
            energyRecovered: '⚡ Energy restored!',
            energyFull: '⚡ Energy fully restored!',
            cooldownsReset: '🔄 Cooldowns reset'
        },
        skinsDyn: {
            noSkins: 'No skins',
            noDescription: 'No description',
            selected: '✓ SELECTED',
            select: 'SELECT',
            claim: 'CLAIM',
            upgrade: 'UPGRADE',
            watchVideo: 'WATCH VIDEO',
            buy: 'BUY',
            unavailable: 'UNAVAILABLE',
            reqLevel: '🔓 Level {value} required',
            reqWatch: '🔓 Watch {count} videos',
            reqWatchSkin: '🔓 Watch {count} videos for this skin',
            reqStars: '💫 Buy for {price} Stars',
            reqSpecial: '🔓 Special condition',
            noBonus: '⚡ No bonus',
            incomeBonus: '⚡ x{value} income'
        },
        tasksList: {
            tap_surge: { title: 'Tap Surge', description: 'x2 tap income for 5 minutes', tag: 'tap', reward: 'x2 • 5 min' },
            passive_hour: { title: 'Passive Hour', description: 'x2 passive income for 60 minutes', tag: 'passive', reward: 'x2 • 60 min' },
            coin_drop: { title: 'Coin Drop', description: 'Random reward from 200 to 30,000 coins', tag: 'coins', reward: '200-30K' }
        },
        minigames: {
            coinflipSpinning: '🪙 Flipping...',
            coinflipPlayed: '🎮 Played!',
            coinflipWin: '🦅 You won! +{bet}',
            coinflipLose: '💀 You lost',
            slotsSpinning: '🎰 Spinning...',
            slotsJackpot: '🎰 JACKPOT! +{win}',
            slotsLose: '🎰 Better luck next time',
            diceRolling: '🎲 Rolling...',
            diceWin: '🎲 You won! x{multiplier}',
            diceLose: '🎲 You lost',
            rouletteSpinning: '🎡 Spinning...',
            rouletteWin: '🎡 Landed on {number}. You won x{multiplier}',
            rouletteLose: '🎡 Landed on {number}. You lost',
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
            player: 'Игрок',
            score: 'Счёт',
            online: 'Онлайн',
            claim: 'Получить',
            equip: 'Надеть',
            cancel: 'Отмена',
            select: 'Выбрать',
            closeHint: 'Нажмите вне окна, чтобы закрыть',
            claimFree: 'Бесплатно',
            bonusIncome: 'Бонус: +50% к доходу'
        },
        nav: { main: 'Главная', friends: 'Друзья', tasks: 'Задания', games: 'Игры', skins: 'Скины', tournament: 'Турнир', achievements: 'Ачивки' },
        main: { upgrade: 'Прокачка' },
        tournament: {
            title: 'Турнир',
            prizePool: 'Призовой фонд: 100 000 монет',
            rank: 'Ваш ранг:',
            score: 'Ваш счёт:',
            finished: 'Турнир завершён'
        },
        friends: {
            title: 'Друзья',
            invited: 'Приглашено',
            earned: 'Заработано',
            referralLink: 'Ваша реферальная ссылка',
            copyLink: 'Копировать',
            share: 'Поделиться',
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
            title: 'Daily Rewards',
            subtitle: 'Login streak',
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
            title: 'Мини-игры',
            kicker: 'Неон Казино',
            heroTitle: 'Один тап. Весь риск. Чистый премиум-хаос.',
            heroSubtitle: 'Выбирай стол, лови сияние и поднимай баланс.',
            potential: 'Потенциал',
            tapToPlay: 'Играть',
            pullReels: 'Крутить слоты',
            rollIt: 'Бросить',
            spinNow: 'Крутить',
            openBox: 'Открыть бокс',
            chaseMultiplier: 'Ловить множитель'
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
            sound: 'Звуки',
            music: 'Музыка',
            vibration: 'Вибрация'
        },
        skins: { title: 'Скин', name: 'Название скина', description: 'Описание скина', rarity: 'редкость' },
        achievements: { title: 'Ачивки' },
        toasts: {
            loadDataError: '⚠️ Ошибка загрузки данных',
            authRequired: '❌ Авторизуйтесь',
            adUnavailable: '❌ Реклама недоступна',
            adUnavailableTemp: '❌ Реклама временно недоступна',
            adLoading: '📺 Загружаем рекламу...',
            videoLoading: '📺 Загружаем видео...',
            serverError: '❌ Ошибка сервера',
            copyError: '❌ Ошибка копирования',
            linkNotLoaded: '❌ Ссылка не загружена',
            linkCopied: '✅ Ссылка скопирована!',
            rewardReceived: '✅ Награда получена!',
            watchError: '❌ Ошибка при просмотре видео',
            notEnoughCoins: '❌ Нужно {amount} монет',
            minBet: '❌ Минимальная ставка 10',
            betRequired: '❌ Введите ставку',
            maxLevel: '⚠️ Максимальный уровень достигнут',
            upgradeBusy: '⏳ Улучшение уже обрабатывается',
            fullUpgradeNoCoins: '❌ Недостаточно монет для полного апгрейда',
            fullUpgradeMax: '⚠️ Один из апгрейдов уже на максимуме',
            upgradeApplyError: '❌ Не удалось применить улучшения',
            uiError: '❌ Ошибка интерфейса',
            rouletteNumber: '❌ Введите число от 0 до 36',
            skinLocked: '❌ Скин "{name}" ещё не открыт!',
            skinSelected: '✨ Скин выбран!',
            skinNew: '✅ Новый скин!',
            skinUnlockError: '❌ Ошибка разблокировки',
            skinSelectError: '❌ Ошибка выбора скина',
            skinAlreadyOwned: '✅ Скин уже есть',
            skinClaimError: '❌ Ошибка получения',
            skinAdProgress: '✅ +1 просмотр для скина!',
            starsUnavailable: '❌ Оплата Stars недоступна в этом клиенте',
            starsInvoiceError: '❌ Не удалось создать счёт на оплату',
            starsPending: '⏳ Ожидаем подтверждение оплаты',
            starsCancelled: 'ℹ️ Оплата отменена',
            starsFailed: '❌ Ошибка оплаты',
            starsSuccess: '✅ Оплата прошла успешно',
            boostActive: '⚡ Буст уже активен!',
            boostFinished: '⏰ Буст закончился',
            megaBoostActivated: '🔥 БУСТ АКТИВИРОВАН НА 3 МИНУТЫ!',
            autoTapEnabled: '✅ Auto Tap 2 мин',
            autoTapFallback: 'ℹ️ Реклама недоступна, авто на 30 сек',
            autoTapError: '❌ Не удалось включить авто',
            charmUpdated: '✅ Брелок обновлен',
            energyRecovered: '⚡ Энергия восстановлена!',
            energyFull: '⚡ Энергия полностью восстановлена!',
            cooldownsReset: '🔄 Кулдауны сброшены'
        },
        skinsDyn: {
            noSkins: 'Нет скинов',
            noDescription: 'Нет описания',
            selected: '✓ ВЫБРАН',
            select: 'ВЫБРАТЬ',
            claim: 'ПОЛУЧИТЬ',
            upgrade: 'ПРОКАЧАТЬ',
            watchVideo: 'СМОТРЕТЬ ВИДЕО',
            buy: 'КУПИТЬ',
            unavailable: 'НЕДОСТУПНО',
            reqLevel: '🔓 Требуется уровень {value}',
            reqWatch: '🔓 Посмотри {count} видео',
            reqWatchSkin: '🔓 Посмотри {count} видео для этого скина',
            reqStars: '💫 Купить за {price} Stars',
            reqSpecial: '🔓 Условие: особое',
            noBonus: '⚡ Бонус: нет',
            incomeBonus: '⚡ x{value} к доходу'
        },
        tasksList: {
            tap_surge: { title: 'Tap Surge', description: 'x2 к тапу на 5 минут', tag: 'тап', reward: 'x2 • 5 мин' },
            passive_hour: { title: 'Passive Hour', description: 'x2 к пассивному доходу на 60 минут', tag: 'пассив', reward: 'x2 • 60 мин' },
            coin_drop: { title: 'Coin Drop', description: 'Случайная награда от 200 до 30 000 монет', tag: 'коины', reward: '200-30K' }
        },
        minigames: {
            coinflipSpinning: '🪙 Подбрасываем...',
            coinflipPlayed: '🎮 Сыграно!',
            coinflipWin: '🦅 Вы выиграли! +{bet}',
            coinflipLose: '💀 Вы проиграли',
            slotsSpinning: '🎰 Крутим...',
            slotsJackpot: '🎰 ДЖЕКПОТ! +{win}',
            slotsLose: '🎰 Повезет в следующий раз',
            diceRolling: '🎲 Бросаем...',
            diceWin: '🎲 Вы выиграли! x{multiplier}',
            diceLose: '🎲 Вы проиграли',
            rouletteSpinning: '🎡 Крутим...',
            rouletteWin: '🎡 Выпало {number}. Вы выиграли x{multiplier}',
            rouletteLose: '🎡 Выпало {number}. Вы проиграли',
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
const AUTO_CLICK_COOLDOWN_STORAGE_KEY = 'autoClickCooldownUntil';
const AUTO_CLICK_COOLDOWN_MIN_MS = 5 * 60 * 1000;
const AUTO_CLICK_COOLDOWN_MAX_MS = 10 * 60 * 1000;
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
        icon: '📣',
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
        link: 'https://www.tiktok.com/@spirit.cliker?_r=1&_t=ZG-94zyH9Al2Fl'
    },
    {
        id: 'instagram_sub',
        name: 'Instagram',
        icon: '📸',
        image: 'imgg/skins/insta.png',
        colorClass: 'instagram',
        link: 'https://www.instagram.com/spirit_cliker/'
    }
];

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

if (tg) {
    tg.expand();
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

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const isApiRequest =
        requestUrl.startsWith(CONFIG.API_URL) ||
        requestUrl.startsWith('/api/');

    if (!isApiRequest || !telegramInitData) {
        return originalFetch(input, init);
    }

    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    headers.set('X-Telegram-Init-Data', telegramInitData);

    return originalFetch(input, {
        ...init,
        headers
    });
};

// ==================== СОСТОЯНИЕ ====================
const State = {
    user: { id: userId, username, referrerId },
    achievements: {
        clicks: 0,
        upgrades: 0,
        games: 0,
        referrals: 0,
        adsWatched: 0,
        completed: []
    },
    game: {
        coins: 0,
        energy: 500,
        maxEnergy: 500,
        profitPerTap: 1,
        profitPerHour: 100,
        level: 0,
        prices: { global: 120, multitap: 120, profit: 120, energy: 120 },
        levels: { multitap: 0, profit: 0, energy: 0 }
    },
    skins: {
        owned: ['default.pngSP'],
        selected: 'default.pngSP',
        adsWatched: 0,
        friendsInvited: 0,
        data: [],
        videoViews: JSON.parse(localStorage.getItem('videoSkinViews') || '{}')
    },
    tasks: {
        social: {}
    },
    daily: {
        claimedDays: 0,
        claimAvailable: false,
        nextDay: 1,
        infiniteEnergyActive: false,
        infiniteEnergyExpiresAt: null
    },
    settings: {
        theme: localStorage.getItem('ryohoSettings') ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).theme || 'day' : 'day',
        sound: localStorage.getItem('ryohoSettings') ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).sound !== undefined ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).sound : true : true,
        music: localStorage.getItem('ryohoSettings') ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).music !== undefined ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).music : true : true,
        vibration: localStorage.getItem('ryohoSettings') ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).vibration !== undefined ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).vibration : true : true
    },
    temp: {
        tapAnimation: null,
        clickBuffer: 0,
        clickValueBuffer: 0,
        clickBatchInFlight: false,
        lastAutoSoundAt: 0,
        lastAutoVibrationAt: 0,
        animationTimer: null,
        syncTimer: null,
        bgm: {
            audio: null,
            ready: false,
            enabled: true
        },
        auto: {
            enabledUntil: 0,
            timer: null,
            fingerDown: false,
            point: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            effect: null
        },
        taskTapBoostExpiresAt: null,
        taskTapBoostMultiplier: 1,
        taskPassiveBoostExpiresAt: null,
        taskPassiveBoostMultiplier: 1,

        // энергосистема
        energyUiTimer: null,
        serverEnergyBase: 0,
        serverEnergySyncedAtMs: 0,
        energyRegenMs: 5000,
        lastTapAt: 0,
        toastLayerReady: false,
        toastContextTimer: null,
        toastCooldowns: {},
        toastReferralCount: null,
        toastAmbientLastAt: 0,
        idleToastTimer: null,
        idleToastShown: false,
        rapidTapWindow: [],
        ghostBoostActive: false,
        ghostBoostExpiresAt: null,
        ghostBoostInterval: null,
        ghostSpawnVisible: false,
        ghostNextSpawnAt: 0,
        tournamentLastRank: null,
        tournamentLastTopLimit: 0,
        tournamentDropWarned: false,
        onboarding: {
            active: false,
            step: 'done',
            handEl: null
        }

    },
    cache: new Map()
};

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
    num = Math.floor(num);
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
};

const AMBIENT_TOAST_VARIANTS = [
    {
        icon: '✨',
        title: 'Spirit pulse',
        body: () => `${formatNumber(State.game.profitPerHour || 0)} per hour and still climbing.`,
        side: 'left',
        variant: 'info'
    },
    {
        icon: '⚡',
        title: 'Charge check',
        body: () => State.game.energy < State.game.maxEnergy * 0.28
            ? 'Energy is running thin. One refill and the combo wakes up again.'
            : 'Energy flow feels stable. Keep the tempo alive.',
        side: 'left',
        variant: 'warning'
    },
    {
        icon: '🤝',
        title: 'Crew pressure',
        body: () => State.skins.friendsInvited > 0
            ? `Your ${State.skins.friendsInvited} friend${State.skins.friendsInvited > 1 ? 's are' : ' is'} boosting the run.`
            : 'Invite one friend and the squad buffs begin.',
        side: 'right',
        variant: 'reward'
    },
    {
        icon: '👻',
        title: 'Strange signal',
        body: () => 'A ghost just audited your taps and said nothing. Bad sign. Good omen.',
        side: 'right',
        variant: 'weird',
        rare: true
    },
    {
        icon: '🫧',
        title: 'Soft static',
        body: () => 'The screen whispered back. Tap slower and it whispers louder.',
        side: 'left',
        variant: 'weird',
        rare: true
    },
    {
        icon: '🎯',
        title: 'Focus line',
        body: () => State.game.level > 0
            ? `Level ${State.game.level} already looks dangerous. Keep stacking clean taps.`
            : 'The first levels come fast. Build momentum before the grind settles.',
        side: 'right',
        variant: 'info'
    }
];

const IDLE_TOAST_VARIANTS = [
    {
        icon: '🌙',
        title: 'Quiet mode',
        body: 'You went silent for a minute. The spirit is waiting for the next combo.',
        side: 'left',
        variant: 'info'
    },
    {
        icon: '🫧',
        title: 'Stillness',
        body: 'No taps for 60 seconds. Even ghosts started wondering if you left.',
        side: 'right',
        variant: 'weird'
    },
    {
        icon: '⚡',
        title: 'Wake the run',
        body: 'One clean tap and the whole loop starts breathing again.',
        side: 'left',
        variant: 'warning'
    }
];

const FAST_TAP_TOAST_VARIANTS = [
    {
        icon: '⚡',
        title: 'Fast hands',
        body: 'Whoa. You are tapping way faster than normal.',
        side: 'right',
        variant: 'reward'
    },
    {
        icon: '🔥',
        title: 'Combo pace',
        body: 'That speed is nasty. Keep that rhythm alive.',
        side: 'left',
        variant: 'reward'
    },
    {
        icon: '💥',
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
    icon = '✨',
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
        icon: normalized.icon || (isError ? '⚠️' : '✨'),
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
        <div class="onboarding-hand-hint__hand">👆</div>
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
            icon: '👆',
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
            icon: '⬆️',
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
            icon: '🎯',
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
            icon: '🎁',
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
            icon: '✨',
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
        Math.max(State.game.levels.multitap || 0, State.game.levels.profit || 0, State.game.levels.energy || 0) === 0;

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
            icon: '🤝',
            side: 'left'
        },
        skins: {
            key: 'skins',
            title: 'Skins',
            body: 'Skins are not just cosmetic. Some of them multiply your tap income.',
            icon: '🎨',
            side: 'right'
        },
        tournament: {
            key: 'tournament',
            title: 'Tournament',
            body: 'Stay near the top and fight for the prize pool before the board shifts.',
            icon: '🏁',
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
            icon: '🤝',
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
            icon: '💜',
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
            title: 'Tournament alert',
            icon: '🏁',
            side: 'right',
            variant: 'warning',
            key: 'tournament:drop',
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
    { id: 'click_100',    title: 'Warm Up',            description: 'Make 100 taps',         icon: '👆', condition: (s) => s.clicks >= 100,    reward: 1000 },
    { id: 'click_500',    title: 'Rhythm',             description: 'Make 500 taps',         icon: '👆', condition: (s) => s.clicks >= 500,    reward: 2000 },
    { id: 'click_1000',   title: 'Experienced Clicker',description: 'Make 1000 taps',        icon: '👆', condition: (s) => s.clicks >= 1000,   reward: 5000 },
    { id: 'click_5000',   title: 'Flow',               description: 'Make 5000 taps',        icon: '🚀', condition: (s) => s.clicks >= 5000,   reward: 12000 },
    { id: 'click_25000',  title: 'Tap Master',         description: 'Make 25000 taps',       icon: '👑', condition: (s) => s.clicks >= 25000,  reward: 40000 },

    { id: 'upgrade_5',    title: 'Engineer',           description: 'Buy 5 upgrades',        icon: '🛠️', condition: (s) => s.upgrades >= 5,   reward: 2000 },
    { id: 'upgrade_15',   title: 'Architect',          description: 'Buy 15 upgrades',       icon: '🧰', condition: (s) => s.upgrades >= 15,  reward: 8000 },
    { id: 'upgrade_30',   title: 'System Builder',     description: 'Buy 30 upgrades',       icon: '⬆️', condition: (s) => s.upgrades >= 30,  reward: 20000 },

    { id: 'games_10',     title: 'Player',             description: 'Play 10 mini-games',    icon: '🎮', condition: (s) => s.games >= 10,     reward: 3000 },
    { id: 'games_30',     title: 'Streamer',           description: 'Play 30 mini-games',    icon: '🎬', condition: (s) => s.games >= 30,     reward: 12000 },

    { id: 'referral_1',   title: 'First Friend',       description: 'Invite 1 friend',       icon: '🤝', condition: (s) => s.referrals >= 1,  reward: 2000 },
    { id: 'referral_5',   title: 'Popular',            description: 'Invite 5 friends',      icon: '👥', condition: (s) => s.referrals >= 5,  reward: 10000 },
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
        console.warn('Achievements restore failed', e);
    }
}

function saveAchievementsToStorage() {
    try {
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify({
            ...State.achievements,
            completed: Array.from(new Set(State.achievements.completed || []))
        }));
    } catch (e) {
        console.warn('Achievements save failed', e);
    }
}

function trackAchievementProgress(key, delta = 1) {
    State.achievements[key] = (State.achievements[key] || 0) + delta;
    saveAchievementsToStorage();
}

function applyServerEnergySnapshot(payload) {
    if (typeof payload.energy === 'number') {
        State.temp.serverEnergyBase = payload.energy;
        State.game.energy = payload.energy;
    }

    if (typeof payload.max_energy === 'number') {
        State.game.maxEnergy = payload.max_energy;
    }

    if (typeof payload.regen_seconds === 'number') {
        State.temp.energyRegenMs = payload.regen_seconds * 1000;
    }

    State.temp.serverEnergySyncedAtMs = Date.now();
}

function getVisualEnergy() {
    if (!State.temp.serverEnergySyncedAtMs) {
        return State.game.energy || 0;
    }

    const elapsed = Date.now() - State.temp.serverEnergySyncedAtMs;
    const gained = Math.floor(elapsed / State.temp.energyRegenMs);

    return Math.min(
        State.game.maxEnergy,
        State.temp.serverEnergyBase + gained
    );
}

function refreshEnergyUIOnly() {
    // Пока игрок активно кликает, не рисуем реген поверх тапа
    if (Date.now() - (State.temp.lastTapAt || 0) < 700) {
        return;
    }

    const visualEnergy = getVisualEnergy();

    if (visualEnergy !== State.game.energy) {
        State.game.energy = visualEnergy;
        updateUI();
    }
}

function checkAchievements() {
    const stats = {
        clicks: State.achievements.clicks || 0,
        upgrades: State.achievements.upgrades || 0,
        games: State.achievements.games || 0,
        referrals: State.skins.friendsInvited || 0,
        adsWatched: State.skins.adsWatched || 0
    };
    
    let changed = false;
    ACHIEVEMENTS.forEach(achievement => {
        if (!State.achievements.completed.includes(achievement.id) && 
            achievement.condition(stats)) {
            State.achievements.completed.push(achievement.id);
            State.game.coins += achievement.reward;
            showAchievementNotification(achievement);
            updateUI();
            changed = true;
        }
    });

    if (changed) saveAchievementsToStorage();
}

function showAchievementNotification(achievement) {
    showToast(`${achievement.title} • +${formatNumber(achievement.reward)} coins`, false, {
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
        if (!window.audioCtx) window.audioCtx = new AudioContext();
        const now = window.audioCtx.currentTime;
        for (let i = 0; i < 3; i++) {
            const osc = window.audioCtx.createOscillator();
            const gain = window.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(window.audioCtx.destination);
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
const API = {
    async request(endpoint, options = {}, retries = 2) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const res = await fetch(CONFIG.API_URL + endpoint, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers },
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) {
                const err = new Error(`HTTP ${res.status}`);
                err.status = res.status;
                try {
                    const data = await res.json();
                    err.detail = data?.detail || '';
                } catch (parseError) {}
                throw err;
            }
            return await res.json();
        } catch (err) {
            clearTimeout(timeout);
            if (retries > 0 && (err.name === 'AbortError' || err.status >= 500)) {
                await new Promise(r => setTimeout(r, 1000));
                return this.request(endpoint, options, retries - 1);
            }
            throw err;
        }
    },
    get(endpoint) { return this.request(endpoint); },
    post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
};

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadUserData() {
    if (!userId) return;
    
    try {
        await API.post('/api/register', {
            user_id: userId,
            username,
            referrer_id: referrerId
        });
        
        const data = await API.get(`/api/user/${userId}`);
        
        State.game.coins = data.coins || 0;
        State.game.energy = data.energy || 500;
        State.game.maxEnergy = data.max_energy || 500;
        applyServerEnergySnapshot({
            energy: data.energy || 0,
            max_energy: data.max_energy || 500,
            regen_seconds: data.regen_seconds || 2
        });
        State.game.profitPerTap = data.profit_per_tap || 1;
        State.game.profitPerHour = data.profit_per_hour || 100;
        State.game.levels.multitap = data.multitap_level || 0;
        State.game.levels.profit = data.profit_level || 0;
        State.game.levels.energy = data.energy_level || 0;
        State.game.level = getDisplayLevel(Math.max(State.game.levels.multitap, State.game.levels.profit, State.game.levels.energy));
        applyTaskBoostPayload(data);
        
        State.skins.owned = normalizeOwnedSkinIds(data.owned_skins || ['default.pngSP']);
        State.skins.selected = normalizeSelectedSkinId(data.selected_skin || 'default.pngSP', State.skins.owned);
        State.skins.adsWatched = data.ads_watched || 0;
        setGhostBoostState(!!data.ghost_boost_active, data.ghost_boost_expires_at || null);
        if (data.daily_infinite_energy_expires_at) {
            State.daily.infiniteEnergyExpiresAt = data.daily_infinite_energy_expires_at;
        }
        
        await loadPrices();
        await loadSkinsList();
        await loadReferralData();
        await checkBoostStatus();
        await loadDailyRewardStatus();

        
        applySavedSkin();
        updateUI();
        startPerfectEnergySystem();
        
        
    } catch (err) {
        console.error('Failed to load user data:', err);
        showToast(tr('toasts.loadDataError'), true);
    }
}

async function loadPrices() {
    if (!userId) return;
    try {
        const prices = await API.get(`/api/upgrade-prices/${userId}`);
        State.game.prices = { ...State.game.prices, ...prices };
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

        // Video skins (rare, x1.5) — per-skin 10 views
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

        // Stars skins (super, x2). Prices: 3 at 149, 3 at 249, 2 at 500
        { id: "stars1.pngSP", name: "Stars 1", image: "imgg/skins/stars1.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 149 } },
        { id: "stars2.pngSP", name: "Stars 2", image: "imgg/skins/stars2.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 149 } },
        { id: "stars3.pngSP", name: "Stars 3", image: "imgg/skins/stars3.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 149 } },

        { id: "stars4.pngSP", name: "Stars 4", image: "imgg/skins/stars4.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 249 } },
        { id: "stars5.pngSP", name: "Stars 5", image: "imgg/skins/stars5.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 249 } },
        { id: "stars6.pngSP", name: "Stars 6", image: "imgg/skins/stars6.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 249 } },

        { id: "stars7.pngSP", name: "Stars 7", image: "imgg/skins/stars7.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 500 } },
        { id: "stars8.pngSP", name: "Stars 8", image: "imgg/skins/stars8.png", rarity: "super", bonus: { type: "multiplier", value: 2.0 }, requirement: { type: "stars", price: 500 } },
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
            skin.requirement.current = getDisplayLevel(State.game.levels.multitap);
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
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
    return expiresAt.getTime() > Date.now();
}

function isGhostBoostActive() {
    if (!State.temp.ghostBoostExpiresAt) return false;
    const expiresAt = parseServerDate(State.temp.ghostBoostExpiresAt);
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
    return expiresAt.getTime() > Date.now();
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
                icon: '🌫️',
                side: 'right',
                variant: 'info',
                duration: 3600
            });
            return;
        }
        renderGhostBoostIndicator(State.temp.ghostBoostExpiresAt);
    }, 1000);
}

async function syncGhostBoostStatus() {
    if (!userId) return;
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/ghost-boost-status/${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        setGhostBoostState(!!data.active, data.expires_at || null);
    } catch (err) {
        console.error('Ghost boost status error:', err);
    }
}

async function startAdActionSession(action) {
    if (!userId) {
        throw new Error(tr('toasts.authRequired'));
    }

    const response = await API.post('/api/ad-action/start', {
        user_id: userId,
        action
    });

    if (!response?.ad_session_id) {
        throw new Error('Ad session was not created');
    }

    return response.ad_session_id;
}

async function showRewardedAd(adSessionId = null) {
    if (typeof window.show_10655027 !== 'function') {
        throw new Error(tr('toasts.adUnavailable'));
    }

    if (!adSessionId) {
        return window.show_10655027('pop');
    }

    const payload = {
        ymid: adSessionId,
        request_var: adSessionId
    };

    try {
        return await window.show_10655027('pop', payload);
    } catch (err) {
        try {
            return await window.show_10655027(payload);
        } catch (fallbackErr) {
            return window.show_10655027('pop');
        }
    }
}

function isAdConfirmationPendingError(err) {
    const detail = String(err?.detail || err?.message || '').toLowerCase();
    return detail.includes('ad completion was not confirmed yet') || detail.includes('ad watch is not completed yet');
}

async function claimAdActionWithRetry(claimFn, attempts = 7, delayMs = 1200) {
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await claimFn();
        } catch (err) {
            lastError = err;
            if (!isAdConfirmationPendingError(err) || attempt === attempts - 1) {
                throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    throw lastError || new Error('Ad claim failed');
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

    if (typeof window.show_10655027 !== 'function') {
        removeLuckyGhost();
        showToast(tr('toasts.adUnavailable'), true, {
            title: 'Ghost escaped',
            icon: '👻',
            side: 'right',
            variant: 'error'
        });
        return;
    }

    try {
        const adSessionId = await startAdActionSession('ghost_boost');
        showToast('Catch the ad and the ghost pays back with x5 taps and infinite energy.', false, {
            title: 'Lucky ghost',
            icon: '👻',
            side: 'right',
            variant: 'weird',
            duration: 3200
        });
        await showRewardedAd(adSessionId);
        const activation = await claimAdActionWithRetry(() => API.post('/api/activate-ghost-boost', {
            user_id: userId,
            ad_session_id: adSessionId
        }));
        const expiresAt = activation?.expires_at || new Date(Date.now() + GHOST_BOOST_DURATION_MS).toISOString();
        setGhostBoostState(true, expiresAt);
        removeLuckyGhost();
        showToast(`x${activation?.multiplier || GHOST_BOOST_MULTIPLIER} taps and infinite energy for 1 minute.`, false, {
            title: 'Ghost caught',
            icon: '💥',
            side: 'right',
            variant: 'reward',
            duration: 4800
        });
    } catch (err) {
        console.error('Ghost claim error:', err);
        removeLuckyGhost();
        showToast(
            isAdConfirmationPendingError(err)
                ? 'You did not finish the ad or the reward was not confirmed.'
                : tr('toasts.watchError'),
            true,
            {
            title: 'Ghost lost',
            icon: '👻',
            side: 'right',
            variant: 'error'
        });
    }
}

function spawnLuckyGhost() {
    if (State.temp.ghostSpawnVisible || document.hidden || document.body.classList.contains('modal-open')) return;

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
        icon: '👻',
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
        primary: isEnergyDay ? `∞ ${t('daily.infiniteEnergyDesc')}` : `+${formatNumber(coins)}`
    };
}

function renderDailyRewardButton() {
    const button = document.getElementById('dailyRewardsButton');
    if (!button) return;
    const dot = button.querySelector('.daily-gift-dot');
    button.title = State.daily.claimAvailable ? t('daily.ready') : t('daily.wait');
    button.classList.toggle('ready', !!State.daily.claimAvailable);
    if (dot) dot.style.display = State.daily.claimAvailable ? 'block' : 'none';
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
        const response = await API.get(`/api/daily-reward/status/${userId}`);
        State.daily.claimedDays = response.claimed_days || 0;
        State.daily.claimAvailable = !!response.claim_available;
        State.daily.nextDay = response.next_day || Math.min(State.daily.claimedDays + 1, DAILY_REWARD_MAX_DAYS);
        State.daily.infiniteEnergyActive = !!response.infinite_energy_active;
        State.daily.infiniteEnergyExpiresAt = response.infinite_energy_expires_at || null;
        State.skins.data.forEach((skin) => {
            if (skin.requirement?.type === 'daily') {
                skin.requirement.current = State.daily.claimedDays || 0;
            }
        });
        renderDailyRewardButton();
        renderDailyRewardsModal();
        renderSkins();
        updateCollectionProgress();
    } catch (err) {
        console.warn('Daily reward status failed', err);
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
    if (!userId || !State.daily.claimAvailable) return;

    try {
        const response = await API.post('/api/daily-reward/claim', { user_id: userId });
        State.game.coins = response.coins ?? State.game.coins;
        if (response.skin_id) {
            State.skins.owned = normalizeOwnedSkinIds([...(State.skins.owned || []), response.skin_id]);
            await loadSkinsList();
            renderSkins();
            updateCollectionProgress();
        }
        if (response.infinite_energy_expires_at) {
            State.daily.infiniteEnergyExpiresAt = response.infinite_energy_expires_at;
        }
        updateUI();
        showToast(`🎁 +${formatNumber(response.coins_reward || 0)}`);
        await loadDailyRewardStatus();
    } catch (err) {
        showToast(err?.detail || tr('toasts.serverError'), true);
    }
}

// ==================== UI ОБНОВЛЕНИЕ ====================
let pendingUI = false;

function updateUI() {
    if (pendingUI) return;
    pendingUI = true;
    
    requestAnimationFrame(() => {
        const coinEl = document.getElementById('coinBalance');
        if (coinEl) coinEl.textContent = formatNumber(State.game.coins);

        const hourEl = document.getElementById('profitPerHour');
        const displayHour = isTaskPassiveBoostActive()
            ? Math.floor((State.game.profitPerHour || 0) * (State.temp.taskPassiveBoostMultiplier || 1))
            : State.game.profitPerHour;
        if (hourEl) hourEl.textContent = formatNumber(displayHour);
        
        const tapEl = document.getElementById('profitPerTap');
        const displayTap = isTaskTapBoostActive()
            ? Math.floor((State.game.profitPerTap || 0) * (State.temp.taskTapBoostMultiplier || 1))
            : State.game.profitPerTap;
        if (tapEl) tapEl.textContent = displayTap;

        const energyFill = document.getElementById('energyFill');
        const energyText = document.getElementById('energyText');
        const maxEnergyEl = document.getElementById('maxEnergyText');
        
        if (energyFill && energyText && maxEnergyEl) {
            const percent = (State.game.energy / State.game.maxEnergy) * 100;
            energyFill.style.width = percent + '%';
            energyText.textContent = Math.floor(State.game.energy);
            maxEnergyEl.textContent = State.game.maxEnergy;
        }

        const globalLevelEl = document.getElementById('globalLevel');
        if (globalLevelEl) {
            const globalLevel = Math.max(State.game.levels.multitap, State.game.levels.profit, State.game.levels.energy);
            const displayLevel = getDisplayLevel(globalLevel);
            State.game.level = displayLevel;
            globalLevelEl.textContent = displayLevel;
        }

        const globalPriceEl = document.getElementById('globalPrice');
        if (globalPriceEl) {
            globalPriceEl.textContent = formatNumber(State.game.prices.global || 0);
        }

        maybePromptUpgradeOnboarding();
        
        pendingUI = false;
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
    }, isLitePerformanceMode() ? 20000 : 15000);
}

async function syncEnergyWithServer() {
    if (!userId) return;

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/sync-energy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        applyServerEnergySnapshot(data);
        updateUI();
    } catch (e) {
        console.error('Energy sync error:', e);
    }
}

async function fullSyncWithServer() {
    if (!userId) return;

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/user/${userId}`);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        State.game.coins = (data.coins || 0) + (State.temp.clickValueBuffer || 0);
        State.game.profitPerTap = data.profit_per_tap || State.game.profitPerTap;
        State.game.profitPerHour = data.profit_per_hour || State.game.profitPerHour;

        applyServerEnergySnapshot(data);
        updateUI();
    } catch (e) {
        console.error('Full sync error:', e);
    }
}

// ==================== КЛИКИ ====================
let lastBatchTime = 0;

async function sendClickBatch() {
    const clicks = State.temp.clickBuffer;

    if (clicks === 0 || !userId || State.temp.clickBatchInFlight) return;

    const optimisticGain = State.temp.clickValueBuffer;
    State.temp.clickBuffer = 0;
    State.temp.clickValueBuffer = 0;
    State.temp.clickBatchInFlight = true;

    try {
        const batchId = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

        const res = await fetch(`${CONFIG.API_URL}/api/clicks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                clicks,
                batch_id: batchId
            })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
            State.game.coins = (data.coins || 0) + (State.temp.clickValueBuffer || 0);
            State.game.profitPerTap = data.profit_per_tap ?? State.game.profitPerTap;
            State.game.profitPerHour = data.profit_per_hour ?? State.game.profitPerHour;
            setGhostBoostState(!!data.ghost_boost_active, data.ghost_boost_expires_at || null);

            applyServerEnergySnapshot(data);
            updateUI();
        }
    } catch (err) {
        console.error('Click batch error:', err);
        State.temp.clickBuffer += clicks;
        State.temp.clickValueBuffer += optimisticGain;
    } finally {
        State.temp.clickBatchInFlight = false;
    }
}

function handleTap(e) {
    const isAutoTap = !!e?.syntheticAuto;
    const target = (e && e.target && e.target.closest) ? e.target : null;
    if (target && target.closest(
        'button, a, .nav-item, .settings-btn, .modal-close, ' +
        '.mini-boost-button, .auto-boost-button, .skin-category, .skin-card, .task-button, ' +
        '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
        '.modal-screen, .modal-content, .game-modal, .game-modal-content, .badge-card'
    )) return;

    if (e.cancelable) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    let clientX, clientY;
    if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const megaBoostActive =
        document.getElementById('mega-boost-btn')?.classList.contains('active') || false;
    const dailyInfiniteEnergyActive = isDailyInfiniteEnergyActive();
    const ghostBoostActive = isGhostBoostActive();

    let previewGain = State.game.profitPerTap;

    const skin = State.skins.data.find(s => s.id === State.skins.selected);
    if (skin?.bonus?.type === 'multiplier') {
        previewGain *= skin.bonus.value;
    }
    if (isTaskTapBoostActive()) {
        previewGain *= Math.max(1, State.temp.taskTapBoostMultiplier || 1);
    }

    if (megaBoostActive) {
        previewGain *= 2;
    }
    if (ghostBoostActive) {
        previewGain *= GHOST_BOOST_MULTIPLIER;
    }

    previewGain = Math.floor(previewGain) || 1;

    const tapTime = Date.now();
    State.temp.lastTapAt = tapTime;
    registerTapRhythm(tapTime, isAutoTap);
    if (!isAutoTap) {
        advanceSoftOnboarding('tap');
    }

    // СНАЧАЛА проверяем энергию
    if (!megaBoostActive && !dailyInfiniteEnergyActive && !ghostBoostActive) {
        const currentVisualEnergy = getVisualEnergy();

        if (currentVisualEnergy < 1) {
            showEnergyRecoveryModal();
            return;
        }

        State.temp.serverEnergyBase = Math.max(0, currentVisualEnergy - 1);
        State.temp.serverEnergySyncedAtMs = Date.now();
        State.game.energy = State.temp.serverEnergyBase;
    }


    // И только потом считаем клик успешным
    State.temp.clickBuffer += 1;
    State.temp.clickValueBuffer += previewGain;
    State.game.coins += previewGain;
    maybeSpawnLuckyGhost(isAutoTap);

    trackAchievementProgress('clicks', 1);
    checkAchievements();
    updateUI();

    // реюз пула эффектов, чтобы не создавать сотни DOM-элементов
    if (!State.temp.tapPool) {
        State.temp.tapPool = Array.from({ length: isLitePerformanceMode() ? 6 : 10 }, () => {
            const el = document.createElement('div');
            el.className = 'tap-effect-global';
            el.style.position = 'fixed';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '9999';
            el.style.whiteSpace = 'nowrap';
            document.body.appendChild(el);
            return el;
        });
        State.temp.tapPoolIdx = 0;
    }
    const pool = State.temp.tapPool;
    const idx = State.temp.tapPoolIdx % pool.length;
    State.temp.tapPoolIdx++;
    const effect = pool[idx];
    const isNightMode = document.body.classList.contains('night-mode');
    const boostVisualActive = megaBoostActive || dailyInfiniteEnergyActive || ghostBoostActive;
    const tapColor = ghostBoostActive ? '#9CEBFF' : (boostVisualActive ? '#FFD700' : (isNightMode ? '#F7F4FF' : '#7F49B4'));
    const tapGlow = ghostBoostActive ? 'rgba(156,235,255,0.95)' : (boostVisualActive ? '#FFD700' : (isNightMode ? 'rgba(247,244,255,0.92)' : '#7F49B4'));
    effect.style.left = `${clientX}px`;
    effect.style.top = `${clientY}px`;
    effect.style.transform = 'translate(-50%, -50%)';
    effect.style.color = tapColor;
    effect.style.fontSize = isAutoTap ? '22px' : '28px';
    effect.style.fontWeight = isAutoTap ? '700' : 'bold';
    effect.style.textShadow = `0 0 10px ${tapGlow}`;
    effect.textContent = ghostBoostActive ? `+${previewGain} 👻` : (boostVisualActive ? `+${previewGain} 🔥` : `+${previewGain}`);
    effect.style.animation = 'none';
    effect.style.opacity = '1';
    effect.offsetWidth;
    effect.style.animation = isAutoTap ? 'tapFloatAuto 0.42s ease-out forwards' : 'tapFloat 0.55s ease-out forwards';

    const allowAutoSound = !isAutoTap || (Date.now() - State.temp.lastAutoSoundAt >= 220);
    const allowAutoVibration = !isAutoTap || (Date.now() - State.temp.lastAutoVibrationAt >= 260);

    if (State.settings.sound && allowAutoSound) {
        try {
            if (!window.audioCtx) window.audioCtx = new AudioContext();
            const now = window.audioCtx.currentTime;
            const osc = window.audioCtx.createOscillator();
            const gainNode = window.audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(window.audioCtx.destination);
            osc.type = boostVisualActive ? 'sawtooth' : 'sine';
            osc.frequency.setValueAtTime(ghostBoostActive ? 980 : (boostVisualActive ? 800 : (isAutoTap ? 560 : 650)), now);
            osc.frequency.exponentialRampToValueAtTime(ghostBoostActive ? 540 : (boostVisualActive ? 400 : (isAutoTap ? 420 : 450)), now + (isAutoTap ? 0.08 : 0.1));
            gainNode.gain.setValueAtTime(isAutoTap ? 0.12 : 0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + (isAutoTap ? 0.12 : 0.2));
            osc.start(now);
            osc.stop(now + (isAutoTap ? 0.12 : 0.2));
            if (isAutoTap) State.temp.lastAutoSoundAt = Date.now();
        } catch (err) {}
    }

    if (State.settings.vibration && allowAutoVibration) {
        try {
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(isAutoTap ? 'soft' : 'light');
            else if (navigator.vibrate) navigator.vibrate(isAutoTap ? 12 : 20);
            if (isAutoTap) State.temp.lastAutoVibrationAt = Date.now();
        } catch (err) {}
    }
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

function getSkinById(id) {
    return State.skins.data.find(s => s.id === id);
}

function applySavedSkin() {
    const img = document.querySelector('.click-image');
    if (!img) return;
    
    const skin = getSkinById(State.skins.selected);
    img.src = (skin?.image || 'imgg/skins/default.png') + '?t=' + Date.now();
    img.onerror = () => img.src = 'imgg/skins/default.png';
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
                ${isSelected ? '<div class="skin-selected-badge">✓</div>' : ''}
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

async function selectActiveSkin(id) {
    if (!userId) return;
    try {
        await API.post('/api/select-skin', { user_id: userId, skin_id: id });
        State.skins.selected = id;
        applySavedSkin();
        renderSkins();
        showToast(tr('toasts.skinSelected'));
    } catch (err) {
        showToast(tr('toasts.skinSelectError'), true);
    }
}

async function unlockSkin(id) {
    if (!userId || State.skins.owned.includes(id)) return;
    try {
        const res = await API.post('/api/unlock-skin', { user_id: userId, skin_id: id, method: 'free' });
        if (res.success) {
            State.skins.owned.push(id);
            showToast(tr('toasts.skinNew'));
            renderSkins();
            applySavedSkin();
        }
    } catch (err) {
        showToast(tr('toasts.skinUnlockError'), true);
    }
}

function openSkins() {
    renderSkins();
    openModal('skins-screen');
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
    
    const isOwned = State.skins.owned.includes(skin.id);
    const isSelected = State.skins.selected === skin.id;
    
    const detailImg = document.getElementById('skin-detail-img');
    detailImg.src = skin.image || 'imgg/clickimg.png';
    detailImg.dataset.skinId = skin.id;
    document.getElementById('skin-detail-name').textContent = skin.name || tr('skins.title');
    
    const rarityEl = document.getElementById('skin-detail-rarity');
    rarityEl.textContent = skin.rarity || 'common';
    rarityEl.className = 'skin-rarity-badge ' + (skin.rarity || 'common');
    
    document.getElementById('skin-detail-description').textContent = skin.description || tr('skinsDyn.noDescription');
    
    const bonusEl = document.getElementById('skin-detail-bonus');
    if (skin.bonus) {
        if (skin.bonus.type === 'multiplier') bonusEl.innerHTML = tr('skinsDyn.incomeBonus', { value: skin.bonus.value });
        else bonusEl.innerHTML = `⚡ +${skin.bonus.value || 0}`;
    } else {
        bonusEl.innerHTML = tr('skinsDyn.noBonus');
    }
    
    const reqBlock = document.getElementById('skin-requirement-block');
    const reqText = document.getElementById('skin-requirement-text');
    const reqProgress = document.getElementById('skin-requirement-progress');
    const progressText = document.getElementById('requirement-progress-text');
    const progressFill = document.getElementById('requirement-progress-fill');
    const actionBtn = document.getElementById('skin-action-btn');
    
    if (isOwned) {
        reqBlock.style.display = 'none';
        actionBtn.textContent = isSelected ? tr('skinsDyn.selected') : tr('skinsDyn.select');
        actionBtn.onclick = isSelected ? closeSkinDetail : () => selectSkinFromDetail(skin.id);
    } else {
        reqBlock.style.display = 'block';
        
        if (skin.requirement?.type === 'level') {
            const current = getDisplayLevel(State.game.levels.multitap);
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

            reqText.textContent = tr('skinsDyn.reqWatchSkin', { count });
            progressText.textContent = `${current}/${count}`;
            progressFill.style.width = percent + '%';
            reqProgress.style.display = 'flex';

            actionBtn.textContent = current >= count ? tr('skinsDyn.claim') : tr('skinsDyn.watchVideo');
            actionBtn.onclick = current >= count ? () => unlockSkinFromDetail(skin.id) : () => watchAdForSkin(skin.id);
        } else if (skin.requirement?.type === 'stars') {
            reqText.textContent = tr('skinsDyn.reqStars', { price: skin.requirement.price });
            reqProgress.style.display = 'none';
            actionBtn.textContent = tr('skinsDyn.buy');
            actionBtn.onclick = () => buySkinWithStarsPlaceholder(skin);
        } else {
            reqText.textContent = tr('skinsDyn.reqSpecial');
            reqProgress.style.display = 'none';
            actionBtn.textContent = tr('skinsDyn.unavailable');
        }
    }
    
    modal.classList.add('active');
}

function closeSkinDetail() {
    document.getElementById('skin-detail-modal')?.classList.remove('active');
}

async function selectSkinFromDetail(skinId) {
    if (!userId) return showToast(tr('toasts.authRequired'), true);
    try {
        await API.post('/api/select-skin', { user_id: userId, skin_id: skinId });
        State.skins.selected = skinId;
        applySavedSkin();
        showToast(tr('toasts.skinSelected'));
        closeSkinDetail();
        renderSkins();
    } catch (err) {
        showToast(tr('toasts.skinSelectError'), true);
    }
}

async function unlockSkinFromDetail(skinId) {
    if (!userId) return showToast(tr('toasts.authRequired'), true);
    if (State.skins.owned.includes(skinId)) {
        showToast(tr('toasts.skinAlreadyOwned'));
        setCharmImageFromSkin(skinId);
        closeSkinDetail();
        return;
    }
    
    try {
        const res = await API.post('/api/unlock-skin', { user_id: userId, skin_id: skinId, method: 'free' });
        if (res.success) {
            State.skins.owned.push(skinId);
            showToast(tr('toasts.skinNew'));
            setCharmImageFromSkin(skinId);
            closeSkinDetail();
            renderSkins();
            updateCollectionProgress();
        }
    } catch (err) {
        showToast(tr('toasts.skinClaimError'), true);
    }
}

async function buySkinWithStarsPlaceholder(skin) {
    if (!userId) {
        showToast(tr('toasts.authRequired'), true);
        return;
    }

    if (!tg?.openInvoice) {
        showToast(tr('toasts.starsUnavailable'), true);
        return;
    }

    try {
        const response = await API.post('/api/skins/stars-invoice', {
            user_id: userId,
            skin_id: skin.id
        });

        if (!response?.invoice_link) {
            showToast(tr('toasts.starsInvoiceError'), true);
            return;
        }

        tg.openInvoice(response.invoice_link, async (status) => {
            if (status === 'paid') {
                showToast(tr('toasts.starsSuccess'));
                await loadUserData();
                renderSkins();
                updateCollectionProgress();
                openSkinDetail(skin.id);
                return;
            }

            if (status === 'pending') {
                showToast(tr('toasts.starsPending'));
                return;
            }

            if (status === 'cancelled') {
                showToast(tr('toasts.starsCancelled'));
                return;
            }

            showToast(tr('toasts.starsFailed'), true);
        });
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
    if (typeof window.show_10655027 !== 'function') {
        showToast(tr('toasts.adUnavailable'), true);
        return;
    }

    showToast(tr('toasts.adLoading'));

    try {
        const adSessionId = await startAdActionSession('ads_increment');
        await showRewardedAd(adSessionId);
        const adsSync = await claimAdActionWithRetry(() => API.post('/api/ads/increment', {
            user_id: userId,
            ad_session_id: adSessionId
        }));

        // локальный прогресс для конкретного скина
        const key = State.skins.data.find(s => s.id === skinId)?.requirement?.progressKey || skinId;
        State.skins.videoViews[key] = (State.skins.videoViews[key] || 0) + 1;
        localStorage.setItem('videoSkinViews', JSON.stringify(State.skins.videoViews));
        State.skins.adsWatched = adsSync?.ads_watched || ((State.skins.adsWatched || 0) + 1);

        trackAchievementProgress('adsWatched', 1);
        checkAchievements();

        showToast(tr('toasts.skinAdProgress'));
        renderSkins();

        if (document.getElementById('skin-detail-modal').classList.contains('active')) {
            openSkinDetail(skinId);
        }

    } catch (e) {
        showToast(
            isAdConfirmationPendingError(e)
                ? 'You did not finish the ad or the reward was not confirmed.'
                : tr('toasts.watchError'),
            true
        );
    }
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
        const result = await API.post('/api/upgrade', {
            user_id: userId,
            boost_type: type
        });
        
        if (result) {
            State.game.coins = result.coins;
            State.game.levels.multitap = result.levels?.multitap ?? result.new_level ?? State.game.levels.multitap;
            State.game.levels.profit = result.levels?.profit ?? result.new_level ?? State.game.levels.profit;
            State.game.levels.energy = result.levels?.energy ?? result.new_level ?? State.game.levels.energy;
            State.game.prices.global = result.next_cost || 0;
            State.game.prices.multitap = result.next_cost || 0;
            State.game.prices.profit = result.next_cost || 0;
            State.game.prices.energy = result.next_cost || 0;
            trackAchievementProgress('upgrades', 1);
            
        if (result.profit_per_tap) State.game.profitPerTap = result.profit_per_tap;
        if (result.profit_per_hour) State.game.profitPerHour = result.profit_per_hour;
        if (result.max_energy) {
            State.game.maxEnergy = result.max_energy;
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
        const result = await API.post('/api/upgrade-all', {
            user_id: userId
        });

        if (!result?.success) {
            showToast(tr('toasts.upgradeApplyError'), true);
            return;
        }

        State.game.coins = result.coins;
        State.game.levels.multitap = result.levels?.multitap ?? State.game.levels.multitap;
        State.game.levels.profit = result.levels?.profit ?? State.game.levels.profit;
        State.game.levels.energy = result.levels?.energy ?? State.game.levels.energy;
        State.game.prices = { ...State.game.prices, ...(result.prices || {}) };
        if (result.next_cost) {
            State.game.prices.global = result.next_cost;
            State.game.prices.multitap = result.next_cost;
            State.game.prices.profit = result.next_cost;
            State.game.prices.energy = result.next_cost;
        }
        State.game.profitPerTap = result.profit_per_tap ?? State.game.profitPerTap;
        State.game.profitPerHour = result.profit_per_hour ?? State.game.profitPerHour;
        State.game.maxEnergy = result.max_energy ?? State.game.maxEnergy;
        State.game.energy = result.energy ?? State.game.maxEnergy;
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
        if (!window.audioCtx) window.audioCtx = new AudioContext();
        const now = window.audioCtx.currentTime;
        for (let i = 0; i < 3; i++) {
            const osc = window.audioCtx.createOscillator();
            const gain = window.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(window.audioCtx.destination);
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
        icon: '🚀',
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
        icon: '⏳',
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
        icon: '💰',
        type: 'coin_drop',
        cooldown: 60,
        lastUsed: null,
        category: 'coins',
        tag: 'drop',
        completed: false,
        available: true
    }
];

const TASKS_STORAGE_KEY = 'videoTasksState';
const SOCIAL_COMPLETED_COLLAPSED_KEY = 'socialCompletedCollapsed';

function persistSocialTasksState() {
    localStorage.setItem(SOCIAL_TASKS_STORAGE_KEY, JSON.stringify(State.tasks.social || {}));
}

function isCompletedSocialTasksCollapsed() {
    return localStorage.getItem(SOCIAL_COMPLETED_COLLAPSED_KEY) === '1';
}

function toggleCompletedSocialTasks() {
    const nextValue = isCompletedSocialTasksCollapsed() ? '0' : '1';
    localStorage.setItem(SOCIAL_COMPLETED_COLLAPSED_KEY, nextValue);
    renderVideoTasks();
}

async function loadSocialTasksStatus() {
    const saved = JSON.parse(localStorage.getItem(SOCIAL_TASKS_STORAGE_KEY) || '{}');
    State.tasks.social = {};

    SOCIAL_TASKS.forEach((task) => {
        State.tasks.social[task.id] = {
            started: !!saved?.[task.id]?.started,
            completed: false
        };
    });

    if (!userId) return;

    try {
        const tasks = await API.get(`/api/tasks/${userId}`);
        tasks
            .filter((task) => SOCIAL_TASKS.some((socialTask) => socialTask.id === task.id))
            .forEach((task) => {
                State.tasks.social[task.id] = {
                    started: false,
                    completed: !!task.completed
                };
            });
        persistSocialTasksState();
    } catch (err) {
        console.warn('Social tasks sync failed', err);
    }
}

function renderSocialTasksMarkup() {
    const activeTasks = [];
    const completedTasks = [];

    SOCIAL_TASKS.forEach((task) => {
        const state = State.tasks.social[task.id] || { started: false, completed: false };
        const isCompleted = state.completed;
        const canClaim = state.started && !state.completed;
        const requiresVerify = task.verifyMode === 'telegram';
        const actionLabel = isCompleted
            ? 'Claimed'
            : canClaim
                ? (requiresVerify ? 'Verify' : 'Claim')
                : 'Subscribe';
        const actionHandler = isCompleted
            ? ''
            : canClaim
                ? `onclick="claimSocialTask('${task.id}')"`
                : `onclick="startSocialTask('${task.id}')"`
        ;
        const statusCopy = isCompleted
            ? 'Reward received'
            : canClaim
                ? (requiresVerify ? 'Join the channel and tap verify' : 'Open the page, then claim the reward')
                : '20,000 coins and an exclusive skin reward';

        const cardMarkup = `
            <div class="task-card task-card-simple social-task-card social-${task.colorClass} ${isCompleted ? 'is-claimed is-inactive' : ''}">
                <div class="social-task-head">
                    <div class="social-task-brand">
                        <span class="social-task-icon">${task.icon}</span>
                        <span class="social-task-dot ${isCompleted ? 'is-off' : ''}"></span>
                        <span class="social-task-name">${task.name}</span>
                    </div>
                    <span class="task-reward-pill task-reward-pill-simple">${isCompleted ? 'Done' : '+20K + Skin'}</span>
                </div>
                <div class="task-copy-simple">
                    <div class="task-title">${`Follow ${task.name}`}</div>
                    <div class="task-desc">${statusCopy}</div>
                </div>
                <div class="task-actions-simple">
                    <div class="social-task-preview">
                        <img src="${task.image}" alt="${task.name}" onerror="this.src='imgg/skins/default.png'">
                    </div>
                    <button class="task-action task-action-simple social-action social-${task.colorClass}" ${actionHandler} ${isCompleted ? 'disabled' : ''}>
                        ${actionLabel}
                    </button>
                </div>
            </div>
        `;

        if (isCompleted) {
            completedTasks.push(cardMarkup);
        } else {
            activeTasks.push(cardMarkup);
        }
    });

    const completedCollapsed = isCompletedSocialTasksCollapsed();
    const completedMarkup = completedTasks.length
        ? `
            <div class="social-completed-block ${completedCollapsed ? 'is-collapsed' : ''}">
                <button class="social-completed-title" type="button" onclick="toggleCompletedSocialTasks()">
                    <span>Completed</span>
                    <span class="social-completed-arrow">${completedCollapsed ? '▾' : '▴'}</span>
                </button>
                <div class="social-completed-list" ${completedCollapsed ? 'hidden' : ''}>
                    ${completedTasks.join('')}
                </div>
            </div>
        `
        : '';

    return `${activeTasks.join('')}${completedMarkup}`;
}

function startSocialTask(taskId) {
    const task = SOCIAL_TASKS.find((item) => item.id === taskId);
    if (!task) return;

    const link = task.link;
    if (taskId === 'telegram_sub' && tg?.openTelegramLink) {
        tg.openTelegramLink(link);
    } else if (tg?.openLink) {
        tg.openLink(link);
    } else {
        window.open(link, '_blank', 'noopener,noreferrer');
    }

    State.tasks.social[taskId] = {
        started: true,
        completed: false
    };
    persistSocialTasksState();
    renderVideoTasks();
}

async function claimSocialTask(taskId) {
    if (!userId) {
        showToast(tr('toasts.authRequired'), true);
        return;
    }

    try {
        const response = await API.post('/api/complete-task', {
            user_id: userId,
            task_id: taskId
        });

        State.tasks.social[taskId] = {
            started: false,
            completed: true
        };
        persistSocialTasksState();

        if (typeof response.coins === 'number') {
            State.game.coins = response.coins;
        }

        if (response.skin_id) {
            State.skins.owned = normalizeOwnedSkinIds([...(State.skins.owned || []), response.skin_id]);
            await loadSkinsList();
            renderSkins();
            updateCollectionProgress();
        }

        updateUI();
        renderVideoTasks();
        showToast(response.message || '✅ Reward claimed!', false, {
            title: taskId === 'telegram_sub' ? 'Verified reward' : 'Reward claimed',
            variant: 'reward',
            side: taskId === 'telegram_sub' ? 'right' : 'left'
        });
    } catch (err) {
        showToast(err?.detail || tr('toasts.serverError'), true);
    }
}

function checkTaskCooldown(task) {
    if (!task.lastUsed) return true; // Никогда не использовалось
    
    const now = Date.now();
    const cooldownMs = task.cooldown * 60 * 1000; // минуты в миллисекунды
    const timePassed = now - task.lastUsed;
    
    return timePassed >= cooldownMs;
}

function getTaskTimeLeft(task) {
    if (!task.lastUsed) return 0;
    
    const now = Date.now();
    const cooldownMs = task.cooldown * 60 * 1000;
    const timePassed = now - task.lastUsed;
    const timeLeft = Math.max(0, cooldownMs - timePassed);
    
    return Math.ceil(timeLeft / 1000 / 60); // минуты
}

async function loadVideoTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;

    await loadSocialTasksStatus();

    if (userId) {
        try {
            const response = await API.get(`/api/video-tasks/status/${userId}`);
            const taskMap = new Map((response.tasks || []).map((task) => [task.task_id, task]));
            VIDEO_TASKS.forEach((task) => {
                const serverTask = taskMap.get(task.id);
                task.available = serverTask ? !!serverTask.available : true;
                task.remainingSeconds = serverTask ? Number(serverTask.remaining_seconds || 0) : 0;
            });
        } catch (err) {
            console.warn('Video task status failed', err);
            VIDEO_TASKS.forEach((task) => {
                task.available = true;
                task.remainingSeconds = 0;
            });
        }
    }

    renderVideoTasks();
}

function persistTasksState() {
    const payload = {};
    VIDEO_TASKS.forEach(t => payload[t.id] = { lastUsed: t.lastUsed || null });
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(payload));
}

function renderVideoTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;

    const socialMarkup = renderSocialTasksMarkup();
    const videoMarkup = VIDEO_TASKS.map(task => {
        const available = task.available;
        const timeLeft = Math.ceil((task.remainingSeconds || 0) / 60);
        const taskCopy = I18N[UI_LANG]?.tasksList?.[task.id] || I18N.en.tasksList[task.id] || {};
        const rewardValue = taskCopy.reward || task.reward;
        const rewardLabel = typeof rewardValue === 'number'
            ? `+${rewardValue.toLocaleString(UI_LANG === 'ru' ? 'ru-RU' : 'en-US')} ${t('tasks.coinsSuffix')}`
            : rewardValue;

        const actionLabel = available ? t('tasks.watch') : t('tasks.locked');
        const stateText = available
            ? `${taskCopy.description || task.description} • ${rewardLabel}`
            : `${t('tasks.refreshIn', { time: timeLeft })} • ${rewardLabel}`;

        return `
            <div class="task-card task-card-simple ${available ? 'ready' : 'cooldown'}" data-category="${task.category}">
                <div class="task-copy-simple">
                    <div class="task-title">${taskCopy.title || task.title}</div>
                    <div class="task-desc">${stateText}</div>
                </div>
                <div class="task-actions-simple">
                    <span class="task-reward-pill task-reward-pill-simple">${rewardLabel}</span>
                    <button class="task-action task-action-simple ${task.category}" onclick="handleVideoTask('${task.id}')" ${!available ? 'disabled' : ''}>
                        ${available ? `📺 ${actionLabel}` : `⏳ ${actionLabel}`}
                    </button>
                </div>
                ${!available && timeLeft > 0 ? `
                    <div class="task-note-simple">⏳ ${t('tasks.refreshIn', { time: timeLeft })}</div>
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
            State.game.coins += random.value;
            showToast(`🎁 +${random.value} ${tr('tasks.coinsSuffix')}`);
            break;
        case 'energy':
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + random.value);
            showToast(`🎁 +${random.value} energy!`);
            break;
        case 'boost':
            activateCustomBoost(random.multiplier, random.minutes);
            break;
        case 'skin_chance':
            unlockRandomSkin('common');
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
    showToast(`🔥 x${multiplier} for ${minutes} min!`);
    
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
    const task = VIDEO_TASKS.find(t => t.id === taskId);
    if (!task || task.completed || !task.available) return;
    
    if (typeof window.show_10655027 !== 'function') {
        showToast(tr('toasts.adUnavailableTemp'), true);
        return;
    }
    
    showToast(tr('toasts.videoLoading'));
    
    try {
        const adSessionId = await startAdActionSession('video_task');
        await showRewardedAd(adSessionId);
        trackAchievementProgress('adsWatched', 1);

        const response = await claimAdActionWithRetry(() => claimVideoReward(task, adSessionId));

        if (typeof response?.coins === 'number') {
            State.game.coins = response.coins;
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
    } catch (error) {
        console.error('Video error:', error);
        showToast(
            isAdConfirmationPendingError(error)
                ? 'You did not finish the ad or the reward was not confirmed.'
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

        const data = await API.get(`/api/referral-data/${userId}`);
        
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
    const shareText = '🎮 Join Spirit Clicker!';
    window.open(`https://t.me/share/url?url=${encodeURIComponent(linkText)}&text=${encodeURIComponent(shareText)}`, '_blank');
}

// ==================== НАСТРОЙКИ ====================
function loadSettings() {
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

function updateSettingsUI() {
    const isNight = State.settings.theme === 'night';
    const soundOn = State.settings.sound;
    const musicOn = State.settings.music;
    const vibOn = State.settings.vibration;
    
    setToggle('themeTrack', isNight);
    setIcon('themeIcon', isNight ? '🌙' : '☀️');
    setLabel('themeLabel', isNight ? t('common.night') : t('common.day'));
    
    setToggle('soundTrack', soundOn);
    setIcon('soundIcon', soundOn ? '🔊' : '🔇');
    setLabel('soundLabel', soundOn ? t('common.on') : t('common.off'));

    setToggle('musicTrack', musicOn);
    setIcon('musicIcon', musicOn ? '🎵' : '🔕');
    setLabel('musicLabel', musicOn ? t('common.on') : t('common.off'));
    
    setToggle('vibTrack', vibOn);
    setIcon('vibIcon', vibOn ? '📳' : '📴');
    setLabel('vibLabel', vibOn ? t('common.on') : t('common.off'));
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
        ['.header .nav-item:nth-child(1) > span:last-child', 'nav.achievements'],
        ['.header .nav-item:nth-child(2) > span:last-child', 'nav.tournament'],
        ['.upgrade-panel-title', 'main.upgrade'],
        ['.nav-bar .nav-item:nth-child(1) > span:last-child', 'nav.main'],
        ['.nav-bar .nav-item:nth-child(2) > span:last-child', 'nav.friends'],
        ['.nav-bar .nav-item:nth-child(3) > span:last-child', 'nav.tasks'],
        ['.nav-bar .nav-item:nth-child(4) > span:last-child', 'nav.games'],
        ['.nav-bar .nav-item:nth-child(5) > span:last-child', 'nav.skins'],
        ['#tournament-screen .modal-header h2', 'tournament.title'],
        ['#tournament-screen .tournament-prize', 'tournament.prizePool'],
        ['#tournament-screen .online-count-label', 'common.online'],
        ['#tournament-screen .leaderboard-header span:nth-child(2)', 'common.player'],
        ['#tournament-screen .leaderboard-header span:nth-child(3)', 'common.score'],
        ['#tournament-screen #leaderboard-list .loading', 'common.loading'],
        ['#tournament-screen .player-rank .rank-info:nth-child(1) .rank-label', 'tournament.rank'],
        ['#tournament-screen .player-rank .rank-info:nth-child(2) .rank-label', 'tournament.score'],
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
        ['#tasks-screen .modal-header-copy h2', 'tasks.title'],
        ['#tasks-screen .tasks-hero-title', 'tasks.heroTitle'],
        ['#tasks-screen .tasks-hero-subtitle', 'tasks.heroSubtitle'],
        ['#tasks-screen .tasks-hero-badge-label', 'tasks.heroLabel'],
        ['#tasks-screen .tasks-hero-badge-value', 'tasks.heroValue'],
        ['#tasks-screen .tasks-list .loading', 'common.loading'],
        ['#games-screen .modal-kicker', 'games.kicker'],
        ['#games-screen .modal-header-copy h2', 'games.title'],
        ['#games-screen .games-hero-title', 'games.heroTitle'],
        ['#games-screen .games-hero-subtitle', 'games.heroSubtitle'],
        ['#games-screen .games-hero-jackpot-label', 'games.potential'],
        ['#games-screen .game-card:nth-child(1) .game-enter', 'games.tapToPlay'],
        ['#games-screen .game-card:nth-child(2) .game-enter', 'games.pullReels'],
        ['#games-screen .game-card:nth-child(3) .game-enter', 'games.rollIt'],
        ['#games-screen .game-card:nth-child(4) .game-enter', 'games.spinNow'],
        ['#games-screen .game-card:nth-child(5) .game-enter', 'games.openBox'],
        ['#games-screen .game-card:nth-child(6) .game-enter', 'games.chaseMultiplier'],
        ['#settings-screen h2', 'gameModals.settings'],
        ['#settings-screen .settings-section:nth-of-type(2) .settings-title', 'gameModals.theme'],
        ['#settings-screen .settings-section:nth-of-type(3) .settings-title', 'gameModals.sound'],
        ['#settings-screen .settings-section:nth-of-type(4) .settings-title', 'gameModals.music'],
        ['#settings-screen .settings-section:nth-of-type(5) .settings-title', 'gameModals.vibration'],
        ['#confirm-modal-title', 'gameModals.chooseAction'],
        ['#confirm-skin-name', 'skins.name'],
        ['#confirm-skin-desc', 'skins.description'],
        ['#confirm-skin-requirements .requirement-badge', 'common.claimFree'],
        ['#confirm-skin-bonus .bonus-badge', 'common.bonusIncome'],
        ['#confirm-modal .btn-secondary .btn-text', 'common.cancel'],
        ['#confirm-action-text', 'common.select'],
        ['#confirm-modal .modal-tip', 'common.closeHint'],
        ['.skins-title', 'skins.title'],
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

    const placeholders = [
        ['coin-bet', 'gameModals.betAmount'],
        ['wheel-bet', 'gameModals.betAmount'],
        ['wheel-number', 'gameModals.numberRange'],
        ['slots-bet', 'gameModals.betAmount'],
        ['dice-bet', 'gameModals.betAmount'],
        ['luckybox-bet', 'gameModals.betAmount'],
        ['crash-bet', 'gameModals.betAmount']
    ];

    placeholders.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('placeholder', t(key));
    });

    const buttonMap = [
        ['#game-coinflip .btn-primary', 'gameModals.flip'],
        ['#game-wheel .btn-primary', 'gameModals.spin'],
        ['#game-slots .btn-primary', 'gameModals.spin'],
        ['#game-dice .btn-primary', 'gameModals.roll']
    ];

    buttonMap.forEach(([selector, key]) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = t(key);
    });

    const referralLink = document.getElementById('referral-link');
    if (referralLink && referralLink.textContent.trim().toLowerCase() === 'loading...') {
        referralLink.textContent = t('common.loading');
    }
}

// ==================== НАВИГАЦИЯ ====================
function openModal(id) {
    document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

function switchTab(tab, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    
    document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');
    
    if (tab === 'main') return;
    
    const modalId = `${tab}-screen`;
    openModal(modalId);
    maybeShowDiscoveryToast(tab);
    
    if (tab === 'friends') loadReferralData();
    if (tab === 'skins') openSkins();
    if (tab === 'tournament') loadTournamentData();
    if (tab === 'tasks') {
        advanceSoftOnboarding('tasks');
        loadVideoTasks();
    }
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

// ==================== ТУРНИР ====================
let tournamentTimer = null;
let onlineHeartbeatTimer = null;
let onlineCountTimer = null;

function setOnlineCount(count) {
    const countEl = document.getElementById('tournament-online-count');
    if (countEl) countEl.textContent = formatNumber(Math.max(0, Number(count) || 0));
}

function canSeeOnlineCounter() {
    return Number(userId || 0) === OWNER_ONLINE_COUNTER_USER_ID;
}

function updateOnlineCounterVisibility() {
    const indicator = document.getElementById('tournament-online-indicator');
    if (!indicator) return;
    indicator.style.display = canSeeOnlineCounter() ? '' : 'none';
}

async function sendOnlineHeartbeat() {
    if (!userId) return;
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/online/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(tg?.initData ? { 'X-Telegram-Init-Data': tg.initData } : {})
            },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await res.json();
        if (data.success && canSeeOnlineCounter()) setOnlineCount(data.online_now);
    } catch (err) {
        console.warn('Online heartbeat failed:', err);
    }
}

async function refreshOnlineCount() {
    if (!canSeeOnlineCounter()) return;
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/online/count`);
        const data = await res.json();
        if (data.success) setOnlineCount(data.online_now);
    } catch (err) {
        console.warn('Online count failed:', err);
    }
}

function startOnlinePresence() {
    if (!userId) return;
    updateOnlineCounterVisibility();
    if (!onlineHeartbeatTimer) {
        sendOnlineHeartbeat();
        onlineHeartbeatTimer = setInterval(sendOnlineHeartbeat, 25000);
    }
    if (!canSeeOnlineCounter()) return;
    if (!onlineCountTimer) {
        refreshOnlineCount();
        onlineCountTimer = setInterval(refreshOnlineCount, 15000);
    }
}

async function loadTournamentData() {
    try {
        const leaderboardRes = await fetch(`${CONFIG.API_URL}/api/tournament/leaderboard`);
        const leaderboardData = await leaderboardRes.json();
        
        const rankRes = await fetch(`${CONFIG.API_URL}/api/tournament/player-rank/${userId}`);
        const rankData = await rankRes.json();
        
        if (leaderboardData.success) {
            const topPlayers = Array.isArray(leaderboardData.players)
                ? leaderboardData.players.slice(0, 3)
                : [];
            updateOnlineCounterVisibility();
            if (canSeeOnlineCounter()) {
                setOnlineCount(leaderboardData.online_now);
            }
            renderLeaderboard({
                players: topPlayers,
                playerRank: rankData.rank,
                playerScore: rankData.score,
                timeLeft: leaderboardData.time_left
            });
            trackTournamentToastState(rankData.rank, topPlayers.length);
            startTournamentTimer(leaderboardData.time_left);
        }
    } catch (err) {
        console.error('Tournament error:', err);
    }
}

function renderLeaderboard(data) {
    const list = document.getElementById('leaderboard-list');
    const playerRankEl = document.getElementById('player-rank');
    const playerScoreEl = document.getElementById('player-score');
    
    if (list) {
        list.innerHTML = data.players.map(p => `
            <div class="leaderboard-item leaderboard-item-rank-${p.rank}">
                <span class="player-rank">${p.rank}</span>
                <div class="player-avatar">
                    <img src="${p.avatar || '/imgg/default_avatar.png'}" 
                         alt="avatar"
                         onerror="this.src='/imgg/default_avatar.png'"
                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                </div>
                <span class="player-name">${p.name || 'Player'}</span>
                <span class="player-score">${formatNumber(p.score)}</span>
            </div>
        `).join('');
    }
    
    if (playerRankEl) playerRankEl.textContent = `#${data.playerRank || 0}`;
    if (playerScoreEl) playerScoreEl.textContent = formatNumber(data.playerScore || 0);
}

function startTournamentTimer(seconds) {
    if (tournamentTimer) clearInterval(tournamentTimer);
    
    const timerEl = document.getElementById('tournament-timer');
    if (!timerEl) return;
    
    let remaining = seconds;
    
    tournamentTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(tournamentTimer);
            timerEl.textContent = t('tournament.finished');
            loadTournamentData();
            return;
        }
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const secs = remaining % 60;
        timerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

// ==================== ЭНЕРГИЯ - МОДАЛКА ====================
function showEnergyRecoveryModal() {
    if (document.querySelector('.energy-recovery-modal')) return;
    
    const modal = document.createElement('div');
    modal.className = 'energy-recovery-modal';
    modal.innerHTML = `
        <div class="modal-content glass">
            <button class="modal-close" onclick="this.closest('.energy-recovery-modal').remove()">✕</button>
            <h3>⚡ Energy is empty!</h3>
            <p>Watch an ad and restore energy to maximum</p>
            <button class="btn-primary" onclick="recoverEnergyWithAd()">
                📺 Restore to max
            </button>
            <button class="btn-secondary" onclick="this.closest('.energy-recovery-modal').remove()">
                ⏳ Wait
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function recoverEnergyWithAd() {
    const modal = document.querySelector('.energy-recovery-modal');
    if (modal) modal.remove();

    if (typeof window.show_10655027 !== 'function') {
        showToast(tr('toasts.adUnavailable'), true);
        return;
    }

    try {
        const adSessionId = await startAdActionSession('energy_refill_max');
        showToast(tr('toasts.adLoading'));
        await showRewardedAd(adSessionId);
        const data = await claimAdActionWithRetry(() => API.post('/api/update-energy', {
            user_id: userId,
            ad_session_id: adSessionId
        }));

        applyServerEnergySnapshot(data);
        updateUI();
        showToast(tr('toasts.energyRecovered'));
    } catch (err) {
        console.error('Energy recover error:', err);
        showToast(
            isAdConfirmationPendingError(err)
                ? 'You did not finish the ad or the reward was not confirmed.'
                : tr('toasts.serverError'),
            true
        );
    }
}

// ==================== MEGA BOOST ====================
let boostEndTime = null;
let boostInterval = null;
let megaBoostCooldownUntil = null;

async function activateMegaBoost() {
    if (!userId) {
        showToast(tr('toasts.authRequired'), true);
        return;
    }
    
    const boostBtn = document.getElementById('mega-boost-btn');
    if (boostBtn?.classList.contains('active')) {
        showToast(tr('toasts.boostActive'), true);
        return;
    }

    if (megaBoostCooldownUntil && megaBoostCooldownUntil > new Date()) {
        showToast(`Mega boost cooldown ${formatCooldownClock((megaBoostCooldownUntil - new Date()) / 1000)}`, true);
        return;
    }

    try {
        const status = await API.get(`/api/mega-boost-status/${userId}`);
        megaBoostCooldownUntil = parseServerDate(status?.cooldown_until) || null;
        if (status?.cooldown_active && megaBoostCooldownUntil && megaBoostCooldownUntil > new Date()) {
            showToast(`Mega boost cooldown ${formatCooldownClock((megaBoostCooldownUntil - new Date()) / 1000)}`, true);
            return;
        }
        if (status?.active) {
            showToast(tr('toasts.boostActive'), true);
            return;
        }
    } catch (err) {}
    
    if (typeof window.show_10655027 !== 'function') {
        showToast(tr('toasts.adUnavailable'), true);
        return;
    }
    
    showToast(tr('toasts.adLoading'));

    (async () => {
        const adSessionId = await startAdActionSession('mega_boost');
        await showRewardedAd(adSessionId);
        const activation = await claimAdActionWithRetry(() => API.post('/api/activate-mega-boost', {
            user_id: userId,
            ad_session_id: adSessionId
        }));

        if (activation?.already_active && activation.expires_at) {
            boostEndTime = parseServerDate(activation.expires_at);
        } else {
            boostEndTime = parseServerDate(activation?.expires_at) || new Date(Date.now() + MEGA_BOOST_DURATION_MS);
        }
        megaBoostCooldownUntil = parseServerDate(activation?.cooldown_until) || megaBoostCooldownUntil;
        
        if (boostBtn) boostBtn.classList.add('active');
        
        const timerEl = document.getElementById('mega-boost-timer');
        if (timerEl) {
            timerEl.style.display = 'block';
            const initialDiff = Math.max(0, boostEndTime - new Date());
            const initialMins = Math.floor(initialDiff / 60000);
            const initialSecs = Math.floor((initialDiff % 60000) / 1000);
            timerEl.textContent = `${initialMins}:${initialSecs.toString().padStart(2, '0')}`;
        }
        
        showBoostIndicator();
        
        const energyBar = document.querySelector('.energy-bar-bg');
        if (energyBar) energyBar.classList.add('boost-active');
        
        if (boostInterval) clearInterval(boostInterval);
        boostInterval = setInterval(() => {
            const now = new Date();
            const diff = boostEndTime - now;
            
            if (diff <= 0) {
                clearInterval(boostInterval);
                if (boostBtn) boostBtn.classList.remove('active');
                if (timerEl) timerEl.style.display = 'none';
                document.querySelector('.mega-boost-indicator')?.remove();
                if (energyBar) energyBar.classList.remove('boost-active');
                showToast(tr('toasts.boostFinished'));
                return;
            }
            
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
        
        showToast(tr('toasts.megaBoostActivated'));
    })().catch((err) => {
        showToast(
            isAdConfirmationPendingError(err)
                ? 'You did not finish the ad or the reward was not confirmed.'
                : (err?.detail || err?.message || tr('toasts.watchError')),
            true
        );
    });
}

function showBoostIndicator() {
    const oldIndicator = document.querySelector('.mega-boost-indicator');
    if (oldIndicator) oldIndicator.remove();
    
    const energyContainer = document.querySelector('.energy-bar-container');
    if (energyContainer) {
        const indicator = document.createElement('div');
        indicator.className = 'mega-boost-indicator';
        indicator.innerHTML = '🔥 MEGA BOOST ACTIVE 🔥';
        energyContainer.appendChild(indicator);
    }
}

async function checkBoostStatus() {
    if (!userId) return;
    
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/mega-boost-status/${userId}`);
        if (res.ok) {
            const data = await res.json();
            megaBoostCooldownUntil = parseServerDate(data.cooldown_until) || null;
            if (data.active) {
                boostEndTime = parseServerDate(data.expires_at);
                const boostBtn = document.getElementById('mega-boost-btn');
                if (boostBtn) boostBtn.classList.add('active');
                
                const timerEl = document.getElementById('mega-boost-timer');
                if (timerEl) timerEl.style.display = 'block';
                
                showBoostIndicator();
                
                const energyBar = document.querySelector('.energy-bar-bg');
                if (energyBar) energyBar.classList.add('boost-active');
                
                if (boostInterval) clearInterval(boostInterval);
                boostInterval = setInterval(() => {
                    const now = new Date();
                    const diff = boostEndTime - now;
                    
                    if (diff <= 0) {
                        clearInterval(boostInterval);
                        if (boostBtn) boostBtn.classList.remove('active');
                        if (timerEl) timerEl.style.display = 'none';
                        document.querySelector('.mega-boost-indicator')?.remove();
                        if (energyBar) energyBar.classList.remove('boost-active');
                        return;
                    }
                    
                    const mins = Math.floor(diff / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                }, 200);
            } else {
                const boostBtn = document.getElementById('mega-boost-btn');
                const timerEl = document.getElementById('mega-boost-timer');
                if (boostBtn) boostBtn.classList.remove('active');
                if (timerEl) timerEl.style.display = 'none';
                document.querySelector('.mega-boost-indicator')?.remove();
                document.querySelector('.energy-bar-bg')?.classList.remove('boost-active');
            }
        }
        await syncGhostBoostStatus();
    } catch (err) {
        console.error('Boost status error:', err);
    }
}

// ==================== МИНИ-ИГРЫ ====================
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
    const res = await fetch(`${CONFIG.API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new Error(data.detail || data.message || 'Server error');
    }
    return data;
}

function openGame(game) {
    document.querySelectorAll('.game-modal').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(`game-${game}`);
    if (game === 'wheel') initRouletteVisuals();
    if (game === 'luckybox') resetLuckyBoxBoard();
    if (game === 'crash' && !crashGhostState.active) resetCrashGhostUI();
    if (modal) modal.classList.add('active');
}

function closeGame(game) {
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
                State.game.coins = data.coins;
                trackAchievementProgress('games', 1);
                checkAchievements();
                updateUI();
                
            } else {
                const win = Math.random() < 0.5;
                coin.classList.remove('flipping');
                if (win) {
                    State.game.coins += bet;
                    coin.classList.add('win');
                    setTimeout(() => coin.classList.remove('win'), 1000);
                    resultEl.textContent = tr('minigames.coinflipWin', { bet });
                    createConfetti();
                    spawnGameParticles(document.querySelector('#game-coinflip .coin-3d'), 'win');
                    playSound('win');
                } else {
                    State.game.coins -= bet;
                    resultEl.textContent = tr('minigames.coinflipLose');
                    shakeGameModal('coinflip');
                    spawnGameParticles(document.querySelector('#game-coinflip .coin-3d'), 'lose');
                    playSound('lose');
                }
                updateUI();
            }
        } catch (err) {
            coin.classList.remove('flipping');
            resultEl.textContent = `❌ ${err.message || tr('toasts.serverError')}`;
            playSound('lose');
            showToast(`❌ ${err.message || tr('toasts.serverError')}`, true);
        } finally {
            miniGameLocks.coinflip = false;
        }
    }, 1500);
}

async function playSlots() {
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
                    
                    State.game.coins = data.coins;
                    updateUI();
                })
                .catch(err => {
                    [slot1, slot2, slot3].forEach(el => el?.classList.remove('spinning'));
                    resultEl.textContent = `❌ ${err.message || tr('toasts.serverError')}`;
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
                    State.game.coins += win;
                    trackAchievementProgress('games', 1);
                    resultEl.textContent = tr('minigames.slotsJackpot', { win });
                    playSound('win');
                    createConfetti();
                    spawnGameParticles(document.querySelector('#game-slots .slots-container'), 'win');
                    checkAchievements();
                } else {
                    State.game.coins -= bet;
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
                    State.game.coins = data.coins;
                    updateUI();
                })
                .catch(err => {
                    dice1?.classList.remove('roll');
                    dice2?.classList.remove('roll');
                    resultEl.textContent = `❌ ${err.message || tr('toasts.serverError')}`;
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
                    State.game.coins += bet * multiplier;
                    resultEl.textContent = tr('minigames.diceWin', { multiplier });
                    playSound('win');
                    spawnGameParticles(document.querySelector('#game-dice .dice-container'), 'win');
                    trackAchievementProgress('games', 1);
                    checkAchievements();
                } else {
                    State.game.coins -= bet;
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
                    ? `🎡 Landed on ${landedNumber}. ${data.message || 'You won'}`
                    : `🎡 Landed on ${landedNumber}. ${data.message || 'You lost'}`;
                
                if (isWinMessage) {
                    createConfetti();
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'win');
                    playSound('win');
                } else {
                    shakeGameModal('wheel');
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'lose');
                    playSound('lose');
                }
                
                State.game.coins = data.coins;
                trackAchievementProgress('games', 1);
                checkAchievements();
                updateUI();
            })
            .catch(err => {
                plate?.classList.remove('spinning');
                console.error('Roulette error:', err);
                resultEl.textContent = `❌ ${err.message || tr('toasts.serverError')}`;
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
                    State.game.coins += bet * multiplier;
                    resultEl.textContent = tr('minigames.rouletteWin', { number: landedNumber, multiplier });
                    playSound('win');
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'win');
                    trackAchievementProgress('games', 1);
                    checkAchievements();
                } else {
                    State.game.coins -= bet;
                    resultEl.textContent = tr('minigames.rouletteLose', { number: landedNumber });
                    shakeGameModal('wheel');
                    spawnGameParticles(document.querySelector('#game-wheel .roulette-container'), 'lose');
                    playSound('lose');
                }
                updateUI();
            }).catch(err => {
                plate?.classList.remove('spinning');
                resultEl.textContent = `❌ ${err.message || tr('toasts.serverError')}`;
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
                    State.game.coins = data.coins;
                }
                resultEl.textContent = data.message || resultEl.textContent;
            } else {
                State.game.coins = State.game.coins - bet + payout;
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
            resultEl.textContent = `❌ ${err.message || tr('toasts.serverError')}`;
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
    crashGhostState.interval = setInterval(syncCrashGhostRound, 120);
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
        State.game.coins = result.coins;
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
            State.game.coins = response.coins;
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
        if (!window.audioCtx) window.audioCtx = new AudioContext();
        const now = window.audioCtx.currentTime;
        const osc = window.audioCtx.createOscillator();
        const gain = window.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(window.audioCtx.destination);
        
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
    renderAchievements();
    openModal('achievements-screen');
}

function renderAchievements() {
    const list = document.getElementById('achievements-list');
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
        if (id.startsWith('referral_')) return parseInt(id.split('_')[1]);
        if (id.startsWith('ads_')) return parseInt(id.split('_')[1]);
        return 0;
    };
    
    list.innerHTML = ACHIEVEMENTS.map(achievement => {
        const completed = State.achievements.completed.includes(achievement.id);

        const current = achievement.id.startsWith('click') ? stats.clicks :
                        achievement.id.startsWith('upgrade') ? stats.upgrades :
                        achievement.id.startsWith('games') ? stats.games :
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
                    ` : `<div class="achievement-reward">✅ +${achievement.reward}</div>`}
                </div>
                ${completed ? '<div class="achievement-check">✓</div>' : ''}
            </div>
        `;
    }).join('');
    
    updateAchievementsProgress();
}

function updateAchievementsProgress() {
    const completed = State.achievements.completed.length;
    const total = ACHIEVEMENTS.length;
    const percent = (completed / total) * 100;
    
    document.getElementById('achievements-completed').textContent = completed;
    document.getElementById('achievements-total').textContent = total;
    document.getElementById('achievements-progress-fill').style.width = percent + '%';
}

// ==================== ОБРАБОТЧИК КЛИКОВ ====================
function setupGlobalClickHandler() {
    document.removeEventListener('click', handleTap);
    document.removeEventListener('touchstart', handleTap);
    
    document.addEventListener('click', function(e) {
        if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
            '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
            '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
            '.modal-screen, .modal-content, .game-modal, .game-modal-content, .auto-boost-button')) return;
        handleTap(e);
    });
    
    document.addEventListener('touchstart', function(e) {
        if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
            '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
            '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
            '.modal-screen, .modal-content, .game-modal, .game-modal-content, .auto-boost-button')) return;
        handleTap(e);
    }, { passive: false });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Spirit Clicker starting...');

    applyPerformanceMode();
    applyStaticTranslations();
    ensureToastLayer();
    updateToastViewportOffset();
    loadAchievementsFromStorage();
    loadSettings();
    initBgm();
    initAutoClicker();
    initBadgePhysics();

    if (userId) {
        await loadUserData();
        await checkOfflinePassiveIncome();
        startOnlinePresence();
        setInterval(sendClickBatch, 1500);
    } else {
        const saved = localStorage.getItem('ryohoGame');
        if (saved) Object.assign(State.game, JSON.parse(saved));
        updateUI();
    }

    setupGlobalClickHandler();
    setInterval(() => localStorage.setItem('ryohoGame', JSON.stringify(State.game)), 10000);
    setInterval(() => checkOfflinePassiveIncome({ silent: true }), CONFIG.PASSIVE_INCOME_INTERVAL);
    startAmbientToastLoop();
    State.temp.lastTapAt = Date.now();
    startIdleToastLoop();
    applySavedSkin();
    initSoftOnboarding();
    window.addEventListener('resize', () => {
        applyPerformanceMode();
        updateToastViewportOffset();
        if (State.temp.onboarding.active && ['tap', 'upgrade'].includes(State.temp.onboarding.step)) {
            renderOnboardingHandHint();
        }
    });

    console.log('✅ Spirit Clicker ready');
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
                    timerLabel.textContent = cooldownLeft > 0 ? `CD ${formatCooldownClock(cooldownLeft / 1000)}` : 'OFF';
                }
                updateEffect();
            } else {
                const remaining = Math.max(0, autoState.enabledUntil - Date.now());
                const sec = Math.ceil(remaining / 1000);
                if (timerLabel) timerLabel.textContent = sec + 's';
                if (autoState.fingerDown) {
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
        loop();
    };

    window.toggleAutoClick = async function toggleAutoClick() {
        if (!autoBtn) return;
        if (autoState.enabledUntil > Date.now()) return; // уже активен
        const cooldownRemainingMs = getCooldownRemainingMs();
        if (cooldownRemainingMs > 0) {
            showToast(`Auto click cooldown ${formatCooldownClock(cooldownRemainingMs / 1000)}`, true);
            return;
        }

        const enable = () => { showToast(tr('toasts.autoTapEnabled')); enableAuto(AUTO_CLICK_DURATION_MS); };

        if (typeof window.show_10655027 !== 'function') {
            showToast(tr('toasts.autoTapFallback'));
            enableAuto(AUTO_CLICK_DURATION_MS);
            return;
        }
        showToast(tr('toasts.adLoading'));
        try {
            const adSessionId = await startAdActionSession('autoclicker');
            await showRewardedAd(adSessionId);
            await claimAdActionWithRetry(() => API.post('/api/autoclicker/activate', {
                user_id: userId,
                ad_session_id: adSessionId
            }));
            enable();
        } catch (e) {
            showToast(
                isAdConfirmationPendingError(e)
                    ? 'You did not finish the ad or the reward was not confirmed.'
                    : tr('toasts.autoTapError'),
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
const checkOfflinePassiveIncome = async ({ silent = false } = {}) => {
    if (!userId) return;
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/passive-income`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.income > 0) {
                State.game.coins = data.coins;
                updateUI();
                if (!silent) {
                    showToast(data.message || `+${formatNumber(data.income)} passive income`);
                }
            }
        }
    } catch (e) {
        console.error('Passive income error:', e);
    }
};


async function testReferral() {
    if (!userId) {
        console.log('❌ Нет userId');
        return;
    }
    
    const testReferrerId = 123456789; // Чужой тестовый ID
    console.log('🧪 Тест: отправляем регистрацию с referrer_id=', testReferrerId);
    
    try {
        const res = await API.post('/api/register', {
            user_id: userId,
            username: username + '_test',
            referrer_id: testReferrerId
        });
        console.log('✅ Результат теста:', res);
        
        // Проверяем, обновились ли данные реферера
        const referrerData = await API.get(`/api/user/${testReferrerId}`);
        console.log('📊 Данные тестового реферера:', referrerData);
        
    } catch (err) {
        console.error('❌ Ошибка теста:', err);
    }
}

// 👇 ВАЖНО: Делаем функцию глобальной
window.testReferral = testReferral;

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
window.toggleTheme = toggleTheme;
window.toggleSound = toggleSound;
window.toggleMusic = toggleMusic;
window.toggleVibration = toggleVibration;
window.activateMegaBoost = activateMegaBoost;
window.selectSkin = selectSkin;
window.filterSkins = filterSkins;
window.openSkins = openSkins;
window.showToast = showToast;
window.playCoinflip = playCoinflip;
window.playSlots = playSlots;
window.playDice = playDice;
window.playWheel = playWheel;
window.playLuckyBox = playLuckyBox;
window.startCrashGhost = startCrashGhost;
window.cashOutCrashGhost = cashOutCrashGhost;
window.State = State;
window.state = State;
window.startPerfectEnergySystem = startPerfectEnergySystem;
window.forceSync = forceSync;
window.sendClickBatch = sendClickBatch;
window.syncEnergyWithServer = syncEnergyWithServer;
window.fullSyncWithServer = fullSyncWithServer;
window.recoverEnergyWithAd = recoverEnergyWithAd;
window.openAchievements = openAchievements;
window.openDailyRewards = openDailyRewards;
window.claimDailyReward = claimDailyReward;
window.watchVideoForTask = watchVideoForTask;
window.startSocialTask = startSocialTask;
window.claimSocialTask = claimSocialTask;
window.toggleCompletedSocialTasks = toggleCompletedSocialTasks;
window.recoverEnergyWithAd = recoverEnergyWithAd;
window.checkBoostStatus = checkBoostStatus;
window.closeSkinDetail = closeSkinDetail;
window.openSkinDetail = openSkinDetail;
window.unlockSkinFromDetail = unlockSkinFromDetail;
window.selectSkinFromDetail = selectSkinFromDetail;

console.log('✅ Все функции определены');




