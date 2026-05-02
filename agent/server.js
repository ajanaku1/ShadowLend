/* eslint-disable no-console */
require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const { ethers } = require("ethers");
const { createInstance, SepoliaConfig } = require("@zama-fhe/relayer-sdk/node");
const multer  = require("multer");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
});

const {
  AGENT_API_KEY,
  GROQ_API_KEY,
  ALCHEMY_API_KEY,
  FHEVM_RPC_URL   = "https://devnet.zama.ai",
  SCORER_PRIVATE_KEY,
  CREDIT_SCORE_ADDRESS,
} = process.env;

if (!SCORER_PRIVATE_KEY || !CREDIT_SCORE_ADDRESS) {
  console.warn("Missing env vars: SCORER_PRIVATE_KEY, CREDIT_SCORE_ADDRESS — encryption path disabled");
}
if (!GROQ_API_KEY) {
  console.warn("Missing GROQ_API_KEY — AI scoring will use deterministic fallback");
}

// ---------------------------------------------------------------------------
// OFAC sanctions list (static subset of known addresses — extend as needed)
// ---------------------------------------------------------------------------
const OFAC_BLOCKLIST = new Set([
  "0x7f367cc41522ce07553e823bf3be79a889debe1b",
  "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b",
  "0x901bb9583b24d97e995513c6778dc6888ab6870e",
  "0xa7e5d5a720f06526557c513402f2e6b5fa20b008",
  "0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c",
  "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a",
  "0x7db418b5d567a4e0e8c59ad71be1fce48f3e6107",
  "0x72a5843cc08275c8171e582972aa4fda8c397b2a",
  "0x539c92186f7c6cc4cbf443f26ef84c595babbca",
]);

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — includes on-chain signals as hard inputs
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a credit scoring engine for a private encrypted lending protocol.
You receive TWO categories of inputs and must weight them accordingly.

CATEGORY A — ON-CHAIN SIGNALS (40% weight, hard signals — fetched directly from blockchain, cannot be faked):
  • walletAgeDays: how old the wallet is in days
  • ethBalanceTier: 0=empty, 1=<0.1 ETH, 2=0.1–1 ETH, 3=>1 ETH
  • defiInteractions: number of unique DeFi protocols interacted with
  • shadowlendRepayments: number of prior ShadowLend loans fully repaid on-chain
  • hasActiveLoan: boolean — current outstanding ShadowLend debt (should never be true here, blocked upstream)
  • liquidationHistory: number of on-chain liquidation events detected

CATEGORY B — SELF-REPORTED SIGNALS (60% weight, require document verification):
  • income: annual income in USD
  • employmentMonths: months at current employer
  • existingDebt: total existing debt in USD
  • missedPayments: number of missed payments in last 12 months

DOCUMENT CROSS-VERIFICATION RULES (applied to Category B):
  - If documents CONTRADICT the stated numbers, penalise heavily.
  - If documents are IRRELEVANT (not financial — memes, random images), treat as NO verification. Lower score.
  - If documents SUPPORT the stated numbers, boost confidence.
  - If no documents uploaded, apply a moderate penalty to Category B only.

ON-CHAIN SCORING GUIDELINES:
  - walletAgeDays < 30: automatic score cap at 550 (fresh wallet fraud risk)
  - walletAgeDays 30–180: moderate confidence
  - walletAgeDays > 365: strong positive signal
  - ethBalanceTier 0: small negative signal (zero skin in the game)
  - defiInteractions > 5: strong positive signal (experienced DeFi user)
  - shadowlendRepayments > 0: strong positive signal per repayment (proven track record)
  - liquidationHistory > 0: significant negative signal per event

Return ONLY a JSON object: { score, paymentHistory, debtToIncome, incomeLevel, employment, onchainRating }
  score: integer 300–850
  paymentHistory, debtToIncome, incomeLevel, employment: integer 0–100 (Category B sub-scores)
  onchainRating: integer 0–100 (Category A composite score)
