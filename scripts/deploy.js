/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const scorer = process.env.SCORER_ADDRESS;

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network: Ethereum Sepolia (chain ${(await deployer.provider.getNetwork()).chainId})`);

  // 1. Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const initialSupply = ethers.parseUnits("1000000", 6);
  const usdc = await MockUSDC.deploy(initialSupply);
  await usdc.waitForDeployment();
  console.log(`MockUSDC: ${await usdc.getAddress()}`);

  // 2. Deploy MockLendingPool (FHE-free for testnet — uses plain boolean eligibility)
  const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
  const pool = await MockLendingPool.deploy(
    await usdc.getAddress(),
    deployer.address // temporary orchestrator, updated below
  );
  await pool.waitForDeployment();
  console.log(`MockLendingPool: ${await pool.getAddress()}`);

  // 3. Deploy Orchestrator via UUPS proxy (upgradeable)
  const ShadowLendOrchestrator = await ethers.getContractFactory("ShadowLendOrchestrator");
  const orchestrator = await upgrades.deployProxy(
    ShadowLendOrchestrator,
    [
      await usdc.getAddress(),
      ethers.ZeroAddress, // no CreditScore needed for mock
      await pool.getAddress(),
      deployer.address,
    ],
    { kind: "uups" }
  );
  await orchestrator.waitForDeployment();
  console.log(`Orchestrator (proxy): ${await orchestrator.getAddress()}`);

  // 4. Wire up: hand over pool control to orchestrator
  await (await pool.setOrchestrator(await orchestrator.getAddress())).wait();
  console.log("Pool orchestrator set");

  // 5. Deploy ShadowLendVault (USD3)
  const ShadowLendVault = await ethers.getContractFactory("ShadowLendVault");
  const vault = await ShadowLendVault.deploy(
    await usdc.getAddress(),
    await pool.getAddress()
  );
  await vault.waitForDeployment();
  console.log(`ShadowLendVault (USD3): ${await vault.getAddress()}`);

  // 6. Wire vault to pool
  await (await pool.setVault(await vault.getAddress())).wait();
  console.log("Pool vault set");

  // 7. Seed pool via vault (so vault accounting is correct)
  const seedAmount = ethers.parseUnits("100000", 6);
  await (await usdc.approve(await vault.getAddress(), seedAmount)).wait();
  await (await vault.deposit(seedAmount, deployer.address)).wait();
  console.log(`Seeded pool with ${ethers.formatUnits(seedAmount, 6)} USDC via vault`);

  // 8. Write contract addresses to frontend
  const deployBlock = await deployer.provider.getBlockNumber();
  const addresses = {
    USDC: await usdc.getAddress(),
    LendingPool: await pool.getAddress(),
    Orchestrator: await orchestrator.getAddress(),
    Vault: await vault.getAddress(),
    DeployBlock: deployBlock,
  };

  const outPath = path.join(__dirname, "..", "frontend", "src", "contracts.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));

  console.log("\nDeployed addresses:");
  console.table(addresses);
  console.log(`\nAddresses written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
