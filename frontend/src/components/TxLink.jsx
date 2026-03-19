import React from "react";
import { truncHash, txLink } from "../utils/helpers";

export default function TxLink({ hash, label }) {
  if (!hash) return null;
  const url = txLink(hash);
  return (
    <div className="tx-link">
      {label && <span className="tx-label">{label}</span>}
      <a href={url} target="_blank" rel="noopener noreferrer" className="tx-hash">
        {truncHash(hash)}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
        </svg>
      </a>
    </div>
  );
}
