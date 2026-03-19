import React, { useState, useEffect } from "react";
import TxLink from "./TxLink";
import { MAX_FILES } from "../config/constants";

const HX = "0123456789abcdef";

function StreamingCiphertext({ ciphertext }) {
  const [displayed, setDisplayed] = useState("");
  const full = ciphertext || "";

  useEffect(() => {
    if (!full) return;
    let i = 0;
    const target = `${full.slice(0, 42)}...${full.slice(-8)}`;
    setDisplayed("");
    const iv = setInterval(() => {
      if (i < target.length) {
        // Show random chars ahead of the "typed" position for scramble effect
        const typed = target.slice(0, i + 1);
        const remaining = target.length - i - 1;
        const noise = Array.from({ length: Math.min(remaining, 6) }, () => HX[Math.floor(Math.random() * 16)]).join("");
        setDisplayed(typed + noise);
        i++;
      } else {
        setDisplayed(target);
        clearInterval(iv);
      }
    }, 18);
    return () => clearInterval(iv);
  }, [full]);

  return <code className="enc-hex">{displayed || "..."}</code>;
}

function FactorBars({ factors }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!factors) return null;

  const items = [
    { key: "paymentHistory", label: "Payment" },
    { key: "debtToIncome", label: "Debt Ratio" },
    { key: "incomeLevel", label: "Income" },
    { key: "employment", label: "Employment" },
  ];

  const getClass = (v) => v >= 70 ? "good" : v >= 40 ? "mid" : "low";

  return (
    <div className="ai-factor-bars">
      {items.map(({ key, label }) => {
        const val = factors[key] || 0;
        return (
          <div key={key} className="ai-factor-row">
            <span className="ai-factor-label">{label}</span>
            <div className="ai-factor-track">
              <div
                className={`ai-factor-fill ${getClass(val)}`}
                style={{ width: animate ? `${val}%` : "0%" }}
              />
            </div>
            <span className="ai-factor-val">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function BorrowerForm({
  form,
  setForm,
  hashes,
  uploadedFiles,
  fileError,
  handleFileUpload,
  removeFile,
  submitting,
  submitDone,
  submitStatus,
  agentTxHash,
  aiScore,
  aiEligible,
  aiFactors,
  interestRate,
  encryptionMode,
  ciphertext,
  canSubmit,
  walletConnected,
  allFilled,
  allValid,
  hasDocuments,
  doSubmit,
  onOpenUpdateModal,
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Borrower Application</h2>
          <p className="card-sub">Encrypted end-to-end before submission</p>
        </div>
        <span className="tag">FHE</span>
      </div>

      <div className="fg">
        {[
          { key: "income", label: "Annual Income (USD)", hashIdx: 0 },
          { key: "employment", label: "Employment Length (months)", hashIdx: 1 },
          { key: "debt", label: "Existing Debt (USD)", hashIdx: 2 },
          { key: "missed", label: "Missed Payments (last 12 mo)", hashIdx: 3 },
        ].map(({ key, label, hashIdx }) => (
          <div className="fw" key={key}>
            <label>{label}</label>
            <input
              type="text"
              placeholder="0"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              disabled={submitDone}
            />
            <div className={`hash ${form[key] ? "visible" : ""}`}>
              {hashes[hashIdx]}
            </div>
          </div>
        ))}
      </div>

      {/* Document Upload */}
      <div className="doc-upload-section">
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
        <p className="doc-hint">
          Upload bank statements, paid invoices, pay stubs, or any proof of income. Max 3 files, 5MB each. PDF, PNG, JPG, WebP.
        </p>

        {!submitDone && (
          <label className="doc-dropzone">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              multiple
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Click to upload or drag files here</span>
            <span className="doc-dropzone-sub">{uploadedFiles.length}/{MAX_FILES} files</span>
          </label>
        )}

        {fileError && (
          <div className="status show err" style={{ marginTop: 8, fontSize: 12 }}>
            {fileError}
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="doc-file-list">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="doc-file-item">
                <div className="doc-file-icon">
                  {f.type === "application/pdf" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                </div>
                <div className="doc-file-info">
                  <span className="doc-file-name">{f.name}</span>
                  <span className="doc-file-size">{(f.size / 1024).toFixed(0)} KB</span>
                </div>
                {!submitDone && (
                  <button className="doc-file-remove" onClick={() => removeFile(i)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className={`btn-fill ${submitting ? "running" : ""}`}
        disabled={!canSubmit}
        onClick={doSubmit}
      >
        <span>
          {submitDone
            ? "Score Encrypted"
            : submitting
            ? "Encrypting..."
            : !walletConnected
            ? "Connect Wallet First"
            : !allFilled
            ? "Fill All Fields"
            : !allValid
            ? "Enter Valid Numbers"
            : !hasDocuments
            ? "Upload Proof of Income"
            : "Submit for Encrypted Scoring"}
        </span>
        <div className="bar" />
      </button>

      {submitStatus && (
        <div className={`status show ${submitStatus.type}`}>
          {submitStatus.type === "wait" && <div className="sp" />}
          {submitStatus.text}
        </div>
      )}

      <TxLink hash={agentTxHash} label="Score tx" />

      {aiScore != null && (<>
        <div className="ai-score-display">
          <div className="ai-score-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={aiEligible ? "var(--green)" : "var(--rose)"}
                strokeWidth="6"
                strokeDasharray={`${((aiScore - 300) / 550) * 264} 264`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dasharray 1s ease" }}
              />
            </svg>
            <div className="ai-score-value">{aiScore}</div>
            <div className="ai-score-max">/850</div>
          </div>
          <div className="ai-score-info">
            <span className={`ai-score-badge ${aiEligible ? "pass" : "fail"}`}>
              {aiEligible ? "Eligible" : "Not Eligible"}
            </span>
            <span className="ai-score-threshold">Threshold: 650 | Rate: {interestRate}%</span>
          </div>
        </div>

        {/* Factor Breakdown */}
        {aiFactors && <FactorBars factors={aiFactors} />}

        {/* Encryption Proof Panel */}
        {ciphertext && (
          <div className="encryption-panel">
            <div className="enc-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span className="enc-title">Privacy Layer</span>
              <span className={`enc-badge ${encryptionMode === "live" ? "enc-live" : "enc-sim"}`}>
                {encryptionMode === "live" ? "FHE Encrypted" : "fhEVM-Ready"}
              </span>
            </div>
            <div className="enc-ciphertext">
              <span className="enc-label">TFHE Ciphertext</span>
              <StreamingCiphertext ciphertext={ciphertext} />
            </div>
            <p className="enc-desc">
              {encryptionMode === "live"
                ? "Your score is encrypted using TFHE and stored on-chain. Only a boolean (eligible/not) is revealed via Gateway oracle."
                : "Score encrypted with TFHE. On fhEVM networks, the ciphertext is stored on-chain and compared against thresholds without decryption."}
            </p>
          </div>
        )}

        {/* Update Score Button */}
        <button
          className="btn-update-score"
          onClick={onOpenUpdateModal}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Update Score
        </button>
      </>)}
    </div>
  );
}
