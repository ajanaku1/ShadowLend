// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CreditScore
/// @notice Stores encrypted credit scores, enforces anti-gaming rules, and computes
///         personalised loan terms entirely in encrypted space using FHE arithmetic.
/// @dev Uses Zama fhEVM v0.9+ (FHE.* API, self-relaying decryption).
///
/// FHE operations used:
///   fromExternal, ge, allowThis, allow            — existing
///   add, sub, mul, min, asEuint32                 — new (loan term computation)
///   makePubliclyDecryptable, toBytes32             — via LendingPool
contract CreditScore is ZamaEthereumConfig, AccessControl {
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");
    bytes32 public constant POOL_ROLE   = keccak256("POOL_ROLE");

    // ── Anti-gaming constants ──────────────────────────────────────────────────
    uint256 public constant SCORE_VALIDITY = 30 days;
    uint256 public constant SCORE_COOLDOWN = 30 days;

    // ── Loan-term computation constants ────────────────────────────────────────
    // Max loan (whole USDC, no decimals):
    //   loanUncapped = (effectiveScore - 300) * 16 + 1000
    //   maxLoan      = min(loanUncapped, 10_000)
    //   score 650 → (350*16)+1000 = 6,600   score 850 → (550*16)+1000 = 9,800
    uint32 public constant MIN_SCORE      = 300;
    uint32 public constant LOAN_PER_POINT = 16;
    uint32 public constant BASE_LOAN      = 1_000;
    uint32 public constant MAX_LOAN       = 10_000;

    // Rate (basis points):
    //   rateBps = (850 - effectiveScore) * 3 + 200
    //   score 650 → (200*3)+200 = 800 bps = 8 %   score 850 → 0+200 = 200 bps = 2 %
    uint32 public constant MAX_SCORE         = 850;
    uint32 public constant RATE_PER_POINT    = 3;
    uint32 public constant RATE_INTERCEPT    = 200;

    // Repayment bonus: +25 score points per successful full repayment, capped at MAX_SCORE
    uint32 public constant REPAYMENT_BONUS = 25;

    // ── State ──────────────────────────────────────────────────────────────────
    mapping(address => euint32)  private  _scores;
    mapping(address => bool)     public   hasScore;
    mapping(address => uint256)  public   lastScoreTimestamp;
    mapping(address => uint32)   public   repaymentCount;

    // ── Compliance: 2-of-3 committee gate ─────────────────────────────────────
    address[3] public complianceCommittee;
    address    public complianceOfficer;

    // member => borrower => has signed
    mapping(address => mapping(address => bool)) private _complianceSigned;
    mapping(address => uint8)                    private _complianceSigCount;

    // ── Events ─────────────────────────────────────────────────────────────────
    event ScoreSubmitted(address indexed borrower);
    event RepaymentRecorded(address indexed borrower, uint32 newCount);
    event ComplianceSignatureAdded(address indexed signer, address indexed borrower, uint8 total);
    event ComplianceAccessGranted(address indexed borrower);

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ── Admin: compliance setup ────────────────────────────────────────────────

    /// @notice Set the 3-member compliance committee and the officer who can decrypt.
    function setComplianceCommittee(
        address[3] calldata committee,
        address officer
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < 3; i++) {
            require(committee[i] != address(0), "zero address in committee");
        }
        require(officer != address(0), "zero officer address");
        complianceCommittee = committee;
        complianceOfficer   = officer;
    }

    /// @notice Grant POOL_ROLE to LendingPool after deployment. Call once during setup.
    function grantPoolRole(address pool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pool != address(0), "zero pool address");
        _grantRole(POOL_ROLE, pool);
    }

    // ── Score submission ───────────────────────────────────────────────────────

    /// @notice Submit an encrypted credit score for a borrower.
    /// @dev Enforces 30-day cooldown between re-submissions to prevent brute-force gaming.
    function submitScore(
        address borrower,
        externalEuint32 encryptedScore,
        bytes calldata inputProof
    ) external onlyRole(SCORER_ROLE) {
        require(
            !hasScore[borrower] ||
            block.timestamp >= lastScoreTimestamp[borrower] + SCORE_COOLDOWN,
            "cooldown: wait 30 days before re-scoring"
        );

        // M1: reset compliance state so stale votes can't carry over to a new score
        if (hasScore[borrower]) {
            _complianceSigCount[borrower] = 0;
            for (uint256 i = 0; i < 3; i++) {
                if (complianceCommittee[i] != address(0)) {
                    _complianceSigned[complianceCommittee[i]][borrower] = false;
                }
            }
        }

        euint32 score = FHE.fromExternal(encryptedScore, inputProof);
        FHE.allowThis(score);

        _scores[borrower]            = score;
        hasScore[borrower]           = true;
        lastScoreTimestamp[borrower] = block.timestamp;

        emit ScoreSubmitted(borrower);
    }

    // ── Validity helper ────────────────────────────────────────────────────────

    /// @notice Returns true if the borrower has a score that is not yet 30 days old.
    function isScoreValid(address borrower) public view returns (bool) {
        return hasScore[borrower] &&
               block.timestamp <= lastScoreTimestamp[borrower] + SCORE_VALIDITY;
    }

    // ── Legacy binary check (kept for backward compatibility) ──────────────────

    /// @notice Homomorphic threshold check — score >= threshold → ebool.
    function scoreAboveThreshold(address borrower, uint32 threshold)
        external
        returns (ebool)
    {
        require(isScoreValid(borrower), "score expired or missing");
        ebool ok = FHE.ge(_scores[borrower], threshold);
        FHE.allowThis(ok);
        FHE.allow(ok, msg.sender);
        return ok;
    }

    // ── NEW: Encrypted loan term computation ───────────────────────────────────

    /// @notice Compute personalised loan terms entirely in encrypted space.
    ///         Returns (maxLoanWhole, rateBps) — both euint32 handles the caller may decrypt.
    ///
    ///  FHE ops used (6 total):
    ///    add  — apply repayment bonus to base score
    ///    min  — cap effective score at MAX_SCORE
    ///    sub  — (effectiveScore - MIN_SCORE) for loan calc
    ///    mul  — scale delta to loan amount
    ///    add  — add base loan floor
    ///    min  — cap at MAX_LOAN
    ///    sub  — (MAX_SCORE - effectiveScore) for rate calc
    ///    mul  — scale deficit to rate points
    ///    add  — add rate intercept
    ///
    /// @dev maxLoanWhole is in whole USDC (no decimals).
    ///      Caller multiplies by 1e6 to get USDC amount.
    function computeEncryptedLoanTerms(address borrower)
        external
        returns (euint32 maxLoanWhole, euint32 rateBps)
    {
        require(isScoreValid(borrower), "score expired or missing");

        euint32 base = _scores[borrower];

        // 1. Apply repayment bonus (plaintext counter, encrypted arithmetic)
        //    Cap bonus to avoid uint32 overflow: max meaningful bonus = MAX_SCORE - MIN_SCORE = 550
        uint256 rawBonus      = uint256(repaymentCount[borrower]) * REPAYMENT_BONUS;
        uint32  bonus         = rawBonus > (MAX_SCORE - MIN_SCORE) ? (MAX_SCORE - MIN_SCORE) : uint32(rawBonus);
        euint32 boosted        = FHE.add(base, bonus);
        euint32 effectiveScore = FHE.min(boosted, FHE.asEuint32(MAX_SCORE));

        // 2. Max loan: (effectiveScore - 300) * 16 + 1000, capped at 10_000
        //    Guard against FHE.sub underflow if submitted score < MIN_SCORE
        euint32 safeScore  = FHE.max(effectiveScore, FHE.asEuint32(MIN_SCORE));
        euint32 delta      = FHE.sub(safeScore, MIN_SCORE);
        euint32 uncapped   = FHE.add(FHE.mul(delta, LOAN_PER_POINT), BASE_LOAN);
        maxLoanWhole       = FHE.min(uncapped, FHE.asEuint32(MAX_LOAN));

        // 3. Rate: (850 - effectiveScore) * 3 + 200  (basis points)
        //    safeScore is already capped at MAX_SCORE by FHE.min above, so no underflow here
        euint32 deficit = FHE.sub(FHE.asEuint32(MAX_SCORE), safeScore);
        rateBps         = FHE.add(FHE.mul(deficit, RATE_PER_POINT), RATE_INTERCEPT);

        FHE.allowThis(maxLoanWhole);
        FHE.allowThis(rateBps);
        FHE.allow(maxLoanWhole, msg.sender);
        FHE.allow(rateBps, msg.sender);
    }

    // ── Repayment reputation (called by LendingPool) ───────────────────────────

    /// @notice Increment the repayment counter for a borrower after a full repayment.
    ///         Each increment adds REPAYMENT_BONUS points to future score computations.
    function incrementRepaymentCount(address borrower) external onlyRole(POOL_ROLE) {
        repaymentCount[borrower] += 1;
        emit RepaymentRecorded(borrower, repaymentCount[borrower]);
    }

    // ── Selective regulatory disclosure ───────────────────────────────────────

    /// @notice A compliance committee member casts their vote to grant the compliance
    ///         officer decryption access for a specific borrower's score.
    ///         When 2-of-3 members have signed, FHE.allow is called — only then can
    ///         the compliance officer decrypt. Neither the protocol nor lenders can
    ///         trigger this unilaterally.
    function requestComplianceDecryption(address borrower) external {
        bool isMember;
        for (uint256 i = 0; i < 3; i++) {
            if (complianceCommittee[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember,                              "not a compliance committee member");
        require(hasScore[borrower],                    "no score on file for borrower");
        require(!_complianceSigned[msg.sender][borrower], "already signed for this borrower");
        require(complianceOfficer != address(0),       "compliance officer not set");

        _complianceSigned[msg.sender][borrower] = true;
        _complianceSigCount[borrower] += 1;

        emit ComplianceSignatureAdded(msg.sender, borrower, _complianceSigCount[borrower]);

        if (_complianceSigCount[borrower] == 2) {
            FHE.allow(_scores[borrower], complianceOfficer);
            emit ComplianceAccessGranted(borrower);
        }
    }

    /// @notice How many committee members have signed a compliance request for a borrower.
    function complianceSignatureCount(address borrower) external view returns (uint8) {
        return _complianceSigCount[borrower];
    }

    // ── Raw handle getter ──────────────────────────────────────────────────────

    function getEncryptedScore(address borrower) external view returns (euint32) {
        return _scores[borrower];
    }
}
