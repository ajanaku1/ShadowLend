import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { Caption } from '../components/Caption';
import { TypewriterText } from '../components/TypewriterText';
import { C, VOICEOVER } from '../constants';

export const VerificationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered springs
  const contractEntry = spring({ frame, fps, config: { damping: 24, stiffness: 55, mass: 1.2 } });
  const codeEntry = spring({ frame: frame - 12, fps, config: { damping: 26, stiffness: 50, mass: 1.1 } });
  const arrowEntry = spring({ frame: frame - 25, fps, config: { damping: 24, stiffness: 50, mass: 1.0 } });
  const blobEntry = spring({ frame: frame - 35, fps, config: { damping: 22, stiffness: 55, mass: 1.2 } });
  const revealEntry = spring({ frame: frame - 50, fps, config: { damping: 20, stiffness: 65, mass: 1.0 } });
  const sideTextEntry = spring({ frame: frame - 15, fps, config: { damping: 28, stiffness: 50, mass: 1.3 } });

  // Arrow animation
  const arrowDash = interpolate(frame % 40, [0, 40], [0, 20]);

  // Green glow for "true" reveal
  const greenGlow = interpolate(revealEntry, [0, 1], [0, 0.6]);
  const greenGlowPulse = interpolate(frame % 50, [0, 25, 50], [0.4, 0.7, 0.4]);
  const finalGreenGlow = revealEntry > 0.5 ? greenGlowPulse : greenGlow;

  // Blob to "true" morph
  const blobScale = interpolate(revealEntry, [0, 1], [1, 0]);
  const trueScale = interpolate(revealEntry, [0, 1], [0.5, 1]);
  const trueOpacity = interpolate(revealEntry, [0, 1], [0, 1]);

  // Encrypted blob shimmer
  const blobShimmer = interpolate(frame % 30, [0, 15, 30], [0.6, 1, 0.6]);

  return (
    <AbsoluteFill>
      <GradientBackground variant="cool" />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -55%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Smart contract box */}
        <FadeSlide delay={0}>
          <div
            style={{
              opacity: contractEntry,
              background: C.surface,
              border: `2px solid ${C.indigo}`,
              borderRadius: 16,
              padding: '0',
              width: 440,
              overflow: 'hidden',
              boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 0 30px rgba(99,102,241,0.1)`,
            }}
          >
            {/* Contract header */}
            <div
              style={{
                background: C.card,
                padding: '14px 24px',
                borderBottom: `1px solid rgba(99,102,241,0.12)`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {/* Solidity icon */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>S</span>
              </div>
              <span
                style={{
                  color: C.ink,
                  fontSize: 18,
                  fontFamily: '"SF Mono", "Fira Code", monospace',
                  fontWeight: 600,
                }}
              >
                CreditScore.sol
              </span>
            </div>

            {/* Contract code */}
            <div
              style={{
                padding: '20px 24px',
                opacity: codeEntry,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: C.inkMuted, fontSize: 13, fontFamily: 'monospace' }}>
                  <span style={{ color: C.indigo2 }}>function</span>{' '}
                  <span style={{ color: C.green }}>checkEligibility</span>
                  <span style={{ color: C.inkSoft }}>(</span>
                </span>
                <span style={{ color: C.inkMuted, fontSize: 13, fontFamily: 'monospace', paddingLeft: 20 }}>
                  <span style={{ color: C.teal }}>euint32</span>{' '}
                  <span style={{ color: C.amber }}>score</span>
                </span>
                <span style={{ color: C.inkSoft, fontSize: 13, fontFamily: 'monospace' }}>
                  ) <span style={{ color: C.indigo2 }}>internal</span> {'{'}</span>

                {/* The key FHE line */}
                <div
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    borderRadius: 8,
                    padding: '10px 16px',
                    margin: '8px 0',
                    border: '1px solid rgba(99,102,241,0.15)',
                  }}
                >
                  <span style={{ fontSize: 16, fontFamily: '"SF Mono", "Fira Code", monospace', fontWeight: 600 }}>
                    <span style={{ color: C.teal }}>FHE</span>
                    <span style={{ color: C.inkSoft }}>.</span>
                    <span style={{ color: C.green }}>ge</span>
                    <span style={{ color: C.inkSoft }}>(</span>
                    <span style={{ color: C.amber }}>score</span>
                    <span style={{ color: C.inkSoft }}>, </span>
                    <span style={{ color: C.rose }}>650</span>
                    <span style={{ color: C.inkSoft }}>)</span>
                  </span>
                </div>

                <span style={{ color: C.inkSoft, fontSize: 13, fontFamily: 'monospace' }}>{'}'}</span>
              </div>
            </div>
          </div>
        </FadeSlide>

        {/* Arrow flowing down */}
        <div
          style={{
            opacity: arrowEntry,
            height: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="3" height="46" style={{ overflow: 'visible' }}>
            <line
              x1="1.5"
              y1="0"
              x2="1.5"
              y2="46"
              stroke={C.indigo2}
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeDashoffset={-arrowDash}
            />
            <polygon points="-4,40 1.5,48 7,40" fill={C.indigo2} />
          </svg>
        </div>

        {/* Encrypted boolean result */}
        <FadeSlide delay={30}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Green glow behind result */}
            <div
              style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(74,222,128,${finalGreenGlow}) 0%, transparent 70%)`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                filter: 'blur(25px)',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: C.inkMuted, fontSize: 12, fontFamily: 'system-ui', letterSpacing: 2, textTransform: 'uppercase' }}>
                Encrypted Result
              </span>

              <div style={{ position: 'relative', width: 140, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Encrypted blob */}
                <div
                  style={{
                    position: 'absolute',
                    background: C.card,
                    border: `1px solid rgba(99,102,241,0.3)`,
                    borderRadius: 12,
                    padding: '12px 24px',
                    opacity: blobEntry * blobScale * blobShimmer,
                    transform: `scale(${interpolate(blobEntry, [0, 1], [0.8, 1])})`,
                  }}
                >
                  <span style={{ color: C.indigo2, fontSize: 14, fontFamily: 'monospace', letterSpacing: 1 }}>
                    0xa7f3...
                  </span>
                </div>

                {/* "true" revealed */}
                <div
                  style={{
                    position: 'absolute',
                    background: 'rgba(74,222,128,0.1)',
                    border: `2px solid ${C.green}`,
                    borderRadius: 12,
                    padding: '10px 32px',
                    opacity: trueOpacity,
                    transform: `scale(${trueScale})`,
                  }}
                >
                  <span
                    style={{
                      color: C.green,
                      fontSize: 28,
                      fontFamily: '"SF Mono", "Fira Code", monospace',
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    true
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FadeSlide>
      </div>

      {/* Side text */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          right: 80,
          transform: 'translateY(-50%)',
          opacity: sideTextEntry,
          maxWidth: 320,
        }}
      >
        <div
          style={{
            background: 'rgba(7,7,26,0.7)',
            border: '1px solid rgba(45,212,191,0.15)',
            borderRadius: 14,
            padding: '20px 24px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            style={{
              color: C.teal,
              fontSize: 18,
              fontFamily: 'system-ui',
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            Homomorphic comparison
          </span>
          <br />
          <span
            style={{
              color: C.inkSoft,
              fontSize: 16,
              fontFamily: 'system-ui',
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            — no decryption needed
          </span>
        </div>
      </div>

      <Caption text={VOICEOVER.verification} delay={10} />
    </AbsoluteFill>
  );
};
