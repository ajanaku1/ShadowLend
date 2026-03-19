import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { Caption } from '../components/Caption';
import { TypewriterText } from '../components/TypewriterText';
import { C, VOICEOVER } from '../constants';

const steps = [
  { label: 'Request Loan', color: C.indigo, delay: 8 },
  { label: 'FHE Verification', color: C.teal, delay: 20 },
  { label: 'USDC Released', color: C.green, delay: 32 },
  { label: 'Repay + 5% Fee', color: C.amber, delay: 44 },
];

export const LoanCycleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Connector line animation
  const lineProgress = (stepIndex: number) => {
    const s = spring({
      frame: frame - steps[stepIndex].delay - 8,
      fps,
      config: { damping: 30, stiffness: 40, mass: 1.0 },
    });
    return interpolate(s, [0, 1], [0, 1]);
  };

  // Browser frame repayment progress animation
  const repayProgress = spring({
    frame: frame - 55,
    fps,
    config: { damping: 30, stiffness: 30, mass: 1.5 },
  });
  const repayWidth = interpolate(repayProgress, [0, 1], [0, 65]);

  // Status badge animation
  const badgeEntry = spring({ frame: frame - 40, fps, config: { damping: 22, stiffness: 60, mass: 1.0 } });
  const badgePulse = interpolate(frame % 60, [0, 30, 60], [0.8, 1, 0.8]);

  return (
    <AbsoluteFill>
      <GradientBackground variant="warm" />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 80,
          padding: '0 100px',
        }}
      >
        {/* Left side: vertical flow diagram */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0,
            marginBottom: 60,
          }}
        >
          {steps.map((step, i) => {
            const entry = spring({
              frame: frame - step.delay,
              fps,
              config: { damping: 24, stiffness: 55, mass: 1.2 },
            });
            const dotScale = interpolate(entry, [0, 1], [0.3, 1]);
            const textOpacity = interpolate(entry, [0, 1], [0, 1]);
            const textX = interpolate(entry, [0, 1], [12, 0]);

            return (
              <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                {/* Step row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                  }}
                >
                  {/* Dot with glow */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${step.color}44 0%, transparent 70%)`,
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) scale(${dotScale})`,
                        filter: 'blur(8px)',
                      }}
                    />
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: step.color,
                        transform: `scale(${dotScale})`,
                        boxShadow: `0 0 12px ${step.color}66`,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    />
                  </div>

                  {/* Label */}
                  <span
                    style={{
                      color: C.ink,
                      fontSize: 22,
                      fontFamily: 'system-ui',
                      fontWeight: 600,
                      opacity: textOpacity,
                      transform: `translateX(${textX}px)`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line between steps */}
                {i < steps.length - 1 && (
                  <div
                    style={{
                      marginLeft: 8,
                      width: 2,
                      height: 36,
                      background: `linear-gradient(to bottom, ${step.color}, ${steps[i + 1].color})`,
                      opacity: lineProgress(i),
                      transformOrigin: 'top',
                      transform: `scaleY(${lineProgress(i)})`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Right side: BrowserFrame with loan card mockup */}
        <BrowserFrame enterDelay={10} scale={1.05} url="app.shadowlend.xyz/loans">
          <div
            style={{
              background: C.bg,
              width: '100%',
              height: '100%',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* App header */}
            <FadeSlide delay={15}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: C.ink, fontSize: 18, fontFamily: 'system-ui', fontWeight: 700 }}>
                  My Loans
                </span>
                <div
                  style={{
                    background: 'rgba(99,102,241,0.12)',
                    borderRadius: 8,
                    padding: '6px 14px',
                  }}
                >
                  <span style={{ color: C.indigo2, fontSize: 12, fontFamily: 'system-ui', fontWeight: 600 }}>
                    0x4a2f...8c31
                  </span>
                </div>
              </div>
            </FadeSlide>

            {/* Loan card */}
            <FadeSlide delay={22}>
              <div
                style={{
                  background: C.card,
                  borderRadius: 16,
                  border: '1px solid rgba(99,102,241,0.12)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                {/* Amount and status row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: C.inkMuted, fontSize: 12, fontFamily: 'system-ui', letterSpacing: 1, textTransform: 'uppercase' }}>
                      Loan Amount
                    </span>
                    <span style={{ color: C.ink, fontSize: 36, fontFamily: 'system-ui', fontWeight: 700, letterSpacing: -0.5 }}>
                      $5,000
                    </span>
                  </div>

                  {/* Status badge */}
                  <div
                    style={{
                      background: `rgba(74,222,128,0.12)`,
                      border: `1px solid ${C.green}`,
                      borderRadius: 24,
                      padding: '8px 20px',
                      opacity: badgeEntry,
                      transform: `scale(${interpolate(badgeEntry, [0, 1], [0.8, 1]) * badgePulse})`,
                    }}
                  >
                    <span
                      style={{
                        color: C.green,
                        fontSize: 14,
                        fontFamily: 'system-ui',
                        fontWeight: 700,
                        letterSpacing: 0.5,
                      }}
                    >
                      Approved
                    </span>
                  </div>
                </div>

                {/* Info row */}
                <div style={{ display: 'flex', gap: 32 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ color: C.inkMuted, fontSize: 11, fontFamily: 'system-ui', letterSpacing: 0.5 }}>Token</span>
                    <span style={{ color: C.ink, fontSize: 15, fontFamily: 'system-ui', fontWeight: 600 }}>USDC</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ color: C.inkMuted, fontSize: 11, fontFamily: 'system-ui', letterSpacing: 0.5 }}>Fee</span>
                    <span style={{ color: C.amber, fontSize: 15, fontFamily: 'system-ui', fontWeight: 600 }}>5%</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ color: C.inkMuted, fontSize: 11, fontFamily: 'system-ui', letterSpacing: 0.5 }}>Network</span>
                    <span style={{ color: C.inkSoft, fontSize: 15, fontFamily: 'system-ui', fontWeight: 600 }}>Sepolia</span>
                  </div>
                </div>

                {/* Repayment progress bar */}
                <FadeSlide delay={48}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: 'system-ui', fontWeight: 500 }}>
                        Repayment Progress
                      </span>
                      <span style={{ color: C.ink, fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                        {Math.round(repayWidth)}%
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 10,
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${repayWidth}%`,
                          height: '100%',
                          borderRadius: 6,
                          background: `linear-gradient(90deg, ${C.indigo}, ${C.teal})`,
                          boxShadow: `0 0 12px rgba(45,212,191,0.3)`,
                        }}
                      />
                    </div>
                  </div>
                </FadeSlide>
              </div>
            </FadeSlide>

            {/* Footer info */}
            <FadeSlide delay={55}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: C.green,
                    boxShadow: `0 0 8px ${C.green}66`,
                  }}
                />
                <span style={{ color: C.inkMuted, fontSize: 12, fontFamily: 'system-ui' }}>
                  FHE-verified on-chain
                </span>
              </div>
            </FadeSlide>
          </div>
        </BrowserFrame>
      </div>

      <Caption text={VOICEOVER.loanCycle} delay={10} />
    </AbsoluteFill>
  );
};
