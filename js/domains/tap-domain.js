(function initSpiritTapDomain(global) {
    function createTapDomain(deps) {
        function processTap({ isAutoTap, tapTime, coords }) {
            deps.stateActions.markTapTimestamp(tapTime);
            deps.registerTapRhythm(tapTime, isAutoTap);
            if (!isAutoTap) {
                deps.advanceSoftOnboarding('tap');
            }

            const tapSnapshot = deps.clickDomain.computeTapPreviewGain({
                isMegaBoostActive: deps.isMegaBoostActive,
                isDailyInfiniteEnergyActive: deps.isDailyInfiniteEnergyActive,
                isGhostBoostActive: deps.isGhostBoostActive,
                isTaskTapBoostActive: deps.isTaskTapBoostActive,
                ghostBoostMultiplier: deps.ghostBoostMultiplier
            });

            const applyTap = deps.clickDomain.applyTapLocalMutation({
                previewGain: tapSnapshot.previewGain,
                freeEnergyActive: tapSnapshot.freeEnergyActive,
                getVisualEnergy: deps.getVisualEnergy,
                updateEnergyUIImmediate: deps.updateEnergyUIImmediate
            });

            if (!applyTap.ok) {
                if (applyTap.reason === 'no_energy') {
                    deps.showEnergyRecoveryModal();
                }
                return {
                    ok: false,
                    reason: applyTap.reason || 'tap_blocked'
                };
            }

            deps.maybeSpawnLuckyGhost(isAutoTap);
            deps.trackAchievementProgress('clicks', 1);
            deps.checkAchievements();
            deps.updateUI();

            return {
                ok: true,
                payload: {
                    clientX: coords.clientX,
                    clientY: coords.clientY,
                    isAutoTap,
                    previewGain: tapSnapshot.previewGain,
                    ghostBoostActive: tapSnapshot.ghostBoostActive,
                    dailyInfiniteEnergyActive: tapSnapshot.dailyInfiniteEnergyActive,
                    megaBoostActive: tapSnapshot.megaBoostActive,
                    freeEnergyActive: tapSnapshot.freeEnergyActive
                }
            };
        }

        return {
            processTap
        };
    }

    global.SpiritTapDomain = {
        createTapDomain
    };
})(window);