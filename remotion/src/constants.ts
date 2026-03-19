export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// ShadowLend color palette — exact from index.css
export const C = {
  bg: '#010104',
  surface: '#07071a',
  card: '#0b0b28',
  cardBorder: 'rgba(99,102,241,0.06)',
  cardBorder2: 'rgba(99,102,241,0.14)',
  indigo: '#6366f1',
  indigo2: '#818cf8',
  indigo3: '#c7d2fe',
  indigoGlow: 'rgba(99,102,241,0.3)',
  indigoDark: 'rgba(99,102,241,0.1)',
  teal: '#2dd4bf',
  green: '#4ade80',
  greenDark: 'rgba(74,222,128,0.08)',
  rose: '#fb7185',
  roseDark: 'rgba(251,113,133,0.08)',
  amber: '#fbbf24',
  ink: '#f1eeff',
  inkSoft: '#8e88a8',
  inkMuted: '#4c4669',
  glass: 'rgba(7,7,26,0.75)',
};

// Scene timings — synced to audio durations + 2s
export const SCENES = {
  problem:     { start: 0,   duration: 32 },
  intro:       { start: 32,  duration: 28 },
  connect:     { start: 60,  duration: 18 },
  scoring:     { start: 78,  duration: 30 },
  encryption:  { start: 108, duration: 23 },
  loanRequest: { start: 131, duration: 26 },
  repayment:   { start: 157, duration: 20 },
  supply:      { start: 177, duration: 26 },
  privacy:     { start: 203, duration: 25 },
  closing:     { start: 228, duration: 30 },
};

// Voiceover script. Problem first, then intro hook, then synced to screen recordings.
export const VOICEOVER: Record<string, string> = {
  problem:
    'DeFi lending is broken in two ways. First, every protocol demands overcollateralization. Lock up fifteen hundred dollars just to borrow a thousand. Your capital sits trapped, doing nothing. Second, the few protocols that try credit scoring expose your financial data on chain. Your score, your income, your history, all public. Two problems. No one has solved both. Until now.',
  intro:
    'Meet ShadowLend. The first uncollateralized lending protocol in crypto where your credit score stays completely private. Borrow based on your creditworthiness, not your collateral. And thanks to fully homomorphic encryption, the system verifies your score without ever decrypting it. No one sees your data. Not the lender. Not the blockchain. Nobody.',
  connect:
    'Here is the app. Connect your wallet and you are on the Sepolia test network. The faucet automatically drops one thousand test USDC into your wallet. You can see the balance update right there. Now you are ready to apply.',
  scoring:
    'Four fields. Annual income, employment length, existing debt, missed payments. Upload a bank statement or pay stub as proof. Hit submit. The AI agent, powered by Groq and Llama, reads your document, cross-checks it against your numbers, and scores you. Watch the ring fill up. 738. Eligible. The factor breakdown shows exactly how each signal contributed.',
  encryption:
    'Now look at the encryption panel below the score. That long hex string is your score encrypted with Zama TFHE, fully homomorphic encryption. The green badge says FHE Encrypted. That ciphertext is all the blockchain will ever see. Your actual number, 738, never gets recorded on chain.',
  loanRequest:
    'Credit line is open. 4,600 USDC available. Select an amount, hit borrow. The smart contract checks the encrypted score on chain. If the encrypted value passes the threshold, USDC transfers to your wallet. You can see the loan details update. Borrowed, confirmed, all without revealing your score.',
  repayment:
    'The repayment card shows everything. Original principal, total owed with the five percent fee, remaining balance. Pick a percentage or type a custom amount. Hit repay. Watch the progress bar fill up. Pay it all off and your credit line resets.',
  supply:
    'Now the lender side. The Supply page shows live pool stats, liquidity, utilization, APY. Deposit USDC, you get USD3 vault tokens. Look at the position card, current value, earned interest in green, your shares, and the withdrawable amount. Hit claim yield to take just the profit. Or withdraw everything.',
  privacy:
    'This is the core of ShadowLend. The borrower sees their own data. The AI agent sees the score briefly then forgets it. The blockchain sees only scrambled ciphertext. Lenders see pool totals, nothing about individual borrowers. No single party ever has the full picture. Your financial data stays yours.',
  closing:
    'Five smart contracts. Six FHE operations. AI credit scoring with real document analysis. An ERC4626 yield vault for lenders. All live on Ethereum Sepolia. ShadowLend. Uncollateralized lending with fully private credit scoring. The only protocol where you borrow on creditworthiness and your score is never visible to anyone. Ever.',
};
