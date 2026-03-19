import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { TypewriterText } from '../components/TypewriterText';
import { C } from '../constants';

export const RepaymentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timings
  const cardEntry = spring({ frame, fps, config: { damping: 24, stiffness: 50, mass: 1.2 } });
  const progressEntry = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 55 } });
  const progressFill = spring({ frame: frame - 30, fps, config: { damping: 30, stiffness: 30, mass: 2 } });
  const breakdownEntry = spring({ frame: frame - 20, fps, config: { damping: 22, stiffness: 55 } });
  const inputEntry = spring({ frame: frame - 50, fps, config: { damping: 22, stiffness: 55 } });
  const quickEntry = spring({ frame: frame - 60, fps, config: { damping: 22, stiffness: 55 } });
  const selectAnim = spring({ frame: frame - 75, fps, config: { damping: 18, stiffness: 70 } });
  const btnEntry = spring({ frame: frame - 85, fps, config: { damping: 22, stiffness: 55 } });
  const clickAnim = spring({ frame: frame - 110, fps, config: { damping: 18, stiffness: 80 } });
  const processingAnim = spring({ frame: frame - 115, fps, config: { damping: 20, stiffness: 60 } });
  const successAnim = spring({ frame: frame - 145, fps, config: { damping: 20, stiffness: 60 } });

  // Progress percentage animation
  const progressPct = interpolate(progressFill, [0, 1], [0, 40]);
  const progressWidth = interpolate(progressFill, [0, 1], [0, 40]);

  // Animated values
  const isProcessing = frame > 110;
  const isDone = frame > 145;

  const paidAmount = interpolate(progressFill, [0, 1], [0, 1050], { extrapolateRight: 'clamp' });
  const remainingAmount = interpolate(progressFill, [0, 1], [2625, 1575], { extrapolateRight: 'clamp' });

  const formatUsd = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const quickInstallments = [
    { label: '25%', amount: '$656' },
    { label: '50%', amount: '$1,312' },
    { label: '75%', amount: '$1,968' },
    { label: 'Full', amount: '$2,625' },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground variant="warm" />

      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -52%)' }}>
        <BrowserFrame scale={1.35} enterDelay={0} url="shadowlend.xyz/apply">
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, background: C.bg, height: '100%' }}>

            {/* Card */}
            <FadeSlide delay={2}>
              <div style={{
                background: C.card,
                border: `1px solid ${C.cardBorder2}`,
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ color: C.ink, fontSize: 15, fontWeight: 600, fontFamily: 'system-ui' }}>
                    Repayment
                  </span>
                  <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui' }}>
                    Pay in full or installments
                  </span>
                </div>

                {/* Repayment Progress section */}
                <FadeSlide delay={6}>
                  <div style={{ opacity: progressEntry, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: C.inkSoft, fontSize: 11, fontFamily: 'system-ui', fontWeight: 500 }}>
                        Repayment Progress
                      </span>
                      <span style={{ color: C.ink, fontSize: 16, fontWeight: 700, fontFamily: 'system-ui' }}>
                        {Math.round(progressPct)}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div style={{
                      width: '100%', height: 8, borderRadius: 4,
                      background: C.indigoDark,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${progressWidth}%`,
                        height: '100%',
                        borderRadius: 4,
                        background: `linear-gradient(90deg, ${C.indigo}, ${C.teal}, ${C.green})`,
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui' }}>
                        Paid: {formatUsd(paidAmount)}
                      </span>
                      <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui' }}>
                        Remaining: {formatUsd(remainingAmount)}
                      </span>
                    </div>
                  </div>
                </FadeSlide>

                {/* Breakdown rows */}
                <FadeSlide delay={14}>
                  <div style={{
                    opacity: breakdownEntry,
                    display: 'flex', flexDirection: 'column', gap: 6,
                    borderTop: `1px solid ${C.cardBorder}`,
                    paddingTop: 10,
                  }}>
                    {[
                      { label: 'Original Principal', value: '$2,500.00', color: C.inkSoft },
                      { label: 'Total Owed (incl. 5% fee)', value: '$2,625.00', color: C.inkSoft },
                      { label: 'Remaining Balance', value: formatUsd(remainingAmount), color: C.rose },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500 }}>
                          {row.label}
                        </span>
                        <span style={{ color: row.color, fontSize: 12, fontFamily: 'system-ui', fontWeight: 600 }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </FadeSlide>

                {/* Repay input */}
                <FadeSlide delay={22}>
                  <div style={{ opacity: inputEntry, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      background: C.bg,
                      border: `1px solid ${C.cardBorder2}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                    }}>
                      <span style={{ color: C.inkMuted, fontSize: 16, fontFamily: 'system-ui', fontWeight: 500, marginRight: 6 }}>$</span>
                      <TypewriterText
                        text="1,050"
                        startFrame={55}
                        speed={0.8}
                        style={{ color: C.ink, fontSize: 16, fontFamily: 'system-ui', fontWeight: 600, flex: 1 }}
                      />
                      <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500 }}>USDC</span>
                    </div>

                    {/* Quick installments */}
                    <div style={{ opacity: quickEntry, display: 'flex', gap: 6 }}>
                      {quickInstallments.map((inst, i) => {
                        const isSelected = i === 1 && selectAnim > 0.5;
                        return (
                          <div
                            key={inst.label}
                            style={{
                              flex: 1,
                              padding: '5px 0',
                              borderRadius: 6,
                              background: isSelected ? C.indigoDark : 'transparent',
                              border: `1px solid ${isSelected ? C.indigo : C.cardBorder2}`,
                              textAlign: 'center' as const,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <span style={{
                              color: isSelected ? C.indigo2 : C.inkMuted,
                              fontSize: 10,
                              fontWeight: isSelected ? 600 : 500,
                              fontFamily: 'system-ui',
                            }}>
                              {inst.label}
                            </span>
                            <span style={{
                              color: isSelected ? C.indigo3 : C.inkMuted,
                              fontSize: 8,
                              fontWeight: 400,
                              fontFamily: 'system-ui',
                              opacity: 0.7,
                            }}>
                              {inst.amount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </FadeSlide>

                {/* Repay button */}
                <FadeSlide delay={28}>
                  <div style={{ opacity: btnEntry }}>
                    <div style={{
                      width: '100%',
                      padding: '10px 0',
                      borderRadius: 8,
                      background: isDone
                        ? `linear-gradient(135deg, ${C.green}, ${C.teal})`
                        : isProcessing
                          ? `linear-gradient(135deg, ${C.indigo}88, ${C.indigo2}88)`
                          : `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                      textAlign: 'center' as const,
                      cursor: 'pointer',
                      transform: clickAnim > 0 && clickAnim < 0.5 ? 'scale(0.97)' : 'scale(1)',
                      boxShadow: isDone
                        ? `0 4px 16px rgba(74,222,128,0.2)`
                        : `0 4px 16px ${C.indigoGlow}`,
                    }}>
                      <span style={{
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'system-ui',
                      }}>
                        {isDone ? 'Repayment Successful' : isProcessing ? 'Processing...' : 'Repay $1,050.00'}
                      </span>
                    </div>
                  </div>
                </FadeSlide>

                {/* Status */}
                <div style={{ minHeight: 16 }}>
                  {isDone && (
                    <FadeSlide delay={0} distance={6}>
                      <span style={{
                        color: C.green,
                        fontSize: 10,
                        fontFamily: 'system-ui',
                        fontWeight: 500,
                        opacity: successAnim,
                      }}>
                        Paid $1,050.00. Remaining: $1,575.00
                      </span>
                    </FadeSlide>
                  )}
                  {isProcessing && !isDone && (
                    <span style={{
                      color: C.inkSoft,
                      fontSize: 10,
                      fontFamily: 'system-ui',
                      fontWeight: 500,
                      opacity: processingAnim,
                    }}>
                      Processing repayment...
                    </span>
                  )}
                </div>
              </div>
            </FadeSlide>

          </div>
        </BrowserFrame>
      </div>

    </AbsoluteFill>
  );
};
