import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { TypewriterText } from '../components/TypewriterText';
import { C } from '../constants';

export const EncryptionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hexString = '0x7a3f9b2e4d1cf8a0e5b729d3c8f16ae0b4d72f9c5a3e8d1b6f40...';

  // Flow step progress
  const step1Done = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 60 } });
  const step2Done = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 60 } });
  const step3Active = spring({ frame: frame - 18, fps, config: { damping: 20, stiffness: 60 } });
  const panelEntry = spring({ frame: frame - 15, fps, config: { damping: 24, stiffness: 50, mass: 1.2 } });
  const hexEntry = spring({ frame: frame - 40, fps, config: { damping: 22, stiffness: 55 } });
  const descEntry = spring({ frame: frame - 70, fps, config: { damping: 24, stiffness: 50 } });
  const statusEntry = spring({ frame: frame - 90, fps, config: { damping: 24, stiffness: 50 } });
  const txEntry = spring({ frame: frame - 110, fps, config: { damping: 24, stiffness: 50 } });

  // Score ring animation
  const scoreRingProgress = spring({ frame: frame - 5, fps, config: { damping: 30, stiffness: 40, mass: 1.5 } });
  const ringStroke = interpolate(scoreRingProgress, [0, 1], [0, 251 * 0.88]); // 742/850 ~ 0.88

  // Scanning light effect
  const scanX = interpolate(frame % 90, [0, 90], [0, 100]);

  // Step 3 pulse
  const step3Pulse = interpolate(frame % 40, [0, 20, 40], [1, 1.08, 1]);

  const flowSteps = [
    { label: 'Connect', done: true },
    { label: 'Score', done: true },
    { label: 'Encrypt', done: false, active: true },
    { label: 'Verify', done: false },
    { label: 'Release', done: false },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground />

      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -52%)' }}>
        <BrowserFrame scale={1.35} enterDelay={0} url="shadowlend.xyz/apply">
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: C.bg, height: '100%' }}>

            {/* Score display - already visible at top */}
            <FadeSlide delay={2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
                {/* Score ring */}
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  <svg width="64" height="64" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke={C.indigoDark} strokeWidth="5" />
                    <circle
                      cx="40" cy="40" r="34"
                      fill="none"
                      stroke={C.green}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="214"
                      strokeDashoffset={214 - ringStroke}
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: C.ink, fontSize: 18, fontWeight: 700, fontFamily: 'system-ui',
                  }}>
                    742
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: C.ink, fontSize: 16, fontWeight: 600, fontFamily: 'system-ui' }}>Credit Score</span>
                  <span style={{
                    background: C.greenDark,
                    color: C.green,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontFamily: 'system-ui',
                    width: 'fit-content',
                  }}>
                    Eligible
                  </span>
                </div>
              </div>
            </FadeSlide>

            {/* Encryption panel */}
            <FadeSlide delay={12}>
              <div style={{
                opacity: panelEntry,
                background: C.card,
                border: `1px solid ${C.cardBorder2}`,
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Lock icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="11" width="18" height="11" rx="3" fill={C.indigo} />
                      <path d="M7 11V7a5 5 0 0110 0v4" stroke={C.indigo2} strokeWidth="2" strokeLinecap="round" fill="none" />
                      <circle cx="12" cy="16" r="2" fill={C.bg} />
                    </svg>
                    <span style={{ color: C.ink, fontSize: 15, fontWeight: 600, fontFamily: 'system-ui' }}>
                      Privacy Layer
                    </span>
                  </div>
                  <span style={{
                    background: C.greenDark,
                    color: C.green,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 5,
                    fontFamily: 'system-ui',
                    letterSpacing: 0.3,
                  }}>
                    FHE Encrypted
                  </span>
                </div>

                {/* TFHE Ciphertext label */}
                <span style={{
                  color: C.inkMuted,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'system-ui',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase' as const,
                }}>
                  TFHE Ciphertext
                </span>

                {/* Hex ciphertext box */}
                <div style={{
                  opacity: hexEntry,
                  background: C.bg,
                  border: `1px solid ${C.cardBorder2}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  position: 'relative' as const,
                  overflow: 'hidden' as const,
                }}>
                  {/* Scanning light effect */}
                  <div style={{
                    position: 'absolute' as const,
                    top: 0,
                    left: `${scanX}%`,
                    width: 60,
                    height: '100%',
                    background: `linear-gradient(90deg, transparent, rgba(99,102,241,0.12), transparent)`,
                    pointerEvents: 'none' as const,
                    transform: 'translateX(-50%)',
                  }} />
                  <TypewriterText
                    text={hexString}
                    startFrame={45}
                    speed={1.0}
                    style={{
                      color: C.indigo2,
                      fontSize: 13,
                      fontFamily: '"SF Mono", "Fira Code", monospace',
                      fontWeight: 500,
                      letterSpacing: 0.5,
                      wordBreak: 'break-all' as const,
                      position: 'relative' as const,
                      zIndex: 1,
                    }}
                  />
                </div>

                {/* Description */}
                <div style={{ opacity: descEntry }}>
                  <span style={{
                    color: C.inkSoft,
                    fontSize: 11,
                    fontFamily: 'system-ui',
                    lineHeight: 1.5,
                    fontWeight: 400,
                  }}>
                    Your score is encrypted using TFHE and stored on-chain. Only a boolean (eligible/not) is revealed via Gateway oracle.
                  </span>
                </div>
              </div>
            </FadeSlide>

            {/* Flow bar */}
            <FadeSlide delay={8}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                padding: '6px 0',
              }}>
                {flowSteps.map((step, i) => {
                  const filled = i < 2 ? true : (i === 2 && step3Active > 0.5);
                  const active = i === 2;
                  return (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1,
                        transform: active ? `scale(${step3Pulse})` : 'none',
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: filled ? C.indigo : 'transparent',
                          border: `2px solid ${filled ? C.indigo : C.inkMuted}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: active ? `0 0 12px ${C.indigoGlow}` : 'none',
                        }}>
                          {i < 2 ? (
                            <svg width="10" height="10" viewBox="0 0 12 12">
                              <polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : active ? (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />
                          ) : (
                            <span style={{ color: C.inkMuted, fontSize: 9, fontWeight: 600 }}>{i + 1}</span>
                          )}
                        </div>
                        <span style={{
                          color: filled || active ? C.ink : C.inkMuted,
                          fontSize: 9,
                          fontWeight: active ? 700 : 500,
                          fontFamily: 'system-ui',
                        }}>
                          {step.label}
                        </span>
                      </div>
                      {i < flowSteps.length - 1 && (
                        <div style={{
                          height: 2, flex: 0.6,
                          background: i < 2 ? C.indigo : C.inkMuted,
                          opacity: 0.4,
                          borderRadius: 1,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </FadeSlide>

            {/* Status message */}
            <FadeSlide delay={30}>
              <div style={{ opacity: statusEntry, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  color: C.inkSoft,
                  fontSize: 11,
                  fontFamily: 'system-ui',
                  fontWeight: 500,
                }}>
                  Score encrypted with TFHE and submitted to CreditScore contract...
                </span>
                <div style={{ opacity: txEntry, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    color: C.inkMuted,
                    fontSize: 10,
                    fontFamily: 'system-ui',
                  }}>
                    Score tx:
                  </span>
                  <span style={{
                    color: C.indigo2,
                    fontSize: 10,
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    fontWeight: 500,
                  }}>
                    0x65cd5e99...
                  </span>
                  <svg width="10" height="10" viewBox="0 0 12 12" style={{ marginLeft: 2 }}>
                    <path d="M3,9 L9,3 M9,3 L5,3 M9,3 L9,7" stroke={C.indigo2} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </FadeSlide>

          </div>
        </BrowserFrame>
      </div>

    </AbsoluteFill>
  );
};
