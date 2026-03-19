// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IMockOrchestrator {
    function onLoanDecision(address borrower, uint256 amount, bool approved) external;
}

/// @title MockLendingPool
/// @notice Test-only version of LendingPool that removes FHE dependency.
///         Uses plain boolean eligibility set by admin instead of encrypted comparison.
contract MockLendingPool is ReentrancyGuard, Pausable {
    struct Loan {
        uint256 amount;
        uint256 remaining;
        uint256 totalOwed;
        uint256 timestamp;
        bool repaid;
    }

    struct PendingRequest {
        address borrower;
        uint256 amount;
        bool eligible;
        uint256 timestamp;
        bool finalized;
    }

    IERC20 public usdc;
    address public orchestrator;
    address public admin;
    address public vault;

    uint32 public creditThreshold = 650;
    uint256 public feeBasisPoints = 500;
    uint256 public totalOutstandingDebt;

    mapping(address => Loan) public loans;
    mapping(uint256 => PendingRequest) private _pendingRequests;
    mapping(address => bool) public eligibility;
    uint256 public nextRequestId;

    event LoanRequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event InstallmentPaid(address indexed borrower, uint256 amount, uint256 remaining);

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "only orchestrator");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    constructor(address usdcAddress, address orchestratorAddress) {
        usdc = IERC20(usdcAddress);
        orchestrator = orchestratorAddress;
        admin = msg.sender;
    }

    // --- Test helpers ---
    function setEligibility(address borrower, bool _eligible) external {
        eligibility[borrower] = _eligible;
    }

    // --- Admin ---
    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    function setOrchestrator(address o) external {
        require(msg.sender == orchestrator || msg.sender == admin, "unauthorized");
        orchestrator = o;
    }

    function setVault(address _vault) external onlyAdmin {
        vault = _vault;
    }

    function setUSDC(address u) external onlyOrchestrator { usdc = IERC20(u); }
    function setCreditScore(address) external onlyOrchestrator {}
    function setCreditThreshold(uint32 t) external onlyOrchestrator { creditThreshold = t; }
    function setFeeBasisPoints(uint256 f) external onlyOrchestrator { feeBasisPoints = f; }

    // --- Vault liquidity management ---

    function depositLiquidity(uint256 amount) external {
        require(msg.sender == vault, "only vault");
        require(usdc.transferFrom(msg.sender, address(this), amount), "transfer failed");
    }

    function withdrawLiquidity(uint256 amount) external {
        require(msg.sender == vault, "only vault");
        require(usdc.balanceOf(address(this)) >= amount, "insufficient idle liquidity");
        require(usdc.transfer(msg.sender, amount), "transfer failed");
    }

    function totalManagedAssets() external view returns (uint256) {
        return usdc.balanceOf(address(this)) + totalOutstandingDebt;
    }

    // --- Loan lifecycle (no FHE) ---

    function requestLoanFor(address borrower, uint256 amount) external onlyOrchestrator whenNotPaused returns (uint256) {
        require(amount > 0, "amount = 0");
        require(usdc.balanceOf(address(this)) >= amount, "insufficient liquidity");

        uint256 requestId = nextRequestId++;
        _pendingRequests[requestId] = PendingRequest({
            borrower: borrower,
            amount: amount,
            eligible: eligibility[borrower],
            timestamp: block.timestamp,
            finalized: false
        });

        emit LoanRequestCreated(requestId, borrower, amount);
        return requestId;
    }

    function getEligibilityHandle(uint256) external pure returns (bytes32) {
        return bytes32(0); // mock — no real FHE handle
    }

    function finalizeLoan(
        uint256 requestId,
        bool decryptedEligible,
        bytes memory /* decryptionProof — ignored in mock */
    ) external nonReentrant whenNotPaused {
        PendingRequest storage pending = _pendingRequests[requestId];
        require(pending.borrower != address(0), "unknown request");
        require(!pending.finalized, "already finalized");

        pending.finalized = true;

        // In mock: use the stored eligibility (ignore decryptedEligible param for simplicity,
        // or use it directly to test both paths)
        bool approved = decryptedEligible;

        if (!approved) {
            IMockOrchestrator(orchestrator).onLoanDecision(pending.borrower, pending.amount, false);
            return;
        }

        require(usdc.transfer(pending.borrower, pending.amount), "transfer failed");
        uint256 fee = (pending.amount * feeBasisPoints) / 10000;
        uint256 total = pending.amount + fee;
        totalOutstandingDebt += total;

        Loan storage existingLoan = loans[pending.borrower];
        if (existingLoan.remaining > 0 && !existingLoan.repaid) {
            existingLoan.amount += pending.amount;
            existingLoan.remaining += total;
            existingLoan.totalOwed += total;
            existingLoan.timestamp = block.timestamp;
        } else {
            loans[pending.borrower] = Loan({
                amount: pending.amount,
                remaining: total,
                totalOwed: total,
                timestamp: block.timestamp,
                repaid: false
            });
        }

        IMockOrchestrator(orchestrator).onLoanDecision(pending.borrower, pending.amount, true);
    }

    function repayLoanFor(address borrower, uint256 repayAmount) external onlyOrchestrator nonReentrant {
        Loan storage loan = loans[borrower];
        require(loan.remaining > 0 && !loan.repaid, "no active loan");
        require(repayAmount > 0, "amount = 0");

        if (repayAmount > loan.remaining) {
            repayAmount = loan.remaining;
        }

        require(usdc.transferFrom(borrower, address(this), repayAmount), "repay failed");
        loan.remaining -= repayAmount;
        totalOutstandingDebt -= repayAmount;

        if (loan.remaining == 0) {
            loan.repaid = true;
        }

        emit InstallmentPaid(borrower, repayAmount, loan.remaining);
    }

    function getPendingRequest(uint256 requestId) external view returns (
        address borrower, uint256 amount, uint256 timestamp, bool finalized
    ) {
        PendingRequest storage p = _pendingRequests[requestId];
        return (p.borrower, p.amount, p.timestamp, p.finalized);
    }
}
