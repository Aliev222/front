(function initSpiritWalletEventUi(global) {
    function createWalletEventUi(deps) {
        function renderTonWalletState() {
            const badgeEl = document.getElementById('event-wallet-status-badge');
            const titleEl = document.getElementById('event-wallet-title');
            const addressEl = document.getElementById('event-wallet-address');
            const subEl = document.getElementById('event-wallet-sub');
            const connectBtn = document.getElementById('event-wallet-connect-btn');
            const disconnectBtn = document.getElementById('event-wallet-disconnect-btn');
            const wallet = deps.getTonWalletState();
            const payoutReady = wallet.connected && wallet.verified;

            if (badgeEl) badgeEl.textContent = payoutReady
                ? deps.t('wallet.connected')
                : (wallet.connected ? deps.t('wallet.verificationRequired') : deps.t('wallet.notConnected'));
            if (titleEl) titleEl.textContent = payoutReady
                ? deps.t('wallet.connectedTitle')
                : (wallet.connected ? deps.t('wallet.verificationTitle') : deps.t('wallet.disconnectedTitle'));
            if (addressEl) addressEl.textContent = wallet.connected
                ? (wallet.masked_address || wallet.address)
                : deps.t('wallet.noWallet');
            if (subEl) subEl.textContent = payoutReady
                ? deps.t('wallet.connectedSub')
                : (wallet.connected ? deps.t('wallet.verificationSub') : deps.t('wallet.disconnectedSub'));
            if (connectBtn) connectBtn.style.display = payoutReady ? 'none' : '';
            if (disconnectBtn) disconnectBtn.style.display = wallet.connected ? '' : 'none';
            if (connectBtn) connectBtn.textContent = deps.t('wallet.connect');
            if (disconnectBtn) disconnectBtn.textContent = deps.t('wallet.disconnect');
            renderPendingTonWalletNotice(deps.getPendingTonWalletNotice());
        }

        function renderPendingTonWalletNotice(notice = null) {
            const eventNoticeEl = document.getElementById('event-payout-notice');
            const walletNoticeEl = document.getElementById('wallet-payout-notice');
            const wallet = deps.getTonWalletState();
            const shouldShow = !!notice && !(wallet.connected && wallet.verified);

            [eventNoticeEl, walletNoticeEl].forEach((node) => {
                if (!node) return;
                if (!shouldShow) {
                    node.classList.add('hidden');
                    node.innerHTML = '';
                    return;
                }
                node.classList.remove('hidden');
                node.innerHTML = deps.buildPendingTonWalletNoticeHtml(notice);
            });
        }

        return {
            renderTonWalletState,
            renderPendingTonWalletNotice
        };
    }

    global.SpiritWalletEventUi = {
        createWalletEventUi
    };
})(window);