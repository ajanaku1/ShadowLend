import React from "react";
import TxLink from "./TxLink";

export default function LoanCard({
  aiScore,
  aiEligible,
  interestRate,
  maxBorrow,
  outstanding,
  availableCredit,
  loanRemaining,
  loanTotalOwed,
  paidSoFar,
  usdcBalance,
  loanInput,
  setLoanInput,
  loanInputNum,
  loanInputValid,
  quickBorrowAmounts,
  requesting,
  reqStatus,
  loanTxHash,
  submitDone,
  doRequest,
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Borrow from Credit Line</h2>
          <p className="card-sub">Zero-knowledge verification only</p>
        </div>
        <span className="tag">ZK</span>
      </div>

      {/* Credit line overview */}
      {aiScore != null && (
        <div className="loan-limit">
          <div className="loan-limit-row">
            <span className="loan-limit-label">Credit Line</span>
            <span className="loan-limit-value">
              ${maxBorrow.toLocaleString()}
              <span className="loan-limit-unit">USDC</span>
            </span>
          </div>
          <div className="loan-limit-bar-bg">
            <div
              className="loan-limit-bar-fill"
              style={{ width: `${maxBorrow > 0 ? (loanRemaining / maxBorrow) * 100 : 0}%` }}
            />
          </div>
          <div className="loan-limit-hint" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Used: ${loanRemaining.toFixed(2)}</span>
            <span>Available: ${availableCredit.toFixed(2)}</span>
          </div>
          <div className="loan-terms-row">
            <div className="loan-term">
              <span className="loan-term-label">Interest Rate</span>
              <span className="loan-term-value">{interestRate}%</span>
            </div>
            <div className="loan-term">
              <span className="loan-term-label">Repayment Fee</span>
              <span className="loan-term-value">5%</span>
            </div>
            <div className="loan-term">
              <span className="loan-term-label">Score</span>
              <span className="loan-term-value" style={{ color: aiEligible ? "var(--green)" : "var(--rose)" }}>{aiScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* Outstanding position */}
      {loanRemaining > 0 && (
        <div className="position-rows" style={{ marginBottom: 12 }}>
          <div className="rr">
            <span className="k">Original Principal</span>
            <span className="v">${outstanding.toLocaleString()}</span>
          </div>
          <div className="rr">
            <span className="k">Remaining Balance</span>
            <span className="v" style={{ color: "var(--rose)" }}>${loanRemaining.toFixed(2)}</span>
          </div>
          {paidSoFar > 0 && (
            <div className="rr">
              <span className="k">Paid So Far</span>
              <span className="v" style={{ color: "var(--green)" }}>${paidSoFar.toFixed(2)}</span>
            </div>
          )}
          <div className="rr">
            <span className="k">USDC Balance</span>
            <span className="v" style={{ color: usdcBalance >= loanRemaining ? "var(--green)" : "var(--teal)" }}>
              ${usdcBalance.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Borrow more input */}
      {availableCredit > 0 && (
        <>
          <div className="loan-input-section">
            <label className="loan-input-label">
              {loanRemaining > 0 ? "Borrow More (USDC)" : "Borrow Amount (USDC)"}
            </label>
            <div className="loan-input-wrap">
              <span className="loan-input-prefix">$</span>
              <input
                type="text"
                className="loan-input"
                placeholder="0"
                value={loanInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  if (!requesting) setLoanInput(v);
                }}
                disabled={requesting}
              />
              <span className="loan-input-suffix">USDC</span>
            </div>
            {loanInputNum > availableCredit && (
              <div className="loan-input-error">Exceeds available credit (${availableCredit.toFixed(2)})</div>
            )}
          </div>

          {quickBorrowAmounts.length > 0 && (
            <div className="quick-amounts">
              {quickBorrowAmounts.map((amt) => (
                <button
                  key={amt}
                  className={`qa-btn ${loanInputNum === amt ? "picked" : ""}`}
                  onClick={() => !requesting && setLoanInput(String(amt))}
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>
          )}

          <button
            className="btn-stroke"
            disabled={!submitDone || !loanInputValid || requesting}
            onClick={doRequest}
          >
            {requesting
              ? "Processing..."
              : loanInputValid
              ? `Borrow $${loanInputNum.toLocaleString()} USDC`
              : "Enter Amount"}
          </button>
        </>
      )}

      {availableCredit <= 0 && aiScore != null && (
        <div className="supply-note">
          Credit line fully utilized. Repay some principal to borrow more.
        </div>
      )}

      {reqStatus && (
        <div className={`status show ${reqStatus.type}`}>
          {reqStatus.type === "wait" && <div className="sp" />}
          {reqStatus.text}
        </div>
      )}

      <TxLink hash={loanTxHash} label="Loan tx" />
    </div>
  );
}
