// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface ICreditScoreAdmin {
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
}

interface ILendingPool {
    function setUSDC(address usdcAddress) external;
    function setCreditScore(address creditScoreAddress) external;
    function setCreditThreshold(uint32 newThreshold) external;
    function setFeeBasisPoints(uint256 newFeeBps) external;
    function requestLoanFor(address borrower, uint256 amount) external returns (uint256);
    function finalizeLoan(uint256 requestId, bool decryptedEligible, bytes memory decryptionProof) external;
    function repayLoanFor(address borrower, uint256 amount) external;
    function loans(address borrower) external view returns (uint256 amount, uint256 remaining, uint256 totalOwed, uint256 timestamp, bool repaid);
    function getEligibilityHandle(uint256 requestId) external view returns (bytes32);
    function creditThreshold() external view returns (uint32);
    function feeBasisPoints() external view returns (uint256);
}

/// @title ShadowLendOrchestrator
/// @notice Coordinates ShadowLend contracts and emits protocol events.
/// @dev UUPS upgradeable. Loan finalization is client-driven (self-relaying decryption).
contract ShadowLendOrchestrator is Initializable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");

    address public usdc;
    address public creditScore;
    address public lendingPool;

    event LoanRequested(address indexed borrower, uint256 amount, uint256 requestId);
    event LoanApproved(address indexed borrower, uint256 amount);
    event LoanDenied(address indexed borrower, uint256 amount);
    event LoanRepaid(address indexed borrower, uint256 amount);
    event InstallmentPaid(address indexed borrower, uint256 amount, uint256 remaining);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address usdcAddress,
        address creditScoreAddress,
        address lendingPoolAddress,
        address owner
    ) public initializer {
        __Ownable_init(owner);
        __Pausable_init();
        usdc = usdcAddress;
        creditScore = creditScoreAddress;
        lendingPool = lendingPoolAddress;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // --- Emergency controls ---

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // --- Admin config ---

    function updateUSDC(address usdcAddress) external onlyOwner {
        usdc = usdcAddress;
        ILendingPool(lendingPool).setUSDC(usdcAddress);
    }

    function updateCreditScore(address creditScoreAddress) external onlyOwner {
        creditScore = creditScoreAddress;
        ILendingPool(lendingPool).setCreditScore(creditScoreAddress);
    }

    function updateCreditThreshold(uint32 newThreshold) external onlyOwner {
        ILendingPool(lendingPool).setCreditThreshold(newThreshold);
    }

    function updateFeeBasisPoints(uint256 newFeeBps) external onlyOwner {
        ILendingPool(lendingPool).setFeeBasisPoints(newFeeBps);
    }

    function setTrustedScorer(address scorer) external onlyOwner {
        ICreditScoreAdmin(creditScore).grantRole(SCORER_ROLE, scorer);
    }

    function revokeTrustedScorer(address scorer) external onlyOwner {
        ICreditScoreAdmin(creditScore).revokeRole(SCORER_ROLE, scorer);
    }

    // --- Loan lifecycle ---

    /// @notice Request a loan. Returns requestId for off-chain decryption.
    function requestLoan(uint256 amount) external whenNotPaused returns (uint256) {
        uint256 requestId = ILendingPool(lendingPool).requestLoanFor(msg.sender, amount);
        emit LoanRequested(msg.sender, amount, requestId);
        return requestId;
    }

    /// @notice Finalize a loan after off-chain decryption via relayer SDK.
    function finalizeLoan(uint256 requestId, bool decryptedEligible, bytes memory decryptionProof) external whenNotPaused {
        ILendingPool(lendingPool).finalizeLoan(requestId, decryptedEligible, decryptionProof);
    }

    /// @notice Get the eligibility handle for a pending loan request.
    function getEligibilityHandle(uint256 requestId) external view returns (bytes32) {
        return ILendingPool(lendingPool).getEligibilityHandle(requestId);
    }

    /// @notice Repay part or all of an outstanding loan. Always allowed even when paused.
    function repayLoan(uint256 amount) external {
        (, uint256 remainingBefore, , , ) = ILendingPool(lendingPool).loans(msg.sender);
        ILendingPool(lendingPool).repayLoanFor(msg.sender, amount);
        (, uint256 remainingAfter, , , bool repaid) = ILendingPool(lendingPool).loans(msg.sender);
        emit InstallmentPaid(msg.sender, amount, remainingAfter);
        if (repaid) {
            emit LoanRepaid(msg.sender, remainingBefore);
        }
    }

    /// @notice Called by LendingPool when loan decision is made.
    function onLoanDecision(address borrower, uint256 amount, bool approved) external {
        require(msg.sender == lendingPool, "only pool");
        if (approved) {
            emit LoanApproved(borrower, amount);
        } else {
            emit LoanDenied(borrower, amount);
        }
    }

    /// @dev Storage gap for future upgrades
    uint256[47] private __gap;
}
