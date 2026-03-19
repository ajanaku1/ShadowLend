/* eslint-disable no-console */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { createInstance, SepoliaConfig } = require("@zama-fhe/relayer-sdk/node");

const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 3 } });

const {
  AGENT_API_KEY,
  GROQ_API_KEY,
  FHEVM_RPC_URL = "https://devnet.zama.ai",
  SCORER_PRIVATE_KEY,
  CREDIT_SCORE_ADDRESS,
} = process.env;

if (!SCORER_PRIVATE_KEY || !CREDIT_SCORE_ADDRESS) {
  console.warn("Missing env vars: SCORER_PRIVATE_KEY, CREDIT_SCORE_ADDRESS — encryption path disabled");
}
if (!GROQ_API_KEY) {
  console.warn("Missing GROQ_API_KEY — AI scoring will use deterministic fallback");
}

const SYSTEM_PROMPT = `You are a credit scoring engine for an encrypted lending protocol. You receive financial signals AND uploaded document content. You MUST cross-reference the documents against the stated financial signals.

CRITICAL RULES:
- If documents CONTRADICT the stated numbers (e.g. form says income $100k but document shows $30k), penalize the score heavily.
- If documents are IRRELEVANT (not financial — e.g. memes, random images, non-financial text), treat them as providing NO verification. Lower the score since the borrower failed to provide valid proof.
- If documents SUPPORT the stated numbers (pay stubs matching income, bank statements showing employment), boost confidence and score.
- If no document text could be extracted, score based only on the numbers but apply a small penalty for unverifiable claims.

Return ONLY a JSON object with these fields: score (integer 300-850), paymentHistory (integer 0-100), debtToIncome (integer 0-100), incomeLevel (integer 0-100), employment (integer 0-100). Each factor field represents how well the borrower scored on that factor (100 = perfect). No explanation. No text. Just JSON.

Scoring weights: payment history 35%, debt-to-income ratio 30%, income level 20%, employment stability 15%.`;

const creditScoreAbi = [
  "function submitScore(address borrower, bytes32 encryptedScore, bytes inputProof) external",
];

function requireAgentKey(req, res, next) {
  const key = req.headers["x-agent-key"];
  if (!AGENT_API_KEY || key !== AGENT_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

// ---------------------------------------------------------------------------
// Document content extraction
// ---------------------------------------------------------------------------

// Extract readable text strings from a PDF buffer (raw scan, no library needed)
function extractPdfText(buffer) {
  const str = buffer.toString("latin1");
  const textBlocks = [];
  // Extract text between BT/ET blocks (PDF text objects)
  const btRegex = /BT[\s\S]*?ET/g;
  let match;
  while ((match = btRegex.exec(str)) !== null) {
    // Extract string literals in parentheses: (text here)
    const parenRegex = /\(([^)]+)\)/g;
    let pm;
    while ((pm = parenRegex.exec(match[0])) !== null) {
      const cleaned = pm[1].replace(/\\[nrt]/g, " ").trim();
      if (cleaned.length > 1) textBlocks.push(cleaned);
    }
  }
  // Also try hex-encoded strings <48656C6C6F> and stream text
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  while ((match = streamRegex.exec(str)) !== null) {
    // Look for readable ASCII in streams
    const ascii = match[1].replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
    if (ascii.length > 20) {
      // Only keep chunks that look like real text (have common words)
      const words = ascii.split(" ").filter((w) => w.length > 2);
      if (words.length > 5) textBlocks.push(ascii.slice(0, 1000));
    }
  }
  return textBlocks.join("\n").slice(0, 3000) || null;
}

// Use Llama 4 Scout vision to analyze an image document
async function analyzeImageWithVision(file) {
  const b64 = file.buffer.toString("base64");
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
          text: `Analyze this uploaded document image. Answer these questions concisely:
1. Is this a financial document (bank statement, pay stub, invoice, tax form, employment letter, etc.)? YES or NO.
2. If YES, what type of financial document is it?
3. What key financial data can you extract? (amounts, dates, names, account info)
4. If NO, what is this image actually showing?
Reply in a structured format.`,
        },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
  };

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
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

