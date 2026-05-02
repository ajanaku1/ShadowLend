/* eslint-disable no-console */
const fs   = require("fs");
const path = require("path");
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const scorer = process.env.SCORER_ADDRESS || deployer.address;
  const network = await deployer.provider.getNetwork();

  console.log(`Deployer : ${deployer.address}`);
  console.log(`Scorer   : ${scorer}`);
  console.log(`Network  : chain ${network.chainId}`);
  console.log("─".repeat(50));

  // ── 1. MockUSDC ────────────────────────────────────────────────────────────
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy(ethers.parseUnits("1000000", 6));
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log(`MockUSDC          : ${usdcAddr}`);

  // ── 2. CreditScore (real FHE contract) ────────────────────────────────────
  const CreditScore = await ethers.getContractFactory("CreditScore");
  const creditScore = await CreditScore.deploy(deployer.address);
  await creditScore.waitForDeployment();
  const csAddr = await creditScore.getAddress();
  console.log(`CreditScore       : ${csAddr}`);

  // Grant SCORER_ROLE so the agent wallet can submit encrypted scores
  const SCORER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SCORER_ROLE"));
  await (await creditScore.grantRole(SCORER_ROLE, scorer)).wait();
  console.log(`SCORER_ROLE granted to ${scorer}`);

  // ── 3. MockLendingPool (FHE-free loan flow for demo) ──────────────────────
  const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
  const pool = await MockLendingPool.deploy(
    usdcAddr,
    deployer.address // temporary orchestrator
  );
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`MockLendingPool   : ${poolAddr}`);

  // Grant POOL_ROLE on CreditScore so LendingPool can call incrementRepaymentCount
  // (uses grantPoolRole convenience function added in our update)
  await (await creditScore.grantPoolRole(poolAddr)).wait();
  console.log(`POOL_ROLE granted to MockLendingPool`);

  // ── 4. Orchestrator (UUPS proxy) ──────────────────────────────────────────
  const ShadowLendOrchestrator = await ethers.getContractFactory("ShadowLendOrchestrator");
  const orchestrator = await upgrades.deployProxy(
    ShadowLendOrchestrator,
    [usdcAddr, csAddr, poolAddr, deployer.address],
    { kind: "uups" }
  );
  await orchestrator.waitForDeployment();
  const orchAddr = await orchestrator.getAddress();
  console.log(`Orchestrator      : ${orchAddr}`);

  // Wire pool to orchestrator
  await (await pool.setOrchestrator(orchAddr)).wait();
  console.log(`Pool orchestrator set`);

  // C1: Grant DEFAULT_ADMIN_ROLE to Orchestrator so it can call grantRole/revokeRole
  //     on CreditScore via setTrustedScorer / revokeTrustedScorer.
  const DEFAULT_ADMIN_ROLE = await creditScore.DEFAULT_ADMIN_ROLE();
  await (await creditScore.grantRole(DEFAULT_ADMIN_ROLE, orchAddr)).wait();
  console.log(`DEFAULT_ADMIN_ROLE granted to Orchestrator`);

  // ── 5. ShadowLendVault (USD3) ─────────────────────────────────────────────
  const ShadowLendVault = await ethers.getContractFactory("ShadowLendVault");
  const vault = await ShadowLendVault.deploy(usdcAddr, poolAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`ShadowLendVault   : ${vaultAddr}`);

  await (await pool.setVault(vaultAddr)).wait();
  console.log(`Pool vault set`);

  // ── 6. Seed pool via vault ─────────────────────────────────────────────────
  const seedAmount = ethers.parseUnits("100000", 6);
  await (await usdc.approve(vaultAddr, seedAmount)).wait();
  await (await vault.deposit(seedAmount, deployer.address)).wait();
  console.log(`Pool seeded with ${ethers.formatUnits(seedAmount, 6)} USDC`);

  // ── 7. Write addresses to frontend + env ──────────────────────────────────
  const deployBlock = await deployer.provider.getBlockNumber();

  const addresses = {
    USDC:        usdcAddr,
    CreditScore: csAddr,
    LendingPool: poolAddr,
    Orchestrator: orchAddr,
    Vault:       vaultAddr,
    DeployBlock: deployBlock,
  };

  const frontendPath = path.join(__dirname, "..", "frontend", "src", "contracts.json");
  fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
  console.log(`\ncontracts.json updated at ${frontendPath}`);

  // Print env vars to update manually
  console.log("\n─── Update your .env ───────────────────────────────────────");
  console.log(`CREDIT_SCORE_ADDRESS=${csAddr}`);
  console.log(`LENDING_POOL_ADDRESS=${poolAddr}`);
  console.log("────────────────────────────────────────────────────────────");

  console.log("\nDeployed addresses:");
  console.table(addresses);
  console.log("\nDone. Run the agent and verify CREDIT_SCORE_ADDRESS is updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
