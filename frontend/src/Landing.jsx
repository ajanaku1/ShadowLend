import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import contractAddresses from "./contracts.json";
import { USDC_ABI, ORCHESTRATOR_ABI } from "./config/constants";

const HX = "0123456789abcdef";
const rh = (n) => {
  let s = "0x";
  for (let i = 0; i < n; i++) s += HX[Math.floor(Math.random() * 16)];
  return s;
};

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2a4 4 0 014 4v2H8V6a4 4 0 014-4z" />
        <rect x="3" y="8" width="18" height="14" rx="2" />
        <circle cx="12" cy="16" r="2" />
      </svg>
    ),
    title: "Fully Encrypted",
    desc: "Your credit score is encrypted with TFHE before touching the blockchain. The raw number never exists on-chain.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    title: "AI-Powered Scoring",
    desc: "Groq AI evaluates 4 financial signals with weighted scoring. Upload documents for verified, trustworthy results.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Homomorphic Verification",
    desc: "Smart contracts check score ≥ 650 on encrypted data. Only a boolean (eligible/not) is ever decrypted.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Zero Data Leakage",
    desc: "No party sees all the data. The borrower, agent, blockchain, and lender each see only what they need.",
  },
];

const STATS = [
  { value: "100%", label: "Privacy", color: "var(--green)" },
  { value: "5", label: "FHE Operations", color: "var(--indigo)" },
  { value: "4", label: "Smart Contracts", color: "var(--teal)" },
  { value: "650", label: "Score Threshold", color: "var(--indigo2)" },
];

const ROADMAP = [
  { phase: "Q2 2026", title: "Bank Connect via Plaid", desc: "Link bank accounts for verified income and spending data — no manual entry.", icon: "bank", status: "next" },
  { phase: "Q3 2026", title: "zkTLS Verification", desc: "Prove financial data from Credit Karma, bank portals, and more using zero-knowledge TLS proofs.", icon: "shield", status: "planned" },
  { phase: "Q4 2026", title: "Revolving Credit Lines", desc: "Draw, repay, and re-draw up to your limit without reapplying. Like a crypto credit card.", icon: "refresh", status: "planned" },
  { phase: "2027", title: "Multi-Chain Deployment", desc: "Deploy ShadowLend pools across Ethereum L2s — Arbitrum, Base, and Polygon.", icon: "globe", status: "planned" },
];

