(function initSpiritModalModule(global) {
    function createModalManager(options = {}) {
        const modalSelector = options.modalSelector || '.modal-screen';
        const activeClass = options.activeClass || 'active';
        const blockingSelector = options.blockingSelector || '.modal-screen.active, .skin-detail-modal.active, .energy-recovery-modal, .ad-input-blocker';
        const bodyClass = options.bodyClass || 'modal-open';
        const onOpen = options.onOpen || null;

        function hasBlockingOverlayActive() {
            return !!document.querySelector(blockingSelector);
        }

        function syncBodyClass() {
            document.body.classList.toggle(bodyClass, hasBlockingOverlayActive());
        }

        function clearModals() {
            document.querySelectorAll(modalSelector).forEach((modal) => modal.classList.remove(activeClass));
            syncBodyClass();
        }

        function openModal(id) {
            clearModals();
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add(activeClass);
                if (typeof onOpen === 'function') {
                    onOpen(id);
                }
            }
            syncBodyClass();
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove(activeClass);
            }
            syncBodyClass();
        }

        return {
            hasBlockingOverlayActive,
            syncBodyClass,
            clearModals,
            openModal,
            closeModal
        };
    }

    global.SpiritModalManager = {
        createModalManager
    };
})(window);