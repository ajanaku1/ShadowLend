// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ICreditScore {
    function scoreAboveThreshold(address borrower, uint32 threshold) external returns (ebool);
}

interface IShadowLendOrchestrator {
    function onLoanDecision(address borrower, uint256 amount, bool approved) external;
}

/// @title LendingPool
/// @notice Releases undercollateralized loans based on encrypted credit checks.
/// @dev v0.9+ self-relaying decryption: client decrypts via relayer and submits proof.
contract LendingPool is ZamaEthereumConfig, ReentrancyGuard, Pausable {
    struct Loan {
        uint256 amount;      // original principal
        uint256 remaining;   // total still owed (principal + fee, decreases with payments)
        uint256 totalOwed;   // original total (principal + fee, immutable)
        uint256 timestamp;
        bool repaid;
    }

    struct PendingRequest {
        address borrower;
        uint256 amount;
        ebool eligibility;
        uint256 timestamp;
        bool finalized;
    }

    IERC20 public usdc;
    ICreditScore public creditScore;
    address public orchestrator;
    address public admin;

    // --- Configurable parameters ---
    uint32 public creditThreshold = 650;
    uint256 public feeBasisPoints = 500; // 500 = 5%

    mapping(address => Loan) public loans;
    mapping(uint256 => PendingRequest) private _pendingRequests;
    uint256 public nextRequestId;

    event LoanRequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event InstallmentPaid(address indexed borrower, uint256 amount, uint256 remaining);
    event ThresholdUpdated(uint32 oldThreshold, uint32 newThreshold);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "only orchestrator");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    constructor(address usdcAddress, address creditScoreAddress, address orchestratorAddress) {
        usdc = IERC20(usdcAddress);
        creditScore = ICreditScore(creditScoreAddress);
        orchestrator = orchestratorAddress;
        admin = msg.sender;
    }

    // --- Admin functions ---

    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        admin = newAdmin;
    }

    // --- Orchestrator-gated setters ---

    function setUSDC(address usdcAddress) external onlyOrchestrator {
        usdc = IERC20(usdcAddress);
    }

    function setCreditScore(address creditScoreAddress) external onlyOrchestrator {
        creditScore = ICreditScore(creditScoreAddress);
    }

    function setOrchestrator(address orchestratorAddress) external onlyOrchestrator {
        orchestrator = orchestratorAddress;
    }

    function setCreditThreshold(uint32 newThreshold) external onlyOrchestrator {
        require(newThreshold >= 300 && newThreshold <= 850, "threshold out of range");
        emit ThresholdUpdated(creditThreshold, newThreshold);
        creditThreshold = newThreshold;
    }

    function setFeeBasisPoints(uint256 newFeeBps) external onlyOrchestrator {
        require(newFeeBps <= 5000, "fee too high"); // max 50%
        emit FeeUpdated(feeBasisPoints, newFeeBps);
        feeBasisPoints = newFeeBps;
    }

    /// @notice Request a loan. Allows top-up borrowing if existing debt + new amount stays within limits.
    /// @return requestId The ID to use for finalization
    function requestLoanFor(address borrower, uint256 amount) external onlyOrchestrator whenNotPaused returns (uint256) {
        require(amount > 0, "amount = 0");
        require(usdc.balanceOf(address(this)) >= amount, "insufficient liquidity");

        // Perform encrypted comparison: score >= threshold
        ebool eligible = creditScore.scoreAboveThreshold(borrower, creditThreshold);
        FHE.allowThis(eligible);
        // Mark the encrypted boolean as publicly decryptable via relayer
        FHE.makePubliclyDecryptable(eligible);

        uint256 requestId = nextRequestId++;
        _pendingRequests[requestId] = PendingRequest({
            borrower: borrower,
            amount: amount,
            eligibility: eligible,
            timestamp: block.timestamp,
            finalized: false
        });

        emit LoanRequestCreated(requestId, borrower, amount);
        return requestId;
    }

    /// @notice Get the eligibility handle for off-chain decryption.
    function getEligibilityHandle(uint256 requestId) external view returns (bytes32) {
        return FHE.toBytes32(_pendingRequests[requestId].eligibility);
    }

    /// @notice Get pending request details.
    function getPendingRequest(uint256 requestId) external view returns (
        address borrower, uint256 amount, uint256 timestamp, bool finalized
    ) {
        PendingRequest storage p = _pendingRequests[requestId];
        return (p.borrower, p.amount, p.timestamp, p.finalized);
    }

    /// @notice Finalize a loan after off-chain decryption. Anyone can call with a valid proof.
    function finalizeLoan(
        uint256 requestId,
        bool decryptedEligible,
        bytes memory decryptionProof
    ) external nonReentrant whenNotPaused {
        PendingRequest storage pending = _pendingRequests[requestId];
        require(pending.borrower != address(0), "unknown request");
        require(!pending.finalized, "already finalized");

        // Verify the decryption proof against the KMS signatures
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(pending.eligibility);
        bytes memory encoded = abi.encode(decryptedEligible);
        FHE.checkSignatures(handles, encoded, decryptionProof);

        pending.finalized = true;

        if (!decryptedEligible) {
            IShadowLendOrchestrator(orchestrator).onLoanDecision(pending.borrower, pending.amount, false);
            return;
        }

        require(usdc.transfer(pending.borrower, pending.amount), "transfer failed");
        uint256 fee = (pending.amount * feeBasisPoints) / 10000;
        uint256 total = pending.amount + fee;
        Loan storage existingLoan = loans[pending.borrower];
        if (existingLoan.remaining > 0 && !existingLoan.repaid) {
            // Top-up: accumulate onto existing loan
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

        IShadowLendOrchestrator(orchestrator).onLoanDecision(pending.borrower, pending.amount, true);
    }

    /// @notice Repay part or all of an outstanding loan. Always allowed even when paused.
    function repayLoanFor(address borrower, uint256 repayAmount) external onlyOrchestrator nonReentrant {
        Loan storage loan = loans[borrower];
        require(loan.remaining > 0 && !loan.repaid, "no active loan");
        require(repayAmount > 0, "amount = 0");

        // Cap at remaining balance
        if (repayAmount > loan.remaining) {
            repayAmount = loan.remaining;
        }

        require(usdc.transferFrom(borrower, address(this), repayAmount), "repay failed");
        loan.remaining -= repayAmount;

        if (loan.remaining == 0) {
            loan.repaid = true;
        }

        emit InstallmentPaid(borrower, repayAmount, loan.remaining);
    }
}
