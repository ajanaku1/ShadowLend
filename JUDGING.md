# ShadowLend: Hackathon Submission

**Sponsor Bounty: [Zama](https://www.zama.org/) fhEVM** | Live on Ethereum Sepolia | [Demo](https://shadowlend-cyan.vercel.app)

## Problem

Undercollateralized lending is hard to do privately. Traditional credit checks expose sensitive financial data to intermediaries. In DeFi, credit-based lending either puts the score on-chain in plaintext or relies on a centralized oracle that can see it. Neither is acceptable for a privacy-first protocol.

## Solution

ShadowLend lets borrowers get loans based on creditworthiness without exposing the score to anyone. An AI agent (Groq/Llama) scores financial signals off-chain, encrypts the result with TFHE, and submits the ciphertext on-chain. The lending contract checks `score >= 650` using `FHE.ge()`: the comparison runs on encrypted data. Loan terms (max borrow, interest rate) are computed with FHE arithmetic on the same ciphertext. No party ever sees the raw score.

## What's new since the original submission

The original submission proved the core idea: encrypt a score, check it homomorphically, release USDC. This version goes further on FHE depth, scoring robustness, and the compliance angle.

**FHE-computed loan terms.** Max borrow and interest rate are no longer hardcoded. They're computed inside the FHE coprocessor using `FHE.add`, `FHE.mul`, `FHE.sub`, `FHE.min`, and `FHE.max` on the encrypted score. Score 650 maps to $1,000 at 8% APR. Score 850 maps to $10,000 at 2% APR. The borrower never sees the intermediate values, only the finalized loan after KMS-signed proof verification.

**On-chain reputation flywheel.** Every time a borrower fully repays, `incrementRepaymentCount` is called on the CreditScore contract. That plaintext counter feeds back into the next loan cycle via `FHE.add(encryptedScore, bonus)`, boosting the effective score by +25 points per repayment, capped at 850. Repaying builds credit. The count is visible on-chain; the score it affects stays encrypted.

**Richer scoring signals.** The agent now fetches four on-chain signals directly from the chain (wallet age, ETH balance tier, DeFi interaction count, ShadowLend repayment history) and weights them at 40% of the total score alongside the self-reported 60%. These can't be faked. Self-reported data goes through AI document cross-verification; contradictions penalize the score.

**Fraud pre-filter.** Before scoring, the agent checks OFAC sanctions, active outstanding loans, and wallet age. Wallets under 30 days old are capped at 550 regardless of what the AI returns. This happens before any on-chain interaction.

**Selective regulatory disclosure.** The encrypted score is inaccessible by default, even to the contract owner. A 2-of-3 compliance committee must independently call `requestComplianceDecryption(borrower)` before `FHE.allow` grants decrypt access to the designated compliance officer. Committee members are elected by DAO multisig (Gnosis Safe) with a 30-day timelock on any membership change. That window makes collusion attempts visible on-chain before they take effect. The borrower can't block a legitimate vote. The protocol can't trigger one alone.

**AI chat assistant.** A Groq-backed chat widget (Llama 3.3-70B) lives in the app and answers questions about scores, loan terms, and FHE. It reads the user's current score, eligibility, and loan balance when a wallet is connected, so answers are specific rather than generic.

## Technical novelty

**Encrypted threshold check.** `FHE.ge(euint32, uint32)` performs the credit check on ciphertext. No party sees the raw score on-chain.

**FHE loan term arithmetic.** Nine FHE operations per loan cycle compute max borrow and interest rate entirely in encrypted space before the borrower sees any result:
```
effectiveScore = FHE.min(FHE.add(base, repaymentBonus), MAX_SCORE)
safeScore      = FHE.max(effectiveScore, MIN_SCORE)          // underflow guard
maxLoan        = FHE.min(FHE.add(FHE.mul(FHE.sub(safeScore, 300), 16), 1000), 10000)
rateBps        = FHE.add(FHE.mul(FHE.sub(MAX_SCORE, safeScore), 3), 200)
```

**Self-relaying decryption (v0.9+).** `FHE.makePubliclyDecryptable()` marks ciphertexts for KMS decryption. The client submits KMS-signed proofs back on-chain via `FHE.checkSignatures()`. Three separate proof verifications happen per loan finalization (eligibility, max loan, rate). No trusted oracle.

**Repayment-to-reputation loop.** Plaintext `repaymentCount` feeds `FHE.add` inside the next loan's encrypted computation. On-chain behavior improves future loan terms without ever revealing the score.

**2-of-3 compliance gate.** `FHE.allow(score, complianceOfficer)` is only called when `_complianceSigCount[borrower] == 2`. The committee is DAO-governed, not admin-appointed. Membership changes require a 30-day timelock.

**AI + FHE pipeline.** Groq Llama 3.3-70B scores financial signals. Llama 4 Scout vision analyzes uploaded documents and cross-checks them against stated figures. The score is encrypted via `@zama-fhe/relayer-sdk` before leaving the agent. No raw score ever touches the frontend or blockchain.

## On-chain proof (Ethereum Sepolia)

| Operation | Tx hash | What it proves |
|-----------|---------|----------------|
| **submitScore** (FHE.fromExternal) | [0x1b9cc528...](https://sepolia.etherscan.io/tx/0x1b9cc5287f4d64f659e6e0ed56401cb27f10bfc1f276ce5317dfbcef839121c0) | Encrypted credit score submitted as euint32 ciphertext |
| **submitScore** (FHE.fromExternal) | [0x27f42e53...](https://sepolia.etherscan.io/tx/0x27f42e5328c04d3f1a2debc75cf0abae3196a74c5a57dbb66e69aeb994f98e8e) | Second encrypted score submission |
| **requestLoan** (FHE.ge + makePubliclyDecryptable) | [0xad935550...](https://sepolia.etherscan.io/tx/0xad93555036d311291ea6fd74f4b96468d977f49447aacae0de19898a849993df) | Homomorphic comparison + eligibility marked for decryption |
| **requestLoan** | [0x07a2d9a8...](https://sepolia.etherscan.io/tx/0x07a2d9a8c7cf581cffc0cab19c4795eb13e0e3e76d235f4c17a6facfdd27aeed) | Second loan request with FHE threshold check |
| **repayLoan** | [0xc520b201...](https://sepolia.etherscan.io/tx/0xc520b20180423defe8901827f40acac851dfc56177e1c5f5cb22f4cbdb7dda14) | Repayment with FHE-computed fee |

Current contracts (block 10,776,045):
- [CreditScore](https://sepolia.etherscan.io/address/0xA81619b5d6460EEf3b9BAC0928F131bbE8d610AA)
- [Orchestrator](https://sepolia.etherscan.io/address/0x2411B413617c515Ff8aB4bFF73D7BAF3Ef46BEAf)
- [LendingPool](https://sepolia.etherscan.io/address/0xA296833b01C704EdAd3078CD772d0F29855d9Fc3)
- [Vault (USD3)](https://sepolia.etherscan.io/address/0xe59ADc5a116c519dA0D9C6E912c595e06B3e1F4c)

### Note on contract redeployment

The five proof transactions above hit an earlier Orchestrator (`0xf4e09...8675`, starting at block 10,457,578). That deployment used a 3-argument `finalizeLoan` signature. After adding FHE-computed loan terms (the `decryptedMaxLoan` and `decryptedRateBps` outputs), the function signature changed to five arguments, requiring a redeploy.

The redeployment did not wipe user history. The frontend queries both contract generations in parallel using `LegacyOrchestrators` in `contracts.json`, so transactions from the original deployment still appear in the Profile page. On-chain activity from the proof transactions is visible at the original Orchestrator address.

The proof transactions are valid: they demonstrate FHE score submission, encrypted threshold comparison, and loan finalization on Sepolia. The current deployment adds FHE loan term arithmetic on top of the same core flow.

## Technical metrics

| Metric | Value |
|--------|-------|
| Solidity contracts | 5 (CreditScore, LendingPool, Orchestrator, Vault, MockUSDC) |
| Lines of Solidity | ~600 |
| Distinct `FHE.*` operations | 11 (`fromExternal`, `ge`, `add`, `mul`, `sub`, `min`, `max`, `asEuint32`, `allowThis`, `makePubliclyDecryptable`, `toBytes32`, `checkSignatures`) |
| FHE operations per loan cycle | 12 (encrypt → submit → ge check → 9 loan term ops → 3x KMS proof verify) |
| Encrypted state variables | 2 (`mapping(address => euint32)` scores, `ebool` eligibility per request) |
| Network | Ethereum Sepolia (live, verified on-chain) |
| Frontend | 5 pages + 6 components + 3 utility modules |
| Agent server | Express.js (scoring, encryption, faucet, chat) |
| AI scoring signals | 4 on-chain (40%) + 4 self-reported (60%) |

### Gas estimates (fhEVM devnet)

| Operation | Estimated gas |
|-----------|--------------|
| `submitScore` (FHE.fromExternal + allowThis) | ~200k–300k |
| `requestLoanFor` (FHE.ge + 9 FHE ops + 3x makePubliclyDecryptable) | ~600k–900k |
| `finalizeLoan` (3x FHE.checkSignatures + USDC transfer) | ~200k–300k |
| `repayLoan` (USDC transferFrom + incrementRepaymentCount) | ~80k–120k |

Gas is higher than standard EVM because FHE arithmetic runs through the coprocessor. Each `FHE.mul` and `FHE.sub` on 32-bit encrypted integers adds meaningful overhead. That's the tradeoff for doing it on-chain without revealing the values.

## What we built

| Component | Status | Details |
|-----------|--------|---------|
| Smart contracts (5) | Complete | All compile and deploy. CreditScore has full FHE arithmetic + compliance gate. |
| AI scoring agent | Complete | Groq Llama 3.3-70B + Llama 4 Scout vision + on-chain signal fetch + OFAC filter |
| React frontend | Complete | Wallet connection, borrowing, repayment, supply, profile, compliance panel, chat widget |
| Test suite | 53 passing, 2 pending | Deployment, access control, lifecycle, fees, upgrades. 2 fhEVM devnet tests skipped on Hardhat local (require live coprocessor). |
| Demo script | Complete | End-to-end: Alice approved, Bob denied, repayment |

## Sponsor bounty

**Zama (primary):** fhEVM confidential smart contracts

FHE operations used (v0.9+ API):
- `FHE.fromExternal()`: verify and convert encrypted input from relayer SDK
- `FHE.ge()`: encrypted comparison (score >= 650)
- `FHE.add()`: repayment bonus application, loan floor, rate intercept
- `FHE.mul()`: loan-per-point scaling, rate-per-point scaling
- `FHE.sub()`: score delta calculation, rate deficit calculation
- `FHE.min()`: cap loan at max, cap effective score at 850
- `FHE.max()`: guard against FHE.sub underflow (score floor at 300)
- `FHE.asEuint32()`: plaintext-to-encrypted conversion for constants
- `FHE.allowThis()`: grant contract access to ciphertext handles
- `FHE.allow()`: grant compliance officer access after 2-of-3 vote
- `FHE.makePubliclyDecryptable()`: mark ciphertexts for KMS decryption
- `FHE.toBytes32()`: convert handles for signature verification
- `FHE.checkSignatures()`: verify KMS-signed decryption proofs on-chain
- `ZamaEthereumConfig`: auto-configure coprocessor addresses per chain

## Privacy guarantees

| Data | Borrower | Agent | Blockchain | Lender |
|------|----------|-------|------------|--------|
| Financial signals | Sees | Sees | Never | Never |
| Raw credit score | Never | Ephemeral | Never | Never |
| Encrypted score | No | Submits | `euint32` ciphertext only | No |
| Loan terms (amount, rate) | Final result only | No | Computed in FHE | No |
| Eligibility (bool) | Event result | No | Decrypted by Gateway | Event result |
| Loan amount | Yes | No | Public | Yes |

## Compliance model

Encrypted scores are inaccessible by default. The compliance system satisfies legitimate regulatory obligations without a permanent backdoor.

When a regulator needs to investigate a borrower, two of the three committee members must independently submit an on-chain vote (`requestComplianceDecryption`). Only after the second vote does the contract call `FHE.allow(score, complianceOfficer)`.

Committee governance:
- Members are elected by DAO multisig (Gnosis Safe)
- Membership changes require a 30-day timelock
- Any swap attempt is visible on-chain for 30 days before it takes effect
- Every vote emits `ComplianceSignatureAdded`
- Access grants emit `ComplianceAccessGranted`

The borrower can't block a legitimate vote. The protocol admin can't trigger one alone. The third committee member's vote has no effect (the `== 2` check ensures `FHE.allow` fires exactly once). The compliance officer gets decrypt access: not the committee members, not the public.

## Adversarial robustness

| Threat | Mitigation |
|--------|-----------|
| Fake/inflated self-reported data | AI cross-references uploaded documents against stated figures. A claimed $100k income with a $30k pay stub triggers a heavy penalty. |
| Irrelevant document uploads | Llama 4 Scout classifies documents. Non-financial uploads are treated as zero verification. |
| No documents submitted | Unverified claims receive a moderate penalty. The agent scores conservatively. |
| Score manipulation at agent level | The agent never returns the raw score to the browser. It's encrypted before leaving the server. |
| OFAC-sanctioned addresses | Blocked before scoring begins. No application processed. |
| Fresh wallet fraud | Wallets under 30 days old are hard-capped at 550, regardless of AI output. |
| On-chain score tampering | CreditScore is role-gated (`SCORER_ROLE`). Only authorized scorer wallets can submit. |
| Replay/forged decryption proofs | `FHE.checkSignatures()` verifies KMS-signed proofs on-chain. Invalid proofs revert. |
| Sybil attacks | One-time faucet per address. Scoring is per-wallet with on-chain repayment history. |
| Compliance committee capture | DAO multisig governance + 30-day timelock. Swap attempts are visible on-chain before they execute. |

## Competitive landscape

| | ShadowLend | Spectral | Maple Finance | Goldfinch | Credora |
|---|---|---|---|---|---|
| **Score privacy** | FHE: score never decrypted on-chain | Plaintext on-chain (MACRO score) | N/A (manual review) | N/A (off-chain auditors) | Centralized, shared with lenders |
| **Loan terms** | Computed in FHE on encrypted score | Fixed tiers, score public | Manual underwriting | Off-chain backers | API-gated |
| **Verification** | `FHE.ge`: only boolean revealed | Public smart contract read | Trust-based delegate model | Off-chain backers vouch | Lender sees rating |
| **Collateral** | Undercollateralized (credit-based) | Overcollateralized + credit boost | Undercollateralized (institutional) | Undercollateralized (pooled) | Overcollateralized + credit line |
| **Regulatory compliance** | 2-of-3 DAO committee + timelock | None | Manual | None | Centralized |
| **Decentralization** | Self-relaying decryption, no oracle | On-chain but centralized scoring | Delegate-controlled pools | Backer-governed | Fully centralized |

ShadowLend is the only protocol where the credit score is never visible to any on-chain participant: not the contract, not the lender, not the borrower. Every competitor either exposes the score on-chain or routes it through a trusted intermediary.

## Risk model

### Fee structure

| Parameter | Value |
|-----------|-------|
| Interest rate | 2%–8% APR (computed in FHE, inversely proportional to score) |
| Score threshold | 650 minimum |
| Max borrow | $1,000 (score 650) to $10,000 (score 850) |

### Default scenario analysis

Assumptions: 100 borrowers, average loan $4,000, average score 720.

| Scenario | Default rate | Pool loss | Fee revenue | Net pool impact |
|----------|-------------|-----------|-------------|-----------------|
| Optimistic | 3% | $12,000 | $20,000 | +$8,000 |
| Baseline | 7% | $28,000 | $28,400 | +$400 |
| Stress | 12% | $48,000 | $34,400 | -$13,600 |

The 650 threshold filters the highest-default cohort before they reach the pool. Higher-risk borrowers pay more and borrow less. The fee curve concentrates revenue where it's needed.

## GTM plan

1. **Web3 payroll integration:** credit lines for DAO contributors using on-chain payment history as encrypted input signals
2. **Multi-signal risk models:** extend the agent to include on-chain reputation, transaction history, and DeFi participation as additional encrypted scoring factors
3. **Institutional lending pools:** lenders fund pools without seeing individual borrower data, only aggregate default rates

## Developer experience

### Running locally

**Prerequisites:** Node.js 20+, a Sepolia RPC URL, a Groq API key.

```bash
git clone https://github.com/Bamijohn/shadowlend
cd shadowlend
npm install
```

Set up environment variables:

```bash
cp agent/.env.example agent/.env
# Fill in: GROQ_API_KEY, SEPOLIA_RPC_URL, SCORER_PRIVATE_KEY
```

Start the scoring agent:

```bash
node agent/server.js
```

Start the frontend (separate terminal):

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Connect MetaMask on Sepolia and the faucet endpoint drops 1,000 test USDC automatically on first visit.

### Running tests

```bash
npx hardhat test
```

53 tests pass against a local Hardhat node with `MockLendingPool` (no FHE dependency). The 2 pending tests require a live fhEVM devnet with a running coprocessor:

```bash
npx hardhat test --network fhevmDevnet
```

### Deploying contracts

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

After deployment, copy the output addresses into `frontend/src/contracts.json` and `agent/.env`. The `LegacyOrchestrators` array in `contracts.json` preserves query coverage across redeployments.

### Project structure

```
contracts/
  CreditScore.sol          FHE score storage + compliance gate
  LendingPool.sol          Liquidity pool + FHE loan term logic
  ShadowLendOrchestrator.sol  UUPS proxy: entry point for all user actions
  ShadowLendVault.sol      ERC4626 vault (USD3 shares)
  mocks/MockLendingPool.sol   Test double (no FHE)

agent/
  server.js                Express scoring server (Groq + TFHE encryption)

frontend/src/
  App.jsx                  Wallet connection + routing
  Profile.jsx              Transaction history (queries current + legacy orchestrators)
  Supply.jsx               ERC4626 deposit/withdraw UI
  config/constants.js      ABI fragments + chain config

test/
  integration.test.js      53 Hardhat tests (mock-based)
  Vault.test.js            ERC4626 vault tests
```

### Adding a scoring signal

The agent scores eight signals. To add a ninth, edit `agent/server.js` in `buildScoringPrompt()`: add the signal name, weight, and fetch logic alongside the existing on-chain lookups. The encrypted output is unaffected; the agent always encrypts the final integer score before any on-chain submission.

### Compliance committee

The compliance committee addresses live in `CreditScore.sol` as `_committeeMembers[0..2]`. To replace a member, call `proposeCommitteeMemberChange(index, newAddress)` via the Gnosis Safe multisig. The change executes after the 30-day timelock expires. Any swap attempt is visible on-chain immediately.