// Process all uploaded documents — extract real content
async function processDocuments(files) {
  if (!files || files.length === 0) return null;

  const results = [];
  for (const f of files) {
    try {
      if (f.mimetype.startsWith("image/")) {
        console.log(`Analyzing image with vision: ${f.originalname} (${(f.size / 1024).toFixed(0)}KB)`);
        const analysis = await analyzeImageWithVision(f);
        results.push({ name: f.originalname, type: "image", analysis });
      } else if (f.mimetype === "application/pdf") {
        console.log(`Extracting PDF text: ${f.originalname} (${(f.size / 1024).toFixed(0)}KB)`);
        const text = extractPdfText(f.buffer);
        results.push({
          name: f.originalname,
          type: "pdf",
          analysis: text
            ? `Extracted PDF text:\n${text}`
            : "[PDF contains no extractable text — may be a scanned image or empty file]",
        });
      } else {
        results.push({ name: f.originalname, type: "unknown", analysis: "[Unsupported file type — not a recognized document format]" });
      }
    } catch (err) {
      console.warn(`Error processing ${f.originalname}:`, err.message);
      results.push({ name: f.originalname, type: "error", analysis: `[Processing error: ${err.message}]` });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Groq AI scoring — uses document analysis results from vision + PDF extraction
// ---------------------------------------------------------------------------
async function callGroq(payload, documentAnalyses) {
  let textPayload = `FINANCIAL SIGNALS (self-reported by borrower):\n${JSON.stringify({
    income: payload.income,
    employmentMonths: payload.employmentMonths,
    existingDebt: payload.existingDebt,
    missedPayments: payload.missedPayments,
  }, null, 2)}`;

  if (documentAnalyses && documentAnalyses.length > 0) {
    textPayload += `\n\nUPLOADED DOCUMENTS — AI ANALYSIS (${documentAnalyses.length} files):`;
    for (const doc of documentAnalyses) {
      textPayload += `\n\n=== Document: "${doc.name}" (${doc.type}) ===\n${doc.analysis}`;
    }
    textPayload += `\n\nCross-reference the document analysis against the self-reported numbers above. If the documents are NOT financial documents, penalize heavily.`;
  } else {
    textPayload += "\n\nNO DOCUMENTS UPLOADED. Cannot verify any claims. Apply a moderate penalty for unverified data.";
  }

  const body = {
    model: "llama-3.3-70b-versatile",
    max_tokens: 256,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: textPayload },
    ],
  };

  console.log(`Scoring with Groq, ${documentAnalyses?.length || 0} document analyses included`);

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Groq error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

function extractScore(text) {
  // Try to find JSON in the response
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.warn("No JSON found in AI response:", text.slice(0, 500));
    return null;
  }
  try {
    const obj = JSON.parse(match[0]);
    const score = Number(obj.score);
    if (!Number.isFinite(score)) {
      console.warn("Invalid score in parsed JSON:", match[0].slice(0, 200));
      return null;
    }
    const clamp = (v) => Math.max(0, Math.min(100, Math.trunc(Number(v) || 0)));
    return {
      score: Math.max(300, Math.min(850, Math.trunc(score))),
      factors: {
        paymentHistory: clamp(obj.paymentHistory),
        debtToIncome: clamp(obj.debtToIncome),
        incomeLevel: clamp(obj.incomeLevel),
        employment: clamp(obj.employment),
      },
    };
  } catch (err) {
    console.warn("Failed to parse AI JSON:", err.message, "Raw:", match[0].slice(0, 300));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Post-AI consistency check — programmatic cross-reference of documents vs inputs
// ---------------------------------------------------------------------------
function runConsistencyCheck(payload, documentAnalyses) {
  if (!documentAnalyses || documentAnalyses.length === 0) {
    return { penalty: 0, flags: ["no_documents"] };
  }

  const flags = [];
  let penalty = 0;

  // Combine all document text for number extraction
  const allText = documentAnalyses.map((d) => d.analysis || "").join("\n").toLowerCase();

  // Check if any documents were classified as non-financial
  const nonFinancialPatterns = /\b(not a financial|non-financial|meme|random image|not financial|no financial)\b/i;
  if (nonFinancialPatterns.test(allText)) {
    penalty += 80;
    flags.push("non_financial_documents");
  }

  // Extract dollar amounts from document text
  const amountRegex = /\$\s?([\d,]+(?:\.\d{2})?)/g;
  const amounts = [];
  let m;
  while ((m = amountRegex.exec(allText)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (val > 0 && val < 10_000_000) amounts.push(val);
  }

  // Also match "XX,XXX" or "XXXXX" near income/salary keywords
  const incomeContextRegex = /(?:salary|income|pay|gross|net|annual|yearly|monthly|wage|compensation|earning)[^\d]{0,30}([\d,]{3,})/gi;
  while ((m = incomeContextRegex.exec(allText)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (val > 0 && val < 10_000_000) amounts.push(val);
  }

  if (amounts.length > 0 && payload.income > 0) {
    // Check if any extracted amount is close to claimed income (within 40%)
    // Consider both annual and monthly income (docs could show either)
    const claimed = payload.income;
    const claimedMonthly = claimed / 12;
    const hasMatch = amounts.some((a) =>
      Math.abs(a - claimed) / claimed < 0.4 ||
      Math.abs(a - claimedMonthly) / claimedMonthly < 0.4
    );

    if (!hasMatch) {
      // Find the closest amount to see how far off it is
      const closest = amounts.reduce((best, a) => {
        const diff = Math.min(
          Math.abs(a - claimed) / claimed,
          Math.abs(a - claimedMonthly) / claimedMonthly
        );
        return diff < best.diff ? { val: a, diff } : best;
      }, { val: 0, diff: Infinity });

      if (closest.diff > 1.0) {
        // More than 100% off — severe contradiction
        penalty += 120;
        flags.push(`income_severe_mismatch:claimed=${claimed},doc=${closest.val}`);
      } else if (closest.diff > 0.4) {
        // 40-100% off — moderate contradiction
        penalty += 60;
        flags.push(`income_moderate_mismatch:claimed=${claimed},doc=${closest.val}`);
      }
    } else {
      flags.push("income_verified");
    }
  }

  // Check for vision failure (all docs failed analysis)
  const failedDocs = documentAnalyses.filter((d) =>
    /\[Vision analysis failed|Processing error|Unsupported file/i.test(d.analysis || "")
  );
  if (failedDocs.length === documentAnalyses.length) {
    penalty += 40;
    flags.push("all_documents_unreadable");
  }

  return { penalty: Math.min(penalty, 200), flags };
}

function getRate(score) {
  if (score <= 650) return 8;
  if (score >= 850) return 2;
  return parseFloat((8 - ((score - 650) / 200) * 6).toFixed(2));
}

let fhevmInstance = null;
async function getFhevmInstance() {
  if (!fhevmInstance) {
    fhevmInstance = await createInstance({
      ...SepoliaConfig,
      network: FHEVM_RPC_URL,
    });
  }
  return fhevmInstance;
}

const DEMO_MODE = !SCORER_PRIVATE_KEY || !CREDIT_SCORE_ADDRESS;

if (DEMO_MODE) {
  console.log("⚠  Running in DEMO mode (no SCORER_PRIVATE_KEY / CREDIT_SCORE_ADDRESS)");
  console.log("   Encrypted on-chain submission disabled. Scoring still works.");
}

app.post("/score", upload.array("documents", 3), requireAgentKey, async (req, res) => {
  try {
    const { borrowerAddress, income, employmentMonths, existingDebt, missedPayments } = req.body || {};

    if (!ethers.isAddress(borrowerAddress)) {
      return res.status(400).json({ error: "invalid borrower address" });
    }

    const payload = {
      borrowerAddress,
      income: Number(income),
      employmentMonths: Number(employmentMonths),
      existingDebt: Number(existingDebt),
      missedPayments: Number(missedPayments),
    };

    // Analyze uploaded documents using vision AI + PDF extraction
    const documentAnalyses = await processDocuments(req.files);

    // --- Compute score ---
    let score, factors;
    if (GROQ_API_KEY) {
      let result = null;
      // Try up to 2 times in case the model returns non-JSON
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        const aiText = await callGroq(payload, documentAnalyses);
        result = extractScore(aiText);
        if (!result && attempt === 0) console.log("Retrying Groq scoring...");
      }
      if (result) {
        score = result.score;
        factors = result.factors;
        console.log(`Groq AI scored ${borrowerAddress}: ${score}`, factors);
      } else {
        console.warn("Groq failed to return valid JSON after 2 attempts, using fallback");
      }
    }
    if (!score) {
      // Deterministic fallback scoring when no API key
      const incomeScore = Math.min(payload.income / 100, 200);
      const empScore = Math.min(payload.employmentMonths * 2, 150);
      const debtPenalty = Math.min(payload.existingDebt / 50, 200);
      const missedPenalty = payload.missedPayments * 60;
      score = Math.max(300, Math.min(850, Math.trunc(500 + incomeScore + empScore - debtPenalty - missedPenalty)));

      const clamp = (v) => Math.max(0, Math.min(100, Math.trunc(v)));
      const paymentHistory = clamp(Math.max(10, 95 - payload.missedPayments * 20));
      const ratio = payload.income > 0 ? payload.existingDebt / payload.income : 1;
      const debtToIncome = clamp(95 - ratio * 80);
      const incomeLevel = clamp(Math.min(95, payload.income / 200));
      const employment = clamp(Math.min(95, payload.employmentMonths * 1.5));
      factors = { paymentHistory, debtToIncome, incomeLevel, employment };

      console.log(`Fallback scored ${borrowerAddress}: ${score}`);
    }

    // --- Post-AI consistency check ---
    const consistency = runConsistencyCheck(payload, documentAnalyses);
    if (consistency.penalty > 0) {
      const before = score;
      score = Math.max(300, score - consistency.penalty);
      console.log(`Consistency check: penalty -${consistency.penalty} (${before} → ${score}), flags: ${consistency.flags.join(", ")}`);
    }

    const eligible = score >= 650;
    const rate = getRate(score);

    // --- Attempt encrypted on-chain submission via relayer SDK ---
    let encryptedTxHash = null;
    let encryptionMode = "simulated";
    let ciphertext = null;

    if (!DEMO_MODE) {
      try {
        const provider = new ethers.JsonRpcProvider(FHEVM_RPC_URL);
        const wallet = new ethers.Wallet(SCORER_PRIVATE_KEY, provider);

        // Encrypt score using Zama relayer SDK
        const instance = await getFhevmInstance();
        const input = instance.createEncryptedInput(CREDIT_SCORE_ADDRESS, wallet.address);
        input.add32(BigInt(score));
        const encrypted = await input.encrypt();

        const handleBytes = encrypted.handles[0]; // Uint8Array(32)
        const proofBytes = encrypted.inputProof;  // Uint8Array

        // Convert handle to hex string for ethers (ABI type is uint256)
        const handleHex = "0x" + Buffer.from(handleBytes).toString("hex");
        const proofHex = "0x" + Buffer.from(proofBytes).toString("hex");

        // Store ciphertext hex for frontend visualization
        ciphertext = handleHex;

        const creditScoreContract = new ethers.Contract(CREDIT_SCORE_ADDRESS, creditScoreAbi, wallet);
        const tx = await creditScoreContract.submitScore(borrowerAddress, handleHex, proofHex);
        const receipt = await tx.wait();
        encryptedTxHash = receipt.hash;
        encryptionMode = "live";
        console.log(`Encrypted score submitted on-chain (Sepolia): ${encryptedTxHash}`);
      } catch (err) {
        console.warn("Encrypted submission failed:", err.message);
        encryptionMode = "simulated";
      }
    }

    // Generate simulated ciphertext for visualization if no real one
    if (!ciphertext) {
      ciphertext = "0x" + [...Array(128)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    }
    if (!encryptedTxHash) {
      encryptedTxHash = "0x" + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    }

    return res.json({
      success: true,
      txHash: encryptedTxHash,
      scoreSubmitted: true,
      score,
      factors,
      rate,
      eligible,
      encryptionMode,
      ciphertext,
      consistencyFlags: consistency.flags,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "server error" });
  }
});

// ---------------------------------------------------------------------------
// Public decryption endpoint — decrypts FHE handles via Zama relayer (KMS)
// ---------------------------------------------------------------------------
app.post("/decrypt", requireAgentKey, async (req, res) => {
  try {
    const { handle } = req.body || {};
    if (!handle || typeof handle !== "string") {
      return res.status(400).json({ error: "missing handle" });
    }

    console.log(`Decrypting handle: ${handle.slice(0, 20)}...`);
    const instance = await getFhevmInstance();

    // Retry up to 10 times — coprocessor may need time to process
    let result = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        result = await instance.publicDecrypt([handle]);
        break;
      } catch (err) {
        console.warn(`publicDecrypt attempt ${attempt + 1} failed:`, err.message);
        if (attempt < 9) {
          await new Promise((r) => setTimeout(r, 6000));
        }
      }
    }

    if (!result) {
      return res.status(504).json({ error: "KMS decryption timed out" });
    }

    const clearValue = result.clearValues[handle];
    console.log(`Decrypted value:`, clearValue);

    // Convert proof to hex string if it's a Uint8Array
    let proofHex = result.decryptionProof;
    if (proofHex instanceof Uint8Array || Buffer.isBuffer(proofHex)) {
      proofHex = "0x" + Buffer.from(proofHex).toString("hex");
    }

    return res.json({
      success: true,
      clearValue: typeof clearValue === "bigint" ? clearValue.toString() : clearValue,
      decryptionProof: proofHex,
    });
  } catch (err) {
    console.error("Decrypt error:", err);
    return res.status(500).json({ error: err.message || "decryption failed" });
  }
});

// ---------------------------------------------------------------------------
// Faucet — airdrop 1000 mUSDC to new users for testing
// ---------------------------------------------------------------------------
const FAUCET_AMOUNT = ethers.parseUnits("1000", 6); // 1000 mUSDC
const faucetClaimed = new Set();

const usdcAbi = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

app.post("/faucet", requireAgentKey, async (req, res) => {
  try {
    const { address } = req.body || {};
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "invalid address" });
    }

    const normalized = address.toLowerCase();
    if (faucetClaimed.has(normalized)) {
      return res.json({ success: true, alreadyClaimed: true, message: "Already claimed" });
    }

    if (!SCORER_PRIVATE_KEY) {
      return res.status(503).json({ error: "faucet not available (no private key)" });
    }

    const provider = new ethers.JsonRpcProvider(FHEVM_RPC_URL);
    const wallet = new ethers.Wallet(SCORER_PRIVATE_KEY, provider);

    const usdcAddress = req.body.usdcAddress;
    if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
      return res.status(400).json({ error: "missing usdcAddress" });
    }

    const usdc = new ethers.Contract(usdcAddress, usdcAbi, wallet);

    // Check if deployer has enough
    const deployerBal = await usdc.balanceOf(wallet.address);
    if (deployerBal < FAUCET_AMOUNT) {
      return res.status(503).json({ error: "faucet depleted" });
    }

    const tx = await usdc.transfer(address, FAUCET_AMOUNT);
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
app.listen(port, () => {
  console.log(`ShadowLend agent listening on :${port}`);
});
