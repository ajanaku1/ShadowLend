#!/bin/bash
cd "$(dirname "$0")/.."

SPEECH_KEY="${AZURE_SPEECH_KEY:?Set AZURE_SPEECH_KEY env var}"
SPEECH_REGION="${AZURE_SPEECH_REGION:-eastus}"
VOICE_NAME="en-NG-AbeoNeural"
OUTPUT_DIR="public/audio"

rm -f "$OUTPUT_DIR"/*.mp3
mkdir -p "$OUTPUT_DIR"

generate_audio() {
  local scene_name="$1"
  local text="$2"
  local output_file="$OUTPUT_DIR/${scene_name}.mp3"

  echo "Generating: $scene_name..."
  local ssml="<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-NG'><voice name='${VOICE_NAME}'><prosody rate='-3%' pitch='+3%'>${text}</prosody></voice></speak>"

  curl -s -X POST "https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1" \
    -H "Ocp-Apim-Subscription-Key: ${SPEECH_KEY}" \
    -H "Content-Type: application/ssml+xml" \
    -H "X-Microsoft-OutputFormat: audio-16khz-128kbitrate-mono-mp3" \
    -H "User-Agent: ShadowLendDemo" \
    -d "${ssml}" \
    --output "$output_file"

  if [ -s "$output_file" ]; then
    local ftype=$(file -b "$output_file" | head -c 10)
    if [[ "$ftype" == *"JSON"* ]] || [[ "$ftype" == *"ASCII"* ]]; then
      echo "  FAILED"; cat "$output_file"; echo ""; rm -f "$output_file"
    else
      echo "  OK: $(du -h "$output_file" | cut -f1)"
    fi
  else
    echo "  FAILED: empty"; rm -f "$output_file"
  fi
}

generate_audio "problem" "DeFi lending is broken in two ways. First, every protocol demands overcollateralization. Lock up fifteen hundred dollars just to borrow a thousand. Your capital sits trapped, doing nothing. Second, the few protocols that try credit scoring expose your financial data on chain. Your score, your income, your history, all public. Two problems. No one has solved both. Until now."

generate_audio "intro" "Meet ShadowLend. The first uncollateralized lending protocol in crypto where your credit score stays completely private. Borrow based on your creditworthiness, not your collateral. And thanks to fully homomorphic encryption, the system verifies your score without ever decrypting it. No one sees your data. Not the lender. Not the blockchain. Nobody."

generate_audio "connect" "Here is the app. Connect your wallet and you are on the Sepolia test network. The faucet automatically drops one thousand test USDC into your wallet. You can see the balance update right there. Now you are ready to apply."

generate_audio "scoring" "Four fields. Annual income, employment length, existing debt, missed payments. Upload a bank statement or pay stub as proof. Hit submit. The AI agent, powered by Groq and Llama, reads your document, cross-checks it against your numbers, and gives you a score between 300 and 850. If yourS score is 650 or higher, you are eligible for a loan. The factor breakdown shows exactly how each signal contributed."

generate_audio "encryption" "Now look at the encryption panel below the score. That long hex string is your score encrypted with Zama TFHE, fully homomorphic encryption. The green badge says FHE Encrypted. That ciphertext is all the blockchain will ever see. Your actual score, which is 730 in this example, never gets recorded on chain."

generate_audio "loanRequest" "Credit line is open. 4,600 USDC available. Select an amount, hit borrow. The smart contract checks the encrypted score on chain. If the encrypted value passes the threshold, USDC transfers to your wallet. You can see the loan details update. Borrowed, confirmed, all without revealing your score."

generate_audio "repayment" "The repayment card shows everything. Original principal, total owed with the five percent fee, remaining balance. Pick a percentage or type a custom amount. Hit repay. Watch the progress bar fill up. Pay it all off and your credit line resets."

generate_audio "supply" "Now the lender side. The Supply page shows live pool stats, liquidity, utilization, APY. Deposit USDC, you get USD3 vault tokens. Look at the position card, current value, earned interest in green, your shares, and the withdrawable amount. Hit claim yield to take just the profit. Or withdraw everything."

generate_audio "privacy" "This is the core of ShadowLend. The borrower sees their own data. The AI agent sees the score briefly then forgets it. The blockchain sees only scrambled ciphertext. Lenders see pool totals, nothing about individual borrowers. No single party ever has the full picture. Your financial data stays yours."

generate_audio "closing" "Five smart contracts. Six FHE operations. AI credit scoring with real document analysis. An ERC4626 yield vault for lenders. All live on Ethereum Sepolia. ShadowLend. Uncollateralized lending with fully private credit scoring. The only protocol where you borrow on creditworthiness and your score is never visible to anyone. Ever."

echo ""
echo "All done:"
ls -lh "$OUTPUT_DIR"/*.mp3 2>/dev/null
