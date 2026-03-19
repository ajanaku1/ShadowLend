import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { FadeSlide } from '../components/FadeSlide';
import { C } from '../constants';

const DataLeak: React.FC<{ label: string; delay: number; frame: number; fps: number }> = ({ label, delay, frame, fps }) => {
  const enter = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 55 } });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [30, 0])}px)`,
    }}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth={2}>
        <circle cx={12} cy={12} r={10} />
        <line x1={15} y1={9} x2={9} y2={15} />
        <line x1={9} y1={9} x2={15} y2={15} />
      </svg>
      <span style={{ color: C.inkSoft, fontSize: 22, fontFamily: 'system-ui', fontWeight: 500 }}>{label}</span>
    </div>
  );
};

export const ProblemScene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({ frame: frame - 10, fps, config: { damping: 28, stiffness: 45, mass: 1.2 } });

  // Animated red glow that pulses
  const glowPulse = 0.3 + Math.sin(frame * 0.04) * 0.15;

  return (
    <AbsoluteFill>
      <GradientBackground variant="warm" />

      {/* Red warning glow */}
      <div style={{
        position: 'absolute', top: '20%', right: '10%',
        width: 300, height: 300, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(251,113,133,${glowPulse}) 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />

      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40 }}>
        {/* Title */}
        <div style={{
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [30, 0])}px)`,
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 56, fontWeight: 800, color: C.ink,
            fontFamily: 'system-ui', letterSpacing: -2, margin: 0, lineHeight: 1.15,
          }}>
            DeFi Lending is{' '}
            <span style={{ color: C.rose }}>Broken</span>
          </h1>
        </div>

        {/* Problem items — two categories */}
        <div style={{ display: 'flex', gap: 80, alignItems: 'flex-start' }}>
          {/* Overcollateralization */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FadeSlide delay={30} direction="up">
              <span style={{ fontSize: 16, fontWeight: 700, color: C.amber, fontFamily: 'system-ui', textTransform: 'uppercase' as const, letterSpacing: 2 }}>
                Capital Inefficiency
              </span>
            </FadeSlide>
            <DataLeak label="150% collateral just to borrow" delay={45} frame={frame} fps={fps} />
            <DataLeak label="Your capital sits locked and idle" delay={60} frame={frame} fps={fps} />
            <DataLeak label="No path to borrow on creditworthiness" delay={75} frame={frame} fps={fps} />
          </div>

          {/* Privacy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FadeSlide delay={50} direction="up">
              <span style={{ fontSize: 16, fontWeight: 700, color: C.rose, fontFamily: 'system-ui', textTransform: 'uppercase' as const, letterSpacing: 2 }}>
                Data Exposure
              </span>
            </FadeSlide>
            <DataLeak label="Credit scores shared with every lender" delay={65} frame={frame} fps={fps} />
            <DataLeak label="Financial data visible on-chain" delay={80} frame={frame} fps={fps} />
            <DataLeak label="Sensitive info stored by centralized oracles" delay={95} frame={frame} fps={fps} />
          </div>
        </div>

        {/* Transition text */}
        <FadeSlide delay={115} direction="up">
          <p style={{
            fontSize: 24, color: C.inkMuted, fontFamily: 'system-ui',
            fontWeight: 500, margin: 0, textAlign: 'center',
          }}>
            Two problems. No one has solved both...
          </p>
        </FadeSlide>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
