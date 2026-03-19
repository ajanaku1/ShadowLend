import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { C } from '../constants';

/* ── tiny stat card ─────────────────────────────────────────────── */
const PoolStat: React.FC<{
  label: string; value: string; sub: string; color: string; delay: number; bar?: boolean;
}> = ({ label, value, sub, color, delay, bar }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 24, stiffness: 55, mass: 1.1 } });
  const o = interpolate(p, [0, 1], [0, 1]);
  const y = interpolate(p, [0, 1], [14, 0]);
  const barW = interpolate(p, [0, 1], [0, 2.5]); // utilization %

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 4px', opacity: o, transform: `translateY(${y}px)`,
    }}>
      <span style={{ color: C.inkMuted, fontSize: 8, fontFamily: 'system-ui', fontWeight: 700,
        textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 4 }}>{label}</span>
      <span style={{ color, fontSize: 16, fontFamily: 'system-ui', fontWeight: 800,
        fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {bar ? (
        <div style={{ width: '80%', height: 3, borderRadius: 2, background: 'rgba(99,102,241,0.1)', marginTop: 4 }}>
          <div style={{ width: `${barW}%`, height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${C.indigo}, ${C.teal})` }} />
        </div>
      ) : (
        <span style={{ color: C.inkMuted, fontSize: 8, fontFamily: 'system-ui', fontWeight: 500, marginTop: 2 }}>{sub}</span>
      )}
    </div>
  );
};

/* ── quick-amount pill ──────────────────────────────────────────── */
const QuickBtn: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <div style={{
    padding: '3px 10px', borderRadius: 6, fontSize: 9, fontFamily: 'system-ui', fontWeight: 600,
    background: active ? C.indigoDark : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? C.indigo : 'rgba(255,255,255,0.06)'}`,
    color: active ? C.indigo2 : C.inkMuted,
  }}>{label}</div>
);

/* ── position row ───────────────────────────────────────────────── */
const PosRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
    <span style={{ color: C.inkSoft, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500 }}>{label}</span>
    <span style={{ color: color || C.ink, fontSize: 11, fontFamily: 'system-ui', fontWeight: 700,
      fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

export const SupplyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* deposit animation: types $5,000 then clicks */
  const typeStart = 30;
  const typeProg = spring({ frame: frame - typeStart, fps, config: { damping: 30, stiffness: 40, mass: 1 } });
  const depositAmount = Math.round(interpolate(typeProg, [0, 1], [0, 5000]));

  const clickFrame = 75; // button click
  const clicked = frame >= clickFrame;
  const clickProg = spring({ frame: frame - clickFrame, fps, config: { damping: 20, stiffness: 80, mass: 0.8 } });
  const btnScale = clicked ? interpolate(clickProg, [0, 0.3, 1], [1, 0.95, 1]) : 1;

  /* status text after click */
  const statusProg = spring({ frame: frame - (clickFrame + 8), fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const statusOpacity = interpolate(statusProg, [0, 1], [0, 1]);

  /* earned interest counter */
  const earnedStart = 40;
  const earnedProg = spring({ frame: frame - earnedStart, fps, config: { damping: 30, stiffness: 35, mass: 1 } });
  const earnedAmount = interpolate(earnedProg, [0, 1], [0, 13.79]);

  /* nav active indicator pulse */
  const navPulse = interpolate(frame % 60, [0, 30, 60], [0.7, 1, 0.7]);

  return (
    <AbsoluteFill>
      <GradientBackground variant="warm" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: '60px 80px 140px' }}>

        <BrowserFrame enterDelay={4} scale={1.38} url="shadowlend.xyz/supply">
          <div style={{ background: C.bg, width: '100%', height: '100%', overflow: 'hidden' }}>

            {/* ── NAV BAR ─────────────────────────────────── */}
            <FadeSlide delay={6} style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px', borderBottom: `1px solid ${C.cardBorder}` }}>
                {/* logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" fill={C.indigo} opacity={0.3} />
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke={C.indigo2} strokeWidth="1.5" fill="none" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={C.indigo2} strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                  <span style={{ color: C.ink, fontSize: 11, fontFamily: 'system-ui', fontWeight: 700 }}>ShadowLend</span>
                </div>
                {/* links */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ color: C.inkMuted, fontSize: 9, fontFamily: 'system-ui', fontWeight: 600 }}>Borrow</span>
                  <span style={{ color: C.indigo2, fontSize: 9, fontFamily: 'system-ui', fontWeight: 700,
                    borderBottom: `2px solid ${C.indigo}`, paddingBottom: 2, opacity: navPulse + 0.3 }}>Supply</span>
                  <span style={{ color: C.inkMuted, fontSize: 9, fontFamily: 'system-ui', fontWeight: 600 }}>Docs</span>
                </div>
                {/* wallet */}
                <div style={{ padding: '3px 10px', borderRadius: 6, background: C.indigoDark,
                  border: `1px solid ${C.cardBorder2}` }}>
                  <span style={{ color: C.indigo3, fontSize: 8, fontFamily: 'monospace', fontWeight: 600 }}>0x96cb...369b</span>
                </div>
              </div>
            </FadeSlide>

            {/* ── PAGE HEADER ─────────────────────────────── */}
            <FadeSlide delay={10}>
              <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8,
                  background: `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12 }}>$</span>
                </div>
                <div>
                  <div style={{ color: C.ink, fontSize: 14, fontFamily: 'system-ui', fontWeight: 800, letterSpacing: -0.3 }}>
                    Supply Liquidity
                  </div>
                  <div style={{ color: C.inkMuted, fontSize: 8, fontFamily: 'system-ui', fontWeight: 500 }}>
                    Earn yield by funding privacy-preserving credit lines
                  </div>
                </div>
              </div>
            </FadeSlide>

            {/* ── POOL STATS ROW ──────────────────────────── */}
            <FadeSlide delay={14}>
              <div style={{ display: 'flex', margin: '10px 16px', gap: 6 }}>
                {[
                  { label: 'POOL LIQUIDITY', value: '$97,500', sub: 'Available USDC', color: C.ink },
                  { label: 'TOTAL BORROWED', value: '$2,500', sub: '1 loan issued', color: C.ink },
                  { label: 'UTILIZATION', value: '2.5%', sub: '', color: C.amber, bar: true },
                  { label: 'BASE APY', value: '2.2%', sub: 'Dynamic rate', color: C.green },
                  { label: 'DEFAULT RATE', value: '0.0%', sub: 'Privacy-preserving', color: C.green },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    flex: 1, background: C.card, borderRadius: 8,
                    border: `1px solid ${C.cardBorder}`, overflow: 'hidden',
                  }}>
                    <PoolStat {...s} delay={18 + i * 4} />
                  </div>
                ))}
              </div>
            </FadeSlide>

            {/* ── TWO CARDS ROW ───────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, padding: '0 16px', height: 200 }}>

              {/* LEFT: Deposit USDC */}
              <FadeSlide delay={28} style={{ flex: 1 }}>
                <div style={{
                  background: C.card, borderRadius: 10, padding: 12,
                  border: `1px solid ${C.cardBorder}`, height: '100%',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ color: C.ink, fontSize: 11, fontFamily: 'system-ui', fontWeight: 700 }}>Deposit USDC</span>
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: C.indigoDark,
                      color: C.indigo2, fontSize: 7, fontFamily: 'system-ui', fontWeight: 700 }}>USDC</span>
                  </div>

                  {/* Input field */}
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                    border: `1px solid ${C.cardBorder2}`, padding: '8px 10px',
                    display: 'flex', alignItems: 'center', marginBottom: 6,
                  }}>
                    <span style={{ color: C.ink, fontSize: 18, fontFamily: 'system-ui', fontWeight: 700,
                      flex: 1, fontVariantNumeric: 'tabular-nums' }}>
                      ${depositAmount.toLocaleString()}
                    </span>
                    <span style={{ color: C.inkMuted, fontSize: 9, fontFamily: 'system-ui' }}>USDC</span>
                  </div>

                  {/* Quick amounts */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <QuickBtn label="$1,000" />
                    <QuickBtn label="$5,000" active />
                    <QuickBtn label="$10,000" />
                    <QuickBtn label="$25,000" />
                  </div>

                  <span style={{ color: C.inkMuted, fontSize: 8, fontFamily: 'system-ui', marginBottom: 8 }}>
                    Balance: $5,550.00 USDC
                  </span>

                  {/* Button / Status */}
                  {!clicked ? (
                    <div style={{
                      background: `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                      borderRadius: 8, padding: '7px 0', textAlign: 'center' as const,
                      transform: `scale(${btnScale})`, cursor: 'pointer',
                      boxShadow: `0 4px 20px ${C.indigoGlow}`,
                    }}>
                      <span style={{ color: '#fff', fontSize: 10, fontFamily: 'system-ui', fontWeight: 700 }}>
                        Deposit $5,000 USDC
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      background: C.greenDark, borderRadius: 8, padding: '7px 12px',
                      textAlign: 'center' as const, opacity: statusOpacity,
                      border: `1px solid rgba(74,222,128,0.2)`,
                    }}>
                      <span style={{ color: C.green, fontSize: 9, fontFamily: 'system-ui', fontWeight: 700 }}>
                        Deposited $5,000 USDC! You received USD3 tokens.
                      </span>
                    </div>
                  )}
                </div>
              </FadeSlide>

              {/* RIGHT: Your Position */}
              <FadeSlide delay={36} style={{ flex: 1 }}>
                <div style={{
                  background: C.card, borderRadius: 10, padding: 12,
                  border: `1px solid rgba(45,212,191,0.12)`, height: '100%',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ color: C.ink, fontSize: 11, fontFamily: 'system-ui', fontWeight: 700 }}>Your Position</span>
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(45,212,191,0.08)',
                      color: C.teal, fontSize: 7, fontFamily: 'system-ui', fontWeight: 700 }}>USD3</span>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <PosRow label="Current Value" value="$5,013.79" />
                      <PosRow label="Earned Interest" value={`+$${earnedAmount.toFixed(2)}`} color={C.green} />
                      <PosRow label="USD3 Shares" value="5,000.00" />
                      <PosRow label="Withdrawable" value="$5,013.79" />
                    </div>

                    <div style={{
                      background: C.greenDark, borderRadius: 8, padding: '7px 0',
                      textAlign: 'center' as const, marginTop: 6,
                      border: `1px solid rgba(74,222,128,0.15)`,
                    }}>
                      <span style={{ color: C.green, fontSize: 10, fontFamily: 'system-ui', fontWeight: 700 }}>
                        Claim $13.79 Yield
                      </span>
                    </div>
                  </div>
                </div>
              </FadeSlide>
            </div>

          </div>
        </BrowserFrame>
      </div>

    </AbsoluteFill>
  );
};
