// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ICreditScore {
    function scoreAboveThreshold(address borrower, uint32 threshold) external returns (ebool);
    function computeEncryptedLoanTerms(address borrower) external returns (euint32 maxLoanWhole, euint32 rateBps);
    function incrementRepaymentCount(address borrower) external;
    function isScoreValid(address borrower) external view returns (bool);
}

interface IShadowLendOrchestrator {
    function onLoanDecision(address borrower, uint256 amount, bool approved) external;
}

/// @title LendingPool
/// @notice Releases undercollateralised loans based on encrypted credit checks.
///         Loan terms (max amount, interest rate) are computed homomorphically in
///         CreditScore and decrypted by the borrower before the request is finalised.
contract LendingPool is ZamaEthereumConfig, ReentrancyGuard, Pausable {

    struct Loan {
        uint256 amount;
        uint256 remaining;
        uint256 totalOwed;
        uint256 timestamp;
        bool    repaid;
    }

    struct PendingRequest {
        address borrower;
        uint256 amount;
        uint256 maxLoanWhole;   // decrypted max loan (whole USDC) — verified in finalizeLoan
        uint256 rateBps;        // decrypted rate in basis points   — used for fee calculation
        ebool   eligibility;    // encrypted eligibility boolean
        euint32 encMaxLoan;     // encrypted max-loan handle (for on-chain proof verification)
        euint32 encRateBps;     // encrypted rate handle    (for on-chain proof verification)
        uint256 timestamp;
        bool    finalized;
    }

    IERC20        public usdc;
    ICreditScore  public creditScore;
    address       public orchestrator;
    address       public admin;

    uint32  public creditThreshold = 650;
    uint256 public feeBasisPoints  = 500; // fallback, overridden by FHE-computed rate

    mapping(address  => Loan)           public loans;
    mapping(uint256  => PendingRequest) private _pendingRequests;
    uint256 public nextRequestId;

    event LoanRequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event LoanTermsQueued(uint256 indexed requestId, address indexed borrower);
    event InstallmentPaid(address indexed borrower, uint256 amount, uint256 remaining);
    event ThresholdUpdated(uint32 old_, uint32 new_);
    event FeeUpdated(uint256 old_, uint256 new_);

    modifier onlyOrchestrator() { require(msg.sender == orchestrator, "only orchestrator"); _; }
    modifier onlyAdmin()        { require(msg.sender == admin,        "only admin");        _; }

    constructor(address usdcAddress, address creditScoreAddress, address orchestratorAddress) {
        usdc         = IERC20(usdcAddress);
        creditScore  = ICreditScore(creditScoreAddress);
        orchestrator = orchestratorAddress;
        admin        = msg.sender;
    }

    // ── Admin ──────────────────────────────────────────────────────────────────
    function pause()   external onlyAdmin { _pause();   }
    function unpause() external onlyAdmin { _unpause(); }
    function setAdmin(address a) external onlyAdmin { require(a != address(0)); admin = a; }

    // ── Orchestrator setters ───────────────────────────────────────────────────
    function setUSDC(address a)           external onlyOrchestrator { usdc        = IERC20(a); }
    function setCreditScore(address a)    external onlyOrchestrator { creditScore = ICreditScore(a); }
    function setOrchestrator(address a)   external onlyOrchestrator { orchestrator = a; }

    function setCreditThreshold(uint32 t) external onlyOrchestrator {
        require(t >= 300 && t <= 850, "threshold out of range");
        emit ThresholdUpdated(creditThreshold, t);
        creditThreshold = t;
    }

    function setFeeBasisPoints(uint256 f) external onlyOrchestrator {
        require(f <= 5000, "fee too high");
        emit FeeUpdated(feeBasisPoints, f);
        feeBasisPoints = f;
    }

    // ── Loan request ───────────────────────────────────────────────────────────

    /// @notice Step 1 — borrower requests a loan.
    ///         Triggers FHE computation of (maxLoan, rateBps) and the binary eligibility
    ///         check. Both are marked as publicly decryptable; the borrower decrypts them
    ///         off-chain via the Zama relayer and calls finalizeLoan with the proofs.
    function requestLoanFor(address borrower, uint256 amount)
        external
        onlyOrchestrator
        whenNotPaused
        returns (uint256 requestId)
    {
        require(amount > 0,                                           "amount = 0");
        require(usdc.balanceOf(address(this)) >= amount,             "insufficient liquidity");
        require(creditScore.isScoreValid(borrower),                  "score expired - re-score first");

        // Existing active loan blocks new borrowing
        Loan storage existing = loans[borrower];
        require(existing.remaining == 0 || existing.repaid,          "repay existing loan first");

        // Compute encrypted loan terms (FHE.add/sub/mul/min operations in CreditScore)
        (euint32 encMax, euint32 encRate) = creditScore.computeEncryptedLoanTerms(borrower);
        FHE.allowThis(encMax);
        FHE.allowThis(encRate);
        FHE.makePubliclyDecryptable(encMax);
        FHE.makePubliclyDecryptable(encRate);

        // Binary eligibility check (kept for the finalization proof step)
        ebool eligible = creditScore.scoreAboveThreshold(borrower, creditThreshold);
        FHE.allowThis(eligible);
        FHE.makePubliclyDecryptable(eligible);

        requestId = nextRequestId++;
        _pendingRequests[requestId] = PendingRequest({
            borrower:     borrower,
            amount:       amount,
            maxLoanWhole: 0,
            rateBps:      0,
            eligibility:  eligible,
            encMaxLoan:   encMax,
            encRateBps:   encRate,
            timestamp:    block.timestamp,
            finalized:    false
        });

        emit LoanRequestCreated(requestId, borrower, amount);
        emit LoanTermsQueued(requestId, borrower);
        return requestId;
    }

    // ── Handle getters for off-chain decryption ────────────────────────────────

    function getEligibilityHandle(uint256 requestId) external view returns (bytes32) {
        return FHE.toBytes32(_pendingRequests[requestId].eligibility);
    }

    function getMaxLoanHandle(uint256 requestId) external view returns (bytes32) {
        return FHE.toBytes32(_pendingRequests[requestId].encMaxLoan);
    }

    function getRateHandle(uint256 requestId) external view returns (bytes32) {
        return FHE.toBytes32(_pendingRequests[requestId].encRateBps);
    }

    function getPendingRequest(uint256 requestId) external view returns (
        address borrower, uint256 amount, uint256 timestamp, bool finalized
    ) {
        PendingRequest storage p = _pendingRequests[requestId];
        return (p.borrower, p.amount, p.timestamp, p.finalized);
    }

    // ── Loan finalisation ──────────────────────────────────────────────────────

    /// @notice Step 2 — anyone submits a single KMS-signed proof to finalise.
    ///         The Zama KMS returns one proof covering all handles in a batch request.
    /// @param decryptedEligible  Decrypted boolean from eligibility handle.
    /// @param decryptedMaxLoan   Decrypted max loan in whole USDC from encMaxLoan handle.
    /// @param decryptedRateBps   Decrypted interest rate in basis points from encRateBps handle.
    /// @param decryptionProof    Single KMS-signed proof covering all three handles.
    function finalizeLoan(
        uint256 requestId,
        bool    decryptedEligible,
        uint256 decryptedMaxLoan,
        uint256 decryptedRateBps,
        bytes memory decryptionProof
    ) external nonReentrant whenNotPaused {
        PendingRequest storage pending = _pendingRequests[requestId];
        require(pending.borrower != address(0), "unknown request");
        require(!pending.finalized,             "already finalized");

        // Verify all three handles with one proof — KMS returns a single proof per batch
        bytes32[] memory handles = new bytes32[](3);
        handles[0] = FHE.toBytes32(pending.eligibility);
        handles[1] = FHE.toBytes32(pending.encMaxLoan);
        handles[2] = FHE.toBytes32(pending.encRateBps);
        FHE.checkSignatures(handles, abi.encode(decryptedEligible, decryptedMaxLoan, decryptedRateBps), decryptionProof);

        pending.maxLoanWhole = decryptedMaxLoan;
        pending.rateBps      = decryptedRateBps;
        pending.finalized    = true;

        if (!decryptedEligible) {
            IShadowLendOrchestrator(orchestrator).onLoanDecision(pending.borrower, pending.amount, false);
            return;
        }

        // Enforce FHE-computed max loan cap
        uint256 maxAmountUsdc = decryptedMaxLoan * 1e6;
        require(pending.amount <= maxAmountUsdc, "amount exceeds FHE-computed credit limit");

        // Fee uses FHE-computed rate instead of fixed feeBasisPoints
        uint256 effectiveRate = decryptedRateBps > 0 ? decryptedRateBps : feeBasisPoints;
        uint256 fee   = (pending.amount * effectiveRate) / 10_000;
        uint256 total = pending.amount + fee;

        require(usdc.transfer(pending.borrower, pending.amount), "transfer failed");

        // requestLoanFor blocks new requests when an active loan exists,
        // so we always create a fresh loan record here.
        loans[pending.borrower] = Loan({
            amount:    pending.amount,
            remaining: total,
            totalOwed: total,
            timestamp: block.timestamp,
            repaid:    false
        });

        IShadowLendOrchestrator(orchestrator).onLoanDecision(pending.borrower, pending.amount, true);
    }

    // ── Repayment ──────────────────────────────────────────────────────────────

    function repayLoanFor(address borrower, uint256 repayAmount)
        external
        onlyOrchestrator
        nonReentrant
    {
        Loan storage loan = loans[borrower];
        require(loan.remaining > 0 && !loan.repaid, "no active loan");
        require(repayAmount > 0, "amount = 0");

        if (repayAmount > loan.remaining) repayAmount = loan.remaining;

        require(usdc.transferFrom(borrower, address(this), repayAmount), "repay failed");
        loan.remaining -= repayAmount;

        if (loan.remaining == 0) {
            loan.repaid = true;
            // Credit the borrower's on-chain repayment reputation
            creditScore.incrementRepaymentCount(borrower);
        }

        emit InstallmentPaid(borrower, repayAmount, loan.remaining);
    }
}
