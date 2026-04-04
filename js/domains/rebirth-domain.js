(function initSpiritRebirthDomain(global) {
    const REBIRTH_MIN_LEVEL = 100;
    const REBIRTH_COST_COINS = 1_000_000;

    function createRebirthDomain(deps) {
        const {
            State,
            store,
            userId,
            API,
            openModal,
            closeModal,
            showToast,
            updateUI,
            formatNumber,
            StateActions
        } = deps;

        function getRawGlobalLevel() {
            return Number(State.game.levels.multitap || 0);
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

        function renderAvailability() {
            const panel = document.getElementById('rebirth-panel');
            if (!panel) return;
            panel.style.display = shouldShowEntry() ? '' : 'none';

            const actionBtn = document.getElementById('rebirth-action-btn');
            if (actionBtn) {
                actionBtn.disabled = !canRebirth();
            }
        }

        function openConfirmModal() {
            if (!shouldShowEntry()) {
                showToast('Требуется 100 уровень.', true);
                return;
            }
            openModal('rebirth-confirm-screen');
        }

        function applyRebirthSuccess(payload) {
            const nextCoins = Number(payload?.coins ?? State.game.coins);
            const nextRebirthCount = Number(payload?.rebirth_count ?? (State.game.rebirthCount + 1));
            const nextProfitPerTap = Number(payload?.profit_per_tap ?? (1 + nextRebirthCount));
            const nextProfitPerHour = Number(payload?.profit_per_hour ?? 100);
            const nextMaxEnergy = Number(payload?.max_energy ?? 500);
            const nextEnergy = Number(payload?.energy ?? nextMaxEnergy);

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
            if (!shouldShowEntry()) {
                showToast('Недостаточный уровень для перерождения.', true);
                closeModal('rebirth-confirm-screen');
                return;
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
                showToast(`Перерождение успешно! Бонус к тапу: +${formatNumber(State.game.rebirthCount)}`);
            } catch (err) {
                const detail = String(err?.detail || '');
                if (detail.includes('level 100')) {
                    showToast('Недостаточный уровень для перерождения.', true);
                } else if (detail.includes('Not enough coins')) {
                    showToast('Недостаточно коинов для перерождения.', true);
                } else {
                    showToast('Ошибка сервера при перерождении.', true);
                }
            } finally {
                renderAvailability();
            }
        }

        return {
            canRebirth,
            shouldShowEntry,
            renderAvailability,
            openConfirmModal,
            confirmRebirth
        };
    }

    global.SpiritRebirthDomain = {
        createRebirthDomain
    };
})(window);
