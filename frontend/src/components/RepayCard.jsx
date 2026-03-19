import React from "react";
import TxLink from "./TxLink";

export default function RepayCard({
  aiScore,
  loanRemaining,
  loanTotalOwed,
  outstanding,
  paidSoFar,
  repayProgress,
  usdcBalance,
  repayInput,
  setRepayInput,
  repayInputNum,
  repayInputValid,
  repaying,
  repayStatus,
  repayTxHash,
  doRepay,
}) {
  return (
    <div className="card full-card">
      <div className="card-head">
        <div>
          <h2>Repayment</h2>
          <p className="card-sub">Pay in full or installments</p>
        </div>
      </div>
      <div>
        {loanRemaining > 0 ? (
          <div>
            {/* Repayment progress */}
            <div className="repay-progress-section">
              <div className="repay-progress-header">
                <span className="repay-progress-label">Repayment Progress</span>
                <span className="repay-progress-pct">{repayProgress.toFixed(0)}%</span>
              </div>
              <div className="repay-progress-bar-bg">
                <div className="repay-progress-bar-fill" style={{ width: `${repayProgress}%` }} />
              </div>
              <div className="repay-progress-hint">
                <span>Paid: ${paidSoFar.toFixed(2)}</span>
                <span>Remaining: ${loanRemaining.toFixed(2)}</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="position-rows" style={{ marginTop: 12 }}>
              <div className="rr">
                <span className="k">Original Principal</span>
                <span className="v">${outstanding.toLocaleString()}</span>
              </div>
              <div className="rr">
                <span className="k">Total Owed (incl. 5% fee)</span>
                <span className="v">${loanTotalOwed.toFixed(2)}</span>
              </div>
              <div className="rr tot">
                <span className="k">Remaining Balance</span>
                <span className="v" style={{ color: "var(--rose)" }}>${loanRemaining.toFixed(2)}</span>
              </div>
            </div>

            {/* Repay amount input */}
            <div className="loan-input-section" style={{ marginTop: 16 }}>
              <label className="loan-input-label">Repay Amount (USDC)</label>
              <div className="loan-input-wrap">
                <span className="loan-input-prefix">$</span>
                <input
                  type="text"
                  className="loan-input"
                  placeholder="0"
                  value={repayInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    if (!repaying) setRepayInput(v);
                  }}
                  disabled={repaying}
                />
                <span className="loan-input-suffix">USDC</span>
              </div>
              {repayInputNum > loanRemaining && (
                <div className="loan-input-error">Exceeds remaining balance (${loanRemaining.toFixed(2)})</div>
              )}
              {repayInputNum > usdcBalance && repayInputNum <= loanRemaining && (
                <div className="loan-input-error">Exceeds USDC balance (${usdcBalance.toFixed(2)})</div>
              )}
            </div>

            {/* Quick installment buttons */}
            <div className="quick-amounts">
              {[25, 50, 75, 100].map((pct) => {
                const amt = Math.ceil((loanRemaining * pct / 100) * 100) / 100;
                return (
                  <button
                    key={pct}
                    className={`qa-btn ${repayInputNum === amt ? "picked" : ""}`}
                    onClick={() => !repaying && setRepayInput(String(amt))}
                  >
                    {pct === 100 ? "Full" : `${pct}%`} · ${amt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </button>
                );
              })}
            </div>

            {/* Repay button */}
            <button
              className="btn-fill"
              style={{ width: "100%", marginTop: 12, padding: "13px 24px" }}
              disabled={repaying || !repayInputValid || repayInputNum > usdcBalance}
              onClick={() => doRepay()}
            >
              <span>
                {repaying
                  ? "Processing..."
                  : repayInputValid
                  ? `Repay $${repayInputNum.toFixed(2)}`
                  : "Enter Amount"}
              </span>
              <div className="bar" />
            </button>
          </div>
        ) : (
          <div className="nil">
            <div className="nil-circle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={aiScore ? "var(--green)" : "currentColor"} strokeWidth="1.5">
                {aiScore ? (
                  <>
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </>
                )}
              </svg>
            </div>
            {aiScore
              ? "No outstanding balance. Your full credit line is available."
              : "Submit your application to activate your credit line."}
          </div>
        )}

        {repayStatus && (
          <div className={`status show ${repayStatus.type}`} style={{ marginTop: 10 }}>
            {repayStatus.type === "wait" && <div className="sp" />}
            {repayStatus.text}
          </div>
        )}

        <TxLink hash={repayTxHash} label="Repay tx" />
      </div>
    </div>
  );
}
