import React from "react";
import { Link } from "react-router-dom";
import { truncAddr } from "../utils/helpers";

export default function Navbar({
  account,
  walletConnected,
  connectWallet,
  disconnectWallet,
  walletMenuOpen,
  setWalletMenuOpen,
}) {
  return (
    <div className="topnav">
      <div className="tn-brand">
        <a href="/" className="tn-brand-link">
          <div className="tn-logo">
            <img src="/logo.png" alt="ShadowLend" />
          </div>
          <span className="tn-name">ShadowLend</span>
        </a>
      </div>
      <div className="tn-sep" />
      <div className="tn-links">
        <button className="tn-link active">Borrow</button>
        <Link to="/app/supply" className="tn-link">Supply</Link>
        <button className="tn-link">Docs</button>
      </div>
      <div style={{ flex: 1 }} />
      {!walletConnected ? (
        <button className="tn-wallet" onClick={connectWallet}>
          <div className="tn-wdot" />
          <span>Connect</span>
        </button>
      ) : (
        <div className="tn-wallet-wrap">
          <button
            className="tn-wallet on"
            onClick={() => setWalletMenuOpen((p) => !p)}
          >
            <div className="tn-wdot" />
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px" }}>
              {truncAddr(account)}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 4, transition: "transform 0.2s", transform: walletMenuOpen ? "rotate(180deg)" : "rotate(0)" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {walletMenuOpen && (
            <>
              <div className="tn-menu-overlay" onClick={() => setWalletMenuOpen(false)} />
              <div className="tn-dropdown">
                <div className="tn-dropdown-header">
                  <div className="tn-dropdown-addr">{truncAddr(account)}</div>
                  <button
                    className="tn-dropdown-copy"
                    onClick={() => { navigator.clipboard.writeText(account); }}
                    title="Copy address"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </div>
                <Link
                  to="/app/profile"
                  className="tn-dropdown-item"
                  onClick={() => setWalletMenuOpen(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </Link>
                <button
                  className="tn-dropdown-item logout"
                  onClick={() => { setWalletMenuOpen(false); disconnectWallet(); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Disconnect
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
