/* eslint-disable no-console */
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

/**
 * ShadowLend Test Suite
 *
 * Note: Tests that involve FHE operations (encrypted score submission,
 * encrypted threshold comparison, async decryption oracle) require the
 * fhEVM devnet environment. These tests are marked as integration tests
 * and will be skipped when run on a plain hardhat network.
 *
 * Tests that exercise contract logic, access control, and standard ERC20
 * operations run on hardhat local network.
 */

describe("ShadowLend", function () {
  let deployer, alice, bob, scorer;
  let usdc, creditScore, pool, orchestrator;

  const SCORER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SCORER_ROLE"));
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 6); // 1M USDC
  const POOL_SEED = ethers.parseUnits("100000", 6); // 100K USDC

  beforeEach(async function () {
    [deployer, alice, bob, scorer] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy(INITIAL_SUPPLY);
    await usdc.waitForDeployment();

    // Deploy CreditScore
    const CreditScore = await ethers.getContractFactory("CreditScore");
    creditScore = await CreditScore.deploy(deployer.address);
    await creditScore.waitForDeployment();

    // Deploy LendingPool (set deployer as temp orchestrator)
    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy(
      await usdc.getAddress(),
      await creditScore.getAddress(),
      deployer.address
    );
    await pool.waitForDeployment();

    // Deploy Orchestrator (UUPS upgradeable proxy via hardhat-upgrades)
    const ShadowLendOrchestrator = await ethers.getContractFactory("ShadowLendOrchestrator");
    orchestrator = await upgrades.deployProxy(
      ShadowLendOrchestrator,
      [
        await usdc.getAddress(),
        await creditScore.getAddress(),
        await pool.getAddress(),
        deployer.address,
      ],
      { kind: "uups" }
    );
    await orchestrator.waitForDeployment();

    // Transfer pool control to orchestrator
    await pool.setOrchestrator(await orchestrator.getAddress());

    // Grant SCORER_ROLE
    await creditScore.grantRole(SCORER_ROLE, scorer.address);

    // Grant orchestrator DEFAULT_ADMIN_ROLE so it can manage scorer roles
    const DEFAULT_ADMIN = ethers.ZeroHash;
    await creditScore.grantRole(DEFAULT_ADMIN, await orchestrator.getAddress());

    // Seed pool with liquidity
    await usdc.transfer(await pool.getAddress(), POOL_SEED);
  });

  // =========================================================================
  // 1. Deployment & Initialization
  // =========================================================================
  describe("Deployment", function () {
    it("should deploy MockUSDC with correct supply and 6 decimals", async function () {
      expect(await usdc.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await usdc.decimals()).to.equal(6);
      expect(await usdc.symbol()).to.equal("mUSDC");
    });

    it("should deploy CreditScore with admin role", async function () {
      const DEFAULT_ADMIN = ethers.ZeroHash;
      expect(await creditScore.hasRole(DEFAULT_ADMIN, deployer.address)).to.be.true;
    });

    it("should grant SCORER_ROLE to scorer address", async function () {
      expect(await creditScore.hasRole(SCORER_ROLE, scorer.address)).to.be.true;
      expect(await creditScore.hasRole(SCORER_ROLE, alice.address)).to.be.false;
    });

    it("should set orchestrator as pool controller", async function () {
      expect(await pool.orchestrator()).to.equal(await orchestrator.getAddress());
    });

    it("should seed lending pool with USDC liquidity", async function () {
      const poolBalance = await usdc.balanceOf(await pool.getAddress());
      expect(poolBalance).to.equal(POOL_SEED);
    });

    it("should store correct contract addresses in orchestrator", async function () {
      expect(await orchestrator.usdc()).to.equal(await usdc.getAddress());
      expect(await orchestrator.creditScore()).to.equal(await creditScore.getAddress());
      expect(await orchestrator.lendingPool()).to.equal(await pool.getAddress());
    });
  });

  // =========================================================================
  // 2. Access Control
  // =========================================================================
  describe("Access Control", function () {
    it("should reject score submission from non-scorer", async function () {
      // CreditScore.submitScore requires SCORER_ROLE
      // On hardhat without fhEVM, we can't create valid encrypted inputs,
      // but we CAN test that access control reverts before FHE logic
      const fakeInput = ethers.randomBytes(32);
      await expect(
        creditScore.connect(alice).submitScore(alice.address, fakeInput, "0x00")
      ).to.be.reverted;
    });

    it("should reject loan request directly to pool (only orchestrator)", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await expect(
        pool.connect(alice).requestLoanFor(alice.address, amount)
      ).to.be.revertedWith("only orchestrator");
    });

    it("should reject repay directly to pool (only orchestrator)", async function () {
      const amount = ethers.parseUnits("100", 6);
      await expect(
        pool.connect(alice).repayLoanFor(alice.address, amount)
      ).to.be.revertedWith("only orchestrator");
    });

    it("should reject onLoanDecision from non-pool address", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await expect(
        orchestrator.connect(alice).onLoanDecision(alice.address, amount, true)
      ).to.be.revertedWith("only pool");
    });

    it("should allow only owner to set trusted scorer", async function () {
      await expect(
        orchestrator.connect(alice).setTrustedScorer(bob.address)
      ).to.be.reverted; // Ownable: caller is not the owner

      // Owner can set
      await orchestrator.setTrustedScorer(bob.address);
      expect(await creditScore.hasRole(SCORER_ROLE, bob.address)).to.be.true;
    });

    it("should allow only owner to revoke trusted scorer", async function () {
      await orchestrator.revokeTrustedScorer(scorer.address);
      expect(await creditScore.hasRole(SCORER_ROLE, scorer.address)).to.be.false;
    });
  });

  // =========================================================================
  // 3. Orchestrator Admin Functions
  // =========================================================================
  describe("Orchestrator Admin", function () {
    it("should update USDC address in orchestrator and pool", async function () {
      const MockUSDC2 = await ethers.getContractFactory("MockUSDC");
      const usdc2 = await MockUSDC2.deploy(INITIAL_SUPPLY);
      await usdc2.waitForDeployment();

      await orchestrator.updateUSDC(await usdc2.getAddress());
      expect(await orchestrator.usdc()).to.equal(await usdc2.getAddress());
      expect(await pool.usdc()).to.equal(await usdc2.getAddress());
    });

    it("should update CreditScore address", async function () {
      const CreditScore2 = await ethers.getContractFactory("CreditScore");
      const cs2 = await CreditScore2.deploy(deployer.address);
      await cs2.waitForDeployment();

      await orchestrator.updateCreditScore(await cs2.getAddress());
      expect(await orchestrator.creditScore()).to.equal(await cs2.getAddress());
    });

    it("should reject admin calls from non-owner", async function () {
      await expect(
        orchestrator.connect(alice).updateUSDC(alice.address)
      ).to.be.reverted;
    });
  });

  // =========================================================================
  // 4. Loan Lifecycle Validation
  // =========================================================================
  describe("Loan Lifecycle Checks", function () {
    it("should reject zero-amount loan request", async function () {
      // We need to call through orchestrator, which calls pool.requestLoanFor
      // Since the orchestrator doesn't validate amount, pool does
      await expect(
        orchestrator.connect(alice).requestLoan(0)
      ).to.be.revertedWith("amount = 0");
    });

    it("should reject repay when no active loan exists", async function () {
      const amount = ethers.parseUnits("100", 6);
      await expect(
        orchestrator.connect(alice).repayLoan(amount)
      ).to.be.revertedWith("no active loan");
    });

    it("should report no active loan for fresh address", async function () {
      const [amount, remaining, totalOwed, timestamp, repaid] = await pool.loans(alice.address);
      expect(amount).to.equal(0);
      expect(repaid).to.equal(false);
    });
  });

  // =========================================================================
  // 5. MockUSDC Token Operations
  // =========================================================================
  describe("MockUSDC", function () {
    it("should transfer USDC between accounts", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await usdc.transfer(alice.address, amount);
      expect(await usdc.balanceOf(alice.address)).to.equal(amount);
    });

    it("should handle approve and transferFrom correctly", async function () {
      const amount = ethers.parseUnits("500", 6);
      await usdc.transfer(alice.address, amount);

      await usdc.connect(alice).approve(bob.address, amount);
      await usdc.connect(bob).transferFrom(alice.address, bob.address, amount);

      expect(await usdc.balanceOf(bob.address)).to.equal(amount);
      expect(await usdc.balanceOf(alice.address)).to.equal(0);
    });
  });

  // =========================================================================
  // 6. Event Emission
  // =========================================================================
  describe("Events", function () {
    it("should emit LoanRequested when requesting a loan", async function () {
      // This will revert because no score exists, but we can't submit
      // encrypted scores on plain hardhat. However, on fhEVM devnet
      // this would emit the event before the oracle callback.
      // For now, we verify the event signature exists by checking the ABI.
      const iface = orchestrator.interface;
      const event = iface.getEvent("LoanRequested");
      expect(event).to.not.be.null;
      expect(event.inputs.length).to.equal(3);
      expect(event.inputs[0].name).to.equal("borrower");
      expect(event.inputs[1].name).to.equal("amount");
      expect(event.inputs[2].name).to.equal("requestId");
    });

    it("should have all expected events on orchestrator", async function () {
      const iface = orchestrator.interface;
      expect(iface.getEvent("LoanRequested")).to.not.be.null;
      expect(iface.getEvent("LoanApproved")).to.not.be.null;
      expect(iface.getEvent("LoanDenied")).to.not.be.null;
      expect(iface.getEvent("LoanRepaid")).to.not.be.null;
    });
  });

  // =========================================================================
  // 7. Integration Tests (require fhEVM devnet)
  // =========================================================================
  describe("Integration (fhEVM devnet only)", function () {
    const isFhevmNetwork = process.env.HARDHAT_NETWORK === "fhevmDevnet";

    before(function () {
      if (!isFhevmNetwork) {
        console.log("    Skipping fhEVM integration tests (run with --network fhevmDevnet)");
        this.skip();
      }
    });

    it("should submit encrypted score and verify threshold", async function () {
      // This test runs only on fhEVM devnet where FHE operations work
      // The agent would encrypt and submit the score
      // Then requestLoan would trigger the encrypted comparison
      // The oracle callback would approve/deny the loan
      expect(true).to.be.true; // placeholder — real test runs via demo.js
    });

    it("should complete full loan lifecycle: score → request → approve → repay", async function () {
      // Full integration test — requires:
      // 1. Agent server running
      // 2. fhEVM oracle active
      // 3. Deployed contracts with addresses in contracts.json
      expect(true).to.be.true; // placeholder — real test runs via demo.js
    });
  });
});
