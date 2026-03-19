/* eslint-disable no-console */
require("dotenv").config();

const { ethers } = require("hardhat");

const agentUrl = process.env.AGENT_URL || "http://localhost:8080";
const agentKey = process.env.AGENT_API_KEY || "demo-key";

const orchestratorAbi = [
  "event LoanRequested(address indexed borrower, uint256 amount)",
  "event LoanApproved(address indexed borrower, uint256 amount)",
  "event LoanDenied(address indexed borrower, uint256 amount)",
  "event LoanRepaid(address indexed borrower, uint256 amount)",
  "function requestLoan(uint256 amount) external",
  "function repayLoan() external",
];

const lendingPoolAbi = [
  "function loans(address borrower) external view returns (uint256 amount, uint256 timestamp, bool repaid)",
];

const usdcAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];

async function submitToAgent(borrowerAddress, payload) {
  const resp = await fetch(`${agentUrl}/score`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-key": agentKey,
    },
    body: JSON.stringify({ borrowerAddress, ...payload }),
  });
  if (!resp.ok) throw new Error(`Agent error: ${resp.status}`);
  return resp.json();
}

function formatHash(hash) {
  return hash ? `${hash.slice(0, 10)}...` : "-";
}

async function waitForDecision(orchestrator, borrower) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Decision timeout")), 120000);

    const onApproved = (addr, amount) => {
      if (addr.toLowerCase() === borrower.toLowerCase()) {
        cleanup();
        resolve({ approved: true, amount: Number(amount) });
      }
    };

    const onDenied = (addr, amount) => {
      if (addr.toLowerCase() === borrower.toLowerCase()) {
        cleanup();
        resolve({ approved: false, amount: Number(amount) });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      orchestrator.off("LoanApproved", onApproved);
      orchestrator.off("LoanDenied", onDenied);
    };

    orchestrator.on("LoanApproved", onApproved);
    orchestrator.on("LoanDenied", onDenied);
  });
}

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.FHEVM_RPC_URL || "https://devnet.zama.ai");

  const alice = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY, provider);
  const bob = new ethers.Wallet(process.env.BOB_PRIVATE_KEY, provider);

  const contracts = require("../frontend/src/contracts.json");
  const orchestrator = new ethers.Contract(contracts.Orchestrator, orchestratorAbi, provider);
  const pool = new ethers.Contract(contracts.LendingPool, lendingPoolAbi, provider);
  const usdc = new ethers.Contract(contracts.USDC, usdcAbi, provider);

  console.log("\n--- ShadowLend Demo ---\n");

  console.log("1) Submit Alice credit profile");
  const aliceAgent = await submitToAgent(alice.address, {
    income: 95000,
    employmentMonths: 48,
    existingDebt: 8000,
    missedPayments: 0,
  });
  console.log(`   Agent tx: ${formatHash(aliceAgent.txHash)}`);

  console.log("2) Submit Bob credit profile");
  const bobAgent = await submitToAgent(bob.address, {
    income: 28000,
    employmentMonths: 6,
    existingDebt: 25000,
    missedPayments: 4,
  });
  console.log(`   Agent tx: ${formatHash(bobAgent.txHash)}`);

  console.log("3) Alice requests a $2,500 loan");
  const aliceOrch = orchestrator.connect(alice);
  const aliceTx = await aliceOrch.requestLoan(ethers.parseUnits("2500", 6));
  await aliceTx.wait();
  console.log(`   Request tx: ${formatHash(aliceTx.hash)}`);

  const aliceDecision = await waitForDecision(orchestrator, alice.address);
  console.log(`   Decision: ${aliceDecision.approved ? "APPROVED" : "DENIED"}`);

  console.log("4) Bob requests a $1,000 loan");
  const bobOrch = orchestrator.connect(bob);
  const bobTx = await bobOrch.requestLoan(ethers.parseUnits("1000", 6));
  await bobTx.wait();
  console.log(`   Request tx: ${formatHash(bobTx.hash)}`);

  const bobDecision = await waitForDecision(orchestrator, bob.address);
  console.log(`   Decision: ${bobDecision.approved ? "APPROVED" : "DENIED"}`);

  if (aliceDecision.approved) {
    console.log("5) Alice repays the loan");
    const loan = await pool.loans(alice.address);
    const fee = (loan.amount * 5n) / 100n;
    const repayAmount = loan.amount + fee;

    const usdcAlice = usdc.connect(alice);
    const approveTx = await usdcAlice.approve(contracts.LendingPool, repayAmount);
    await approveTx.wait();

    const repayTx = await aliceOrch.repayLoan();
    await repayTx.wait();
    console.log(`   Repay tx: ${formatHash(repayTx.hash)}`);
  }

  console.log("\nDemo complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
