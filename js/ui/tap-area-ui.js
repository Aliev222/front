(function initSpiritTapAreaUiModule(global) {
    function createTapAreaUi() {
        const selectors = {
            fill: '[data-ui="tap-energy-fill"], #energyFill',
            current: '[data-ui="tap-energy-current"], #energyText',
            max: '[data-ui="tap-energy-max"], #maxEnergyText',
            percent: '#energyPercent',
            container: '#energyHud',
            clickButton: '#ryoho'
        };

        function buildViewModel({ visualEnergy = 0, maxEnergy = 1 } = {}) {
            const safeMax = Math.max(1, Number(maxEnergy || 1));
            const safeVisual = Math.max(0, Math.min(safeMax, Number(visualEnergy || 0)));
            const percent = (safeVisual / safeMax) * 100;

            return {
                energyText: String(Math.floor(safeVisual)),
                maxEnergyText: String(safeMax),
                fillWidth: `${percent}%`,
                percentText: `${Math.round(percent)}%`,
                state: percent <= 0 ? 'empty' : (percent <= 25 ? 'low' : 'full')
            };
        }

        function render(viewModel = {}) {
            const fill = document.querySelector(selectors.fill);
            const current = document.querySelector(selectors.current);
            const max = document.querySelector(selectors.max);
            const percent = document.querySelector(selectors.percent);
            const container = document.querySelector(selectors.container);
            const clickButton = document.querySelector(selectors.clickButton);
            if (!fill || !current || !max) return;

            fill.style.width = viewModel.fillWidth || '0%';
            current.textContent = viewModel.energyText || '0';
            max.textContent = viewModel.maxEnergyText || '0';
            if (percent) percent.textContent = viewModel.percentText || '0%';
            if (container) container.setAttribute('data-energy-state', viewModel.state || 'full');
            if (clickButton) {
                clickButton.classList.toggle('is-low-energy', (viewModel.state || 'full') === 'low');
                clickButton.classList.toggle('is-empty-energy', (viewModel.state || 'full') === 'empty');
            }
        }

        return {
            buildViewModel,
            render
        };
    }

    global.SpiritTapAreaUi = {
        createTapAreaUi
    };
})(window);
