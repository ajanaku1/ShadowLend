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

/* ── nav link ───────────────────────────────────── */
const NavLink: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <span
    style={{
      color: active ? C.ink : C.inkMuted,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      fontFamily: 'system-ui',
      padding: '4px 0',
      borderBottom: active ? `2px solid ${C.indigo}` : '2px solid transparent',
    }}
  >
    {label}
  </span>
);

/* ── flow step indicator ────────────────────────── */
const FlowStep: React.FC<{ num: number; label: string; active: boolean; done: boolean; delay: number }> = ({
  num,
  label,
  active,
  done,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 55 } });
  const bg = active ? C.indigo : done ? C.indigoDark : 'rgba(255,255,255,0.04)';
  const numColor = active ? '#fff' : done ? C.indigo2 : C.inkMuted;
  const labelColor = active ? C.ink : C.inkMuted;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: enter }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: active ? 'none' : `1px solid ${C.cardBorder}`,
        }}
      >
        <span style={{ color: numColor, fontSize: 10, fontWeight: 700, fontFamily: 'system-ui' }}>{num}</span>
      </div>
      <span style={{ color: labelColor, fontSize: 10, fontWeight: 600, fontFamily: 'system-ui' }}>{label}</span>
    </div>
  );
};

/* ── toast notification ─────────────────────────── */
const Toast: React.FC<{ text: string; icon: 'loading' | 'check'; color: string; opacity: number; y: number }> = ({
  text,
  icon,
  color,
  opacity,
  y,
}) => (
  <div
    style={{
      position: 'absolute',
      top: y,
      right: 16,
      padding: '8px 14px',
      borderRadius: 10,
      background: C.card,
      border: `1px solid ${color}30`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      opacity,
      boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
    }}
  >
    {icon === 'check' ? (
      <svg width={14} height={14} viewBox="0 0 20 20" fill="none">
        <circle cx={10} cy={10} r={10} fill={`${color}20`} />
        <path d="M6 10.5L9 13.5L14 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          borderTopColor: 'transparent',
        }}
      />
    )}
    <span style={{ color: C.ink, fontSize: 10, fontWeight: 500, fontFamily: 'system-ui', maxWidth: 220 }}>{text}</span>
  </div>
);

/* ════════════════════════════════════════════════════
   CONNECT SCENE — Wallet connection flow
   ════════════════════════════════════════════════════ */
