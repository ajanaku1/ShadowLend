import React, { useState, useEffect, useCallback, Component } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import contractAddresses from "./contracts.json";
import { USDC_ABI, ORCHESTRATOR_ABI, LENDING_POOL_ABI, VAULT_ABI, FHEVM_CHAIN_ID } from "./config/constants";

// ---------------------------------------------------------------------------
// Error Boundary — prevents blank screen in production
// ---------------------------------------------------------------------------
class SupplyErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Supply page error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32, background: "#010104", color: "#f1eeff" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: "#8e88a8", fontSize: 14, maxWidth: 400, textAlign: "center" }}>
            The Supply page encountered an error. This may be due to network issues with the blockchain RPC.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "10px 24px", borderRadius: 10, background: "#6366f1", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Reload Page
          </button>
          <pre style={{ fontSize: 11, color: "#4c4669", maxWidth: 500, overflow: "auto", marginTop: 8 }}>
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const truncAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";


// ===========================================================================
// Supply
// ===========================================================================
function SupplyInner() {
  // --- wallet ---
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [chainOk, setChainOk] = useState(false);

  // --- deposit ---
  const [depositInput, setDepositInput] = useState("");

  // --- pool stats (live from chain) ---
  const [poolBalance, setPoolBalance] = useState(0);
  const [totalBorrowed, setTotalBorrowed] = useState(0);
  const [loanCount, setLoanCount] = useState(0);
  const [defaultRate] = useState(0); // no defaults on testnet yet
  const [statsLoading, setStatsLoading] = useState(true);

  // --- position (live from vault) ---
  const [deposited, setDeposited] = useState(0);
  const [earnedInterest, setEarnedInterest] = useState(0);
  const [usd3Balance, setUsd3Balance] = useState(0);
  const [userUsdcBalance, setUserUsdcBalance] = useState(0);
  const [withdrawMax, setWithdrawMax] = useState(0);
  const [positionLoading, setPositionLoading] = useState(false);

  // --- withdraw input ---
  const [withdrawInput, setWithdrawInput] = useState("");

  // --- deposit/withdraw/claim status ---
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositStatus, setDepositStatus] = useState(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);

  // --- yield calculator ---
  const [yieldInput, setYieldInput] = useState("10000");
  const [yieldDuration, setYieldDuration] = useState(12);

  // ---------------------------------------------------------------------------
  // Wallet connection
  // ---------------------------------------------------------------------------
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use ShadowLend");
      return;
    }
    try {
      sessionStorage.removeItem("shadowlend_disconnected");
      const bp = new ethers.BrowserProvider(window.ethereum);
      const accounts = await bp.send("eth_requestAccounts", []);
      const s = await bp.getSigner();
      const network = await bp.getNetwork();

      setProvider(bp);
      setSigner(s);
      setAccount(accounts[0]);
      setChainOk(Number(network.chainId) === FHEVM_CHAIN_ID);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainOk(false);
    sessionStorage.setItem("shadowlend_disconnected", "1");
  }, []);

  // Auto-reconnect on mount (unless user explicitly disconnected)
  useEffect(() => {
    if (!window.ethereum) return;
    if (sessionStorage.getItem("shadowlend_disconnected")) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accts) => {
      if (accts.length > 0) connectWallet();
    }).catch(() => {});
  }, [connectWallet]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accts) => {
      if (accts.length === 0) disconnectWallet();
      else setAccount(accts[0]);
    };
    const onChain = () => {
      window.location.reload();
    };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [disconnectWallet]);

  // Switch to Sepolia
  function switchChain() {
    const hexChainId = "0x" + FHEVM_CHAIN_ID.toString(16);
    const addChain = () =>
      window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexChainId,
          chainName: "Sepolia Testnet",
          nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });

    window.ethereum
      .request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] })
      .catch(function () {
        return addChain();
      });
  }

  // ---------------------------------------------------------------------------
  // Fetch live pool stats from chain
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function fetchPoolStats() {
      try {
        const rpc = new ethers.JsonRpcProvider(RPC_URL);
        const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, rpc);
        const orchestrator = new ethers.Contract(contractAddresses.Orchestrator, ORCHESTRATOR_ABI, rpc);

        // Pool USDC balance = available liquidity
        const bal = await usdc.balanceOf(contractAddresses.LendingPool);
        const balNum = parseFloat(ethers.formatUnits(bal, 6));
        setPoolBalance(balNum);

        // Count loan events from deploy block
        const fromBlock = contractAddresses.DeployBlock || 0;
        const approvedFilter = orchestrator.filters.LoanApproved();
        const approvedEvents = await orchestrator.queryFilter(approvedFilter, fromBlock);

        let borrowed = 0;
        for (const ev of approvedEvents) {
          borrowed += parseFloat(ethers.formatUnits(ev.args[1], 6));
        }
        setTotalBorrowed(borrowed);
        setLoanCount(approvedEvents.length);
      } catch (err) {
        console.warn("Failed to fetch pool stats:", err.message);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchPoolStats();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch lender position from vault
  // ---------------------------------------------------------------------------
  const refreshPosition = useCallback(async (addr) => {
    if (!addr || !contractAddresses.Vault) return;
    setPositionLoading(true);
    try {
      const rpc = new ethers.JsonRpcProvider(RPC_URL);
      const vault = new ethers.Contract(contractAddresses.Vault, VAULT_ABI, rpc);
      const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, rpc);

      const shares = await vault.balanceOf(addr);
      const shareFloat = parseFloat(ethers.formatUnits(shares, 6));
      setUsd3Balance(shareFloat);

      if (shares > 0n) {
        const assetsValue = await vault.convertToAssets(shares);
        const assetsFloat = parseFloat(ethers.formatUnits(assetsValue, 6));
        setDeposited(assetsFloat);
        // Earned yield from on-chain cost basis tracking
        const yieldWei = await vault.earnedYield(addr);
        setEarnedInterest(parseFloat(ethers.formatUnits(yieldWei, 6)));
      } else {
        setDeposited(0);
        setEarnedInterest(0);
      }

      const maxW = await vault.maxWithdraw(addr);
      setWithdrawMax(parseFloat(ethers.formatUnits(maxW, 6)));

      const bal = await usdc.balanceOf(addr);
      setUserUsdcBalance(parseFloat(ethers.formatUnits(bal, 6)));
    } catch (err) {
      console.warn("Failed to fetch position:", err.message);
    } finally {
      setPositionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (account) refreshPosition(account);
  }, [account, refreshPosition]);

  // ---------------------------------------------------------------------------
  // Deposit USDC into vault
  // ---------------------------------------------------------------------------
  const doDeposit = async () => {
    if (!signer || depositAmount <= 0) return;
    setDepositLoading(true);
    setDepositStatus({ type: "wait", text: "Approving USDC..." });
    try {
      const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, signer);
      const vault = new ethers.Contract(contractAddresses.Vault, VAULT_ABI, signer);
      const amount = ethers.parseUnits(String(depositAmount), 6);

      const approveTx = await usdc.approve(contractAddresses.Vault, amount);
      await approveTx.wait();

      setDepositStatus({ type: "wait", text: "Depositing into vault..." });
      const depositTx = await vault.deposit(amount, account);
      await depositTx.wait();

      setDepositStatus({ type: "ok", text: `Deposited $${depositAmount.toLocaleString()} USDC! You received USD3 tokens.` });
      setDepositInput("");
      await refreshPosition(account);
      setTimeout(() => setDepositStatus(null), 5000);
    } catch (err) {
      const msg = err.code === "ACTION_REJECTED" ? "Transaction rejected" : (err.reason || err.message || "Deposit failed");
      setDepositStatus({ type: "err", text: msg });
    } finally {
      setDepositLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Withdraw from vault (redeem all shares)
  // ---------------------------------------------------------------------------
  const doWithdraw = async (overrideAmount) => {
    if (!signer || usd3Balance <= 0) return;
    const amt = overrideAmount || Number(withdrawInput);
    if (!amt || amt <= 0) {
      setWithdrawStatus({ type: "err", text: "Enter an amount to withdraw." });
      return;
    }
    const cappedAmt = Math.min(amt, withdrawMax);
    if (cappedAmt <= 0) {
      setWithdrawStatus({ type: "err", text: "No idle liquidity available for withdrawal." });
      return;
    }

    setWithdrawLoading(true);
    setWithdrawStatus({ type: "wait", text: `Withdrawing $${cappedAmt.toFixed(2)} USDC...` });
    try {
      const vault = new ethers.Contract(contractAddresses.Vault, VAULT_ABI, signer);
      const withdrawAmt = ethers.parseUnits(String(Math.floor(cappedAmt * 100) / 100), 6);
      const tx = await vault.withdraw(withdrawAmt, account, account);
      await tx.wait();

      setWithdrawStatus({ type: "ok", text: `Withdrew $${cappedAmt.toFixed(2)} USDC to your wallet.` });
      setWithdrawInput("");
      await refreshPosition(account);
      setTimeout(() => setWithdrawStatus(null), 5000);
    } catch (err) {
      const msg = err.code === "ACTION_REJECTED" ? "Transaction rejected" : (err.reason || err.message || "Withdrawal failed");
      setWithdrawStatus({ type: "err", text: msg });
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Claim only the earned yield (interest) via on-chain claimYield(), keep principal in pool
  const doClaimYield = async () => {
    if (!signer || earnedInterest <= 0.01) return;
    setClaimLoading(true);
    setWithdrawStatus({ type: "wait", text: `Claiming $${earnedInterest.toFixed(2)} yield...` });
    try {
      const vault = new ethers.Contract(contractAddresses.Vault, VAULT_ABI, signer);
      const tx = await vault.claimYield(account);
      await tx.wait();

      setWithdrawStatus({ type: "ok", text: `Claimed $${earnedInterest.toFixed(2)} yield! Principal remains in pool.` });
      await refreshPosition(account);
      setTimeout(() => setWithdrawStatus(null), 5000);
    } catch (err) {
      const msg = err.code === "ACTION_REJECTED" ? "Transaction rejected" : (err.reason || err.message || "Claim failed");
      setWithdrawStatus({ type: "err", text: msg });
    } finally {
      setClaimLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Yield calculator
  // ---------------------------------------------------------------------------
  const yieldAmount = Number(yieldInput) || 0;
  const utilization = (poolBalance + totalBorrowed) > 0
    ? (totalBorrowed / (poolBalance + totalBorrowed)) * 100
    : 0;
  // Base APY scales with utilization: 2% base + up to 6% at high utilization
  const baseAPY = 2 + (utilization / 100) * 6;
  const projectedYield = yieldAmount * (baseAPY / 100) * (yieldDuration / 12);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const walletConnected = !!account;
  const depositAmount = Number(depositInput) || 0;
  const canDeposit = walletConnected && depositAmount > 0;

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <>
      {/* Blobs */}
      <div className="blob-container">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="page">
        {/* Nav */}
        <div className="topnav">
          <div className="tn-brand">
            <Link to="/" className="tn-brand-link">
              <div className="tn-logo">
                <img src="/logo.png" alt="ShadowLend" />
              </div>
              <span className="tn-name">ShadowLend</span>
            </Link>
          </div>
          <div className="tn-sep" />
          <div className="tn-links">
            <Link to="/app" className="tn-link">Borrow</Link>
            <Link to="/app/supply" className="tn-link active">Supply</Link>
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

        {/* Page Header */}
        <section className="app-header">
          <h1 className="app-title">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="1.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            Supply Liquidity
          </h1>
          <p className="app-subtitle">
            Earn yield by funding privacy-preserving credit lines
          </p>
        </section>

        {/* Chain warning */}
        {walletConnected && !chainOk && (
          <div className="chain-warning">
            <span>Wrong network. ShadowLend runs on Sepolia (Zama fhEVM coprocessor).</span>
            <button className="chain-switch-btn" onClick={switchChain}>
              Switch to Sepolia
            </button>
          </div>
        )}

        {/* Pool Stats — live from chain */}
        <section className="main-section" style={{ paddingBottom: 0 }}>
          <div className="pool-stats-row">
            <div className="pool-stat-card">
              <div className="pool-stat-label">Pool Liquidity</div>
              <div className="pool-stat-value">
                {statsLoading ? "—" : `$${poolBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </div>
              <div className="pool-stat-sub">Available USDC</div>
            </div>
            <div className="pool-stat-card">
              <div className="pool-stat-label">Total Borrowed</div>
              <div className="pool-stat-value">
                {statsLoading ? "—" : `$${totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </div>
              <div className="pool-stat-sub">{statsLoading ? "" : `${loanCount} loan${loanCount !== 1 ? "s" : ""} issued`}</div>
            </div>
            <div className="pool-stat-card">
              <div className="pool-stat-label">Utilization</div>
              <div className="pool-stat-value">{statsLoading ? "—" : `${utilization.toFixed(1)}%`}</div>
              <div className="pool-stat-bar-wrap">
                <div className="pool-stat-bar" style={{ width: `${Math.min(utilization, 100)}%` }} />
              </div>
            </div>
            <div className="pool-stat-card">
              <div className="pool-stat-label">Base APY</div>
              <div className="pool-stat-value" style={{ color: "var(--green)" }}>
                {statsLoading ? "—" : `${baseAPY.toFixed(1)}%`}
              </div>
              <div className="pool-stat-sub">Dynamic rate</div>
            </div>
            <div className="pool-stat-card">
              <div className="pool-stat-label">Default Rate</div>
              <div className="pool-stat-value" style={{ color: "var(--green)" }}>
                {statsLoading ? "—" : `${defaultRate.toFixed(1)}%`}
              </div>
              <div className="pool-stat-sub">Privacy-preserving</div>
            </div>
          </div>
        </section>

        {/* Deposit + Position Cards */}
        <section className="main-section">
          <div className="card-grid">
            {/* Deposit Card */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Deposit USDC</h2>
                  <p className="card-sub">Fund the lending pool and earn yield</p>
                </div>
                <span className="tag">USDC</span>
              </div>

              <div className="loan-input-section">
                <label className="loan-input-label">Deposit Amount (USDC)</label>
                <div className="loan-input-wrap">
                  <span className="loan-input-prefix">$</span>
                  <input
                    type="text"
                    className="loan-input"
                    placeholder="0"
                    value={depositInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      setDepositInput(v);
                    }}
                  />
                  <span className="loan-input-suffix">USDC</span>
                </div>
              </div>

              <div className="quick-amounts">
                {[1000, 5000, 10000, 25000].map((amt) => (
                  <button
                    key={amt}
                    className={`qa-btn ${Number(depositInput) === amt ? "picked" : ""}`}
                    onClick={() => setDepositInput(String(amt))}
                  >
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>

              {walletConnected && userUsdcBalance > 0 && (
                <div className="loan-input-hint" style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, fontFamily: "var(--mono)" }}>
                  Balance: ${userUsdcBalance.toFixed(2)} USDC
                </div>
              )}

              <button
                className={`btn-fill ${depositLoading ? "running" : ""}`}
                disabled={!canDeposit || depositLoading}
                onClick={doDeposit}
              >
                <span>
                  {depositLoading
                    ? "Processing..."
                    : !walletConnected
                    ? "Connect Wallet First"
                    : depositAmount > 0
                    ? `Deposit $${depositAmount.toLocaleString()} USDC`
                    : "Enter Amount"}
                </span>
                <div className="bar" />
              </button>

              {depositStatus && (
                <div className={`status show ${depositStatus.type}`} style={{ marginTop: 10 }}>
                  {depositStatus.type === "wait" && <div className="sp" />}
                  {depositStatus.text}
                </div>
              )}

              <div className="supply-note">
                You will receive USD3 tokens representing your share of the lending pool
              </div>
            </div>

            {/* Position Card */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Your Position</h2>
                  <p className="card-sub">Current supply position and earnings</p>
                </div>
                <span className="tag">USD3</span>
              </div>

              <div className="position-rows">
                <div className="rr">
                  <span className="k">Current Value</span>
                  <span className="v">{positionLoading ? "—" : `$${deposited.toFixed(2)}`}</span>
                </div>
                <div className="rr">
                  <span className="k">Earned Interest</span>
                  <span className="v" style={{ color: earnedInterest > 0 ? "var(--green)" : undefined }}>
                    {positionLoading ? "—" : `$${earnedInterest.toFixed(2)}`}
                  </span>
                </div>
                <div className="rr">
                  <span className="k">USD3 Shares</span>
                  <span className="v">{positionLoading ? "—" : usd3Balance.toFixed(2)}</span>
                </div>
                <div className="rr">
                  <span className="k">Withdrawable</span>
                  <span className="v" style={{ fontFamily: "var(--mono)" }}>
                    {positionLoading ? "—" : `$${withdrawMax.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Claim Yield */}
              {earnedInterest > 0.01 && (
                <button
                  className={`btn-fill ${claimLoading ? "running" : ""}`}
                  disabled={claimLoading || withdrawLoading || earnedInterest <= 0.01}
                  onClick={doClaimYield}
                  style={{ marginTop: 4 }}
                >
                  <span>
                    {claimLoading ? "Claiming..." : `Claim $${earnedInterest.toFixed(2)} Yield`}
                  </span>
                  <div className="bar" />
                </button>
              )}

              {/* Flexible Withdraw */}
              <div className="loan-input-section" style={{ marginTop: 12 }}>
                <label className="loan-input-label">Withdraw Amount (USDC)</label>
                <div className="loan-input-wrap">
                  <span className="loan-input-prefix">$</span>
                  <input
                    type="text"
                    className="loan-input"
                    placeholder="0"
                    value={withdrawInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      if (!withdrawLoading) setWithdrawInput(v);
                    }}
                    disabled={withdrawLoading}
                  />
                  <span className="loan-input-suffix">USDC</span>
                </div>
              </div>

              <div className="quick-amounts">
                {withdrawMax > 0 && [0.25, 0.5, 0.75, 1].map((pct) => {
                  const amt = Math.floor(withdrawMax * pct);
                  if (amt <= 0) return null;
                  return (
                    <button
                      key={pct}
                      className={`qa-btn ${Number(withdrawInput) === amt ? "picked" : ""}`}
                      onClick={() => !withdrawLoading && setWithdrawInput(String(amt))}
                    >
                      {pct === 1 ? "Max" : `${pct * 100}%`}
                    </button>
                  );
                })}
              </div>

              <button
                className={`btn-stroke ${withdrawLoading ? "running" : ""}`}
                disabled={usd3Balance === 0 || withdrawLoading || !Number(withdrawInput)}
                onClick={() => doWithdraw()}
              >
                {withdrawLoading
                  ? "Withdrawing..."
                  : Number(withdrawInput) > 0
                  ? `Withdraw $${Number(withdrawInput).toLocaleString()} USDC`
                  : "Enter Amount"}
              </button>

              {withdrawStatus && (
                <div className={`status show ${withdrawStatus.type}`} style={{ marginTop: 10 }}>
                  {withdrawStatus.type === "wait" && <div className="sp" />}
                  {withdrawStatus.text}
                </div>
              )}
            </div>

            {/* Yield Calculator Card */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Yield Calculator</h2>
                  <p className="card-sub">Estimate your earnings from supplying</p>
                </div>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="1.5">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="8" y1="10" x2="10" y2="10" />
                  <line x1="12" y1="10" x2="16" y2="10" />
                  <line x1="8" y1="14" x2="10" y2="14" />
                  <line x1="12" y1="14" x2="16" y2="14" />
                  <line x1="8" y1="18" x2="16" y2="18" />
                </svg>
              </div>

              <div className="loan-input-section">
                <label className="loan-input-label">Supply Amount (USDC)</label>
                <div className="loan-input-wrap">
                  <span className="loan-input-prefix">$</span>
                  <input
                    type="text"
                    className="loan-input"
                    placeholder="10000"
                    value={yieldInput}
                    onChange={(e) => setYieldInput(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </div>
              </div>

              <div className="quick-amounts" style={{ marginBottom: 12 }}>
                {[6, 12, 24, 36].map((m) => (
                  <button
                    key={m}
                    className={`qa-btn ${yieldDuration === m ? "picked" : ""}`}
                    onClick={() => setYieldDuration(m)}
                  >
                    {m}mo
                  </button>
                ))}
              </div>

              <div className="position-rows">
                <div className="rr">
                  <span className="k">Current APY</span>
                  <span className="v" style={{ color: "var(--green)" }}>{baseAPY.toFixed(1)}%</span>
                </div>
                <div className="rr">
                  <span className="k">Duration</span>
                  <span className="v">{yieldDuration} months</span>
                </div>
                <div className="rr" style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
                  <span className="k" style={{ fontWeight: 600 }}>Projected Earnings</span>
                  <span className="v" style={{ color: "var(--green)", fontWeight: 700, fontSize: 18 }}>
                    ${projectedYield.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Pool Health Card */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Pool Health</h2>
                  <p className="card-sub">Anonymized portfolio metrics — no borrower data exposed</p>
                </div>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>

              <div className="position-rows">
                <div className="rr">
                  <span className="k">Default Rate</span>
                  <span className="v" style={{ color: "var(--green)" }}>{defaultRate.toFixed(1)}%</span>
                </div>
                <div className="rr">
                  <span className="k">Loans Outstanding</span>
                  <span className="v">{statsLoading ? "—" : loanCount}</span>
                </div>
                <div className="rr">
                  <span className="k">Pool Utilization</span>
                  <span className="v">{statsLoading ? "—" : `${utilization.toFixed(1)}%`}</span>
                </div>
                <div className="rr">
                  <span className="k">Credit Threshold</span>
                  <span className="v">650+</span>
                </div>
                <div className="rr">
                  <span className="k">Borrower Fee</span>
                  <span className="v">5%</span>
                </div>
              </div>

              <div className="privacy-shield-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Lenders see only aggregate statistics — individual borrower scores and data remain encrypted via FHE
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Float Stats */}
      <div className="float-stats">
        <div className="fs-item">
          <div className="fs-dot g" /> FHE Active
        </div>
        <div className="fs-item">
          TVL <span className="fs-val">
            {statsLoading ? "—" : `$${(poolBalance + totalBorrowed).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          </span>
        </div>
        <div className="fs-item">
          <div className="fs-dot i" /> Loans <span className="fs-val">{statsLoading ? "—" : loanCount}</span>
        </div>
        <div className="fs-item">
          Privacy{" "}
          <span className="fs-val" style={{ color: "var(--green)" }}>100%</span>
        </div>
      </div>

      {/* Supply-specific styles */}
      <style>{`
        .pool-stats-row {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 8px;
        }

        @media (max-width: 900px) {
          .pool-stats-row { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 580px) {
          .pool-stats-row { grid-template-columns: 1fr 1fr; }
        }

        .pool-stat-card {
          padding: 20px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--glass);
          backdrop-filter: blur(12px);
          text-align: center;
          transition: all 0.3s;
        }

        .pool-stat-card:hover {
          border-color: var(--border2);
          transform: translateY(-2px);
        }

        .pool-stat-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .pool-stat-value {
          font-size: 24px;
          font-weight: 800;
          font-family: var(--mono);
          letter-spacing: -0.03em;
        }

        .pool-stat-sub {
          font-size: 10px;
          color: var(--text3);
          margin-top: 4px;
          font-family: var(--mono);
        }

        .pool-stat-bar-wrap {
          margin-top: 8px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.06);
          overflow: hidden;
        }

        .pool-stat-bar {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, var(--indigo), var(--teal));
          transition: width 0.8s ease;
        }

        .position-rows {
          margin-bottom: 8px;
        }

        .supply-note {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--indigo-d);
          border: 1px solid rgba(99, 102, 241, 0.1);
          font-size: 12px;
          color: var(--indigo2);
          line-height: 1.5;
        }

        .privacy-shield-note {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(45, 212, 191, 0.06);
          border: 1px solid rgba(45, 212, 191, 0.12);
          font-size: 11px;
          color: var(--teal);
          line-height: 1.5;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .privacy-shield-note svg {
          flex-shrink: 0;
          margin-top: 1px;
        }
      `}</style>
    </>
  );
}

export default function Supply() {
  return (
    <SupplyErrorBoundary>
      <SupplyInner />
    </SupplyErrorBoundary>
  );
}
