# ShadowLend: Private Credit Scoring for DeFi Lending

Undercollateralized lending where your credit score stays fully encrypted on-chain. Powered by Zama fhEVM and Groq AI.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Zama fhEVM](https://img.shields.io/badge/Zama-fhEVM_v0.9+-6366f1)](https://www.zama.org/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3--70B-f55036)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-56_passing-brightgreen)]()

<!-- TODO: Add screenshot -->
<!-- ![Hero](docs/images/landing.png) -->

---

## What Is ShadowLend?

ShadowLend lets borrowers get loans based on creditworthiness, not collateral. An AI agent scores your financial data off-chain, encrypts the score with fully homomorphic encryption (TFHE), and submits it on-chain. The smart contract verifies `score >= 650` without ever decrypting it. No one sees your score. Not the lender, not the blockchain, not the UI.

---

## Features

- **Fully private credit scoring.** Your score is encrypted with Zama TFHE before it touches the chain. The contract performs `FHE.ge()` on ciphertext.
- **AI-powered underwriting.** Groq Llama 3.3-70B analyzes financial signals and uploaded documents (bank statements, pay stubs) via Llama 4 Scout vision.
- **Zero-knowledge eligibility.** The blockchain sees only an encrypted boolean. Lenders see approved/denied, never the score.
- **Self-relaying decryption.** No oracle middleman. `FHE.makePubliclyDecryptable()` + KMS-signed proofs via `FHE.checkSignatures()`.
- **ERC4626 yield vault.** Lenders deposit USDC, receive USD3 vault tokens, earn yield from borrower repayments.
- **Document fraud detection.** AI cross-references uploaded docs against stated financials. Inconsistencies penalize the score.
- **Modular orchestration.** Scorer agents, thresholds, and contract addresses are hot-swappable without redeployment.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Confidential contracts | Zama fhEVM v0.9+ on Ethereum Sepolia |
| AI credit scoring | Groq API (Llama 3.3-70B + Llama 4 Scout vision) |
| Encryption SDK | @zama-fhe/relayer-sdk (TFHE 32-bit encryption) |
| Frontend | React 18 + Vite + Tailwind CSS + ethers.js v6 |
| Vault | ERC4626 (ShadowLend USD3) |
| Token | MockUSDC (ERC20, 6 decimals) |

---

## Smart Contracts (Ethereum Sepolia)

| Contract | Address | Purpose | FHE Operations |
|----------|---------|---------|----------------|
| CreditScore | `0x...` | Encrypted score storage + threshold check | `fromExternal`, `ge`, `allowThis`, `allow` |
| LendingPool | `0x16cF...D00f` | Loan lifecycle, decryption marking, proof verification | `makePubliclyDecryptable`, `checkSignatures`, `toBytes32` |
| Orchestrator | `0xf4E0...7e2e` | Coordinates contracts, manages scorer roles | None (coordinator) |
| ShadowLendVault (USD3) | `0xdA4e...37e2e` | ERC4626 yield vault for lenders | None |
| MockUSDC | `0x1123...B3a6` | Test USDC token | None |

---

## Architecture

```
Borrower (Browser)          Agent Server            Ethereum Sepolia (Zama fhEVM)
                                 |
  1. Fill form + upload docs     |
  2. Connect wallet              |
        |                        |
        |-- POST /score -------->|
        |   (signals + docs)     |
        |                   3. Groq API (Llama 3.3-70B)
        |                   4. Vision analysis (Llama 4 Scout)
        |                   5. Score 300-850
        |                   6. Encrypt via relayer SDK (TFHE)
        |                        |
        |                        |-- submitScore() ----------> CreditScore.sol
        |                        |   (encrypted euint32)        FHE.fromExternal()
        |<-- { txHash } --------|
        |                        |
  7. requestLoan() ----------------------------------> Orchestrator -> LendingPool
        |                                               FHE.ge(score, 650)
        |                                               FHE.makePubliclyDecryptable()
        |
  8. publicDecrypt() <-- Zama KMS --------------------|
        |  (decrypts boolean, returns proof)
        |
  9. finalizeLoan(proof) ---------------------------> FHE.checkSignatures()
        |                                               if true: USDC transfer
        |<-- LoanApproved event -----------------------|
        |
 10. repayLoan() ----------------------------------> principal + 5% fee
```

---

## Privacy Model

| Data | Borrower | Agent | Blockchain | Lender |
|------|----------|-------|------------|--------|
| Financial signals | Sees | Sees | Never | Never |
| Raw credit score | Never | Ephemeral | Never | Never |
| Encrypted score | No | Submits it | euint32 ciphertext | No |
| Eligibility (bool) | Event result | No | Encrypted -> decrypted by KMS | Event result |
| Loan amount | Yes | No | Public | Yes |

No single party ever has the full picture. Your financial data stays yours.

---

## Testing the App

### As a Borrower

1. Connect a MetaMask wallet on Sepolia testnet.
2. The faucet drops 1,000 test USDC into your wallet automatically.
3. Fill in financial signals: annual income, employment length, existing debt, missed payments.
4. Upload 1-3 supporting documents (bank statement, pay stub, tax form).
5. Submit. The AI agent scores you, encrypts the result, and submits it on-chain.
6. If eligible (score >= 650), select a borrow amount and click Borrow.
7. The smart contract checks the encrypted score, verifies the KMS proof, and transfers USDC.
8. Repay anytime with a 5% fee.

### As a Lender

1. Navigate to the Supply page.
2. Deposit USDC to receive USD3 vault tokens.
3. Watch your position grow as borrowers repay with fees.
4. Claim yield (profit only) or withdraw everything.

---

## Running Locally

```bash
git clone https://github.com/ajanaku1/ShadowLend.git
cd ShadowLend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in: GROQ_API_KEY, SCORER_PRIVATE_KEY, CREDIT_SCORE_ADDRESS

# Start agent server (port 8080)
npm run agent

# Start frontend (port 5173, proxies /api to agent)
npm run dev:frontend
```

---

## Project Structure

```
ShadowLend/
  contracts/              # Solidity smart contracts
    CreditScore.sol       #   Encrypted score storage + FHE threshold
    LendingPool.sol       #   Loan lifecycle + proof verification
    ShadowLendOrchestrator.sol  # Contract coordinator
    ShadowLendVault.sol   #   ERC4626 lender vault (USD3)
    MockUSDC.sol          #   Test token
  agent/
    server.js             # Express API: scoring, encryption, faucet
  frontend/
    src/
      App.jsx             #   Main app shell + wallet connection
      Landing.jsx         #   Marketing homepage
      Profile.jsx         #   Borrower dashboard
      Supply.jsx          #   Lender vault interface
      components/         #   BorrowerForm, LoanCard, RepayCard, Navbar
      config/             #   Constants, contract addresses, ABIs
  test/                   # 56+ tests (unit + integration + vault)
  scripts/
    deploy.js             # Sepolia deployment script
    demo.js               # End-to-end demo (Alice approved, Bob denied)
  remotion/               # Demo video generation
```

---

## License

MIT
