(function initSpiritStoreModule(global) {
    function safeParse(json, fallback) {
        try {
            const parsed = JSON.parse(json);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function createInitialState(ctx) {
        return {
            user: { id: ctx.userId, username: ctx.username, referrerId: ctx.referrerId },
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
                coinsConfirmed: 0,
                coinsOptimisticDelta: 0,
                energy: 500,
                maxEnergy: 500,
                profitPerTap: 1,
                profitPerHour: 100,
                level: 0,
                rebirthCount: 0,
                prices: { global: 120, multitap: 120, profit: 120, energy: 120 },
                levels: { multitap: 0, profit: 0, energy: 0 }
            },
            skins: {
                owned: ['default.pngSP'],
                selected: 'default.pngSP',
                adsWatched: 0,
                friendsInvited: 0,
                data: [],
                videoViews: safeParse(global.localStorage.getItem('videoSkinViews') || '{}', {}),
                selectInFlight: false
            },
            tasks: {
                social: {}
            },
            daily: {
                claimedDays: 0,
                claimAvailable: false,
                loaded: false,
                nextDay: 1,
                infiniteEnergyActive: false,
                infiniteEnergyExpiresAt: null
            },
            settings: {
                theme: ctx.savedSettings.theme || 'day',
                language: ctx.uiLang,
                sound: ctx.savedSettings.sound !== undefined ? ctx.savedSettings.sound : true,
                music: ctx.savedSettings.music !== undefined ? ctx.savedSettings.music : true,
                vibration: ctx.savedSettings.vibration !== undefined ? ctx.savedSettings.vibration : true
            },
            temp: {
                tapAnimation: null,
                clickBuffer: 0,
                clickValueBuffer: 0,
                clickBatchInFlight: false,
                pendingClickBatchId: null,
                lastAutoFeedbackAt: 0,
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
                    point: { x: global.innerWidth / 2, y: global.innerHeight / 2 },
                    effect: null
                },
                taskTapBoostExpiresAt: null,
                taskTapBoostMultiplier: 1,
                taskPassiveBoostExpiresAt: null,
                taskPassiveBoostMultiplier: 1,
                energyUiTimer: null,
                serverEnergyBase: 0,
                serverMaxEnergy: 0,
                serverEnergySyncedAtMs: 0,
                energyRegenMs: 200, // 5 energy/sec => 1 tick per 200ms
                pendingEnergySpend: 0,
                lastTapAt: 0,
                lastStateUpdatedAtMs: 0,
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
                adInputBlocked: false,
                adBlockerEl: null,
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
    }

    function createStore(state) {
        function set(path, value) {
            const parts = String(path || '').split('.').filter(Boolean);
            if (!parts.length) return;
            let cursor = state;
            for (let i = 0; i < parts.length - 1; i += 1) {
                const key = parts[i];
                if (!cursor[key] || typeof cursor[key] !== 'object') {
                    cursor[key] = {};
                }
                cursor = cursor[key];
            }
            cursor[parts[parts.length - 1]] = value;
        }

        function merge(path, patch) {
            const parts = String(path || '').split('.').filter(Boolean);
            if (!parts.length) return;
            let cursor = state;
            for (let i = 0; i < parts.length; i += 1) {
                const key = parts[i];
                if (i === parts.length - 1) {
                    const prev = cursor[key] && typeof cursor[key] === 'object' ? cursor[key] : {};
                    cursor[key] = { ...prev, ...(patch || {}) };
                    return;
                }
                if (!cursor[key] || typeof cursor[key] !== 'object') {
                    cursor[key] = {};
                }
                cursor = cursor[key];
            }
        }

        return {
            state,
            set,
            merge
        };
    }

    global.SpiritStore = {
        createInitialState,
        createStore
    };
})(window);
