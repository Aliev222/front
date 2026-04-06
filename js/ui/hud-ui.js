(function initSpiritHudUiModule(global) {
    function createHudUi(deps = {}) {
        const formatNumber = deps.formatNumber || ((v) => String(v ?? 0));
        const selectors = {
            coins: '[data-ui="hud-coins"], #coinBalance',
            perHour: '[data-ui="hud-profit-hour"], #profitPerHour',
            perTap: '[data-ui="hud-profit-tap"], #profitPerTap',
            reward: '#tapRewardValue',
            rewardHud: '#coinRewardHud'
        };

        let lastCoinsValue = null;

        function buildViewModel({
            coins = 0,
            profitPerHour = 0,
            profitPerTap = 0,
            isTaskPassiveBoostActive = false,
            taskPassiveBoostMultiplier = 1,
            isTaskTapBoostActive = false,
            taskTapBoostMultiplier = 1
        } = {}) {
            const displayHour = isTaskPassiveBoostActive
                ? Math.floor((profitPerHour || 0) * (taskPassiveBoostMultiplier || 1))
                : (profitPerHour || 0);
            const displayTap = isTaskTapBoostActive
                ? Math.floor((profitPerTap || 0) * (taskTapBoostMultiplier || 1))
                : (profitPerTap || 0);

            return {
                coinsText: formatNumber(coins || 0),
                perHourText: formatNumber(displayHour),
                perTapText: String(displayTap)
            };
        }

        function setText(selector, value) {
            document.querySelectorAll(selector).forEach((node) => {
                node.textContent = value;
            });
        }

        function render(viewModel = {}) {
            const rewardHud = document.querySelector(selectors.rewardHud);
            setText(selectors.coins, viewModel.coinsText || '0');
            setText(selectors.perHour, viewModel.perHourText || '0');
            setText(selectors.perTap, viewModel.perTapText || '0');
            setText(selectors.reward, viewModel.perTapText || '0');

            const numericCoins = Number((viewModel.coinsText || '0').toString().replace(/[^\d.-]/g, '')) || 0;
            if (rewardHud && lastCoinsValue !== null && numericCoins > lastCoinsValue) {
                rewardHud.classList.remove('is-rewarding');
                rewardHud.offsetWidth;
                rewardHud.classList.add('is-rewarding');
                clearTimeout(rewardHud._rewardPulseTimer);
                rewardHud._rewardPulseTimer = setTimeout(() => rewardHud.classList.remove('is-rewarding'), 280);
            }
            lastCoinsValue = numericCoins;
        }

        return {
            buildViewModel,
            render
        };
    }

    global.SpiritHudUi = {
        createHudUi
    };
})(window);
