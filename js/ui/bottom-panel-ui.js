(function initSpiritBottomPanelUiModule(global) {
    function createBottomPanelUi(deps = {}) {
        const formatNumber = deps.formatNumber || ((v) => String(v ?? 0));
        const getDisplayLevel = deps.getDisplayLevel || ((v) => Number(v || 0));

        function buildViewModel({ rawLevel = 0, globalPrice = 0 } = {}) {
            const safeRawLevel = Number(rawLevel || 0);
            return {
                rawLevel: safeRawLevel,
                displayLevel: getDisplayLevel(safeRawLevel),
                globalPriceText: formatNumber(globalPrice || 0)
            };
        }

        function render(viewModel = {}) {
            const levelEl = document.querySelector('[data-ui="bottom-level"], #globalLevel');
            const priceEl = document.querySelector('[data-ui="bottom-price"], #globalPrice');
            if (levelEl) levelEl.textContent = String(viewModel.displayLevel || 0);
            if (priceEl) priceEl.textContent = String(viewModel.globalPriceText || '0');
        }

        function setActiveTab(tab) {
            document.querySelectorAll('[data-ui-nav-item]').forEach((node) => {
                const nodeTab = node.getAttribute('data-ui-tab') || '';
                node.classList.toggle('active', nodeTab === tab);
            });
        }

        return {
            buildViewModel,
            render,
            setActiveTab
        };
    }

    global.SpiritBottomPanelUi = {
        createBottomPanelUi
    };
})(window);
