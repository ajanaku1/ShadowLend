// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ShadowLendLedger
/// @notice On-chain record of credit scores, factors, loans, and balances for ShadowLend.
///         Supports incremental borrowing up to a credit limit and installment repayments.
contract ShadowLendLedger {
    struct ScoreRecord {
        uint32 score;
        bool eligible;
        uint16 rateBps;       // interest rate in basis points (e.g. 633 = 6.33%)
        uint256 creditLimit;  // max total outstanding in USDC (6 decimals)
        uint8 paymentHistory; // 0-100
        uint8 debtToIncome;   // 0-100
        uint8 incomeLevel;    // 0-100
        uint8 employment;     // 0-100
        uint64 timestamp;
    }

    mapping(address => ScoreRecord) public scores;
    mapping(address => uint256) public borrowed;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public totalBorrowed;
    mapping(address => uint256) public totalRepaid;
    mapping(address => uint256) public totalFeesPaid;

    event ScoreRecorded(address indexed borrower, uint32 score, bool eligible, uint16 rateBps, uint256 creditLimit);
    event LoanBorrowed(address indexed borrower, uint256 amount, uint256 newOutstanding);
    event LoanRepaid(address indexed borrower, uint256 principal, uint256 fee, uint256 remaining);

    /// @notice Record a credit score with factor breakdown for the caller.
    function recordScore(
        uint32 score,
        bool eligible,
        uint16 rateBps,
        uint256 creditLimit,
        uint8 paymentHistory,
        uint8 debtToIncome,
        uint8 incomeLevel,
        uint8 employment
    ) external {
        scores[msg.sender] = ScoreRecord({
            score: score,
            eligible: eligible,
            rateBps: rateBps,
            creditLimit: creditLimit,
            paymentHistory: paymentHistory,
            debtToIncome: debtToIncome,
            incomeLevel: incomeLevel,
            employment: employment,
            timestamp: uint64(block.timestamp)
        });
        emit ScoreRecorded(msg.sender, score, eligible, rateBps, creditLimit);
    }

    /// @notice Borrow more USDC. Can be called multiple times up to credit limit.
    function borrow(uint256 amount) external {
        require(amount > 0, "amount = 0");
        ScoreRecord memory s = scores[msg.sender];
        require(s.score > 0, "no score recorded");
        require(s.eligible, "not eligible");
        require(borrowed[msg.sender] + amount <= s.creditLimit, "exceeds credit limit");

        borrowed[msg.sender] += amount;
        balances[msg.sender] += amount;
        totalBorrowed[msg.sender] += amount;

        emit LoanBorrowed(msg.sender, amount, borrowed[msg.sender]);
    }

    /// @notice Repay part or all of outstanding loan.
    function repay(uint256 principalAmount) external {
        uint256 outstanding = borrowed[msg.sender];
        require(outstanding > 0, "nothing owed");
        require(principalAmount > 0, "amount = 0");
        require(principalAmount <= outstanding, "exceeds outstanding");

        ScoreRecord memory s = scores[msg.sender];
        uint256 fee = (principalAmount * s.rateBps) / 10000;
        uint256 total = principalAmount + fee;
        require(balances[msg.sender] >= total, "insufficient balance");

        balances[msg.sender] -= total;
        borrowed[msg.sender] -= principalAmount;
        totalRepaid[msg.sender] += principalAmount;
        totalFeesPaid[msg.sender] += fee;

        emit LoanRepaid(msg.sender, principalAmount, fee, borrowed[msg.sender]);
    }

    /// @notice Add to simulated USDC balance (e.g. faucet for demo).
    function addBalance(uint256 amount) external {
        balances[msg.sender] += amount;
    }

    /// @notice Get score and factor breakdown.
    function getScore(address user) external view returns (
        uint32 score, bool eligible, uint16 rateBps, uint256 creditLimit, uint64 timestamp,
        uint8 paymentHistory, uint8 debtToIncome, uint8 incomeLevel, uint8 employment
    ) {
        ScoreRecord memory s = scores[user];
        return (s.score, s.eligible, s.rateBps, s.creditLimit, s.timestamp,
                s.paymentHistory, s.debtToIncome, s.incomeLevel, s.employment);
    }

    /// @notice Get position summary.
    function getPosition(address user) external view returns (
        uint256 outstandingPrincipal,
        uint256 balance,
        uint256 lifetimeBorrowed,
        uint256 lifetimeRepaid,
        uint256 lifetimeFees
    ) {
        return (borrowed[user], balances[user], totalBorrowed[user], totalRepaid[user], totalFeesPaid[user]);
    }
}
