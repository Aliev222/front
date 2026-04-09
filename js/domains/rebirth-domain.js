(function initSpiritRebirthDomain(global) {
    const REBIRTH_MIN_LEVEL = 100;
    const REBIRTH_COST_COINS = 1_000_000;

    function createRebirthDomain(deps) {
        const {
            State,
            userId,
            API,
            openModal,
            closeModal,
            setConfirmBusy,
            showToast,
            updateUI,
            formatNumber,
            StateActions
        } = deps;

        let rebirthInFlight = false;

        function getRawGlobalLevel() {
            return Number(State.game.level || 0);
        }

        function canRebirth() {
            return (
                getRawGlobalLevel() >= REBIRTH_MIN_LEVEL &&
                Number(State.game.coins || 0) >= REBIRTH_COST_COINS
            );
        }

        function shouldShowEntry() {
            return getRawGlobalLevel() >= REBIRTH_MIN_LEVEL;
        }

        function buildAvailabilityViewModel() {
            const enabled = canRebirth();
            return {
                visible: shouldShowEntry(),
                enabled,
                actionText: enabled
                    ? 'Переродиться'
                    : `Нужно ${formatNumber(REBIRTH_COST_COINS)} монет`
            };
        }

        function openConfirmModal() {
            if (!shouldShowEntry()) {
                showToast(`Требуется ${REBIRTH_MIN_LEVEL} уровень.`, true);
                return;
            }
            openModal('rebirth-confirm-screen');
        }

        function applyRebirthSuccess(payload) {
            const nextCoins = Number(payload?.coins ?? State.game.coins);
            const nextRebirthCount = Number(payload?.rebirth_count ?? (State.game.rebirthCount + 1));
            const nextProfitPerTap = Number(payload?.profit_per_tap ?? State.game.profitPerTap);
            const nextProfitPerHour = Number(payload?.profit_per_hour ?? State.game.profitPerHour);
            const nextMaxEnergy = Number(payload?.max_energy ?? State.game.maxEnergy);
            const nextEnergy = Number(payload?.energy ?? State.game.energy);

            StateActions.setCoins(nextCoins);
            StateActions.setRebirthCount(nextRebirthCount);
            StateActions.applyProgressSnapshot({
                level: 0,
                multitap_level: 0,
                profit_level: 0,
                energy_level: 0
            });
            StateActions.applyProfitSnapshot({
                profit_per_tap: nextProfitPerTap,
                profit_per_hour: nextProfitPerHour
            });
            StateActions.applyEnergySnapshot({
                energy: nextEnergy,
                max_energy: nextMaxEnergy,
                regen_seconds: 2
            });
        }

        async function confirmRebirth() {
            if (!userId()) return;
            if (rebirthInFlight) return;
            if (!shouldShowEntry()) {
                showToast('Недостаточный уровень для перерождения.', true);
                closeModal('rebirth-confirm-screen');
                return;
            }

            rebirthInFlight = true;
            if (typeof setConfirmBusy === 'function') {
                setConfirmBusy(true, {
                    defaultLabel: 'Переродиться',
                    loadingLabel: 'Перерождение...'
                });
            }

            try {
                const result = await API.post('/api/rebirth', { user_id: userId() });
                if (!result?.success) {
                    showToast('Не удалось выполнить перерождение.', true);
                    return;
                }
                applyRebirthSuccess(result);
                closeModal('rebirth-confirm-screen');
                updateUI();
                showToast(`Перерождение успешно! Бонус к тапу: +${formatNumber(State.game.rebirthCount)}.`);
            } catch (err) {
                const detail = String(err?.detail || '');
                if (detail.includes('level 100') || detail.includes('level 101')) {
                    showToast('Недостаточный уровень для перерождения.', true);
                } else if (detail.includes('Not enough coins')) {
                    showToast('Недостаточно коинов для перерождения.', true);
                } else {
                    showToast('Ошибка сервера при перерождении.', true);
                }
            } finally {
                rebirthInFlight = false;
                if (typeof setConfirmBusy === 'function') {
                    setConfirmBusy(false, {
                        defaultLabel: 'Переродиться'
                    });
                }
            }
        }

        return {
            canRebirth,
            shouldShowEntry,
            buildAvailabilityViewModel,
            openConfirmModal,
            confirmRebirth
        };
    }

    global.SpiritRebirthDomain = {
        createRebirthDomain
    };
})(window);
