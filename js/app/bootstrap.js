(function initSpiritBootstrapModule(global) {
    function run(deps) {
        document.addEventListener('DOMContentLoaded', async () => {
            if (deps.DEBUG) console.log('Spirit Clicker starting');
            const doneStartup = deps.debugPerfStart('perf', 'startup/domcontentloaded');
            deps.DEBUG_BOOT.appStarted = true;

            deps.applyPerformanceMode();
            deps.applyStaticTranslations();
            deps.ensureToastLayer();
            deps.updateToastViewportOffset();
            deps.loadAchievementsFromStorage();
            deps.loadSettings();
            deps.setupGlobalClickHandler();
            deps.initTonWalletBridge();
            deps.initBgm();
            deps.initAdsgramController();
            if (typeof deps.initMainTapButtonUx === 'function') deps.initMainTapButtonUx();
            deps.initAutoClicker();
            deps.initBadgePhysics();

            if (deps.userId) {
                await deps.loadUserData();
                Promise.allSettled([
                    deps.loadTournamentPrizePoolData({ silent: true }),
                    deps.loadTonWalletStatus(),
                    deps.checkOfflinePassiveIncome()
                ]).catch((err) => {
                    if (deps.DEBUG) console.warn('Deferred post-hydration startup failed:', err);
                });
                deps.startOnlinePresence();
                setInterval(deps.sendClickBatch, deps.CONFIG.CLICK_BATCH_INTERVAL || 5000);
            } else {
                const saved = localStorage.getItem('ryohoGame');
                if (saved) Object.assign(deps.State.game, JSON.parse(saved));
                deps.updateUI();
            }

            setInterval(() => localStorage.setItem('ryohoGame', JSON.stringify(deps.State.game)), 10000);
            setInterval(() => deps.checkOfflinePassiveIncome({ silent: true }), deps.CONFIG.PASSIVE_INCOME_INTERVAL);
            deps.startAmbientToastLoop();
            deps.State.temp.lastTapAt = Date.now();
            deps.startIdleToastLoop();
            deps.applySavedSkin();
            deps.initSoftOnboarding();
            global.addEventListener('resize', () => {
                deps.applyPerformanceMode();
                deps.updateToastViewportOffset();
                if (deps.State.temp.onboarding.active && ['tap', 'upgrade'].includes(deps.State.temp.onboarding.step)) {
                    deps.renderOnboardingHandHint();
                }
            });

            if (deps.DEBUG) console.log('Spirit Clicker ready');
            doneStartup(true, { userId: !!deps.userId, readyMs: Math.round(performance.now() - deps.APP_BOOT_TS) });
        });
    }

    global.SpiritBootstrap = {
        run
    };
})(window);
