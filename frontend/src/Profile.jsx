import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import contractAddresses from "./contracts.json";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FHEVM_CHAIN_ID = 11155111;
const EXPLORER_BASE = "https://sepolia.etherscan.io/tx/";
const EXPLORER_ADDR = "https://sepolia.etherscan.io/address/";

// Encrypted contract ABIs
const ORCHESTRATOR_ABI = [
  "event LoanRequested(address indexed borrower, uint256 amount, uint256 requestId)",
  "event LoanApproved(address indexed borrower, uint256 amount)",
  "event LoanDenied(address indexed borrower, uint256 amount)",
  "event LoanRepaid(address indexed borrower, uint256 amount)",
  "event InstallmentPaid(address indexed borrower, uint256 amount, uint256 remaining)",
];

const LENDING_POOL_ABI = [
  "function loans(address borrower) external view returns (uint256 amount, uint256 remaining, uint256 totalOwed, uint256 timestamp, bool repaid)",
];

const USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
];

const VAULT_ABI = [
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
];

// localStorage cache key (shared with App.jsx)
const CACHE_KEY = "shadowlend_score_";

function loadCachedScore(account) {
  try {
    const raw = localStorage.getItem(CACHE_KEY + account.toLowerCase());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

const FACTOR_META = [
  { key: "paymentHistory", label: "Payment History", weight: 35, color: "var(--indigo)" },
  { key: "debtToIncome", label: "Debt-to-Income", weight: 30, color: "var(--teal)" },
  { key: "incomeLevel", label: "Income Level", weight: 20, color: "var(--indigo2)" },
  { key: "employment", label: "Employment", weight: 15, color: "var(--indigo3)" },
];

const truncAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");
const truncHash = (h) => (h ? `${h.slice(0, 10)}...` : "");
const fmtUsd = (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getScoreColor(score) {
  if (score >= 750) return "var(--green)";
  if (score >= 650) return "var(--teal)";
  return "var(--rose)";
}

function getScoreLabel(score) {
  if (score >= 800) return "Excellent";
  if (score >= 750) return "Very Good";
  if (score >= 700) return "Good";
  if (score >= 650) return "Fair";
  return "Poor";
}

const HISTORY_PAGE_SIZE = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Profile() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  // Score data (from localStorage cache — private, never on-chain in plaintext)
  const [score, setScore] = useState(null);
  const [factors, setFactors] = useState(null);
  const [eligible, setEligible] = useState(false);
  const [rate, setRate] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);
  const [scoreTimestamp, setScoreTimestamp] = useState(0);

  // Position data (from LendingPool + USDC contracts)
  const [outstanding, setOutstanding] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [txHistory, setTxHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Wallet connection
  // ---------------------------------------------------------------------------
  const connectWallet = async () => {
    if (!window.ethereum) { alert("Install MetaMask"); return; }
    try {
      sessionStorage.removeItem("shadowlend_disconnected");
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (parseInt(chainId, 16) !== FHEVM_CHAIN_ID) {
        try {
          await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + FHEVM_CHAIN_ID.toString(16) }] });
        } catch { return; }
      }
      setAccount(accs[0]);
      setWalletConnected(true);
    } catch { /* user rejected */ }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setWalletConnected(false);
    setScore(null);
    setFactors(null);
    setTxHistory([]);
    sessionStorage.setItem("shadowlend_disconnected", "1");
  };

  // Auto-connect (unless user explicitly disconnected)
  useEffect(() => {
    (async () => {
      if (!window.ethereum) return;
      if (sessionStorage.getItem("shadowlend_disconnected")) return;
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      if (accs.length > 0) {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (parseInt(chainId, 16) === FHEVM_CHAIN_ID) {
          setAccount(accs[0]);
          setWalletConnected(true);
        }
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch data from encrypted contracts + localStorage
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);

      // Load cached score data (private — from agent, never on-chain in plaintext)
      const cached = loadCachedScore(account);
      if (cached && cached.score > 0) {
        setScore(cached.score);
        setEligible(cached.eligible);
        setRate(cached.rate || 0);
        setCreditLimit(cached.creditLimit || 0);
        setScoreTimestamp(cached.timestamp ? Math.floor(cached.timestamp / 1000) : 0);
        if (cached.factors) {
          setFactors(cached.factors);
        }
      }

      // Read loan state from LendingPool
      if (contractAddresses.LendingPool) {
        const pool = new ethers.Contract(contractAddresses.LendingPool, LENDING_POOL_ABI, provider);
        const loan = await pool.loans(account);
        const remaining = Number(ethers.formatUnits(loan.remaining, 6));
        setOutstanding(remaining > 0 && !loan.repaid ? remaining : 0);
      }

      // Read real USDC balance
      if (contractAddresses.USDC) {
        const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, provider);
        const bal = await usdc.balanceOf(account);
        setUsdcBalance(Number(ethers.formatUnits(bal, 6)));
      }

      // Transaction history from Orchestrator events
      if (contractAddresses.Orchestrator) {
        const orchestrator = new ethers.Contract(contractAddresses.Orchestrator, ORCHESTRATOR_ABI, provider);
        // Use deploy block to avoid RPC range limits on Sepolia
        const deployBlock = contractAddresses.DeployBlock || 0;
        const currentBlock = await provider.getBlockNumber();
        // If no deploy block saved, search last 100k blocks (~2 weeks on Sepolia)
        const fromBlock = deployBlock || Math.max(0, currentBlock - 100000);

        const [reqEvents, approvedEvents, deniedEvents, repaidEvents, installmentEvents] = await Promise.all([
          orchestrator.queryFilter(orchestrator.filters.LoanRequested(account), fromBlock, "latest"),
          orchestrator.queryFilter(orchestrator.filters.LoanApproved(account), fromBlock, "latest"),
          orchestrator.queryFilter(orchestrator.filters.LoanDenied(account), fromBlock, "latest"),
          orchestrator.queryFilter(orchestrator.filters.LoanRepaid(account), fromBlock, "latest"),
          orchestrator.queryFilter(orchestrator.filters.InstallmentPaid(account), fromBlock, "latest"),
        ]);

        const tsCache = {};
        const getTs = async (bn) => {
          if (tsCache[bn]) return tsCache[bn];
          const block = await provider.getBlock(bn);
          tsCache[bn] = block.timestamp;
          return block.timestamp;
        };

        const allEvents = [];
        for (const e of approvedEvents) {
          const ts = await getTs(e.blockNumber);
          allEvents.push({
            type: "borrow",
            amount: Number(ethers.formatUnits(e.args.amount, 6)),
            txHash: e.transactionHash,
            timestamp: ts,
            blockNumber: e.blockNumber,
          });
        }
        for (const e of installmentEvents) {
          const ts = await getTs(e.blockNumber);
          allEvents.push({
            type: "installment",
            amount: Number(ethers.formatUnits(e.args.amount, 6)),
            remaining: Number(ethers.formatUnits(e.args.remaining, 6)),
            txHash: e.transactionHash,
            timestamp: ts,
            blockNumber: e.blockNumber,
          });
        }
        for (const e of repaidEvents) {
          const ts = await getTs(e.blockNumber);
          allEvents.push({
            type: "repay",
            amount: Number(ethers.formatUnits(e.args.amount, 6)),
            txHash: e.transactionHash,
            timestamp: ts,
            blockNumber: e.blockNumber,
          });
        }
        for (const e of deniedEvents) {
          const ts = await getTs(e.blockNumber);
          allEvents.push({
            type: "denied",
            amount: Number(ethers.formatUnits(e.args.amount, 6)),
            txHash: e.transactionHash,
            timestamp: ts,
            blockNumber: e.blockNumber,
          });
        }

        // Vault supply-side events (Deposit / Withdraw)
        if (contractAddresses.Vault) {
          const vault = new ethers.Contract(contractAddresses.Vault, VAULT_ABI, provider);
          const [vaultDeposits, vaultWithdraws] = await Promise.all([
            vault.queryFilter(vault.filters.Deposit(account), fromBlock, "latest"),
            vault.queryFilter(vault.filters.Withdraw(account), fromBlock, "latest"),
          ]);

          for (const e of vaultDeposits) {
            const ts = await getTs(e.blockNumber);
            allEvents.push({
              type: "supply",
              amount: Number(ethers.formatUnits(e.args.assets, 6)),
              txHash: e.transactionHash,
              timestamp: ts,
              blockNumber: e.blockNumber,
            });
          }
          for (const e of vaultWithdraws) {
            const ts = await getTs(e.blockNumber);
            allEvents.push({
              type: "withdraw",
              amount: Number(ethers.formatUnits(e.args.assets, 6)),
              txHash: e.transactionHash,
              timestamp: ts,
              blockNumber: e.blockNumber,
            });
          }
        }

        allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
        setTxHistory(allEvents);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
    setLoading(false);
  }, [account]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const totalPages = Math.ceil(txHistory.length / HISTORY_PAGE_SIZE);
  const pagedHistory = txHistory.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE);
  const available = Math.max(0, creditLimit - outstanding);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="page">
      {/* Blob background */}
      <div className="blob-container">
        <div className="blob" style={{ width: 500, height: 500, background: "radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)", top: "-10%", left: "-10%" }} />
        <div className="blob" style={{ width: 400, height: 400, background: "radial-gradient(circle, rgba(45,212,191,0.1), transparent 70%)", bottom: "5%", right: "-5%" }} />
      </div>

      {/* Nav */}
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
          <Link to="/app" className="tn-link">Borrow</Link>
          <Link to="/app/supply" className="tn-link">Supply</Link>
          <button className="tn-link active">Profile</button>
        </div>
        <div style={{ flex: 1 }} />
        {!walletConnected ? (
          <button className="tn-wallet" onClick={connectWallet}>
            <div className="tn-wdot" />
            <span>Connect</span>
          </button>
        ) : (
          <div className="tn-wallet-wrap">
            <button className="tn-wallet on" onClick={() => setWalletMenuOpen((p) => !p)}>
              <div className="tn-wdot" />
              <span style={{ fontFamily: "var(--mono)", fontSize: "11px" }}>{truncAddr(account)}</span>
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
                    <button className="tn-dropdown-copy" onClick={() => navigator.clipboard.writeText(account)} title="Copy address">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                  <Link to="/app/profile" className="tn-dropdown-item" onClick={() => setWalletMenuOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile
                  </Link>
                  <button className="tn-dropdown-item logout" onClick={() => { setWalletMenuOpen(false); disconnectWallet(); }}>
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

      {/* Back button + Header */}
      <section className="app-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h1 className="app-title">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Borrower Profile
        </h1>
        <p className="app-subtitle">
          Your encrypted credit profile, position summary, and transaction history.
        </p>
      </section>

      {/* Content */}
      <div className="profile-grid">
        {!walletConnected ? (
          <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px" }}>
            <p style={{ color: "var(--text2)", marginBottom: 16 }}>Connect your wallet to view your profile</p>
            <button className="btn-fill" onClick={connectWallet}>Connect Wallet</button>
          </div>
        ) : loading ? (
          <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px" }}>
            <p style={{ color: "var(--text2)" }}>Loading encrypted contract data...</p>
          </div>
        ) : !score ? (
          <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px" }}>
            <p style={{ color: "var(--text2)", marginBottom: 16 }}>No credit score found for this wallet</p>
            <Link to="/app" className="btn-fill" style={{ display: "inline-block", textDecoration: "none" }}>Apply for Credit</Link>
          </div>
        ) : (
          <>
            {/* Credit Score Card */}
            <div className="card profile-score-card">
              <h3 className="card-label">Credit Score</h3>
              <div className="profile-score-ring">
                <svg viewBox="0 0 120 120" width="140" height="140">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={getScoreColor(score)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${((score - 300) / 550) * 314} 314`}
                    transform="rotate(-90 60 60)"
                    style={{ filter: `drop-shadow(0 0 6px ${getScoreColor(score)})` }}
                  />
                  <text x="60" y="55" textAnchor="middle" fill="var(--text)" fontSize="28" fontWeight="700" fontFamily="var(--sans)">{score}</text>
                  <text x="60" y="72" textAnchor="middle" fill="var(--text2)" fontSize="11" fontFamily="var(--sans)">{getScoreLabel(score)}</text>
                </svg>
              </div>
              <div className="profile-score-meta">
                <div className="profile-meta-row">
                  <span className="profile-meta-label">Status</span>
                  <span className={`profile-meta-val ${eligible ? "val-green" : "val-rose"}`}>
                    {eligible ? "Eligible" : "Not Eligible"}
                  </span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">Interest Rate</span>
                  <span className="profile-meta-val">{Number(rate).toFixed(2)}%</span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">Privacy</span>
                  <span className="profile-meta-val" style={{ color: "var(--green)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    FHE Encrypted
                  </span>
                </div>
              </div>
            </div>

            {/* Factors Card */}
            <div className="card profile-factors-card">
              <h3 className="card-label">Score Breakdown</h3>
              {factors && FACTOR_META.map((f) => (
                <div key={f.key} className="profile-factor-row">
                  <div className="profile-factor-top">
                    <span className="profile-factor-name">{f.label}</span>
                    <span className="profile-factor-score" style={{ color: f.color }}>{factors[f.key]}/100</span>
                  </div>
                  <div className="profile-factor-bar-bg">
                    <div className="profile-factor-bar" style={{ width: `${factors[f.key]}%`, background: f.color }} />
                  </div>
                  <span className="profile-factor-weight">{f.weight}% weight</span>
                </div>
              ))}
              <p style={{ fontSize: 10, color: "var(--text3)", marginTop: 12, textAlign: "center" }}>
                Score data is cached locally. Raw score never stored on-chain.
              </p>
            </div>

            {/* Position Card */}
            <div className="card profile-position-card">
              <h3 className="card-label">Position Summary</h3>
              <div className="profile-stats-grid">
                <div className="profile-stat">
                  <span className="profile-stat-label">Credit Limit</span>
                  <span className="profile-stat-val">{fmtUsd(creditLimit)}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-label">Outstanding</span>
                  <span className="profile-stat-val" style={{ color: outstanding > 0 ? "var(--rose)" : "var(--text)" }}>{fmtUsd(outstanding)}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-label">Available Credit</span>
                  <span className="profile-stat-val" style={{ color: "var(--green)" }}>{fmtUsd(available)}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-label">USDC Balance</span>
                  <span className="profile-stat-val">{fmtUsd(usdcBalance)}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-label">Contract Path</span>
                  <span className="profile-stat-val" style={{ color: "var(--indigo2)", fontSize: 12 }}>Encrypted (FHE)</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-label">Wallet</span>
                  <a href={`${EXPLORER_ADDR}${account}`} target="_blank" rel="noopener noreferrer" className="profile-stat-val" style={{ color: "var(--indigo2)", fontSize: 12 }}>
                    {truncAddr(account)}
                  </a>
                </div>
              </div>
            </div>

            {/* Transaction History Card */}
            <div className="card profile-history-card">
              <div className="tx-history-header">
                <h3 className="card-label" style={{ margin: 0 }}>Transaction History</h3>
                <span className="tx-history-count">{txHistory.length} transactions</span>
              </div>
              {txHistory.length === 0 ? (
                <p style={{ color: "var(--text3)", textAlign: "center", padding: "30px 0" }}>No transactions yet</p>
              ) : (
                <>
                  <div className="profile-tx-list">
                    {pagedHistory.map((tx, i) => (
                      <div key={`${tx.txHash}-${i}`} className={`profile-tx-row tx-${tx.type}`}>
                        <div className="profile-tx-icon">
                          {tx.type === "borrow" ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><polyline points="7 7 12 2 17 7" /><line x1="12" y1="2" x2="12" y2="16" /><path d="M21 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3" /></svg>
                          ) : tx.type === "supply" ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--indigo2)" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                          ) : tx.type === "withdraw" ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><polyline points="7 17 12 22 17 17" /><line x1="12" y1="22" x2="12" y2="8" /><path d="M21 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v3" /></svg>
                          ) : tx.type === "repay" || tx.type === "installment" ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><polyline points="7 17 12 22 17 17" /><line x1="12" y1="22" x2="12" y2="8" /><path d="M21 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v3" /></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          )}
                        </div>
                        <div className="profile-tx-info">
                          <span className="profile-tx-type">
                            {tx.type === "borrow" ? "Loan Approved"
                              : tx.type === "supply" ? "Supplied Liquidity"
                              : tx.type === "withdraw" ? "Withdrew Liquidity"
                              : tx.type === "repay" ? "Fully Repaid"
                              : tx.type === "installment" ? "Installment Payment"
                              : "Loan Denied"}
                          </span>
                          <span className="profile-tx-date">
                            {new Date(tx.timestamp * 1000).toLocaleString()}
                            {tx.type === "installment" && tx.remaining > 0 && (
                              <span style={{ color: "var(--text3)", marginLeft: 6 }}>
                                (${tx.remaining.toFixed(2)} left)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="profile-tx-amount">
                          <span style={{ color: tx.type === "borrow" ? "var(--green)" : tx.type === "supply" ? "var(--indigo2)" : tx.type === "withdraw" ? "#fbbf24" : (tx.type === "repay" || tx.type === "installment") ? "var(--teal)" : "var(--rose)" }}>
                            {tx.type === "denied" ? "Denied" : tx.type === "supply" ? `-${fmtUsd(tx.amount)}` : tx.type === "withdraw" ? `+${fmtUsd(tx.amount)}` : `${tx.type === "borrow" ? "+" : "-"}${fmtUsd(tx.amount)}`}
                          </span>
                        </div>
                        <a href={`${EXPLORER_BASE}${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="profile-tx-link">
                          {truncHash(tx.txHash)}
                        </a>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="tx-history-pagination">
                      <button className="tx-page-btn" disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)}>Prev</button>
                      <span className="tx-page-info">{historyPage + 1} / {totalPages}</span>
                      <button className="tx-page-btn" disabled={historyPage >= totalPages - 1} onClick={() => setHistoryPage((p) => p + 1)}>Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
