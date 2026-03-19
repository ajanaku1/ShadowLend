// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const AGENT_URL = import.meta.env.VITE_AGENT_URL || "/api";
export const AGENT_KEY = import.meta.env.VITE_AGENT_KEY || "demo-key";
export const FHEVM_CHAIN_ID = 11155111; // Ethereum Sepolia (Zama fhEVM coprocessor)

// Encrypted contract path ABIs (CreditScore + Orchestrator + LendingPool + USDC)
export const ORCHESTRATOR_ABI = [
  "function requestLoan(uint256 amount) external returns (uint256)",
  "function finalizeLoan(uint256 requestId, bool decryptedEligible, bytes decryptionProof) external",
  "function getEligibilityHandle(uint256 requestId) external view returns (bytes32)",
  "function repayLoan(uint256 amount) external",
  "event LoanRequested(address indexed borrower, uint256 amount, uint256 requestId)",
  "event LoanApproved(address indexed borrower, uint256 amount)",
  "event LoanDenied(address indexed borrower, uint256 amount)",
  "event LoanRepaid(address indexed borrower, uint256 amount)",
  "event InstallmentPaid(address indexed borrower, uint256 amount, uint256 remaining)",
];

export const LENDING_POOL_ABI = [
  "function loans(address borrower) external view returns (uint256 amount, uint256 remaining, uint256 totalOwed, uint256 timestamp, bool repaid)",
  "function getEligibilityHandle(uint256 requestId) external view returns (bytes32)",
  "function totalManagedAssets() external view returns (uint256)",
  "function totalOutstandingDebt() external view returns (uint256)",
  "event LoanRequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount)",
];

export const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

export const VAULT_ABI = [
  "function deposit(uint256 assets, address receiver) external returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) external returns (uint256)",
  "function claimYield(address receiver) external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function convertToShares(uint256 assets) external view returns (uint256)",
  "function maxWithdraw(address owner) external view returns (uint256)",
  "function maxRedeem(address owner) external view returns (uint256)",
  "function earnedYield(address lender) external view returns (uint256)",
  "function costBasis(address lender) external view returns (uint256)",
  "function previewDeposit(uint256 assets) external view returns (uint256)",
  "function previewRedeem(uint256 shares) external view returns (uint256)",
  "function asset() external view returns (address)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
  "event YieldClaimed(address indexed lender, uint256 yieldAmount)",
];

export const EXPLORER_BASE = "https://sepolia.etherscan.io/tx/";

export const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILES = 3;

export const FLOW_STEPS = ["Documents", "AI Score", "Encrypt", "Verify", "Release"];
