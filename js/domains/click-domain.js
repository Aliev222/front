(function initSpiritClickDomain(global) {
    function createClickDomain({ store, state, userId, API, setCoins, applyBoostStateFromPayload, applyServerEnergySnapshot, updateUI, fullSyncWithServer }) {
        function setCoinsValue(next) {
            store.set('game.coins', next);
        }

        function addCoins(delta) {
            store.set('game.coins', state.game.coins + delta);
        }

        function computeTapPreviewGain({ isMegaBoostActive, isDailyInfiniteEnergyActive, isGhostBoostActive, isTaskTapBoostActive, ghostBoostMultiplier }) {
            const megaBoostActive = isMegaBoostActive();
            const dailyInfiniteEnergyActive = isDailyInfiniteEnergyActive();
            const ghostBoostActive = isGhostBoostActive();
            const freeEnergyActive = megaBoostActive || dailyInfiniteEnergyActive || ghostBoostActive;

            let previewGain = state.game.profitPerTap;
            const skin = state.skins.data.find((s) => s.id === state.skins.selected);
            if (skin?.bonus?.type === 'multiplier') {
                previewGain *= skin.bonus.value;
            }
            if (isTaskTapBoostActive()) {
                previewGain *= Math.max(1, state.temp.taskTapBoostMultiplier || 1);
            }
            if (megaBoostActive) {
                previewGain *= 2;
            }
            if (ghostBoostActive) {
                previewGain *= ghostBoostMultiplier;
            }

            previewGain = Math.floor(previewGain) || 1;

            return {
                previewGain,
                freeEnergyActive,
                megaBoostActive,
                dailyInfiniteEnergyActive,
                ghostBoostActive
            };
        }

        function applyTapLocalMutation({ previewGain, freeEnergyActive, getVisualEnergy, updateEnergyUIImmediate }) {
            if (!freeEnergyActive) {
                const currentVisualEnergy = getVisualEnergy();
                if (currentVisualEnergy < 1) {
                    return { ok: false, reason: 'no_energy' };
                }
                store.set('temp.pendingEnergySpend', state.temp.pendingEnergySpend + 1);
                updateEnergyUIImmediate();
            }

            store.set('temp.clickBuffer', state.temp.clickBuffer + 1);
            store.set('temp.clickValueBuffer', state.temp.clickValueBuffer + previewGain);
            addCoins(previewGain);
            return { ok: true };
        }

        async function sendClickBatch() {
            const clicks = state.temp.clickBuffer;
            if (clicks === 0 || !userId() || state.temp.clickBatchInFlight) return;

            const optimisticGain = state.temp.clickValueBuffer;
            const batchId = state.temp.pendingClickBatchId || `${userId()}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
            const pendingSpendForThisBatch = state.temp.pendingEnergySpend;

            store.set('temp.clickBuffer', 0);
            store.set('temp.clickValueBuffer', 0);
            store.set('temp.clickBatchInFlight', true);
            store.set('temp.pendingClickBatchId', batchId);

            try {
                const data = await API.post('/api/clicks', {
                    user_id: userId(),
                    clicks,
                    batch_id: batchId
                }, { idempotent: true });

                if (data.success) {
                    store.set('temp.pendingClickBatchId', null);

                    const incomingTs = data.state_updated_at || data.state_version || 0;
                    const currentTs = state.temp.lastStateUpdatedAtMs || 0;
                    if (incomingTs > 0 && incomingTs <= currentTs) {
                        return;
                    }
                    if (incomingTs > 0) {
                        store.set('temp.lastStateUpdatedAtMs', incomingTs);
                    }

                    setCoins((data.coins || 0) + (state.temp.clickValueBuffer || 0));
                    if (typeof data.profit_per_tap === 'number') {
                        const nextTap = Math.max(1, Number(data.profit_per_tap || 0));
                        const expectedMinTap = Math.max(1, Number(state.game.levels.multitap || 0) + 1);
                        if (nextTap >= expectedMinTap) {
                            store.set('game.profitPerTap', nextTap);
                        }
                    }
                    store.set('game.profitPerHour', data.profit_per_hour ?? state.game.profitPerHour);
                    applyBoostStateFromPayload(data);

                    store.set('temp.pendingEnergySpend', Math.max(0, state.temp.pendingEnergySpend - pendingSpendForThisBatch));
                    applyServerEnergySnapshot(data);
                    updateUI();
                }
            } catch (err) {
                if (err?.status === 409) {
                    store.set('temp.pendingClickBatchId', null);
                    store.set('temp.pendingEnergySpend', Math.max(0, state.temp.pendingEnergySpend - pendingSpendForThisBatch));
                    await fullSyncWithServer();
                    return;
                }
                if (err?.status === 500 || err?.status === 502 || err?.status === 503 || err?.status === 504) {
                    console.error('Click batch server error:', err);
                    store.set('temp.clickBuffer', state.temp.clickBuffer + clicks);
                    store.set('temp.clickValueBuffer', state.temp.clickValueBuffer + optimisticGain);
                    return;
                }
                console.error('Click batch error:', err);
                store.set('temp.clickBuffer', state.temp.clickBuffer + clicks);
                store.set('temp.clickValueBuffer', state.temp.clickValueBuffer + optimisticGain);
            } finally {
                store.set('temp.clickBatchInFlight', false);
            }
        }

        return {
            setCoins: setCoinsValue,
            addCoins,
            computeTapPreviewGain,
            applyTapLocalMutation,
            sendClickBatch
        };
    }

    global.SpiritClickDomain = {
        createClickDomain
    };
})(window);
