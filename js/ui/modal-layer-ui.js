(function initSpiritModalLayerUiModule(global) {
    function createModalLayerUi(deps = {}) {
        const modalManager = deps.modalManager;
        if (!modalManager) {
            throw new Error('modalManager is required for modal-layer-ui');
        }

        function hasBlockingOverlayActive() {
            return modalManager.hasBlockingOverlayActive();
        }

        function syncBodyClass() {
            modalManager.syncBodyClass();
        }

        function clearModals() {
            modalManager.clearModals();
        }

        function openModal(id) {
            modalManager.openModal(id);
        }

        function closeModal(id) {
            modalManager.closeModal(id);
        }

        function setRebirthConfirmBusy(isBusy, options = {}) {
            const btn = document.querySelector('[data-ui="rebirth-confirm-btn"], #rebirth-confirm-btn');
            if (!btn) return;

            if (isBusy) {
                btn.dataset.prevLabel = btn.textContent || options.defaultLabel || 'Переродиться';
                btn.disabled = true;
                if (options.loadingLabel) {
                    btn.textContent = options.loadingLabel;
                }
                return;
            }

            btn.disabled = false;
            btn.textContent = btn.dataset.prevLabel || options.defaultLabel || 'Переродиться';
        }

        return {
            hasBlockingOverlayActive,
            syncBodyClass,
            clearModals,
            openModal,
            closeModal,
            setRebirthConfirmBusy
        };
    }

    global.SpiritModalLayerUi = {
        createModalLayerUi
    };
})(window);
