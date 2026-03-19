# ShadowLend — Hackathon Submission

## Problem

Undercollateralized lending is inaccessible to many users because traditional credit checks leak sensitive financial data and require centralized intermediaries. Even in DeFi, credit-based lending either exposes borrower data or relies on centralized oracles that can see raw scores.

## Solution

ShadowLend enables **fully private credit verification** using Zama fhEVM. An AI agent (Groq/Llama) computes a credit score off-chain from borrower-submitted financial signals, encrypts it with TFHE, and submits the ciphertext on-chain. The lending contract verifies `score >= 650` **homomorphically** — performing the comparison on encrypted data — and releases USDC only if the condition is met. The raw score is never visible to the contract, lenders, or the frontend.

## Technical Novelty

- **Encrypted threshold comparison** — `FHE.ge(euint32, uint32)` performs the credit check on ciphertext. No party ever sees the raw score on-chain.
- **Self-relaying decryption (v0.9+)** — `FHE.makePubliclyDecryptable()` marks the encrypted boolean for off-chain decryption. The client decrypts via the Zama relayer and submits a KMS-signed proof back on-chain via `FHE.checkSignatures()`. No trusted oracle middleman.
- **AI + FHE pipeline** — Groq API (Llama 3.3-70B) generates credit scores from structured financial signals + document analysis (Llama 4 Scout vision). The score is encrypted via `@zama-fhe/relayer-sdk` and submitted on-chain to Ethereum Sepolia. Novel combination of LLM-based underwriting with homomorphic encryption.
- **Modular orchestration** — Scorer agents can be rotated, policy thresholds updated, and contract addresses swapped without redeployment.
- **Live on Ethereum Sepolia** — All contracts deployed and verified, real FHE coprocessor interaction, real KMS decryption.

## On-Chain Proof (Ethereum Sepolia)

Real FHE transactions on Sepolia, verifiable on Etherscan:

| Operation | Tx Hash | What It Proves |
|-----------|---------|----------------|
| **submitScore** (FHE.fromExternal) | [0x1b9cc528...](https://sepolia.etherscan.io/tx/0x1b9cc5287f4d64f659e6e0ed56401cb27f10bfc1f276ce5317dfbcef839121c0) | Encrypted credit score submitted on-chain as euint32 ciphertext |
| **submitScore** (FHE.fromExternal) | [0x27f42e53...](https://sepolia.etherscan.io/tx/0x27f42e5328c04d3f1a2debc75cf0abae3196a74c5a57dbb66e69aeb994f98e8e) | Second encrypted score submission |
| **requestLoan** (FHE.ge + makePubliclyDecryptable) | [0xad935550...](https://sepolia.etherscan.io/tx/0xad93555036d311291ea6fd74f4b96468d977f49447aacae0de19898a849993df) | Homomorphic comparison on encrypted score, eligibility marked for decryption |
| **requestLoan** | [0x07a2d9a8...](https://sepolia.etherscan.io/tx/0x07a2d9a8c7cf581cffc0cab19c4795eb13e0e3e76d235f4c17a6facfdd27aeed) | Second loan request with FHE threshold check |
| **repayLoan** | [0xc520b201...](https://sepolia.etherscan.io/tx/0xc520b20180423defe8901827f40acac851dfc56177e1c5f5cb22f4cbdb7dda14) | Borrower repayment with 5% fee |

View all contract activity:
- [CreditScore contract](https://sepolia.etherscan.io/address/0x7384b26858aCbC14d2aD2473b0Ab7568d1114653)
- [Orchestrator contract](https://sepolia.etherscan.io/address/0xf4E09ce9caA06E18f28f6faF033d9b8af54B8675)
- [LendingPool contract](https://sepolia.etherscan.io/address/0x16cF583dFA5F7C06015f028F04596A46636dD00f)
- [Vault (USD3) contract](https://sepolia.etherscan.io/address/0xdA4e83bC9046498F6Fe13Ea9C21DAB664D337e2e)

## Technical Metrics

| Metric | Value |
|--------|-------|
| Solidity contracts | 5 (CreditScore, LendingPool, Orchestrator, Ledger, MockUSDC) |
| Lines of Solidity | 538 |
| Distinct `FHE.*` operations | 6 (`fromExternal`, `ge`, `allowThis`, `makePubliclyDecryptable`, `toBytes32`, `checkSignatures`) |
| Total FHE operations per loan cycle | 7 (encrypt → verify → store → compare → mark decryptable → KMS decrypt → verify proof) |
| Encrypted state variables | 2 (`mapping(address => euint32)` scores, `ebool` eligibility per request) |
| FHE-specific functions | 6 (`submitScore`, `getEncryptedScore`, `scoreAboveThreshold`, `requestLoanFor`, `finalizeLoan`, `getEligibilityHandle`) |
| Network | Ethereum Sepolia (live, verified on-chain) |
| Frontend | 4 pages (Landing, App, Profile, Supply) + 5 components + 3 utility modules — 3,245 LOC |
| Agent server | Express.js scoring + encryption + faucet — 504 LOC |
| AI scoring signals | 4 weighted factors (payment history 35%, DTI 30%, income 20%, employment 15%) |

### Gas Estimates (fhEVM devnet)

| Operation | Estimated Gas |
|-----------|--------------|
| `submitScore` (FHE.fromExternal + allowThis) | ~200k–300k |
| `requestLoanFor` (FHE.ge + makePubliclyDecryptable) | ~300k–500k |
| `finalizeLoan` (FHE.checkSignatures + USDC transfer) | ~100k–150k |
| `repayLoan` (USDC transferFrom) | ~80k–120k |

> Gas costs are higher than standard EVM due to FHE computation overhead. `TFHE.ge()` is the most expensive operation — it performs a homomorphic comparison on 32-bit encrypted integers.

## What We Built

| Component | Status | Details |
|-----------|--------|---------|
| Smart contracts (5) | Complete | CreditScore, LendingPool, Orchestrator, Ledger, MockUSDC — all compile and deploy |
| AI scoring agent | Complete | Express server, Groq API (Llama 3.3-70B), fhevmjs encryption, on-chain submission |
| React frontend | Complete | Real wallet connection, agent API calls, contract interactions, event listeners |
| Test suite | 56 tests (24 unit + 32 integration) | Deployment, access control, lifecycle, fees, upgrades, FHE integration |
| Demo script | Complete | Full end-to-end: Alice approved, Bob denied, repayment |

## Sponsor Bounty Targeted

**Zama (primary)** — fhEVM confidential smart contracts

FHE operations used (v0.9+ API):
- `FHE.fromExternal()` — verify and convert encrypted input from relayer SDK
- `FHE.ge()` — encrypted greater-than-or-equal comparison (score >= 650)
- `FHE.allowThis()` — grant contract access to ciphertext handle
- `FHE.makePubliclyDecryptable()` — mark encrypted boolean for off-chain decryption
- `FHE.toBytes32()` — convert handle for signature verification
- `FHE.checkSignatures()` — verify KMS-signed decryption proof on-chain
- `ZamaEthereumConfig` — auto-configure Zama coprocessor addresses per chain

### Privacy Guarantees

| Data | Borrower | Agent | Blockchain | Lender |
|------|----------|-------|------------|--------|
| Financial signals | Sees | Sees | Never | Never |
| Raw credit score | Never | Ephemeral | Never | Never |
| Encrypted score | No | Submits | `euint32` ciphertext only | No |
| Eligibility (bool) | Event | No | Decrypted by Gateway oracle | Event |
| Loan amount | Yes | No | Public | Yes |

## Competitive Landscape

| | ShadowLend | Spectral | Maple Finance | Goldfinch | Credora |
|---|---|---|---|---|---|
| **Score privacy** | FHE — score never decrypted on-chain | Plaintext on-chain (MACRO score) | N/A (manual review) | N/A (off-chain auditors) | Centralized score, shared with lenders |
| **Verification** | Homomorphic comparison (`FHE.ge`) — only boolean revealed | Public smart contract read | Trust-based delegate model | Off-chain backers vouch | API-gated, lender sees rating |
| **Collateral model** | Undercollateralized (credit-based) | Overcollateralized + credit boost | Undercollateralized (institutional) | Undercollateralized (pooled) | Overcollateralized + credit line |
| **Scoring method** | AI (Llama 3.3-70B) + document vision analysis | On-chain transaction history | Manual underwriting by pool delegates | Off-chain auditor review | Proprietary algorithm on financials |
| **Data exposure** | Zero — no party sees all data | Full score visible on-chain | Borrower financials shared with delegates | Shared with auditors/backers | Shared with Credora + lenders |
| **Decentralization** | Self-relaying decryption, no oracle middleman | On-chain but centralized scoring | Delegate-controlled pools | Backer-governed | Fully centralized |

**ShadowLend's edge:** The only protocol where the credit score is *never* visible to any on-chain participant — not the contract, not the lender, not even the borrower. Every competitor either exposes the score on-chain or shares it with trusted intermediaries.

## Adversarial Robustness & Fraud Prevention

### Current Safeguards

| Threat | Mitigation |
|--------|-----------|
| **Fake/inflated self-reported data** | AI agent cross-references uploaded documents against stated financials. Contradictions (e.g. claimed $100k income, pay stub shows $30k) trigger heavy score penalties. |
| **Irrelevant document uploads** | Llama 4 Scout vision classifies documents — non-financial uploads (memes, random images) are flagged and treated as zero verification, lowering the score. |
| **No documents submitted** | Unverified claims receive a moderate penalty — the agent scores conservatively without supporting evidence. |
| **Score manipulation at agent level** | Agent never returns the raw score to the borrower or frontend. Score is encrypted (TFHE) before leaving the agent and submitted directly on-chain. |
| **On-chain score tampering** | CreditScore contract is role-gated (`SCORER_ROLE`). Only authorized scorer wallets can submit. Encrypted score is immutable once stored. |
| **Replay/forged decryption proofs** | `FHE.checkSignatures()` verifies KMS-signed proofs on-chain. Invalid or replayed proofs revert. |
| **Sybil attacks (multiple wallets)** | One-time faucet per address. Scoring is per-wallet with on-chain history. |

### Planned Hardening (Roadmap)

- **zkTLS verification (Q3 2026)** — Prove financial data directly from bank portals and Credit Karma via zero-knowledge TLS proofs, eliminating self-reported data entirely
- **Plaid bank connect (Q4 2026)** — Verified income and spending data from linked bank accounts
- **Multi-signal on-chain reputation** — Cross-reference DeFi participation, transaction history, and DAO contributions as additional encrypted scoring factors
- **Rate limiting & cooldowns** — Throttle re-scoring attempts to prevent brute-force signal optimization
- **Agent rotation & multi-agent consensus** — Multiple independent scoring agents must agree before score submission, preventing single-agent compromise

## Risk Model & Default Economics

Undercollateralized lending carries credit risk. ShadowLend's fee structure and scoring model are designed to keep the pool solvent across realistic default scenarios.

### Fee Structure

| Parameter | Value |
|-----------|-------|
| Origination fee | 5% of borrowed amount (500 basis points) |
| Interest rate | 2%-8% APR (dynamic, inversely proportional to score) |
| Score threshold | 650 minimum (filters bottom ~30% of applicants) |
| Max borrow per wallet | $1,000 (score 650) to $10,000 (score 850) |

### Default Scenario Analysis

Assumptions: 100 borrowers, average loan $4,000, average score 720.

| Scenario | Default Rate | Pool Loss | Fee Revenue (5%) | Net Pool Impact |
|----------|-------------|-----------|-------------------|-----------------|
| Optimistic | 3% | $12,000 | $20,000 | +$8,000 |
| Baseline | 7% | $28,000 | $20,000 + $8,400 APR | +$400 |
| Stress | 12% | $48,000 | $20,000 + $14,400 APR | -$13,600 |

### How the Scoring Model Mitigates Risk

1. **AI cross-referencing reduces fraud.** The Groq agent compares stated income against uploaded documents. Contradictions trigger score penalties of up to -200 points, pushing fraudulent applicants below the 650 threshold.
2. **Higher-risk borrowers pay more.** A borrower scoring 650 pays 8% APR and can only borrow $1,000. A borrower scoring 850 pays 2% APR but borrows up to $10,000. The fee curve concentrates revenue on riskier loans.
3. **Threshold filtering removes the tail.** The 650 cutoff eliminates the highest-default cohort before they ever reach the pool.
4. **Pool diversification.** Lenders deposit into a shared ERC4626 vault. Individual defaults are absorbed by the pool, not by a single lender. Lenders see only aggregate utilization and APY.

### Planned Risk Enhancements

- **Dynamic threshold adjustment** based on pool utilization (raise threshold when utilization > 80%)
- **Per-wallet borrow cooldowns** to prevent rapid re-borrowing after repayment
- **On-chain reputation multiplier** using DeFi history as an additional encrypted signal
- **Insurance reserve** from a percentage of fees, held in the vault as a first-loss buffer

## GTM Plan

1. **Web3 payroll integration** — Partner with payroll platforms to offer private credit lines to DAO contributors, using on-chain payment history as encrypted input signals
2. **Multi-signal risk models** — Extend the agent to consume on-chain reputation, transaction history, and DeFi participation as additional encrypted scoring factors
3. **Institutional lending pools** — Allow lenders to fund pools without seeing individual borrower data — only aggregate default rates
