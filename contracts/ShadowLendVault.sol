// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPoolForVault {
    function totalManagedAssets() external view returns (uint256);
    function depositLiquidity(uint256 amount) external;
    function withdrawLiquidity(uint256 amount) external;
}

/// @title ShadowLendVault (USD3)
/// @notice ERC4626 vault for lenders. Deposits USDC into the LendingPool.
///         Share value increases as borrowers repay principal + fees.
///         Tracks per-lender cost basis on-chain for accurate yield calculation.
///         Lenders see only aggregate pool metrics — no individual borrower data.
contract ShadowLendVault is ERC4626 {
    address public immutable pool;

    /// @notice Tracks each lender's USDC cost basis (total deposited minus proportional withdrawals)
    mapping(address => uint256) public costBasis;

    /// @dev Flag to skip cost basis reduction during claimYield
    bool private _claimingYield;

    event YieldClaimed(address indexed lender, uint256 yieldAmount);

    constructor(
        IERC20 _usdc,
        address _pool
    ) ERC20("ShadowLend USD3", "USD3") ERC4626(_usdc) {
        pool = _pool;
    }

    /// @notice Total assets = all USDC managed by the pool (idle + loaned out + accrued fees)
    function totalAssets() public view override returns (uint256) {
        return IPoolForVault(pool).totalManagedAssets();
    }

    /// @notice Get a lender's earned yield (current value minus cost basis)
    function earnedYield(address lender) external view returns (uint256) {
        uint256 shares = balanceOf(lender);
        if (shares == 0) return 0;
        uint256 currentValue = convertToAssets(shares);
        uint256 basis = costBasis[lender];
        return currentValue > basis ? currentValue - basis : 0;
    }

    /// @notice Claim only the earned yield, keeping principal in the pool
    function claimYield(address receiver) external returns (uint256 claimed) {
        uint256 shares = balanceOf(msg.sender);
        require(shares > 0, "no position");
        uint256 currentValue = convertToAssets(shares);
        uint256 basis = costBasis[msg.sender];
        require(currentValue > basis, "no yield to claim");

        claimed = currentValue - basis;
        // costBasis stays the same — we're only withdrawing profit
        uint256 sharesToBurn = convertToShares(claimed);
        _claimingYield = true;
        _withdraw(msg.sender, receiver, msg.sender, claimed, sharesToBurn);
        _claimingYield = false;

        emit YieldClaimed(msg.sender, claimed);
    }

    /// @dev After receiving USDC from depositor, forward it to the pool and track cost basis
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        IERC20(asset()).approve(pool, assets);
        IPoolForVault(pool).depositLiquidity(assets);
        // Track cost basis: add deposited USDC to receiver's basis
        costBasis[receiver] += assets;
    }

    /// @dev Pull USDC from pool before sending to withdrawer, reduce cost basis proportionally
    function _withdraw(
        address caller, address receiver, address owner,
        uint256 assets, uint256 shares
    ) internal override {
        IPoolForVault(pool).withdrawLiquidity(assets);

        // Reduce cost basis proportionally — skip during claimYield (only profit withdrawn)
        if (!_claimingYield) {
            uint256 currentValue = convertToAssets(balanceOf(owner));
            if (currentValue > 0 && costBasis[owner] > 0) {
                uint256 basisReduction = (costBasis[owner] * assets) / currentValue;
                if (basisReduction > costBasis[owner]) {
                    costBasis[owner] = 0;
                } else {
                    costBasis[owner] -= basisReduction;
                }
            }
        }

        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /// @notice Cap withdrawals at pool's idle USDC liquidity
    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 maxByShares = super.maxWithdraw(owner);
        uint256 poolIdle = IERC20(asset()).balanceOf(pool);
        return maxByShares < poolIdle ? maxByShares : poolIdle;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 maxShares = super.maxRedeem(owner);
        uint256 poolIdle = IERC20(asset()).balanceOf(pool);
        uint256 maxSharesByLiquidity = convertToShares(poolIdle);
        return maxShares < maxSharesByLiquidity ? maxShares : maxSharesByLiquidity;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