export const ConnectScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── timings (at 30fps, 14s = 420 frames) ───── */
  const navIn = spring({ frame: frame - 5, fps, config: { damping: 26, stiffness: 55 } });

  // Phase 1: Connect button highlight (frame ~30)
  const clickHighlight = interpolate(frame, [30, 38, 46], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: Connected state (frame ~60)
  const connectedIn = spring({ frame: frame - 60, fps, config: { damping: 26, stiffness: 55 } });

  // Phase 3: Wrong network warning (frame ~90)
  const wrongNetIn = spring({ frame: frame - 90, fps, config: { damping: 26, stiffness: 55 } });
  const wrongNetOut = interpolate(frame, [130, 145], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 4: Switching... (frame ~130)
  const switchingIn = interpolate(frame, [130, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const switchingOut = interpolate(frame, [165, 175], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 5: Sepolia confirmed (frame ~170)
  const sepoliaIn = spring({ frame: frame - 175, fps, config: { damping: 26, stiffness: 55 } });

  // Phase 6: Faucet toast loading (frame ~200)
  const faucetLoadIn = interpolate(frame, [200, 210], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const faucetLoadOut = interpolate(frame, [270, 280], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 7: Faucet toast success (frame ~280)
  const faucetSuccessIn = spring({ frame: frame - 280, fps, config: { damping: 26, stiffness: 55 } });
  const faucetSuccessOut = interpolate(frame, [360, 375], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 8: Flow bar (frame ~320)
  const flowBarIn = spring({ frame: frame - 320, fps, config: { damping: 26, stiffness: 55 } });

  /* show connected vs disconnect button */
  const showConnected = frame >= 60;
  const showGreenDot = frame >= 175;
  const walletLabel = showConnected ? '0x96cb...369b' : 'Connect';

  /* page placeholder content */
  const pageContentIn = spring({ frame: frame - 15, fps, config: { damping: 26, stiffness: 50 } });

  return (
    <AbsoluteFill>
      <GradientBackground variant="cool" />

      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
        <BrowserFrame enterDelay={0} scale={1.35} url="shadowlend.xyz/borrow">
          <div style={{ background: C.bg, width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

            {/* ── Top nav bar ─────────────────────── */}
            <div
              style={{
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                borderBottom: `1px solid ${C.cardBorder}`,
                opacity: navIn,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <LockIcon />
                <span style={{ color: C.ink, fontSize: 14, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: -0.3 }}>
                  ShadowLend
                </span>
              </div>
              <div style={{ display: 'flex', gap: 22 }}>
                <NavLink label="Borrow" active />
                <NavLink label="Supply" />
                <NavLink label="Docs" />
              </div>
              {/* wallet button */}
              <div
                style={{
                  padding: '5px 14px',
                  borderRadius: 8,
                  background: showConnected ? C.card : C.indigo,
                  border: showConnected ? `1px solid ${C.cardBorder}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: clickHighlight > 0 ? `0 0 16px ${C.indigo}` : 'none',
                  transform: `scale(${1 + clickHighlight * 0.06})`,
                }}
              >
                {showGreenDot && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, opacity: sepoliaIn }} />
                )}
                <span
                  style={{
                    color: showConnected ? C.ink : '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: showConnected ? 'monospace' : 'system-ui',
                  }}
                >
                  {walletLabel}
                </span>
              </div>
            </div>

            {/* ── Page content placeholder ────────── */}
            <div
              style={{
                padding: '36px 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
                opacity: pageContentIn,
              }}
            >
              {/* centered card */}
              <div
                style={{
                  width: '85%',
                  maxWidth: 480,
                  background: C.card,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 14,
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* big lock or wallet icon */}
                {!showConnected ? (
                  <>
                    <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
                      <rect x={8} y={22} width={32} height={20} rx={5} fill={C.indigo} opacity={0.7} />
                      <path d="M15 22v-5a9 9 0 0118 0v5" stroke={C.indigo2} strokeWidth={3} fill="none" />
                      <circle cx={24} cy={32} r={3} fill={C.bg} />
                    </svg>
                    <div style={{ color: C.ink, fontSize: 17, fontWeight: 700, fontFamily: 'system-ui', textAlign: 'center' }}>
                      Connect Your Wallet
                    </div>
                    <div style={{ color: C.inkSoft, fontSize: 11, fontFamily: 'system-ui', textAlign: 'center', maxWidth: 280 }}>
                      Connect MetaMask on Sepolia to access private borrowing powered by FHE encryption.
                    </div>
                    <div
                      style={{
                        padding: '10px 28px',
                        borderRadius: 10,
                        background: `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                        boxShadow: `0 4px 16px ${C.indigoGlow}`,
                        transform: `scale(${1 + clickHighlight * 0.08})`,
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'system-ui' }}>
                        Connect MetaMask
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Connected state - show summary info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: connectedIn }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${C.indigo}, ${C.teal})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width={18} height={18} viewBox="0 0 20 20" fill="none">
                          <path d="M6 10.5L9 13.5L14 7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ color: C.ink, fontSize: 14, fontWeight: 700, fontFamily: 'system-ui' }}>Wallet Connected</div>
                        <div style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'monospace' }}>0x96cb...369b</div>
                      </div>
                    </div>

                    {/* Network status */}
                    <div
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginTop: 8,
                        opacity: connectedIn,
                      }}
                    >
                      {/* Network row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${C.cardBorder}`,
                        }}
                      >
                        <span style={{ color: C.inkSoft, fontSize: 11, fontFamily: 'system-ui', fontWeight: 500 }}>Network</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {showGreenDot ? (
                            <>
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: C.green,
                                  opacity: sepoliaIn,
                                }}
                              />
                              <span
                                style={{
                                  color: C.green,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  fontFamily: 'system-ui',
                                  opacity: sepoliaIn,
                                }}
                              >
                                Sepolia
                              </span>
                            </>
                          ) : (
                            <>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
                              <span style={{ color: C.amber, fontSize: 11, fontWeight: 600, fontFamily: 'system-ui' }}>
                                {frame >= 130 ? 'Switching...' : 'Wrong Network'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Balance row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${C.cardBorder}`,
                        }}
                      >
                        <span style={{ color: C.inkSoft, fontSize: 11, fontFamily: 'system-ui', fontWeight: 500 }}>mUSDC Balance</span>
                        <span style={{ color: frame >= 300 ? C.green : C.ink, fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}>
                          {frame >= 300 ? '1,000.00' : '0.00'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Flow bar ────────────────────────── */}
            {frame >= 320 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 48,
                  borderTop: `1px solid ${C.cardBorder}`,
                  background: C.surface,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 28,
                  opacity: flowBarIn,
                  transform: `translateY(${interpolate(flowBarIn, [0, 1], [10, 0])}px)`,
                }}
              >
                <FlowStep num={1} label="Documents" active done={false} delay={325} />
                <div style={{ width: 20, height: 1, background: C.cardBorder }} />
                <FlowStep num={2} label="AI Score" active={false} done={false} delay={330} />
                <div style={{ width: 20, height: 1, background: C.cardBorder }} />
                <FlowStep num={3} label="Encrypt" active={false} done={false} delay={335} />
                <div style={{ width: 20, height: 1, background: C.cardBorder }} />
                <FlowStep num={4} label="Verify" active={false} done={false} delay={340} />
                <div style={{ width: 20, height: 1, background: C.cardBorder }} />
                <FlowStep num={5} label="Release" active={false} done={false} delay={345} />
              </div>
            )}

            {/* ── Toast notifications ─────────────── */}
            {/* Wrong network */}
            {frame >= 90 && frame < 145 && (
              <Toast
                text="Wrong network detected. Please switch to Sepolia."
                icon="loading"
                color={C.amber}
                opacity={wrongNetIn * wrongNetOut}
                y={52}
              />
            )}

            {/* Switching */}
            {frame >= 130 && frame < 175 && (
              <Toast
                text="Switching to Sepolia testnet..."
                icon="loading"
                color={C.indigo2}
                opacity={switchingIn * switchingOut}
                y={52}
              />
            )}

            {/* Sepolia confirmed */}
            {frame >= 175 && frame < 210 && (
              <Toast
                text="Connected to Sepolia testnet"
                icon="check"
                color={C.green}
                opacity={sepoliaIn}
                y={52}
              />
            )}

            {/* Faucet loading */}
            {frame >= 200 && frame < 280 && (
              <Toast
                text="Welcome! Claiming 1,000 mUSDC for testing..."
                icon="loading"
                color={C.teal}
                opacity={faucetLoadIn * faucetLoadOut}
                y={frame >= 175 && frame < 210 ? 90 : 52}
              />
            )}

            {/* Faucet success */}
            {frame >= 280 && frame < 375 && (
              <Toast
                text="1,000 mUSDC deposited to your wallet!"
                icon="check"
                color={C.green}
                opacity={faucetSuccessIn * faucetSuccessOut}
                y={52}
              />
            )}
          </div>
        </BrowserFrame>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