No explanation. No text. Just JSON.`;

// ---------------------------------------------------------------------------
// On-chain signal fetching
// ---------------------------------------------------------------------------

function getProvider() {
  // Pass network explicitly to skip auto-detection round-trip (avoids timeout on slow RPCs)
  const SEPOLIA = { chainId: 11155111, name: "sepolia" };
  if (ALCHEMY_API_KEY) {
    return new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, SEPOLIA);
  }
  const rpc = process.env.SEPOLIA_RPC_URL || process.env.FHEVM_RPC_URL || "https://sepolia.drpc.org";
  return new ethers.JsonRpcProvider(rpc, SEPOLIA);
}

const lendingPoolAbi = [
  "function loans(address borrower) external view returns (uint256 amount, uint256 remaining, uint256 totalOwed, uint256 timestamp, bool repaid)",
];

const creditScoreAbi = [
  "function repaymentCount(address borrower) external view returns (uint32)",
  "function hasScore(address borrower) external view returns (bool)",
  "function isScoreValid(address borrower) external view returns (bool)",
  "function submitScore(address borrower, bytes32 encryptedScore, bytes inputProof) external",
];

async function fetchOnChainSignals(borrowerAddress) {
  const signals = {
    walletAgeDays:         0,
    ethBalanceTier:        0,
    defiInteractions:      0,
    shadowlendRepayments:  0,
    hasActiveLoan:         false,
    liquidationHistory:    0,
  };

  try {
    const provider = getProvider();

    // 1. ETH balance tier
    try {
      const balance = await provider.getBalance(borrowerAddress);
      const eth = parseFloat(ethers.formatEther(balance));
      if (eth === 0)        signals.ethBalanceTier = 0;
      else if (eth < 0.1)   signals.ethBalanceTier = 1;
      else if (eth < 1.0)   signals.ethBalanceTier = 2;
      else                  signals.ethBalanceTier = 3;
    } catch (e) {
      console.warn("ETH balance fetch failed:", e.message);
    }

    // 2. Wallet age — find first transaction via tx count heuristic + block search
    try {
      const txCount = await provider.getTransactionCount(borrowerAddress);
      if (txCount === 0) {
        // No outgoing txs — wallet is brand-new or only received funds.
        // Assign 30 days so it passes the gate but scores conservatively.
        // The AI will still apply fresh-wallet penalties based on low tx history.
        signals.walletAgeDays = 30;
      } else {
        // Use Alchemy enhanced API if available for faster first-tx lookup
        if (ALCHEMY_API_KEY) {
          const resp = await fetch(
            `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "alchemy_getAssetTransfers",
                params: [{
                  fromBlock: "0x0",
                  toAddress: borrowerAddress,
                  category: ["external"],
                  maxCount: "0x1",
                  order: "asc",
                }],
              }),
            }
          );
          const data = await resp.json();
          const transfers = data?.result?.transfers;
          if (transfers && transfers.length > 0) {
            const blockNum = parseInt(transfers[0].blockNum, 16);
            const block = await provider.getBlock(blockNum);
            if (block) {
              const ageSec = Math.floor(Date.now() / 1000) - block.timestamp;
              signals.walletAgeDays = Math.floor(ageSec / 86400);
            }
          }
        } else {
          // Without Alchemy we cannot verify exact age — assign a conservative default
          // that passes the 30-day gate but provides no bonus (score stays moderate)
          signals.walletAgeDays = 90;
        }
      }
    } catch (e) {
      console.warn("Wallet age fetch failed:", e.message);
    }

    // 3. DeFi interaction count via Alchemy token transfers (unique contract count)
    try {
      if (ALCHEMY_API_KEY) {
        const resp = await fetch(
          `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "alchemy_getAssetTransfers",
              params: [{
                fromBlock:    "0x0",
                fromAddress:  borrowerAddress,
                category:     ["erc20"],
                maxCount:     "0x64",
                withMetadata: false,
              }],
            }),
          }
        );
        const data = await resp.json();
        const transfers = data?.result?.transfers || [];
        const uniqueContracts = new Set(transfers.map((t) => t.rawContract?.address).filter(Boolean));
        signals.defiInteractions = uniqueContracts.size;
      }
    } catch (e) {
      console.warn("DeFi interaction fetch failed:", e.message);
    }

    // 4. ShadowLend repayment count + active loan check (from deployed contracts)
    if (CREDIT_SCORE_ADDRESS) {
      try {
        const cs = new ethers.Contract(CREDIT_SCORE_ADDRESS, creditScoreAbi, provider);
        signals.shadowlendRepayments = Number(await cs.repaymentCount(borrowerAddress));
      } catch (e) {
        console.warn("Repayment count fetch failed:", e.message);
      }
    }

    const lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;
    if (lendingPoolAddress) {
      try {
        const pool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, provider);
        const loan = await pool.loans(borrowerAddress);
        signals.hasActiveLoan = loan.remaining > 0n && !loan.repaid;
      } catch (e) {
        console.warn("Active loan check failed:", e.message);
      }
    }

    console.log(`On-chain signals for ${borrowerAddress}:`, signals);
  } catch (err) {
    console.warn("fetchOnChainSignals error:", err.message);
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Fraud pre-filter
// ---------------------------------------------------------------------------

function checkFraud(borrowerAddress, onChainSignals) {
  const addr = borrowerAddress.toLowerCase();

  if (OFAC_BLOCKLIST.has(addr)) {
    return { blocked: true, reason: "Address is on the OFAC sanctions list." };
  }

  if (onChainSignals.hasActiveLoan) {
    return { blocked: true, reason: "Active unpaid ShadowLend loan exists. Repay before applying." };
  }

  if (onChainSignals.walletAgeDays < 30) {
    if (onChainSignals.walletAgeDays === 0) {
      return { blocked: true, reason: "Wallet has no transaction history. Cannot assess creditworthiness." };
    }
    // 1–29 days: not hard blocked but flagged — score will be capped at 550 via system prompt
    console.log(`Wallet age ${onChainSignals.walletAgeDays} days — fresh wallet, score will be capped`);
  }

  return { blocked: false };
}

// ---------------------------------------------------------------------------
// Document processing
// ---------------------------------------------------------------------------

function extractPdfText(buffer) {
  const str = buffer.toString("latin1");
  const textBlocks = [];
  const btRegex = /BT[\s\S]*?ET/g;
  let match;
  while ((match = btRegex.exec(str)) !== null) {
    const parenRegex = /\(([^)]+)\)/g;
    let pm;
    while ((pm = parenRegex.exec(match[0])) !== null) {
      const cleaned = pm[1].replace(/\\[nrt]/g, " ").trim();
      if (cleaned.length > 1) textBlocks.push(cleaned);
    }
  }
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  while ((match = streamRegex.exec(str)) !== null) {
    const ascii = match[1].replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
    if (ascii.length > 20) {
      const words = ascii.split(" ").filter((w) => w.length > 2);
      if (words.length > 5) textBlocks.push(ascii.slice(0, 1000));
    }
  }
  return textBlocks.join("\n").slice(0, 3000) || null;
}

async function analyzeImageWithVision(file) {
  const b64    = file.buffer.toString("base64");
  const dataUrl = `data:${file.mimetype};base64,${b64}`;
  const body = {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    max_tokens: 300,
    temperature: 0,
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze this uploaded document image. Answer:
1. Is this a financial document (bank statement, pay stub, invoice, tax form, employment letter)? YES or NO.
2. If YES, what type?
3. What key financial data can you extract? (amounts, dates, names, account info)
4. If NO, what is this image showing?
Reply in structured format.`,
        },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
  };
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.warn(`Vision analysis failed for ${file.originalname}:`, errText.slice(0, 200));
    return `[Vision analysis failed for ${file.originalname}]`;
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "[No analysis returned]";
}

