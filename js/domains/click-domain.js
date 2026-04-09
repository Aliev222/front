(function initSpiritClickDomain(global) {
    function createClickDomain({ store, state, userId, API, setCoins, applyBoostStateFromPayload, applyServerEnergySnapshot, updateUI, fullSyncWithServer, config = {} }) {
        const clickBatchThreshold = Math.max(1, Number(config.CLICK_BATCH_FLUSH_THRESHOLD || 500));
        const clickBatchMaxWaitMs = Math.max(1000, Number(config.CLICK_BATCH_MAX_WAIT_MS || 60000));
        const clickBatchIdleFlushMs = Math.max(120, Number(config.CLICK_BATCH_IDLE_FLUSH_MS || 300));
        let lastBatchSentAtMs = 0;
        let idleFlushTimer = null;

        function setCoinsValue(next) {
            store.set('game.coinsConfirmed', next);
            store.set('game.coinsOptimisticDelta', 0);
            store.set('game.coins', next);
        }

        function addCoins(delta) {
            const nextDelta = state.game.coinsOptimisticDelta + delta;
            const nextDisplay = state.game.coinsConfirmed + nextDelta;
            store.set('game.coinsOptimisticDelta', nextDelta);
            store.set('game.coins', nextDisplay);
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

            const nextClickBuffer = state.temp.clickBuffer + 1;
            store.set('temp.clickBuffer', nextClickBuffer);
            if (nextClickBuffer === 1) {
                store.set('temp.clickBufferStartedAtMs', Date.now());
            }
            store.set('temp.clickValueBuffer', state.temp.clickValueBuffer + previewGain);
            addCoins(previewGain);
            scheduleIdleFlush();
            return { ok: true };
        }

        function scheduleIdleFlush() {
            if (idleFlushTimer) {
                clearTimeout(idleFlushTimer);
            }
            idleFlushTimer = setTimeout(() => {
                idleFlushTimer = null;
                if (state.temp.clickBuffer > 0 && !state.temp.clickBatchInFlight) {
                    sendClickBatch({ force: true }).catch(() => {});
                }
            }, clickBatchIdleFlushMs);
        }

        async function sendClickBatch({ force = false } = {}) {
            const clicks = state.temp.clickBuffer;
            if (clicks === 0 || !userId() || state.temp.clickBatchInFlight) return;
            if (idleFlushTimer) {
                clearTimeout(idleFlushTimer);
                idleFlushTimer = null;
            }

            const nowMs = Date.now();
            const bufferStartedAtMs = Number(state.temp.clickBufferStartedAtMs || nowMs);
            const bufferAgeMs = Math.max(0, nowMs - bufferStartedAtMs);
            const shouldFlush = force || clicks >= clickBatchThreshold || bufferAgeMs >= clickBatchMaxWaitMs;
            if (!shouldFlush) return;
            
            // Validate userId before sending
            const currentUserId = userId();
            if (!currentUserId || currentUserId <= 0) {
                console.error('[CLICK] Invalid userId, skipping batch');
                return;
            }

            const optimisticGain = state.temp.clickValueBuffer;
            const batchId = `${currentUserId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
            const pendingSpendForThisBatch = state.temp.pendingEnergySpend;
            
            // Snapshot the optimistic delta at batch send time
            const optimisticDeltaAtSend = state.game.coinsOptimisticDelta;

            store.set('temp.clickBuffer', 0);
            store.set('temp.clickValueBuffer', 0);
            store.set('temp.clickBufferStartedAtMs', 0);
            store.set('temp.clickBatchInFlight', true);
            store.set('temp.pendingClickBatchId', batchId);
            lastBatchSentAtMs = nowMs;

            try {
                const data = await API.post('/api/clicks', {
                    user_id: currentUserId,
                    clicks,
                    batch_id: batchId
                }, { idempotent: true });

                if (data.success) {
                    store.set('temp.pendingClickBatchId', null);

                const incomingTs = data.state_updated_at || data.state_version || 0;
                const currentTs = state.temp.lastStateUpdatedAtMs || 0;
                
                // Debug logging for coin balance issues
                console.log('[CLICK] Response received:', {
                    batchId,
                    clicks,
                    optimisticGain,
                    optimisticDeltaAtSend,
                    incomingCoins: data.coins,
                    currentConfirmed: state.game.coinsConfirmed,
                    currentDelta: state.game.coinsOptimisticDelta,
                    incomingTs,
                    currentTs,
                    isStale: incomingTs > 0 && incomingTs <= currentTs
                });
                
                if (incomingTs > 0 && incomingTs <= currentTs) {
                    // Stale response - only subtract optimistic delta, don't update confirmed
                    const nextDelta = Math.max(0, state.game.coinsOptimisticDelta - optimisticGain);
                    const nextDisplay = state.game.coinsConfirmed + nextDelta;
                    console.log('[CLICK] Stale response ignored, delta adjusted:', { nextDelta, nextDisplay });
                    store.set('game.coinsOptimisticDelta', nextDelta);
                    store.set('game.coins', nextDisplay);
                    return;
                }
                if (incomingTs > 0) {
                    store.set('temp.lastStateUpdatedAtMs', incomingTs);
                }

                const incomingCoins = Number(data.coins || 0);
                
                // Calculate how much delta was added AFTER this batch was sent
                const deltaAddedAfterSend = state.game.coinsOptimisticDelta - optimisticDeltaAtSend;
                
                // New confirmed = server coins
                // New delta = only the clicks that happened AFTER this batch
                const nextConfirmed = incomingCoins;
                const nextDelta = Math.max(0, deltaAddedAfterSend);
                const nextDisplay = nextConfirmed + nextDelta;
                
                console.log('[CLICK] Balance updated:', {
                    nextConfirmed,
                    nextDelta,
                    nextDisplay,
                    deltaAddedAfterSend,
                    diff: nextDisplay - state.game.coins
                });
                
                store.set('game.coinsConfirmed', nextConfirmed);
                store.set('game.coinsOptimisticDelta', nextDelta);
                store.set('game.coins', nextDisplay);
                
                if (typeof data.profit_per_tap === 'number') {
                    const nextTap = Math.max(1, Number(data.profit_per_tap || 0));
                    const expectedMinTap = Math.max(1, Number(state.game.level || 0) + 1);
                    if (nextTap >= expectedMinTap) {
                        store.set('game.profitPerTap', nextTap);
                    }
                }
                store.set('game.profitPerHour', data.profit_per_hour ?? state.game.profitPerHour);
                applyBoostStateFromPayload(data);

                const actualEnergySpent = typeof data.effective_clicks === 'number' ? data.effective_clicks : pendingSpendForThisBatch;
                store.set('temp.pendingEnergySpend', Math.max(0, state.temp.pendingEnergySpend - actualEnergySpent));
                    applyServerEnergySnapshot(data);
                    updateUI();
                }
        } catch (err) {
            if (err?.status === 409) {
                store.set('temp.pendingClickBatchId', null);
                const nextDelta = Math.max(0, state.game.coinsOptimisticDelta - optimisticGain);
                const nextDisplay = state.game.coinsConfirmed + nextDelta;
                store.set('game.coinsOptimisticDelta', nextDelta);
                store.set('game.coins', nextDisplay);
                store.set('temp.pendingEnergySpend', 0);
                await fullSyncWithServer();
                return;
            }
            if (err?.status === 500 || err?.status === 502 || err?.status === 503 || err?.status === 504) {
                console.error('Click batch server error:', err);
                store.set('temp.clickBuffer', state.temp.clickBuffer + clicks);
                store.set('temp.clickValueBuffer', state.temp.clickValueBuffer + optimisticGain);
                if (!state.temp.clickBufferStartedAtMs) {
                    store.set('temp.clickBufferStartedAtMs', nowMs);
                }
                const nextDelta = Math.max(0, state.game.coinsOptimisticDelta - optimisticGain);
                const nextDisplay = state.game.coinsConfirmed + nextDelta;
                store.set('game.coinsOptimisticDelta', nextDelta);
                store.set('game.coins', nextDisplay);
                return;
            }
            console.error('Click batch error:', err);
            store.set('temp.clickBuffer', state.temp.clickBuffer + clicks);
            store.set('temp.clickValueBuffer', state.temp.clickValueBuffer + optimisticGain);
            if (!state.temp.clickBufferStartedAtMs) {
                store.set('temp.clickBufferStartedAtMs', nowMs);
            }
            const nextDelta = Math.max(0, state.game.coinsOptimisticDelta - optimisticGain);
            const nextDisplay = state.game.coinsConfirmed + nextDelta;
            store.set('game.coinsOptimisticDelta', nextDelta);
            store.set('game.coins', nextDisplay);
        } finally {
                store.set('temp.clickBatchInFlight', false);
            }
        }

        return {
            setCoins: setCoinsValue,
            addCoins,
            computeTapPreviewGain,
            applyTapLocalMutation,
            sendClickBatch,
            getLastBatchSentAtMs: () => lastBatchSentAtMs
        };
    }

    global.SpiritClickDomain = {
        createClickDomain
    };
})(window);
