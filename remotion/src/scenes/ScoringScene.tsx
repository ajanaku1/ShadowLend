import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { C } from '../constants';

/* ── tiny lock icon ─────────────────────────────── */
const LockIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect x={4} y={9} width={12} height={8} rx={2} fill={C.indigo} />
    <path d="M7 9V7a3 3 0 016 0v2" stroke={C.indigo2} strokeWidth={1.5} fill="none" />
    <circle cx={10} cy={13} r={1.2} fill={C.bg} />
  </svg>
);

/* ── deterministic pseudo-random for hash flicker ─ */
const hashChars = '0123456789abcdef';
const flickerHash = (seed: number, frame: number, prefix: string): string => {
  if (frame < 0) return '';
  let h = prefix;
  for (let i = 0; i < 4; i++) {
    const idx = Math.abs(Math.floor(Math.sin(seed * 100 + i * 37 + frame * 7.3) * 1000)) % 16;
    h += hashChars[idx];
  }
  return h;
};

/* ── form field with typing + hash ──────────────── */
const FormField: React.FC<{
  label: string;
  value: string;
  hash: string;
  typingStart: number;
  typingDuration: number;
  hashSeed: number;
}> = ({ label, value, hash, typingStart, typingDuration, hashSeed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fieldIn = spring({ frame: frame - typingStart + 10, fps, config: { damping: 26, stiffness: 55 } });

  /* typing progress */
  const typingProgress = interpolate(frame, [typingStart, typingStart + typingDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const charsShown = Math.floor(typingProgress * value.length);
  const displayValue = value.slice(0, charsShown);
  const showCursor = frame >= typingStart && frame < typingStart + typingDuration + 15;
  const cursorBlink = Math.sin(frame * 0.3) > 0;

  /* hash flicker */
  const hashVisible = frame >= typingStart + 5;
  const hashSettled = frame >= typingStart + typingDuration + 5;
  const flickered = hashSettled ? hash : flickerHash(hashSeed, frame, '0x');

  return (
    <div style={{ opacity: fieldIn, marginBottom: 10 }}>
      <div
        style={{
          color: C.inkMuted,
          fontSize: 9,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.8,
          fontFamily: 'system-ui',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Input */}
        <div
          style={{
            flex: 1,
            height: 32,
            borderRadius: 7,
            background: C.card,
            border: `1px solid ${C.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
          }}
        >
          <span style={{ color: C.ink, fontSize: 12, fontFamily: 'monospace', fontWeight: 500 }}>
            {displayValue}
            {showCursor && cursorBlink && (
              <span style={{ color: C.indigo2, marginLeft: 1 }}>|</span>
            )}
          </span>
        </div>
        {/* Hash tag */}
        {hashVisible && (
          <div
            style={{
              padding: '4px 8px',
              borderRadius: 5,
              background: C.indigoDark,
              border: `1px solid ${C.indigo}20`,
              minWidth: 60,
            }}
          >
            <span
              style={{
                color: hashSettled ? C.indigo2 : C.indigo,
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 600,
                opacity: hashSettled ? 1 : 0.7,
              }}
            >
              {flickered}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── factor bar for results ─────────────────────── */
const FactorBar: React.FC<{ label: string; score: number; delay: number; color: string }> = ({
  label,
  score,
  delay,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const barWidth = interpolate(enter, [0, 1], [0, score]);
  const displayVal = Math.round(score * enter);

  return (
    <div style={{ opacity: enter, marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: C.inkSoft, fontSize: 8, fontWeight: 600, fontFamily: 'system-ui' }}>{label}</span>
        <span style={{ color, fontSize: 8, fontWeight: 700, fontFamily: 'monospace' }}>{displayVal}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${barWidth}%`,
            height: '100%',
            borderRadius: 3,
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            boxShadow: `0 0 8px ${color}30`,
          }}
        />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   SCORING SCENE — Borrower form + AI credit scoring
   ════════════════════════════════════════════════════ */
export const ScoringScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── timings (at 30fps, 16s = 480 frames) ───── */
  const navIn = spring({ frame: frame - 5, fps, config: { damping: 26, stiffness: 55 } });

  /* form fields typing schedule */
  const field1Start = 30;   // Annual Income
  const field2Start = 75;   // Employment Length
  const field3Start = 115;  // Existing Debt
  const field4Start = 150;  // Missed Payments

  /* document upload (frame ~195) */
  const docAreaIn = spring({ frame: frame - 190, fps, config: { damping: 26, stiffness: 55 } });
  const fileIn = spring({ frame: frame - 210, fps, config: { damping: 26, stiffness: 55 } });

  /* submit button (frame ~240) */
  const submitIn = spring({ frame: frame - 240, fps, config: { damping: 26, stiffness: 55 } });
  const submitClicked = frame >= 260;
  const submitClickPulse = interpolate(frame, [260, 268, 276], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* encrypting state (frame ~270) */
  const encryptingIn = interpolate(frame, [270, 280], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const encryptingOut = interpolate(frame, [310, 320], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  /* score results (frame ~320) */
  const scoreIn = spring({ frame: frame - 320, fps, config: { damping: 30, stiffness: 40, mass: 1.4 } });
  const scoreVal = Math.round(interpolate(scoreIn, [0, 1], [0, 742]));

  /* SVG score ring */
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const targetPct = 742 / 850;
  const dashOffset = circumference - circumference * targetPct * scoreIn;

  /* eligible badge */
  const eligibleIn = spring({ frame: frame - 370, fps, config: { damping: 26, stiffness: 55 } });

  /* factor bars */
  const factorsDelay = 380;

  return (
    <AbsoluteFill>
      <GradientBackground />

      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
        <BrowserFrame enterDelay={0} scale={1.35} url="shadowlend.xyz/borrow">
          <div style={{ background: C.bg, width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

            {/* ── Top nav bar ─────────────────────── */}
            <div
              style={{
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                borderBottom: `1px solid ${C.cardBorder}`,
                opacity: navIn,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LockIcon />
                <span style={{ color: C.ink, fontSize: 13, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: -0.3 }}>
                  ShadowLend
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                <span style={{ color: C.ink, fontSize: 10, fontFamily: 'monospace', fontWeight: 500 }}>0x96cb...369b</span>
              </div>
            </div>

            {/* ── Main content area — two columns ─── */}
            <div style={{ display: 'flex', height: 'calc(100% - 40px)', overflow: 'hidden' }}>

              {/* LEFT: Form card */}
              <div
                style={{
                  flex: 1,
                  padding: '16px 16px 16px 20px',
                  overflowY: 'hidden',
                }}
              >
                <div
                  style={{
                    background: C.card,
                    border: `1px solid ${C.cardBorder}`,
                    borderRadius: 12,
                    padding: '14px 14px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Card header */}
                  <FadeSlide delay={10}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: C.ink, fontSize: 14, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: -0.3 }}>
                          Borrower Application
                        </span>
                        <div
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: C.indigoDark,
                            border: `1px solid ${C.indigo}20`,
                          }}
                        >
                          <span style={{ color: C.indigo2, fontSize: 8, fontWeight: 600, fontFamily: 'system-ui' }}>FHE</span>
                        </div>
                      </div>
                      <div style={{ color: C.inkMuted, fontSize: 9, fontFamily: 'system-ui', marginTop: 2 }}>
                        Encrypted end-to-end before submission
                      </div>
                    </div>
                  </FadeSlide>

                  {/* Form fields */}
                  <FormField
                    label="Annual Income (USD)"
                    value="75000"
                    hash="0x7a3f"
                    typingStart={field1Start}
                    typingDuration={30}
                    hashSeed={1}
                  />
                  <FormField
                    label="Employment Length (months)"
                    value="36"
                    hash="0x9b2e"
                    typingStart={field2Start}
                    typingDuration={18}
                    hashSeed={2}
                  />
                  <FormField
                    label="Existing Debt (USD)"
                    value="5000"
                    hash="0x4d1c"
                    typingStart={field3Start}
                    typingDuration={24}
                    hashSeed={3}
                  />
                  <FormField
                    label="Missed Payments (last 12 mo)"
                    value="0"
                    hash="0xf8a0"
                    typingStart={field4Start}
                    typingDuration={10}
                    hashSeed={4}
                  />

                  {/* Document upload area */}
                  <div style={{ opacity: docAreaIn, marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          color: C.inkMuted,
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase' as const,
                          letterSpacing: 0.8,
                          fontFamily: 'system-ui',
                        }}
                      >
                        Proof of Income
                      </span>
                      <div
                        style={{
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: C.roseDark,
                          border: `1px solid ${C.rose}20`,
                        }}
                      >
                        <span style={{ color: C.rose, fontSize: 7, fontWeight: 700, fontFamily: 'system-ui' }}>required</span>
                      </div>
                    </div>
                    <div
                      style={{
                        borderRadius: 7,
                        border: `1px dashed ${C.cardBorder}`,
                        background: 'rgba(255,255,255,0.02)',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        opacity: fileIn,
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                        <rect x={2} y={1} width={12} height={14} rx={2} stroke={C.inkMuted} strokeWidth={1.2} fill="none" />
                        <path d="M5 5h6M5 8h6M5 11h3" stroke={C.inkMuted} strokeWidth={0.8} strokeLinecap="round" />
                      </svg>
                      <div>
                        <div style={{ color: C.ink, fontSize: 9, fontWeight: 600, fontFamily: 'system-ui' }}>
                          pay_stub_march.pdf
                        </div>
                        <div style={{ color: C.inkMuted, fontSize: 7, fontFamily: 'system-ui' }}>240 KB</div>
                      </div>
                      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto' }}>
                        <circle cx={8} cy={8} r={7} fill={`${C.green}20`} />
                        <path d="M5 8l2 2 4-4" stroke={C.green} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  {/* Submit button */}
                  <div style={{ marginTop: 'auto', paddingTop: 8, opacity: submitIn }}>
                    <div
                      style={{
                        width: '100%',
                        padding: '9px 0',
                        borderRadius: 8,
                        background: submitClicked
                          ? `linear-gradient(135deg, ${C.indigo}aa, ${C.indigo2}aa)`
                          : `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                        textAlign: 'center',
                        boxShadow: submitClickPulse > 0 ? `0 0 20px ${C.indigo}60` : `0 4px 16px ${C.indigoGlow}`,
                        transform: `scale(${1 - submitClickPulse * 0.03})`,
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'system-ui' }}>
                        {frame >= 270 && frame < 320
                          ? 'Encrypting...'
                          : frame >= 320
                            ? 'Submitted'
                            : 'Submit for Encrypted Scoring'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Score results (appear after submit) */}
              <div
                style={{
                  flex: 1,
                  padding: '16px 20px 16px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                {/* encrypting spinner */}
                {frame >= 270 && frame < 320 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      opacity: encryptingIn * encryptingOut,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: `3px solid ${C.indigo}30`,
                        borderTopColor: C.indigo,
                        transform: `rotate(${frame * 8}deg)`,
                      }}
                    />
                    <span style={{ color: C.inkSoft, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500 }}>
                      Encrypting with TFHE...
                    </span>
                  </div>
                )}

                {/* Score ring + results */}
                {frame >= 320 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      opacity: scoreIn,
                      transform: `scale(${interpolate(scoreIn, [0, 1], [0.8, 1])})`,
                    }}
                  >
                    {/* Score ring SVG */}
                    <svg width={90} height={90} viewBox="0 0 90 90">
                      <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
                      <circle
                        cx={45}
                        cy={45}
                        r={r}
                        fill="none"
                        stroke="url(#scoreGrad2)"
                        strokeWidth={6}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 45 45)"
                      />
                      <defs>
                        <linearGradient id="scoreGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={C.indigo} />
                          <stop offset="100%" stopColor={C.teal} />
                        </linearGradient>
                      </defs>
                      <text
                        x={45}
                        y={42}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={C.ink}
                        fontSize={22}
                        fontWeight={800}
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {scoreVal}
                      </text>
                      <text
                        x={45}
                        y={57}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={C.inkMuted}
                        fontSize={7}
                        fontWeight={600}
                        fontFamily="system-ui"
                      >
                        AI CREDIT SCORE
                      </text>
                    </svg>

                    {/* Eligible badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: eligibleIn,
                      }}
                    >
                      <div
                        style={{
                          padding: '3px 10px',
                          borderRadius: 6,
                          background: C.greenDark,
                          border: `1px solid ${C.green}30`,
                        }}
                      >
                        <span style={{ color: C.green, fontSize: 10, fontWeight: 700, fontFamily: 'system-ui' }}>
                          Eligible
                        </span>
                      </div>
                    </div>

                    {/* Threshold + Rate */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 14,
                        opacity: eligibleIn,
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: C.inkMuted, fontSize: 7, fontWeight: 600, fontFamily: 'system-ui' }}>Threshold</div>
                        <div style={{ color: C.ink, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>650</div>
                      </div>
                      <div style={{ width: 1, height: 24, background: C.cardBorder }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: C.inkMuted, fontSize: 7, fontWeight: 600, fontFamily: 'system-ui' }}>Rate</div>
                        <div style={{ color: C.green, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>3.24%</div>
                      </div>
                    </div>

                    {/* Factor bars */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 220,
                        background: C.card,
                        border: `1px solid ${C.cardBorder}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        marginTop: 4,
                      }}
                    >
                      <div style={{ color: C.inkSoft, fontSize: 8, fontWeight: 600, fontFamily: 'system-ui', marginBottom: 8 }}>
                        Score Factors
                      </div>
                      <FactorBar label="Payment" score={88} delay={factorsDelay} color={C.indigo} />
                      <FactorBar label="Debt Ratio" score={75} delay={factorsDelay + 10} color={C.indigo2} />
                      <FactorBar label="Income" score={82} delay={factorsDelay + 20} color={C.teal} />
                      <FactorBar label="Employment" score={65} delay={factorsDelay + 30} color={C.green} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </BrowserFrame>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