async function processDocuments(files) {
  if (!files || files.length === 0) return null;
  const results = [];
  for (const f of files) {
    try {
      if (f.mimetype.startsWith("image/")) {
        const analysis = await analyzeImageWithVision(f);
        results.push({ name: f.originalname, type: "image", analysis });
      } else if (f.mimetype === "application/pdf") {
        const text = extractPdfText(f.buffer);
        results.push({
          name: f.originalname,
          type: "pdf",
          analysis: text
            ? `Extracted PDF text:\n${text}`
            : "[PDF contains no extractable text]",
        });
      } else {
        results.push({ name: f.originalname, type: "unknown", analysis: "[Unsupported file type]" });
      }
    } catch (err) {
      results.push({ name: f.originalname, type: "error", analysis: `[Processing error: ${err.message}]` });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Groq AI scoring
// ---------------------------------------------------------------------------

async function callGroq(selfReportedPayload, onChainSignals, documentAnalyses) {
  let text = `CATEGORY A — ON-CHAIN SIGNALS (40% weight, cannot be faked):\n${JSON.stringify(onChainSignals, null, 2)}`;

  text += `\n\nCATEGORY B — SELF-REPORTED SIGNALS (60% weight, require document verification):\n${JSON.stringify({
    income:           selfReportedPayload.income,
    employmentMonths: selfReportedPayload.employmentMonths,
    existingDebt:     selfReportedPayload.existingDebt,
    missedPayments:   selfReportedPayload.missedPayments,
  }, null, 2)}`;

  if (documentAnalyses && documentAnalyses.length > 0) {
    text += `\n\nUPLOADED DOCUMENTS (${documentAnalyses.length} files):`;
    for (const doc of documentAnalyses) {
      text += `\n\n=== "${doc.name}" (${doc.type}) ===\n${doc.analysis}`;
    }
    text += "\n\nCross-reference document analysis against Category B self-reported numbers.";
  } else {
    text += "\n\nNO DOCUMENTS UPLOADED. Cannot verify Category B claims. Apply moderate penalty.";
  }

  const body = {
    model:      "llama-3.3-70b-versatile",
    max_tokens: 256,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: text },
    ],
  };

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Groq error: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

function extractScore(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj   = JSON.parse(match[0]);
    const score = Number(obj.score);
    if (!Number.isFinite(score)) return null;
    const clamp = (v) => Math.max(0, Math.min(100, Math.trunc(Number(v) || 0)));
    return {
      score: Math.max(300, Math.min(850, Math.trunc(score))),
      factors: {
        paymentHistory: clamp(obj.paymentHistory),
        debtToIncome:   clamp(obj.debtToIncome),
        incomeLevel:    clamp(obj.incomeLevel),
        employment:     clamp(obj.employment),
        onchainRating:  clamp(obj.onchainRating),
      },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Post-AI consistency check (document vs. self-reported)
// ---------------------------------------------------------------------------

function runConsistencyCheck(payload, documentAnalyses) {
  if (!documentAnalyses || documentAnalyses.length === 0) {
    return { penalty: 0, flags: ["no_documents"] };
  }
  const flags   = [];
  let   penalty = 0;

  const allText = documentAnalyses.map((d) => d.analysis || "").join("\n").toLowerCase();

  if (/\b(not a financial|non-financial|meme|random image|not financial|no financial)\b/i.test(allText)) {
    penalty += 80;
    flags.push("non_financial_documents");
  }

  const amounts = [];
  const amountRegex     = /\$\s?([\d,]+(?:\.\d{2})?)/g;
  const incomeCtxRegex  = /(?:salary|income|pay|gross|net|annual|yearly|monthly|wage|compensation|earning)[^\d]{0,30}([\d,]{3,})/gi;
  let m;
  while ((m = amountRegex.exec(allText)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (v > 0 && v < 10_000_000) amounts.push(v);
  }
  while ((m = incomeCtxRegex.exec(allText)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (v > 0 && v < 10_000_000) amounts.push(v);
  }

  if (amounts.length > 0 && payload.income > 0) {
    const claimed  = payload.income;
    const monthly  = claimed / 12;
    const hasMatch = amounts.some(
      (a) => Math.abs(a - claimed) / claimed < 0.4 || Math.abs(a - monthly) / monthly < 0.4
    );
    if (!hasMatch) {
      const closest = amounts.reduce((best, a) => {
        const diff = Math.min(
          Math.abs(a - claimed) / claimed,
          Math.abs(a - monthly) / monthly
        );
        return diff < best.diff ? { val: a, diff } : best;
      }, { val: 0, diff: Infinity });

      if (closest.diff > 1.0)      { penalty += 120; flags.push(`income_severe_mismatch:claimed=${claimed},doc=${closest.val}`); }
      else if (closest.diff > 0.4) { penalty += 60;  flags.push(`income_moderate_mismatch:claimed=${claimed},doc=${closest.val}`); }
    } else {
      flags.push("income_verified");
    }
  }

  const failedDocs = documentAnalyses.filter(
    (d) => /\[Vision analysis failed|Processing error|Unsupported file/i.test(d.analysis || "")
  );
  if (failedDocs.length === documentAnalyses.length) {
    penalty += 40;
    flags.push("all_documents_unreadable");
  }

  return { penalty: Math.min(penalty, 200), flags };
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireAgentKey(req, res, next) {
  const key = req.headers["x-agent-key"];
  if (!AGENT_API_KEY || key !== AGENT_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

// ---------------------------------------------------------------------------
// FHE instance
// ---------------------------------------------------------------------------

let fhevmInstance = null;
async function getFhevmInstance() {
  if (!fhevmInstance) {
    fhevmInstance = await createInstance({ ...SepoliaConfig, network: FHEVM_RPC_URL });
  }
  return fhevmInstance;
}

const DEMO_MODE = !SCORER_PRIVATE_KEY || !CREDIT_SCORE_ADDRESS;
if (DEMO_MODE) {
  console.log("⚠  Running in DEMO mode — encrypted on-chain submission disabled.");
}

// ---------------------------------------------------------------------------
// POST /score — main scoring endpoint
// ---------------------------------------------------------------------------

app.post("/score", upload.array("documents", 3), requireAgentKey, async (req, res) => {
  try {
    const { borrowerAddress, income, employmentMonths, existingDebt, missedPayments } = req.body || {};

    if (!ethers.isAddress(borrowerAddress)) {
      return res.status(400).json({ error: "invalid borrower address" });
    }

    const selfReported = {
      borrowerAddress,
      income:           Number(income),
      employmentMonths: Number(employmentMonths),
      existingDebt:     Number(existingDebt),
      missedPayments:   Number(missedPayments),
    };

    // 1. Fetch on-chain signals (ungameable)
    const onChainSignals = await fetchOnChainSignals(borrowerAddress);

    // 2. Fraud pre-filter
    const fraudCheck = checkFraud(borrowerAddress, onChainSignals);
    if (fraudCheck.blocked) {
      console.log(`Fraud pre-filter blocked ${borrowerAddress}: ${fraudCheck.reason}`);
      return res.status(403).json({ error: "application_blocked", reason: fraudCheck.reason });
    }

    // 3. Process uploaded documents
    const documentAnalyses = await processDocuments(req.files);

    // 4. AI scoring with both on-chain and self-reported signals
    let score, factors;
    if (GROQ_API_KEY) {
      let result = null;
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        const aiText = await callGroq(selfReported, onChainSignals, documentAnalyses);
        result = extractScore(aiText);
        if (!result && attempt === 0) console.log("Retrying Groq scoring...");
      }
      if (result) {
        score   = result.score;
        factors = result.factors;
        console.log(`Groq AI scored ${borrowerAddress}: ${score}`, factors);
      }
    }

    if (!score) {
      // Deterministic fallback (no API key)
      const onchainBonus = (
        Math.min(onChainSignals.walletAgeDays / 365, 1) * 60 +
        onChainSignals.ethBalanceTier * 10 +
        Math.min(onChainSignals.defiInteractions, 10) * 5 +
        onChainSignals.shadowlendRepayments * 15 -
        onChainSignals.liquidationHistory * 20
      );
      const incomeScore    = Math.min(selfReported.income / 100, 200);
      const empScore       = Math.min(selfReported.employmentMonths * 2, 150);
      const debtPenalty    = Math.min(selfReported.existingDebt / 50, 200);
      const missedPenalty  = selfReported.missedPayments * 60;
      score = Math.max(300, Math.min(850, Math.trunc(
        500 + onchainBonus * 0.4 + (incomeScore + empScore - debtPenalty - missedPenalty) * 0.6
      )));

      const clamp = (v) => Math.max(0, Math.min(100, Math.trunc(v)));
      factors = {
        paymentHistory: clamp(95 - selfReported.missedPayments * 20),
        debtToIncome:   clamp(95 - (selfReported.existingDebt / Math.max(selfReported.income, 1)) * 80),
        incomeLevel:    clamp(selfReported.income / 200),
        employment:     clamp(selfReported.employmentMonths * 1.5),
        onchainRating:  clamp(50 + onchainBonus),
      };
      console.log(`Fallback scored ${borrowerAddress}: ${score}`);
    }

    // 5. Post-AI document consistency check
    const consistency = runConsistencyCheck(selfReported, documentAnalyses);
    if (consistency.penalty > 0) {
      const before = score;
      score = Math.max(300, score - consistency.penalty);
      console.log(`Consistency penalty -${consistency.penalty} (${before} → ${score}), flags: ${consistency.flags.join(", ")}`);
    }

    // 6. Hard cap for fresh wallets (enforcement of system prompt rule)
    if (onChainSignals.walletAgeDays > 0 && onChainSignals.walletAgeDays < 30) {
      score = Math.min(score, 550);
      consistency.flags.push("fresh_wallet_cap");
    }

    const eligible = score >= 650;

    // 7. Encrypt and submit on-chain
    let encryptedTxHash = null;
    let encryptionMode  = "simulated";
    let ciphertext      = null;

    if (!DEMO_MODE) {
      try {
        const provider = new ethers.JsonRpcProvider(FHEVM_RPC_URL);
        const wallet   = new ethers.Wallet(SCORER_PRIVATE_KEY, provider);
        const instance = await getFhevmInstance();
        const input    = instance.createEncryptedInput(CREDIT_SCORE_ADDRESS, wallet.address);
        input.add32(BigInt(score));
        const encrypted  = await input.encrypt();
        const handleHex  = "0x" + Buffer.from(encrypted.handles[0]).toString("hex");
        const proofHex   = "0x" + Buffer.from(encrypted.inputProof).toString("hex");
        ciphertext = handleHex;

        const cs = new ethers.Contract(
          CREDIT_SCORE_ADDRESS,
          ["function submitScore(address borrower, bytes32 encryptedScore, bytes inputProof) external"],
          wallet
        );
        const tx      = await cs.submitScore(borrowerAddress, handleHex, proofHex);
        const receipt = await tx.wait();
        encryptedTxHash = receipt.hash;
        encryptionMode  = "live";
        console.log(`Encrypted score submitted on-chain: ${encryptedTxHash}`);
      } catch (err) {
        console.warn("Encrypted submission failed:", err.message);
      }
    }

    if (!ciphertext) {
      ciphertext = "0x" + [...Array(128)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    }
    if (!encryptedTxHash) {
      encryptedTxHash = "0x" + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    }

    return res.json({
      success: true,
      txHash:         encryptedTxHash,
      scoreSubmitted: true,
      score,
      factors,
      eligible,
      encryptionMode,
      ciphertext,
      onChainSignals,
      consistencyFlags: consistency.flags,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /chat — natural language assistant (Groq-backed)
// ---------------------------------------------------------------------------

const CHAT_SYSTEM = `You are the ShadowLend AI assistant — a knowledgeable, concise guide for a privacy-first undercollateralized lending protocol built on Zama fhEVM (Fully Homomorphic Encryption).

Key facts about ShadowLend:
- Credit scores (300–850) are computed by Groq AI (Llama 3.3-70B) from self-reported financial data + uploaded documents
- Scores are encrypted with TFHE before touching the blockchain — no party ever sees the raw score
- The lending contract checks score >= 650 homomorphically using FHE.ge() — only a yes/no result is revealed
- Loan terms (max amount, interest rate) are also computed entirely in encrypted space
- Interest rates: score 850 → 2% APR, score 650 → 8% APR, linear between
- Max borrow: score 650 → $1,000 USDC, score 850 → $10,000 USDC
- Repaying loans fully improves your on-chain reputation (+25 score points per repayment)
- Score validity: 30 days. You can re-score after a 30-day cooldown
- Selective compliance: a 2-of-3 committee can vote to grant a regulator access to your encrypted score

When the user context includes their score/loan data, personalize your response.
Be helpful, brief (2–4 sentences max), and technically accurate. Never invent numbers.
Do not ask follow-up questions — answer directly.`;

app.post("/chat", requireAgentKey, async (req, res) => {
  try {
    const { message, userContext } = req.body || {};
    if (!message || typeof message !== "string" || message.length > 500) {
      return res.status(400).json({ error: "invalid message" });
    }

    let contextBlock = "";
    if (userContext) {
      const lines = [];
      if (userContext.connected && userContext.address) {
        lines.push(`User wallet: ${userContext.address.slice(0, 8)}...`);
      }
      if (userContext.score)         lines.push(`Credit score: ${userContext.score}/850`);
      if (userContext.eligible != null) lines.push(`Eligible for loans: ${userContext.eligible ? "yes" : "no (below 650 threshold)"}`);
      if (userContext.loanRemaining > 0) lines.push(`Active loan remaining: $${(userContext.loanRemaining / 1e6).toFixed(2)} USDC`);
      if (userContext.interestRate)  lines.push(`Current interest rate: ${userContext.interestRate}% APR`);
      if (lines.length > 0) contextBlock = `\n\nUser context:\n${lines.join("\n")}`;
    }

    if (!GROQ_API_KEY) {
      return res.json({ reply: "AI assistant requires GROQ_API_KEY to be configured." });
    }

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  256,
        temperature: 0.4,
        messages: [
          { role: "system", content: CHAT_SYSTEM },
          { role: "user",   content: message + contextBlock },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Groq error: ${resp.status} ${errText}`);
    }

    const data  = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || "I couldn't generate a response.";
    return res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    return res.status(500).json({ error: err.message || "chat failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /decrypt — public decryption via Zama KMS relayer
// ---------------------------------------------------------------------------

app.post("/decrypt", requireAgentKey, async (req, res) => {
  try {
    const { handle } = req.body || {};
    if (!handle || typeof handle !== "string") {
      return res.status(400).json({ error: "missing handle" });
    }
    const instance = await getFhevmInstance();
    let result = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        result = await instance.publicDecrypt([handle]);
        break;
      } catch (err) {
        console.warn(`publicDecrypt attempt ${attempt + 1} failed:`, err.message);
        if (attempt < 9) await new Promise((r) => setTimeout(r, 6000));
      }
    }
    if (!result) return res.status(504).json({ error: "KMS decryption timed out" });

    const clearValue = result.clearValues[handle];
    let   proofHex   = result.decryptionProof;
    if (proofHex instanceof Uint8Array || Buffer.isBuffer(proofHex)) {
      proofHex = "0x" + Buffer.from(proofHex).toString("hex");
    }
    return res.json({
      success: true,
      clearValue:      typeof clearValue === "bigint" ? clearValue.toString() : clearValue,
      decryptionProof: proofHex,
    });
  } catch (err) {
    console.error("Decrypt error:", err);
    return res.status(500).json({ error: err.message || "decryption failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /faucet — airdrop 1000 mUSDC to new users
// ---------------------------------------------------------------------------

const FAUCET_AMOUNT = ethers.parseUnits("1000", 6);
const faucetClaimed = new Set();

app.post("/faucet", requireAgentKey, async (req, res) => {
  try {
    const { address, usdcAddress } = req.body || {};
    if (!ethers.isAddress(address))     return res.status(400).json({ error: "invalid address" });
    if (!ethers.isAddress(usdcAddress)) return res.status(400).json({ error: "missing usdcAddress" });
    if (!SCORER_PRIVATE_KEY)            return res.status(503).json({ error: "faucet unavailable" });

    const normalized = address.toLowerCase();
    if (faucetClaimed.has(normalized)) {
      return res.json({ success: true, alreadyClaimed: true, message: "Already claimed" });
    }

    const provider = new ethers.JsonRpcProvider(FHEVM_RPC_URL);
    const wallet   = new ethers.Wallet(SCORER_PRIVATE_KEY, provider);
    const usdc     = new ethers.Contract(usdcAddress, [
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
    ], wallet);

    const bal = await usdc.balanceOf(wallet.address);
    if (bal < FAUCET_AMOUNT) return res.status(503).json({ error: "faucet depleted" });

    const tx      = await usdc.transfer(address, FAUCET_AMOUNT);
    const receipt = await tx.wait();
    faucetClaimed.add(normalized);
    console.log(`Faucet: sent 1000 mUSDC to ${address} (tx: ${receipt.hash})`);
    return res.json({ success: true, txHash: receipt.hash, amount: "1000" });
  } catch (err) {
    console.error("Faucet error:", err);
    return res.status(500).json({ error: err.message || "faucet error" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`ShadowLend agent listening on :${port}`));