export default function Landing() {
  const [hashes, setHashes] = useState(["0x7a3f", "0x9b2e", "0x4d1c", "0xf8a0"]);

  const [tvl, setTvl] = useState(null);
  const [loanCount, setLoanCount] = useState(null);

  useEffect(() => {
    const iv = setInterval(() => {
      setHashes((prev) => prev.map(() => rh(4)));
    }, 150);
    return () => clearInterval(iv);
  }, []);

  // Fetch live pool stats
  useEffect(() => {
    (async () => {
      try {
        const rpc = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
        const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, rpc);
        const orchestrator = new ethers.Contract(contractAddresses.Orchestrator, ORCHESTRATOR_ABI, rpc);

        const poolBal = await usdc.balanceOf(contractAddresses.LendingPool);
        const balNum = parseFloat(ethers.formatUnits(poolBal, 6));

        const fromBlock = contractAddresses.DeployBlock || 0;
        const approvedEvents = await orchestrator.queryFilter(orchestrator.filters.LoanApproved(), fromBlock);
        let borrowed = 0;
        for (const ev of approvedEvents) {
          borrowed += parseFloat(ethers.formatUnits(ev.args[1], 6));
        }

        setTvl(balNum + borrowed);
        setLoanCount(approvedEvents.length);
      } catch (err) {
        console.warn("Landing stats fetch failed:", err.message);
      }
    })();
  }, []);

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
            <div className="tn-logo">
              <img src="/logo.png" alt="ShadowLend" />
            </div>
            <span className="tn-name">ShadowLend</span>
          </div>
          <div className="tn-sep" />
          <div className="tn-links">
            <button className="tn-link active">Home</button>
            <button className="tn-link" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>How It Works</button>
            <button className="tn-link" onClick={() => document.getElementById("privacy")?.scrollIntoView({ behavior: "smooth" })}>Privacy</button>
          </div>
          <div className="tn-sep" />
          <a href="/app" target="_blank" rel="noopener noreferrer" className="tn-wallet on" style={{ textDecoration: "none" }}>
            <div className="tn-wdot" />
            <span>Launch App</span>
          </a>
        </div>

        {/* Hero */}
        <section className="split-hero">
          <div className="hero-content">
            <div className="hero-chip">
              <div className="pulse-ring" /> Zama FHE Encryption
            </div>
            <h1 className="hero-h1">
              Borrow Without
              <br />
              <span className="glow">Revealing Anything</span>
            </h1>
            <p className="hero-p">
              Your credit score is computed by AI, encrypted with fully
              homomorphic encryption, and verified on-chain — without exposing a
              single byte of your financial data.
            </p>
            <div className="hero-actions">
              <a href="/app" target="_blank" rel="noopener noreferrer" className="ha-primary" style={{ textDecoration: "none", textAlign: "center" }}>
                Launch App
              </a>
              <button className="ha-ghost" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                Learn More
              </button>
            </div>
          </div>

          <div className="hero-viz">
            <div className="orbit-system">
              <div className="orbit-center">
                <img src="/logo.png" alt="ShadowLend" style={{ width: "90%", height: "90%", objectFit: "contain" }} />
              </div>
              <div className="orbit-ring orbit-ring-1">
                <div className="orbit-node node-1">
                  <div className="orbit-dot" />
                  <span className="orbit-label">Smart Contracts</span>
                </div>
              </div>
              <div className="orbit-ring orbit-ring-2">
                <div className="orbit-node node-2">
                  <div className="orbit-dot orbit-dot-2" />
                  <span className="orbit-label">FHE Encryption</span>
                </div>
              </div>
              <div className="orbit-ring orbit-ring-3">
                <div className="orbit-node node-3">
                  <div className="orbit-dot orbit-dot-3" />
                  <span className="orbit-label">AI Scoring</span>
                </div>
              </div>
              <div className="orbit-ring orbit-ring-4">
                <div className="orbit-node node-4">
                  <div className="orbit-dot orbit-dot-4" />
                  <span className="orbit-label">ERC-4626 Vault</span>
                </div>
              </div>
              <div className="orbit-ring orbit-ring-5">
                <div className="orbit-node node-5">
                  <div className="orbit-dot orbit-dot-5" />
                  <span className="orbit-label">Ethereum</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Bar — live + protocol facts */}
        <section className="landing-stats">
          <div className="ls-item">
            <div className="ls-value" style={{ color: "var(--green)" }}>
              {tvl != null ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            </div>
            <div className="ls-label">Total Value Locked</div>
          </div>
          <div className="ls-item">
            <div className="ls-value" style={{ color: "var(--indigo)" }}>
              {loanCount != null ? loanCount : "—"}
            </div>
            <div className="ls-label">Loans Issued</div>
          </div>
          <div className="ls-item">
            <div className="ls-value" style={{ color: "var(--teal)" }}>6</div>
            <div className="ls-label">FHE Operations</div>
          </div>
          <div className="ls-item">
            <div className="ls-value" style={{ color: "var(--indigo2)" }}>5</div>
            <div className="ls-label">Smart Contracts</div>
          </div>
          <div className="ls-item">
            <div className="ls-value" style={{ color: "var(--green)" }}>100%</div>
            <div className="ls-label">Privacy</div>
          </div>
        </section>

        {/* How It Works */}
        <section className="hiw-section" id="how-it-works">
          <div className="hiw-title">How It Works</div>
          <div className="hiw-grid">
            <div className="hiw-card">
              <div className="hiw-num">1</div>
              <svg className="hiw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <div className="hiw-label">Submit Signals</div>
              <div className="hiw-desc">
                Enter income, employment, debt, and payment history. Upload bank statements or invoices as proof. Data is sent only to the AI agent — never stored.
              </div>
              <span className="hiw-arrow">&#x2192;</span>
            </div>
            <div className="hiw-card">
              <div className="hiw-num">2</div>
              <svg className="hiw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a4 4 0 014 4v2H8V6a4 4 0 014-4z" />
                <rect x="3" y="8" width="18" height="14" rx="2" />
                <circle cx="12" cy="16" r="2" />
              </svg>
              <div className="hiw-label">AI Scores & Encrypts</div>
              <div className="hiw-desc">
                Groq AI computes a credit score (300-850) from your signals and documents. The agent encrypts it with TFHE before any chain interaction.
              </div>
              <span className="hiw-arrow">&#x2192;</span>
            </div>
            <div className="hiw-card">
              <div className="hiw-num">3</div>
              <svg className="hiw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="hiw-label">On-Chain Verification</div>
              <div className="hiw-desc">
                The smart contract checks score &ge; 650 homomorphically. The raw score never exists on-chain — only ciphertext.
              </div>
              <span className="hiw-arrow">&#x2192;</span>
            </div>
            <div className="hiw-card">
              <div className="hiw-num">4</div>
              <svg className="hiw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <div className="hiw-label">USDC Released</div>
              <div className="hiw-desc">
                If eligible, USDC is transferred instantly. If denied, only "not eligible" is revealed — never why.
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="landing-features" id="privacy">
          <h2 className="lf-title">Why ShadowLend?</h2>
          <div className="lf-grid">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="lf-card">
                <div className="lf-icon">{icon}</div>
                <h3 className="lf-card-title">{title}</h3>
                <p className="lf-card-desc">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Table */}
        <section className="privacy-section">
          <div className="privacy-card">
            <h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Privacy Guarantee
            </h3>
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Borrower</th>
                  <th>AI Agent</th>
                  <th>Blockchain</th>
                  <th>Lender</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Financial signals</td>
                  <td><span className="ptag yes">Sees</span></td>
                  <td><span className="ptag yes">Sees</span></td>
                  <td><span className="ptag no">Never</span></td>
                  <td><span className="ptag no">Never</span></td>
                </tr>
                <tr>
                  <td>Uploaded documents</td>
                  <td><span className="ptag yes">Owns</span></td>
                  <td><span className="ptag yes">Analyzes</span></td>
                  <td><span className="ptag no">Never</span></td>
                  <td><span className="ptag no">Never</span></td>
                </tr>
                <tr>
                  <td>Raw credit score</td>
                  <td><span className="ptag no">Never</span></td>
                  <td><span className="ptag yes">Ephemeral</span></td>
                  <td><span className="ptag no">Never</span></td>
                  <td><span className="ptag no">Never</span></td>
                </tr>
                <tr>
                  <td>Encrypted score</td>
                  <td><span className="ptag no">No</span></td>
                  <td><span className="ptag enc">Submits</span></td>
                  <td><span className="ptag enc">euint32</span></td>
                  <td><span className="ptag no">No</span></td>
                </tr>
                <tr>
                  <td>Eligibility result</td>
                  <td><span className="ptag yes">Event</span></td>
                  <td><span className="ptag no">No</span></td>
                  <td><span className="ptag enc">ebool &#x2192; bool</span></td>
                  <td><span className="ptag yes">Event</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Roadmap */}
        <section className="rm-section" id="roadmap">
          <div className="rm-title">Roadmap</div>
          <div className="rm-grid">
            {ROADMAP.map(({ phase, title, desc, icon, status }) => (
              <div key={phase} className="rm-card">
                <div className="rm-header">
                  <span className="rm-phase">{phase}</span>
                  <span className={`rm-status ${status === "next" ? "rm-status-next" : "rm-status-planned"}`}>
                    {status === "next" ? "Up Next" : "Planned"}
                  </span>
                </div>
                <div className="rm-icon">
                  {icon === "bank" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
                    </svg>
                  )}
                  {icon === "shield" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                  )}
                  {icon === "refresh" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  )}
                  {icon === "globe" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                  )}
                </div>
                <div className="rm-card-title">{title}</div>
                <div className="rm-desc">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="landing-cta">
          <div className="cta-card">
            <h2>Ready for a Private Credit Line?</h2>
            <p>Connect your wallet, submit your financial data, and get an instant credit line decision — all without revealing your credit score.</p>
            <a href="/app" target="_blank" rel="noopener noreferrer" className="ha-primary" style={{ textDecoration: "none", textAlign: "center", display: "inline-block" }}>
              Launch App
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="lf-left">
            <div className="tn-logo" style={{ width: 20, height: 20 }}>
              <img src="/logo.png" alt="ShadowLend" />
            </div>
            <span style={{ fontSize: 13, color: "var(--text3)" }}>ShadowLend — Built on Zama fhEVM</span>
          </div>
          <div className="lf-right">
            <span style={{ fontSize: 12, color: "var(--text3)" }}>PL Genesis Hackathon 2026</span>
          </div>
        </footer>
      </div>

      {/* Float Stats — live from chain */}
      <div className="float-stats">
        <div className="fs-item">
          <div className="fs-dot g" /> FHE Active
        </div>
        <div className="fs-item">
          TVL <span className="fs-val">
            {tvl != null ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
          </span>
        </div>
        <div className="fs-item">
          <div className="fs-dot i" /> Loans <span className="fs-val">{loanCount != null ? loanCount : "—"}</span>
        </div>
        <div className="fs-item">
          Privacy{" "}
          <span className="fs-val" style={{ color: "var(--green)" }}>100%</span>
        </div>
      </div>
    </>
  );
}
