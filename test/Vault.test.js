/* eslint-disable no-console */
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ShadowLendVault (USD3)", function () {
  let deployer, alice, bob;
  let usdc, pool, orchestrator, vault;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 6);
  const SEED = ethers.parseUnits("100000", 6);

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy(INITIAL_SUPPLY);
    await usdc.waitForDeployment();

    // Deploy MockLendingPool
    const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
    pool = await MockLendingPool.deploy(await usdc.getAddress(), deployer.address);
    await pool.waitForDeployment();

    // Deploy Orchestrator (UUPS proxy)
    const ShadowLendOrchestrator = await ethers.getContractFactory("ShadowLendOrchestrator");
    orchestrator = await upgrades.deployProxy(
      ShadowLendOrchestrator,
      [await usdc.getAddress(), ethers.ZeroAddress, await pool.getAddress(), deployer.address],
      { kind: "uups" }
    );
    await orchestrator.waitForDeployment();
    await pool.setOrchestrator(await orchestrator.getAddress());

    // Deploy Vault
    const ShadowLendVault = await ethers.getContractFactory("ShadowLendVault");
    vault = await ShadowLendVault.deploy(await usdc.getAddress(), await pool.getAddress());
    await vault.waitForDeployment();

    // Wire vault to pool
    await pool.setVault(await vault.getAddress());

    // Seed pool via vault
    await usdc.approve(await vault.getAddress(), SEED);
    await vault.deposit(SEED, deployer.address);

    // Give alice some USDC for testing
    await usdc.transfer(alice.address, ethers.parseUnits("50000", 6));
  });

  describe("Deployment", function () {
    it("should deploy vault with correct name and symbol", async function () {
      expect(await vault.name()).to.equal("ShadowLend USD3");
      expect(await vault.symbol()).to.equal("USD3");
      expect(await vault.decimals()).to.equal(6);
    });

    it("should have correct asset (USDC)", async function () {
      expect(await vault.asset()).to.equal(await usdc.getAddress());
    });

    it("should forward seed deposit to pool", async function () {
      const poolBal = await usdc.balanceOf(await pool.getAddress());
      expect(poolBal).to.equal(SEED);
    });

    it("should mint shares to deployer", async function () {
      const shares = await vault.balanceOf(deployer.address);
      expect(shares).to.be.gt(0);
    });

    it("should report correct totalAssets", async function () {
      const total = await vault.totalAssets();
      expect(total).to.equal(SEED);
    });
  });

  describe("Deposit", function () {
    it("should accept lender deposit and mint shares", async function () {
      const amount = ethers.parseUnits("10000", 6);
      await usdc.connect(alice).approve(await vault.getAddress(), amount);
      await vault.connect(alice).deposit(amount, alice.address);

      const shares = await vault.balanceOf(alice.address);
      expect(shares).to.be.gt(0);

      // Pool should hold the additional USDC
      const poolBal = await usdc.balanceOf(await pool.getAddress());
      expect(poolBal).to.equal(SEED + amount);
    });

    it("should report updated totalAssets after deposit", async function () {
      const amount = ethers.parseUnits("10000", 6);
      await usdc.connect(alice).approve(await vault.getAddress(), amount);
      await vault.connect(alice).deposit(amount, alice.address);

      const total = await vault.totalAssets();
      expect(total).to.equal(SEED + amount);
    });
  });

  describe("Withdraw", function () {
    it("should allow lender to redeem shares for USDC", async function () {
      const amount = ethers.parseUnits("10000", 6);
      await usdc.connect(alice).approve(await vault.getAddress(), amount);
      await vault.connect(alice).deposit(amount, alice.address);

      const shares = await vault.balanceOf(alice.address);
      const balBefore = await usdc.balanceOf(alice.address);

      await vault.connect(alice).redeem(shares, alice.address, alice.address);

      const balAfter = await usdc.balanceOf(alice.address);
      expect(balAfter - balBefore).to.be.closeTo(amount, ethers.parseUnits("1", 6)); // within 1 USDC (rounding)
      expect(await vault.balanceOf(alice.address)).to.equal(0);
    });

    it("should cap maxWithdraw at pool idle liquidity", async function () {
      // Alice deposits
      const amount = ethers.parseUnits("10000", 6);
      await usdc.connect(alice).approve(await vault.getAddress(), amount);
      await vault.connect(alice).deposit(amount, alice.address);

      // Simulate a loan: set alice eligible, borrow most of pool
      await pool.setEligibility(alice.address, true);
      const loanAmt = ethers.parseUnits("100000", 6);
      const orc = orchestrator.connect(alice);
      await orc.requestLoan(loanAmt);
      await orc.finalizeLoan(0, true, "0x");

      // Pool now has very little idle USDC
      const poolIdle = await usdc.balanceOf(await pool.getAddress());
      const maxW = await vault.maxWithdraw(deployer.address);
      expect(maxW).to.be.lte(poolIdle);
    });
  });

  describe("Interest Accrual", function () {
    it("should increase share value after borrower repayment with fee", async function () {
      // Get initial share price
      const sharesBefore = await vault.balanceOf(deployer.address);
      const valueBefore = await vault.convertToAssets(sharesBefore);

      // Alice borrows and repays with fee
      await pool.setEligibility(alice.address, true);
      const loanAmt = ethers.parseUnits("1000", 6);
      const orc = orchestrator.connect(alice);
      await orc.requestLoan(loanAmt);
      await orc.finalizeLoan(0, true, "0x");

      // Alice got 1000 USDC, owes 1050 (5% fee)
      // Repay full amount
      const repayAmt = ethers.parseUnits("1050", 6);
      await usdc.connect(alice).approve(await pool.getAddress(), repayAmt);
      await orc.repayLoan(repayAmt);

      // Now pool has original seed + 50 USDC profit
      const valueAfter = await vault.convertToAssets(sharesBefore);
      expect(valueAfter).to.be.gt(valueBefore);

      // The profit should be ~50 USDC (the fee)
      const profit = valueAfter - valueBefore;
      expect(profit).to.be.closeTo(ethers.parseUnits("50", 6), ethers.parseUnits("1", 6));
    });

    it("should track earnedYield on-chain via cost basis", async function () {
      // Before any loans, yield should be 0
      const yieldBefore = await vault.earnedYield(deployer.address);
      expect(yieldBefore).to.equal(0);

      // Alice borrows and repays with fee
      await pool.setEligibility(alice.address, true);
      const loanAmt = ethers.parseUnits("1000", 6);
      const orc = orchestrator.connect(alice);
      await orc.requestLoan(loanAmt);
      await orc.finalizeLoan(0, true, "0x");
      const repayAmt = ethers.parseUnits("1050", 6);
      await usdc.connect(alice).approve(await pool.getAddress(), repayAmt);
      await orc.repayLoan(repayAmt);

      // Yield should now be ~50 USDC
      const yieldAfter = await vault.earnedYield(deployer.address);
      expect(yieldAfter).to.be.closeTo(ethers.parseUnits("50", 6), ethers.parseUnits("1", 6));
    });

    it("should claim yield and reset earned to 0", async function () {
      // Create yield via borrower fee
      await pool.setEligibility(alice.address, true);
      const orc = orchestrator.connect(alice);
      await orc.requestLoan(ethers.parseUnits("1000", 6));
      await orc.finalizeLoan(0, true, "0x");
      await usdc.connect(alice).approve(await pool.getAddress(), ethers.parseUnits("1050", 6));
      await orc.repayLoan(ethers.parseUnits("1050", 6));

      const yieldBefore = await vault.earnedYield(deployer.address);
      expect(yieldBefore).to.be.gt(0);

      const balBefore = await usdc.balanceOf(deployer.address);
      await vault.claimYield(deployer.address);
      const balAfter = await usdc.balanceOf(deployer.address);

      // Should have received ~50 USDC
      expect(balAfter - balBefore).to.be.closeTo(yieldBefore, ethers.parseUnits("2", 6));

      // Earned yield should now be ~0
      const yieldAfterClaim = await vault.earnedYield(deployer.address);
      expect(yieldAfterClaim).to.be.lt(ethers.parseUnits("2", 6));
    });
  });
});
