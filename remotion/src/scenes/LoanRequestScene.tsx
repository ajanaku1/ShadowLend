import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { TypewriterText } from '../components/TypewriterText';
import { C } from '../constants';

export const LoanRequestScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation timings
  const cardEntry = spring({ frame, fps, config: { damping: 24, stiffness: 50, mass: 1.2 } });
  const overviewEntry = spring({ frame: frame - 10, fps, config: { damping: 22, stiffness: 55 } });
  const inputEntry = spring({ frame: frame - 25, fps, config: { damping: 22, stiffness: 55 } });
  const quickBtnEntry = spring({ frame: frame - 35, fps, config: { damping: 22, stiffness: 55 } });
  const selectAnim = spring({ frame: frame - 55, fps, config: { damping: 18, stiffness: 70 } });
  const btnEntry = spring({ frame: frame - 70, fps, config: { damping: 22, stiffness: 55 } });
  const clickAnim = spring({ frame: frame - 100, fps, config: { damping: 18, stiffness: 80 } });
  const processingEntry = spring({ frame: frame - 105, fps, config: { damping: 20, stiffness: 60 } });
  const statusMsg2 = spring({ frame: frame - 130, fps, config: { damping: 20, stiffness: 60 } });
  const statusMsg3 = spring({ frame: frame - 160, fps, config: { damping: 20, stiffness: 60 } });
  const utilizationFill = spring({ frame: frame - 170, fps, config: { damping: 30, stiffness: 35, mass: 1.5 } });
  const flowStep5 = spring({ frame: frame - 175, fps, config: { damping: 20, stiffness: 60 } });

  // Input typing animation
  const inputText = frame > 30 ? '2500' : frame > 25 ? '250' : frame > 22 ? '25' : frame > 20 ? '2' : '';

  // Button state
  const isProcessing = frame > 100;
  const isConfirmed = frame > 130;
  const isDone = frame > 160;

  // Utilization bar
  const utilWidth = interpolate(utilizationFill, [0, 1], [0, 49.5]); // 2500/5050 ~ 49.5%

  const quickAmounts = [
    { label: '$1,200', value: 1200 },
    { label: '$2,500', value: 2500 },
    { label: '$3,700', value: 3700 },
    { label: '$5,050', value: 5050 },
  ];

  const flowSteps = [
    { label: 'Connect', done: true },
    { label: 'Score', done: true },
    { label: 'Encrypt', done: true },
    { label: 'Verify', done: true },
    { label: 'Release', done: false, active: true },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground variant="cool" />

      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -52%)' }}>
        <BrowserFrame scale={1.35} enterDelay={0} url="shadowlend.xyz/apply">
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, background: C.bg, height: '100%' }}>

            {/* Card header */}
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
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ color: C.ink, fontSize: 15, fontWeight: 600, fontFamily: 'system-ui' }}>
                      Borrow from Credit Line
                    </span>
                    <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui' }}>
                      Zero-knowledge verification only
                    </span>
                  </div>
                  <span style={{
                    background: C.indigoDark,
                    color: C.indigo2,
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 5,
                    fontFamily: 'system-ui',
                    letterSpacing: 0.5,
                  }}>
                    ZK
                  </span>
                </div>

                {/* Credit Line overview */}
                <FadeSlide delay={8}>
                  <div style={{ opacity: overviewEntry, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: C.inkSoft, fontSize: 11, fontFamily: 'system-ui', fontWeight: 500 }}>
                        Credit Line
                      </span>
                      <span style={{ color: C.ink, fontSize: 18, fontWeight: 700, fontFamily: 'system-ui' }}>
                        $5,050 USDC
                      </span>
                    </div>

                    {/* Utilization bar */}
                    <div style={{
                      width: '100%', height: 6, borderRadius: 3,
                      background: C.indigoDark,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${utilWidth}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: `linear-gradient(90deg, ${C.indigo}, ${C.teal})`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui' }}>
                        Used: {isDone ? '$2,500.00' : '$0.00'}
                      </span>
                      <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui' }}>
                        Available: {isDone ? '$2,550.00' : '$5,050.00'}
                      </span>
                    </div>

                    {/* Terms row */}
                    <div style={{
                      display: 'flex', gap: 12, padding: '6px 0',
                      borderTop: `1px solid ${C.cardBorder}`,
                      marginTop: 2,
                    }}>
                      {[
                        { label: 'Interest Rate', value: '3.24%', color: C.inkSoft },
                        { label: 'Repayment Fee', value: '5%', color: C.inkSoft },
                        { label: 'Score', value: '742', color: C.green },
                      ].map((term) => (
                        <div key={term.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                          <span style={{ color: C.inkMuted, fontSize: 9, fontFamily: 'system-ui', fontWeight: 500 }}>
                            {term.label}
                          </span>
                          <span style={{ color: term.color, fontSize: 12, fontFamily: 'system-ui', fontWeight: 600 }}>
                            {term.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeSlide>

                {/* Borrow input */}
                <FadeSlide delay={18}>
                  <div style={{ opacity: inputEntry, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      background: C.bg,
                      border: `1px solid ${C.cardBorder2}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                    }}>
                      <span style={{ color: C.inkMuted, fontSize: 16, fontFamily: 'system-ui', fontWeight: 500, marginRight: 6 }}>$</span>
                      <span style={{ color: C.ink, fontSize: 16, fontFamily: 'system-ui', fontWeight: 600, flex: 1 }}>
                        {frame > 55 ? '2,500' : (
                          <TypewriterText
                            text="2000"
                            startFrame={22}
                            speed={0.8}
                            style={{ color: C.ink, fontSize: 16, fontFamily: 'system-ui', fontWeight: 600 }}
                          />
                        )}
                      </span>
                      <span style={{ color: C.inkMuted, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500 }}>USDC</span>
                    </div>

                    {/* Quick amounts */}
                    <div style={{ opacity: quickBtnEntry, display: 'flex', gap: 6 }}>
                      {quickAmounts.map((amt, i) => {
                        const isSelected = i === 1 && selectAnim > 0.5;
                        return (
                          <div
                            key={amt.label}
                            style={{
                              flex: 1,
                              padding: '5px 0',
                              borderRadius: 6,
                              background: isSelected ? C.indigoDark : 'transparent',
                              border: `1px solid ${isSelected ? C.indigo : C.cardBorder2}`,
                              textAlign: 'center' as const,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{
                              color: isSelected ? C.indigo2 : C.inkMuted,
                              fontSize: 10,
                              fontWeight: isSelected ? 600 : 500,
                              fontFamily: 'system-ui',
                            }}>
                              {amt.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </FadeSlide>

                {/* Borrow button */}
                <FadeSlide delay={24}>
                  <div style={{ opacity: btnEntry }}>
                    <div style={{
                      width: '100%',
                      padding: '10px 0',
                      borderRadius: 8,
                      background: isProcessing
                        ? `linear-gradient(135deg, ${C.indigo}88, ${C.indigo2}88)`
                        : `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                      textAlign: 'center' as const,
                      cursor: 'pointer',
                      transform: clickAnim > 0 && clickAnim < 0.5 ? 'scale(0.97)' : 'scale(1)',
                      boxShadow: `0 4px 16px ${C.indigoGlow}`,
                    }}>
                      <span style={{
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'system-ui',
                      }}>
                        {isDone ? 'Borrowed!' : isProcessing ? 'Processing...' : 'Borrow $2,500 USDC'}
                      </span>
                    </div>
                  </div>
                </FadeSlide>

                {/* Status messages */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 36 }}>
                  {isProcessing && (
                    <FadeSlide delay={0} distance={8}>
                      <span style={{
                        color: C.inkSoft, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500,
                        opacity: processingEntry,
                      }}>
                        Requesting loan via Orchestrator...
                      </span>
                    </FadeSlide>
                  )}
                  {isConfirmed && (
                    <span style={{
                      color: C.amber, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500,
                      opacity: statusMsg2,
                    }}>
                      Eligibility confirmed! Finalizing...
                    </span>
                  )}
                  {isDone && (
                    <span style={{
                      color: C.green, fontSize: 10, fontFamily: 'system-ui', fontWeight: 500,
                      opacity: statusMsg3,
                    }}>
                      Borrowed $2,500 USDC via FHE-verified credit check
                    </span>
                  )}
                </div>
              </div>
            </FadeSlide>

            {/* Flow bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 0, padding: '4px 0',
            }}>
              {flowSteps.map((step, i) => {
                const isLit = i < 4 || (i === 4 && flowStep5 > 0.5);
                const isActive = i === 4;
                const stepGlow = isActive && flowStep5 > 0.5
                  ? interpolate(frame % 40, [0, 20, 40], [1, 1.1, 1])
                  : 1;
                return (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1,
                      transform: `scale(${stepGlow})`,
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: isLit ? (isActive && flowStep5 > 0.5 ? C.green : C.indigo) : 'transparent',
                        border: `2px solid ${isLit ? (isActive && flowStep5 > 0.5 ? C.green : C.indigo) : C.inkMuted}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: isActive && flowStep5 > 0.5 ? `0 0 12px rgba(74,222,128,0.3)` : 'none',
                      }}>
                        {isLit ? (
                          <svg width="9" height="9" viewBox="0 0 12 12">
                            <polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <span style={{ color: C.inkMuted, fontSize: 8, fontWeight: 600 }}>{i + 1}</span>
                        )}
                      </div>
                      <span style={{
                        color: isLit ? C.ink : C.inkMuted,
                        fontSize: 8, fontWeight: isActive ? 700 : 500, fontFamily: 'system-ui',
                      }}>
                        {step.label}
                      </span>
                    </div>
                    {i < flowSteps.length - 1 && (
                      <div style={{
                        height: 2, flex: 0.6,
                        background: i < 3 ? C.indigo : (i === 3 && flowStep5 > 0.5 ? C.green : C.inkMuted),
                        opacity: 0.4, borderRadius: 1,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </BrowserFrame>
      </div>

    </AbsoluteFill>
  );
};
