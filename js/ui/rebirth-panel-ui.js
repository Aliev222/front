(function initSpiritRebirthPanelUiModule(global) {
    function createRebirthPanelUi() {
        function render(viewModel = {}) {
            const panel = document.querySelector('[data-ui="rebirth-panel"], #rebirth-panel');
            if (!panel) return;

            panel.style.display = viewModel.visible ? '' : 'none';

            const actionBtn = document.querySelector('[data-ui="rebirth-action-btn"], #rebirth-action-btn');
            if (!actionBtn) return;

            actionBtn.disabled = !viewModel.enabled;
            if (typeof viewModel.actionText === 'string' && viewModel.actionText.length > 0) {
                actionBtn.textContent = viewModel.actionText;
            }
        }

        return {
            render
        };
    }

    global.SpiritRebirthPanelUi = {
        createRebirthPanelUi
    };
})(window);
