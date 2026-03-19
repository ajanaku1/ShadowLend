import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { Caption } from '../components/Caption';
import { C, VOICEOVER } from '../constants';

const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx={10} cy={10} r={10} fill={`${C.rose}20`} />
    <path d="M7 7L13 13M13 7L7 13" stroke={C.rose} strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx={10} cy={10} r={10} fill={`${C.green}20`} />
    <path d="M6 10.5L9 13.5L14 7" stroke={C.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ComparisonItem: React.FC<{
  text: string;
  type: 'bad' | 'good';
  delay: number;
}> = ({ text, type, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 55, mass: 1.2 } });
  const translateX = interpolate(enter, [0, 1], [type === 'bad' ? -30 : 30, 0]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: enter,
        transform: `translateX(${translateX}px)`,
        padding: '14px 0',
      }}
    >
      {type === 'bad' ? <XIcon size={24} /> : <CheckIcon size={24} />}
      <span
        style={{
          color: type === 'bad' ? C.inkSoft : C.ink,
          fontSize: 19,
          fontWeight: 500,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.4,
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Divider animation
  const dividerProgress = spring({ frame: frame - 20, fps, config: { damping: 30, stiffness: 50, mass: 1.2 } });
  const dividerHeight = interpolate(dividerProgress, [0, 1], [0, 360]);

  // Column headers
  const leftHeaderIn = spring({ frame: frame - 10, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const rightHeaderIn = spring({ frame: frame - 15, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });

  return (
    <AbsoluteFill>
      <GradientBackground variant="cool" />

      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 0,
          paddingBottom: 80,
        }}
      >
        {/* Left column — Traditional Lending */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: 80 }}>
          <div
            style={{
              opacity: leftHeaderIn,
              transform: `translateY(${interpolate(leftHeaderIn, [0, 1], [30, 0])}px)`,
              marginBottom: 32,
            }}
          >
            <h2
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: C.rose,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: -1,
                margin: 0,
                textAlign: 'right',
              }}
            >
              Traditional Lending
            </h2>
            <div
              style={{
                width: 60,
                height: 3,
                borderRadius: 2,
                background: C.rose,
                opacity: 0.5,
                marginTop: 10,
                marginLeft: 'auto',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 420, alignItems: 'flex-end' }}>
            <ComparisonItem text="Score visible on-chain" type="bad" delay={35} />
            <ComparisonItem text="Data shared with lenders" type="bad" delay={55} />
            <ComparisonItem text="Centralized oracles see everything" type="bad" delay={75} />
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 2,
            height: dividerHeight,
            background: `linear-gradient(180deg, transparent 0%, ${C.indigo}60 30%, ${C.indigo}60 70%, transparent 100%)`,
            borderRadius: 1,
            flexShrink: 0,
          }}
        />

        {/* Right column — ShadowLend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 80 }}>
          <div
            style={{
              opacity: rightHeaderIn,
              transform: `translateY(${interpolate(rightHeaderIn, [0, 1], [30, 0])}px)`,
              marginBottom: 32,
            }}
          >
            <h2
              style={{
                fontSize: 34,
                fontWeight: 700,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: -1,
                margin: 0,
                background: `linear-gradient(135deg, ${C.indigo}, ${C.teal})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ShadowLend
            </h2>
            <div
              style={{
                width: 60,
                height: 3,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${C.indigo}, ${C.teal})`,
                opacity: 0.5,
                marginTop: 10,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 420 }}>
            <ComparisonItem text="Score encrypted (TFHE)" type="good" delay={45} />
            <ComparisonItem text="Only boolean revealed" type="good" delay={65} />
            <ComparisonItem text="Zero data leakage" type="good" delay={85} />
          </div>
        </div>
      </AbsoluteFill>

      <Caption text={VOICEOVER.problem} delay={15} />
    </AbsoluteFill>
  );
};
