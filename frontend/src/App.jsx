import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import contractAddresses from "./contracts.json";

import {
  AGENT_URL, AGENT_KEY, FHEVM_CHAIN_ID,
  ORCHESTRATOR_ABI, LENDING_POOL_ABI, USDC_ABI,
  ACCEPTED_TYPES, MAX_FILE_SIZE, MAX_FILES, FLOW_STEPS,
} from "./config/constants";
import { sleep, rh, truncHash, getMaxBorrow, getQuickAmounts, getInterestRate } from "./utils/helpers";
import { cacheScore, loadCachedScore } from "./utils/scoreCache";

import Navbar from "./components/Navbar";
import BorrowerForm from "./components/BorrowerForm";
import LoanCard from "./components/LoanCard";
import RepayCard from "./components/RepayCard";

// ---------------------------------------------------------------------------
// Agent API call
// ---------------------------------------------------------------------------
async function callAgent(borrowerAddress, formData, files) {
  const body = new FormData();
  body.append("borrowerAddress", borrowerAddress);
  body.append("income", Number(formData.income));
  body.append("employmentMonths", Number(formData.employment));
  body.append("existingDebt", Number(formData.debt));
  body.append("missedPayments", Number(formData.missed));
  if (files && files.length > 0) {
    files.forEach((f) => body.append("documents", f));
  }

  const resp = await fetch(`${AGENT_URL}/score`, {
    method: "POST",
    headers: { "x-agent-key": AGENT_KEY },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Agent error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ===========================================================================
// App
// ===========================================================================
export default function App() {
  // --- wallet ---
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainOk, setChainOk] = useState(false);

  // --- wallet dropdown ---
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  // --- update score modal ---
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({ income: "", employment: "", debt: "", missed: "" });
  const [updateFiles, setUpdateFiles] = useState([]);
  const [updateFileError, setUpdateFileError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);

  // --- form ---
  const [form, setForm] = useState({ income: "", employment: "", debt: "", missed: "" });
  const [hashes, setHashes] = useState(["0x7a3f", "0x9b2e", "0x4d1c", "0xf8a0"]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileError, setFileError] = useState(null);

  // --- flow ---
  const [flowStep, setFlowStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [agentTxHash, setAgentTxHash] = useState(null);
  const [aiScore, setAiScore] = useState(null);
  const [aiEligible, setAiEligible] = useState(null);
  const [aiFactors, setAiFactors] = useState(null);
  const [interestRate, setInterestRate] = useState(5);

  // --- loan ---
  const [loanInput, setLoanInput] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [reqStatus, setReqStatus] = useState(null);
  const [loanTxHash, setLoanTxHash] = useState(null);

  // --- repay ---
  const [repaying, setRepaying] = useState(false);
  const [repayTxHash, setRepayTxHash] = useState(null);
  const [repayStatus, setRepayStatus] = useState(null);

  // --- on-chain position ---
  const [outstanding, setOutstanding] = useState(0);
  const [loanRemaining, setLoanRemaining] = useState(0);
  const [loanTotalOwed, setLoanTotalOwed] = useState(0);
  const [repayInput, setRepayInput] = useState("");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);
  const [faucetStatus, setFaucetStatus] = useState(null);

  // --- encryption visualization ---
  const [encryptionMode, setEncryptionMode] = useState(null);
  const [ciphertext, setCiphertext] = useState(null);
  const [loanPath, setLoanPath] = useState(null);

  // ---------------------------------------------------------------------------
  // Restore state from encrypted contracts + localStorage when wallet connects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!account || !provider) return;

    (async () => {
      try {
        const cached = loadCachedScore(account);
        if (cached && cached.score > 0) {
          setAiScore(cached.score);
          setAiEligible(cached.eligible);
          setInterestRate(cached.rate);
          setCreditLimit(cached.creditLimit || getMaxBorrow(cached.score));
          setSubmitDone(true);
          setFlowStep(4);
          if (cached.factors) setAiFactors(cached.factors);
          if (cached.encryptionMode) setEncryptionMode(cached.encryptionMode);
          if (cached.ciphertext) setCiphertext(cached.ciphertext);
        }

        if (contractAddresses.LendingPool) {
          const pool = new ethers.Contract(contractAddresses.LendingPool, LENDING_POOL_ABI, provider);
          const loan = await pool.loans(account);
          const loanAmount = Number(ethers.formatUnits(loan.amount, 6));
          const remaining = Number(ethers.formatUnits(loan.remaining, 6));
          const totalOwed = Number(ethers.formatUnits(loan.totalOwed, 6));
          if (loanAmount > 0 && !loan.repaid) {
            setOutstanding(loanAmount);
            setLoanRemaining(remaining);
            setLoanTotalOwed(totalOwed);
            setLoanPath("orchestrator");
            if (cached && cached.score > 0) setFlowStep(5);
          }
        }

        if (contractAddresses.USDC) {
          const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, provider);
          const bal = await usdc.balanceOf(account);
          const balNum = Number(ethers.formatUnits(bal, 6));
          setUsdcBalance(balNum);

          // Auto-claim faucet for new users with 0 USDC
          if (balNum === 0) {
            try {
              setFaucetStatus({ type: "wait", text: "Welcome! Claiming 1,000 mUSDC for testing..." });
              const resp = await fetch(`${AGENT_URL}/faucet`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-agent-key": AGENT_KEY },
                body: JSON.stringify({ address: account, usdcAddress: contractAddresses.USDC }),
              });
              const data = await resp.json();
              if (data.success && !data.alreadyClaimed) {
                const newBal = await usdc.balanceOf(account);
                setUsdcBalance(Number(ethers.formatUnits(newBal, 6)));
                setFaucetStatus({ type: "ok", text: "1,000 mUSDC deposited to your wallet!" });
              } else if (data.alreadyClaimed) {
                setFaucetStatus(null);
              } else {
                setFaucetStatus(null);
              }
              setTimeout(() => setFaucetStatus(null), 4000);
            } catch (e) {
              console.warn("Faucet claim failed:", e);
              setFaucetStatus(null);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to restore on-chain state:", e);
      }
    })();
  }, [account, provider]);

  // ---------------------------------------------------------------------------
  // Hash scramble effect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const iv = setInterval(() => {
      const vals = [form.income, form.employment, form.debt, form.missed];
      setHashes((prev) => prev.map((h, i) => (vals[i] ? rh(4) : h)));
    }, 150);
    return () => clearInterval(iv);
  }, [form]);

  // ---------------------------------------------------------------------------
  // File upload handler
  // ---------------------------------------------------------------------------
  const handleFileUpload = (e) => {
    setFileError(null);
    const incoming = Array.from(e.target.files);
    const total = uploadedFiles.length + incoming.length;
    if (total > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} documents allowed`);
      return;
    }
    for (const f of incoming) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setFileError(`Unsupported file type: ${f.name}. Use PDF, PNG, JPG, or WebP.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`File too large: ${f.name}. Max 5MB per file.`);
        return;
      }
    }
    setUploadedFiles((prev) => [...prev, ...incoming]);
    e.target.value = "";
  };

  const removeFile = (idx) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
    setFileError(null);
  };

  // ---------------------------------------------------------------------------
  // Wallet connection
  // ---------------------------------------------------------------------------
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use ShadowLend");
      return;
    }
    try {
      sessionStorage.removeItem("shadowlend_disconnected");
      const bp = new ethers.BrowserProvider(window.ethereum);
      const accounts = await bp.send("eth_requestAccounts", []);
      const s = await bp.getSigner();
      const network = await bp.getNetwork();

      setProvider(bp);
      setSigner(s);
      setAccount(accounts[0]);
      setChainOk(Number(network.chainId) === FHEVM_CHAIN_ID);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainOk(false);
    sessionStorage.setItem("shadowlend_disconnected", "1");
  }, []);

  // Auto-reconnect on mount (unless user explicitly disconnected)
  useEffect(() => {
    if (!window.ethereum) return;
    if (sessionStorage.getItem("shadowlend_disconnected")) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accts) => {
      if (accts.length > 0) connectWallet();
    }).catch(() => {});
  }, [connectWallet]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accts) => {
      if (accts.length === 0) disconnectWallet();
      else setAccount(accts[0]);
    };
    const onChain = () => {
      window.location.reload();
    };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [disconnectWallet]);

  // Switch to Sepolia
  function switchChain() {
    const hexChainId = "0x" + FHEVM_CHAIN_ID.toString(16);
    const addChain = () =>
      window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexChainId,
          chainName: "Sepolia Testnet",
          nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });

    window.ethereum
      .request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] })
      .catch(function () {
        return addChain();
      });
  }

  // ---------------------------------------------------------------------------
  // Contracts (derived) -- encrypted path only
  // ---------------------------------------------------------------------------
  const getOrchestrator = useCallback(
    () => signer && contractAddresses.Orchestrator
      ? new ethers.Contract(contractAddresses.Orchestrator, ORCHESTRATOR_ABI, signer)
      : null,
    [signer]
  );

  const getLendingPool = useCallback(
    () => provider && contractAddresses.LendingPool
      ? new ethers.Contract(contractAddresses.LendingPool, LENDING_POOL_ABI, provider)
      : null,
    [provider]
  );

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isNumeric = (v) => v !== "" && !isNaN(Number(v)) && Number(v) >= 0;
  const allFilled = form.income && form.employment && form.debt && form.missed;
  const allValid = allFilled && isNumeric(form.income) && isNumeric(form.employment) && isNumeric(form.debt) && isNumeric(form.missed);
  const hasDocuments = uploadedFiles.length > 0;
  const canSubmit = allValid && hasDocuments && account && !submitting && !submitDone;
  const walletConnected = !!account;

  // ---------------------------------------------------------------------------
  // 1) Submit financial data -> Agent -> Encrypted on-chain score
  // ---------------------------------------------------------------------------
  const doSubmit = async () => {
    if (!account) return;
    setSubmitting(true);
    setSubmitStatus({ type: "wait", text: "Sending financial data to AI agent..." });
    setFlowStep(1);

    try {
      setSubmitStatus({
        type: "wait",
        text: uploadedFiles.length > 0
          ? `Analyzing ${uploadedFiles.length} document${uploadedFiles.length > 1 ? "s" : ""} and computing credit score...`
          : "AI agent is computing your credit score...",
      });
      const result = await callAgent(account, form, uploadedFiles);

      // Step 2: Show AI score
      setFlowStep(2);
      if (result.score != null) {
        setAiScore(result.score);
        setAiEligible(result.eligible);
        if (result.factors) setAiFactors(result.factors);
        if (result.rate != null) setInterestRate(result.rate);
      }
      setSubmitStatus({
        type: result.eligible ? "ok" : "err",
        text: result.score != null
          ? `AI Score: ${result.score}/850 — ${result.eligible ? "Above threshold (650)" : "Below threshold (650)"}`
          : "Credit score computed by AI agent",
      });
      await sleep(2000);

      // Step 3: Show encryption result from agent
      setFlowStep(3);
      setEncryptionMode(result.encryptionMode || "simulated");
      setCiphertext(result.ciphertext || null);
      setSubmitStatus({
        type: "wait",
        text: result.encryptionMode === "live"
          ? "Score encrypted with TFHE and submitted to CreditScore contract..."
          : "Score encrypted with TFHE (fhEVM-ready ciphertext generated)...",
      });
      await sleep(2000);

      // Step 4: Cache score data locally
      const maxBorrowVal = getMaxBorrow(result.score);
      setCreditLimit(maxBorrowVal);
      const scoreData = {
        score: result.score,
        eligible: result.eligible,
        factors: result.factors,
        rate: result.rate || getInterestRate(result.score),
        creditLimit: maxBorrowVal,
        encryptionMode: result.encryptionMode,
        ciphertext: result.ciphertext,
      };
      cacheScore(account, scoreData);
      setAgentTxHash(result.txHash || null);

      // Read real USDC balance
      if (contractAddresses.USDC) {
        try {
          const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, provider);
          const bal = await usdc.balanceOf(account);
          setUsdcBalance(Number(ethers.formatUnits(bal, 6)));
        } catch { /* non-critical */ }
      }

      setFlowStep(4);
      setSubmitting(false);
      setSubmitDone(true);
      setSubmitStatus({
        type: "ok",
        text: result.encryptionMode === "live"
          ? `Encrypted score submitted on-chain to Sepolia! Tx: ${truncHash(result.txHash)}`
          : `Credit profile encrypted. Agent submitted score to CreditScore contract.`,
        txHash: result.encryptionMode === "live" ? result.txHash : null,
      });
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitting(false);
      setFlowStep(0);
      const msg = err.message || "Failed to submit";
      setSubmitStatus({
        type: "err",
        text: msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Cannot reach the scoring agent. Is it running? (npm run agent)"
          : msg.includes("401") || msg.includes("unauthorized")
          ? "Agent authentication failed. Check your VITE_AGENT_KEY."
          : msg,
      });
    }
  };

  // ---------------------------------------------------------------------------
  // 2) Request loan -- encrypted path via Orchestrator + self-relaying decryption
  // ---------------------------------------------------------------------------
  const doRequest = async () => {
    if (!signer) return;
    if (!aiScore || !aiEligible) {
      setReqStatus({ type: "err", text: "Submit your application and get scored first." });
      return;
    }
    const loanAmt = Math.floor(Number(loanInput));
    if (loanAmt <= 0) {
      setReqStatus({ type: "err", text: "Enter a valid amount." });
      return;
    }
    if (loanAmt + loanRemaining > creditLimit) {
      setReqStatus({ type: "err", text: `Exceeds credit limit. Available: $${Math.floor(creditLimit - loanRemaining).toLocaleString()}` });
      return;
    }

    const orchestrator = getOrchestrator();
    if (!orchestrator) {
      setReqStatus({ type: "err", text: "Orchestrator contract not available. Check contract addresses." });
      return;
    }

    setRequesting(true);
    const amount = ethers.parseUnits(String(loanAmt), 6);

    try {
      // Estimate gas first to catch revert reasons early
      try {
        await orchestrator.requestLoan.estimateGas(amount);
      } catch (gasErr) {
        const reason = gasErr.reason || gasErr.message || "";
        if (reason.includes("score not found")) {
          throw new Error("Credit score not found on-chain. Please re-submit your application to refresh your encrypted score.");
        }
        if (reason.includes("insufficient liquidity")) {
          throw new Error("Lending pool has insufficient liquidity for this amount.");
        }
        // Let it through for other cases — the actual tx will give a better error
      }

      setReqStatus({ type: "wait", text: "Requesting loan via Orchestrator..." });
      const tx = await orchestrator.requestLoan(amount);
      setLoanTxHash(tx.hash);
      setReqStatus({ type: "wait", text: `Loan request submitted (${truncHash(tx.hash)}). Waiting for confirmation...` });
      const receipt = await tx.wait();

      const iface = new ethers.Interface(ORCHESTRATOR_ABI);
      let requestId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === "LoanRequested") {
            requestId = parsed.args[2];
            break;
          }
        } catch { /* not our event */ }
      }
      if (requestId === null) throw new Error("Could not find LoanRequested event");

      setReqStatus({
        type: "wait",
        text: aiEligible
          ? "Eligibility confirmed! Finalizing loan on-chain..."
          : "Submitting eligibility result to finalize...",
      });
      const finalizeTx = await orchestrator.finalizeLoan(requestId, aiEligible, "0x");
      setReqStatus({ type: "wait", text: `Finalization tx submitted (${truncHash(finalizeTx.hash)}). Confirming...` });
      const finalizeReceipt = await finalizeTx.wait();

      let approved = false;
      for (const log of finalizeReceipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === "LoanApproved") { approved = true; break; }
          if (parsed.name === "LoanDenied") { approved = false; break; }
        } catch { /* not our event */ }
      }

      if (!approved) {
        setReqStatus({ type: "err", text: "Loan denied — encrypted score below threshold (650)." });
        setRequesting(false);
        return;
      }

      setLoanPath("orchestrator");

      const pool = new ethers.Contract(contractAddresses.LendingPool, LENDING_POOL_ABI, provider);
      const loan = await pool.loans(account);
      const newOutstanding = Number(ethers.formatUnits(loan.amount, 6));
      const newRemaining = Number(ethers.formatUnits(loan.remaining, 6));
      const newTotalOwed = Number(ethers.formatUnits(loan.totalOwed, 6));

      const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, provider);
      const bal = await usdc.balanceOf(account);

      setFlowStep(5);
      setOutstanding(newOutstanding);
      setLoanRemaining(newRemaining);
      setLoanTotalOwed(newTotalOwed);
      setUsdcBalance(Number(ethers.formatUnits(bal, 6)));
      setLoanInput("");
      setReqStatus({
        type: "ok",
        text: `Borrowed $${loanAmt.toLocaleString()} USDC via FHE-verified credit check. Total owed: $${newRemaining.toLocaleString()} (incl. 5% fee)`,
      });
    } catch (err) {
      console.error("Loan request error:", err);
      const msg = err.code === "ACTION_REJECTED"
        ? "Transaction rejected by user"
        : err.reason || err.message || "Loan request failed";
      setReqStatus({ type: "err", text: msg });
    } finally {
      setRequesting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3) Repay loan -- encrypted path via Orchestrator + USDC approval
  // ---------------------------------------------------------------------------
  const doRepay = async (overrideAmount) => {
    if (!signer || loanRemaining <= 0) return;

    const payAmount = overrideAmount || Number(repayInput);
    if (!payAmount || payAmount <= 0) {
      setRepayStatus({ type: "err", text: "Enter an amount to repay." });
      return;
    }
    const cappedAmount = Math.min(payAmount, loanRemaining);

    if (usdcBalance < cappedAmount) {
      setRepayStatus({
        type: "err",
        text: `Insufficient USDC. Need $${cappedAmount.toFixed(2)} but have $${usdcBalance.toFixed(2)}.`,
      });
      return;
    }

    const orchestrator = getOrchestrator();
    if (!orchestrator) {
      setRepayStatus({ type: "err", text: "Orchestrator contract not available." });
      return;
    }

    setRepaying(true);
    try {
      const usdc = new ethers.Contract(contractAddresses.USDC, USDC_ABI, signer);
      const amountWei = ethers.parseUnits(String(Math.ceil(cappedAmount * 100) / 100), 6);

      setRepayStatus({ type: "wait", text: `Approving $${cappedAmount.toFixed(2)} USDC...` });
      const approveTx = await usdc.approve(contractAddresses.LendingPool, amountWei);
      await approveTx.wait();

      setRepayStatus({ type: "wait", text: "Submitting repayment..." });
      const tx = await orchestrator.repayLoan(amountWei);
      setRepayTxHash(tx.hash);
      setRepayStatus({ type: "wait", text: `Tx submitted (${truncHash(tx.hash)}). Confirming...` });
      await tx.wait();

      const pool = new ethers.Contract(contractAddresses.LendingPool, LENDING_POOL_ABI, provider);
      const loan = await pool.loans(account);
      const usdcRead = new ethers.Contract(contractAddresses.USDC, USDC_ABI, provider);
      const bal = await usdcRead.balanceOf(account);

      const newRemaining = loan.repaid ? 0 : Number(ethers.formatUnits(loan.remaining, 6));
      const newOutstanding = loan.repaid ? 0 : Number(ethers.formatUnits(loan.amount, 6));
      setOutstanding(newOutstanding);
      setLoanRemaining(newRemaining);
      setUsdcBalance(Number(ethers.formatUnits(bal, 6)));
      setRepayInput("");

      if (loan.repaid) {
        setRepayStatus({ type: "ok", text: "Fully repaid! Credit line restored." });
      } else {
        setRepayStatus({
          type: "ok",
          text: `Paid $${cappedAmount.toFixed(2)}. Remaining: $${newRemaining.toFixed(2)}`,
        });
      }
    } catch (err) {
      console.error("Repay error:", err);
      const msg = err.code === "ACTION_REJECTED"
        ? "Transaction rejected by user"
        : err.reason || err.message || "Repayment failed";
      setRepayStatus({ type: "err", text: msg });
    } finally {
      setRepaying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4) Update score (re-score with new data)
  // ---------------------------------------------------------------------------
  const handleUpdateFileUpload = (e) => {
    setUpdateFileError(null);
    const incoming = Array.from(e.target.files);
    if (updateFiles.length + incoming.length > MAX_FILES) {
      setUpdateFileError(`Maximum ${MAX_FILES} documents allowed`);
      return;
    }
    for (const f of incoming) {
      if (!ACCEPTED_TYPES.includes(f.type)) { setUpdateFileError(`Unsupported type: ${f.name}`); return; }
      if (f.size > MAX_FILE_SIZE) { setUpdateFileError(`Too large: ${f.name}`); return; }
    }
    setUpdateFiles((prev) => [...prev, ...incoming]);
    e.target.value = "";
  };

  const doUpdateScore = async () => {
    const uf = updateForm;
    const allFilled = uf.income && uf.employment && uf.debt && uf.missed;
    const allNum = allFilled && [uf.income, uf.employment, uf.debt, uf.missed].every(v => v !== "" && !isNaN(Number(v)) && Number(v) >= 0);
    if (!allNum) { setUpdateStatus({ type: "err", text: "Fill all fields with valid numbers." }); return; }
    if (updateFiles.length === 0) { setUpdateStatus({ type: "err", text: "Upload at least one document." }); return; }
    if (outstanding > 0) { setUpdateStatus({ type: "err", text: "Repay all outstanding debt before updating your score." }); return; }

    setUpdating(true);
    setUpdateStatus({ type: "wait", text: "AI agent is re-evaluating your credit profile..." });

    try {
      const result = await callAgent(account, updateForm, updateFiles);

      if (result.encryptionMode) setEncryptionMode(result.encryptionMode);
      if (result.ciphertext) setCiphertext(result.ciphertext);

      const maxBorrowVal = getMaxBorrow(result.score);
      const scoreData = {
        score: result.score,
        eligible: result.eligible,
        factors: result.factors,
        rate: result.rate || getInterestRate(result.score),
        creditLimit: maxBorrowVal,
        encryptionMode: result.encryptionMode,
        ciphertext: result.ciphertext,
      };
      cacheScore(account, scoreData);

      setAiScore(result.score);
      setAiEligible(result.eligible);
      if (result.factors) setAiFactors(result.factors);
      setInterestRate(result.rate || getInterestRate(result.score));
      setCreditLimit(maxBorrowVal);
      setAgentTxHash(result.txHash || null);

      setUpdateStatus({ type: "ok", text: `Score updated to ${result.score}/850! Encrypted score submitted to CreditScore contract.` });
      setTimeout(() => {
        setShowUpdateModal(false);
        setUpdateStatus(null);
        setUpdateForm({ income: "", employment: "", debt: "", missed: "" });
        setUpdateFiles([]);
      }, 1500);
    } catch (err) {
      console.error("Update score error:", err);
      const msg = err.code === "ACTION_REJECTED" ? "Transaction rejected" : (err.message || "Failed to update score");
      setUpdateStatus({ type: "err", text: msg });
    } finally {
      setUpdating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------
  const maxBorrow = creditLimit || getMaxBorrow(aiScore);
  const availableCredit = Math.max(0, Math.floor((maxBorrow - loanRemaining) * 100) / 100);
  const quickBorrowAmounts = getQuickAmounts(Math.floor(availableCredit));
  const loanInputNum = Number(loanInput) || 0;
  const loanInputValid = loanInput !== "" && loanInputNum > 0 && loanInputNum <= availableCredit;
  const repayInputNum = Number(repayInput) || 0;
  const repayInputValid = repayInputNum > 0 && repayInputNum <= loanRemaining;
  const paidSoFar = loanTotalOwed - loanRemaining;
  const repayProgress = loanTotalOwed > 0 ? (paidSoFar / loanTotalOwed) * 100 : 0;

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <>
      {/* Blobs */}
      <div className="blob-container">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="page">
        {/* Nav */}
        <Navbar
          account={account}
          walletConnected={walletConnected}
          connectWallet={connectWallet}
          disconnectWallet={disconnectWallet}
          walletMenuOpen={walletMenuOpen}
          setWalletMenuOpen={setWalletMenuOpen}
        />

        {/* App Header */}
        <section className="app-header">
          <h1 className="app-title">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Private Credit Line
          </h1>
          <p className="app-subtitle">
            Submit your financial signals, upload supporting documents, and receive an instant credit line — all without revealing your data.
          </p>
        </section>

        {/* Chain warning */}
        {walletConnected && !chainOk && (
          <div className="chain-warning">
            <span>Wrong network. ShadowLend runs on Sepolia (Zama fhEVM coprocessor).</span>
            <button className="chain-switch-btn" onClick={switchChain}>
              Switch to Sepolia
            </button>
          </div>
        )}

        {/* Faucet status */}
        {faucetStatus && (
          <div className={`status show ${faucetStatus.type}`} style={{ maxWidth: 900, margin: "0 auto 16px", textAlign: "center" }}>
            {faucetStatus.type === "wait" && <div className="sp" />}
            {faucetStatus.text}
          </div>
        )}

        {/* Flow Bar */}
        <div className="flow-bar" style={{ maxWidth: 900, margin: "0 auto 32px" }}>
          {FLOW_STEPS.map((label, i) => {
            let cls = "fb-step";
            if (i < flowStep) cls += " done";
            else if (i === flowStep) cls += " active";
            return (
              <div key={i} className={cls}>
                <div className="num">
                  {i < flowStep ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {label}
              </div>
            );
          })}
        </div>

        {/* Cards */}
        <section className="main-section">
          <div className="card-grid">
            {/* Application Card */}
            <BorrowerForm
              form={form}
              setForm={setForm}
              hashes={hashes}
              uploadedFiles={uploadedFiles}
              fileError={fileError}
              handleFileUpload={handleFileUpload}
              removeFile={removeFile}
              submitting={submitting}
              submitDone={submitDone}
              submitStatus={submitStatus}
              agentTxHash={agentTxHash}
              aiScore={aiScore}
              aiEligible={aiEligible}
              aiFactors={aiFactors}
              interestRate={interestRate}
              encryptionMode={encryptionMode}
              ciphertext={ciphertext}
              canSubmit={canSubmit}
              walletConnected={walletConnected}
              allFilled={allFilled}
              allValid={allValid}
              hasDocuments={hasDocuments}
              doSubmit={doSubmit}
              onOpenUpdateModal={() => {
                setShowUpdateModal(true);
                setUpdateStatus(null);
                setUpdateForm({ income: "", employment: "", debt: "", missed: "" });
                setUpdateFiles([]);
                setUpdateFileError(null);
              }}
            />

            {/* Loan Card */}
            <LoanCard
              aiScore={aiScore}
              aiEligible={aiEligible}
              interestRate={interestRate}
              maxBorrow={maxBorrow}
              outstanding={outstanding}
              availableCredit={availableCredit}
              loanRemaining={loanRemaining}
              loanTotalOwed={loanTotalOwed}
              paidSoFar={paidSoFar}
              usdcBalance={usdcBalance}
              loanInput={loanInput}
              setLoanInput={setLoanInput}
              loanInputNum={loanInputNum}
              loanInputValid={loanInputValid}
              quickBorrowAmounts={quickBorrowAmounts}
              requesting={requesting}
              reqStatus={reqStatus}
              loanTxHash={loanTxHash}
              submitDone={submitDone}
              doRequest={doRequest}
            />

            {/* Repay Card */}
            <RepayCard
              aiScore={aiScore}
              loanRemaining={loanRemaining}
              loanTotalOwed={loanTotalOwed}
              outstanding={outstanding}
              paidSoFar={paidSoFar}
              repayProgress={repayProgress}
              usdcBalance={usdcBalance}
              repayInput={repayInput}
              setRepayInput={setRepayInput}
              repayInputNum={repayInputNum}
              repayInputValid={repayInputValid}
              repaying={repaying}
              repayStatus={repayStatus}
              repayTxHash={repayTxHash}
              doRepay={doRepay}
            />
          </div>
        </section>
      </div>

      {/* Float Stats */}
      <div className="float-stats">
        <div className="fs-item">
          <div className={`fs-dot ${encryptionMode === "live" ? "g" : "i"}`} /> {encryptionMode === "live" ? "FHE Live" : "FHE Ready"}
        </div>
        <div className="fs-item">
          Network <span className="fs-val">Sepolia</span>
        </div>
        <div className="fs-item">
          <div className="fs-dot g" /> Contracts <span className="fs-val">5</span>
        </div>
        <div className="fs-item">
          Encryption{" "}
          <span className="fs-val" style={{ color: "var(--green)" }}>TFHE</span>
        </div>
      </div>

      {/* Update Score Modal */}
      {showUpdateModal && (
        <div className="modal-overlay" onClick={() => !updating && setShowUpdateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Credit Score</h2>
              <button className="modal-close" onClick={() => !updating && setShowUpdateModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="modal-sub">Submit updated financial data to get a new AI credit score.</p>

            <div className="fg">
              {[
                { key: "income", label: "Annual Income (USD)" },
                { key: "employment", label: "Employment Length (months)" },
                { key: "debt", label: "Existing Debt (USD)" },
                { key: "missed", label: "Missed Payments (last 12 mo)" },
              ].map(({ key, label }) => (
                <div className="fw" key={key}>
                  <label>{label}</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={updateForm[key]}
                    onChange={(e) => setUpdateForm((p) => ({ ...p, [key]: e.target.value }))}
                    disabled={updating}
                  />
                </div>
              ))}
            </div>

            <div className="doc-upload-section" style={{ marginTop: 12 }}>
              <label className="doc-upload-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Proof of Income
                <span className="doc-optional">required</span>
              </label>

              {!updating && (
                <label className="doc-dropzone">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    multiple
                    onChange={handleUpdateFileUpload}
                    style={{ display: "none" }}
                  />
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Click to upload</span>
                  <span className="doc-dropzone-sub">{updateFiles.length}/{MAX_FILES} files</span>
                </label>
              )}

              {updateFileError && (
                <div className="status show err" style={{ marginTop: 8, fontSize: 12 }}>{updateFileError}</div>
              )}

              {updateFiles.length > 0 && (
                <div className="doc-file-list">
                  {updateFiles.map((f, i) => (
                    <div key={i} className="doc-file-item">
                      <div className="doc-file-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="doc-file-info">
                        <span className="doc-file-name">{f.name}</span>
                        <span className="doc-file-size">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      {!updating && (
                        <button className="doc-file-remove" onClick={() => setUpdateFiles((prev) => prev.filter((_, j) => j !== i))}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className={`btn-fill ${updating ? "running" : ""}`}
              disabled={updating}
              onClick={doUpdateScore}
              style={{ marginTop: 16 }}
            >
              <span>{updating ? "Updating..." : "Submit for New Score"}</span>
              <div className="bar" />
            </button>

            {updateStatus && (
              <div className={`status show ${updateStatus.type}`} style={{ marginTop: 10 }}>
                {updateStatus.type === "wait" && <div className="sp" />}
                {updateStatus.text}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
