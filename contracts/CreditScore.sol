// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CreditScore
/// @notice Stores encrypted credit scores and provides encrypted threshold checks.
/// @dev Uses Zama fhEVM v0.9+ (FHE.* API, self-relaying decryption).
contract CreditScore is ZamaEthereumConfig, AccessControl {
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");

    mapping(address => euint32) private _scores;
    mapping(address => bool) private _hasScore;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Submit an encrypted credit score for a borrower.
    function submitScore(
        address borrower,
        externalEuint32 encryptedScore,
        bytes calldata inputProof
    ) external onlyRole(SCORER_ROLE) {
        euint32 score = FHE.fromExternal(encryptedScore, inputProof);
        FHE.allowThis(score);
        _scores[borrower] = score;
        _hasScore[borrower] = true;
    }

    /// @notice Get the raw encrypted score handle for a borrower.
    function getEncryptedScore(address borrower) external view returns (euint32) {
        return _scores[borrower];
    }

    /// @notice Check if a borrower has a submitted score.
    function hasScore(address borrower) external view returns (bool) {
        return _hasScore[borrower];
    }

    /// @notice Compare score against threshold homomorphically (no decryption).
    function scoreAboveThreshold(address borrower, uint32 threshold)
        external
        returns (ebool)
    {
        require(_hasScore[borrower], "score not found");
        ebool ok = FHE.ge(_scores[borrower], threshold);
        FHE.allowThis(ok);
        FHE.allow(ok, msg.sender); // Allow caller (LendingPool) to use the result
        return ok;
    }
}
