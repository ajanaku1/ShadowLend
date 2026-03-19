import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { Caption } from '../components/Caption';
import { C, VOICEOVER } from '../constants';

const FACTORS = [
  { label: 'Payment History', pct: 35, color: C.indigo },
  { label: 'Debt-to-Income', pct: 30, color: C.indigo2 },
  { label: 'Income', pct: 20, color: C.teal },
  { label: 'Employment', pct: 15, color: C.green },
];

const FactorBar: React.FC<{ label: string; pct: number; color: string; delay: number }> = ({
  label,
  pct,
  color,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const barWidth = interpolate(enter, [0, 1], [0, pct]);

  return (
    <div style={{ opacity: enter, marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span style={{ color: C.ink, fontSize: 17, fontWeight: 600, fontFamily: 'system-ui' }}>{label}</span>
        <span style={{ color, fontSize: 17, fontWeight: 700, fontFamily: 'system-ui' }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 5,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: '100%',
            borderRadius: 5,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 12px ${color}40`,
          }}
        />
      </div>
    </div>
  );
};

const ScoreRing: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 30, stiffness: 40, mass: 1.4 } });
  const scoreValue = Math.round(interpolate(enter, [0, 1], [0, 742]));

  // SVG circle params
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const targetPct = 0.75; // 742 out of ~850 max display range
  const dashOffset = circumference - circumference * targetPct * enter;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        {/* Background ring */}
        <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        {/* Score ring */}
        <circle
          cx={65}
          cy={65}
          r={r}
          fill="none"
          stroke={`url(#scoreGrad)`}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 65 65)"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.indigo} />
            <stop offset="100%" stopColor={C.teal} />
          </linearGradient>
        </defs>
        {/* Score number */}
        <text
          x={65}
          y={62}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={C.ink}
          fontSize={28}
          fontWeight={700}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {scoreValue}
        </text>
        <text
          x={65}
          y={82}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={C.inkSoft}
          fontSize={10}
          fontWeight={500}
          fontFamily="system-ui"
        >
          CREDIT SCORE
        </text>
      </svg>
    </div>
  );
};

export const AIScoringScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <GradientBackground />

      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 80,
          paddingBottom: 80,
        }}
      >
        {/* Left side — text explanation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 440 }}>
          <FadeSlide delay={8}>
            <h2
              style={{
                fontSize: 40,
                fontWeight: 700,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: -1.5,
                margin: 0,
                background: `linear-gradient(135deg, ${C.ink}, ${C.indigo3})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AI Credit Scoring
            </h2>
          </FadeSlide>

          <FadeSlide delay={20}>
            <p
              style={{
                fontSize: 20,
                color: C.inkSoft,
                fontFamily: 'system-ui',
                fontWeight: 500,
                margin: 0,
                marginBottom: 12,
              }}
            >
              4 weighted factors
            </p>
          </FadeSlide>

          {FACTORS.map((f, i) => (
            <FactorBar key={f.label} label={f.label} pct={f.pct} color={f.color} delay={35 + i * 18} />
          ))}
        </div>

        {/* Right side — BrowserFrame with borrower form mockup */}
        <BrowserFrame enterDelay={10} scale={1.05} url="shadowlend.xyz/borrow">
          <div style={{ padding: 24, background: C.surface, height: '100%' }}>
            {/* Form header */}
            <FadeSlide delay={20}>
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    color: C.ink,
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: 'system-ui',
                    letterSpacing: -0.3,
                  }}
                >
                  Borrower Application
                </div>
                <div style={{ color: C.inkMuted, fontSize: 12, fontFamily: 'system-ui', marginTop: 4 }}>
                  Submit your financial signals securely
                </div>
              </div>
            </FadeSlide>

            {/* Form fields */}
            {[
              { label: 'Monthly Income', value: '$8,500', delay: 35 },
              { label: 'Monthly Debt', value: '$2,100', delay: 45 },
              { label: 'Employment Length', value: '4 years', delay: 55 },
              { label: 'Payment History', value: 'On-time (98%)', delay: 65 },
            ].map((field) => (
              <FadeSlide key={field.label} delay={field.delay}>
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      color: C.inkMuted,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase' as const,
                      letterSpacing: 0.8,
                      fontFamily: 'system-ui',
                      marginBottom: 4,
                    }}
                  >
                    {field.label}
                  </div>
                  <div
                    style={{
                      height: 34,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${C.indigo}20`,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                    }}
                  >
                    <span style={{ color: C.ink, fontSize: 13, fontFamily: 'system-ui', fontWeight: 500 }}>
                      {field.value}
                    </span>
                  </div>
                </div>
              </FadeSlide>
            ))}

            {/* Score ring */}
            <FadeSlide delay={80}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: 10,
                }}
              >
                <ScoreRing delay={90} />
              </div>
            </FadeSlide>
          </div>
        </BrowserFrame>
      </AbsoluteFill>

      <Caption text={VOICEOVER.aiScoring} delay={15} />
    </AbsoluteFill>
  );
};
