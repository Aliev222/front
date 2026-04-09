(function initSpiritRebirthPanelUiModule(global) {
    function createRebirthPanelUi() {
        function render(viewModel = {}) {
            const panel = document.querySelector('[data-ui="rebirth-panel"], #rebirth-panel');
            const mainUpgradePanel = document.querySelector('[data-ui="main-upgrade-panel"]');
            if (!panel) {
                return;
            }

            const levelNode = document.querySelector('[data-ui="bottom-level"], #globalLevel');
            const displayedLevel = Number(levelNode?.textContent || 0);
            const hasRequiredDisplayLevel = Number.isFinite(displayedLevel) ? displayedLevel >= 101 : true;
            const effectiveVisible = Boolean(viewModel.visible && hasRequiredDisplayLevel);

            panel.style.display = effectiveVisible ? '' : 'none';
            if (mainUpgradePanel) {
                mainUpgradePanel.style.display = effectiveVisible ? 'none' : '';
            }

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
