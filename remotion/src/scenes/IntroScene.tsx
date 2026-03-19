import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { C } from '../constants';

/* ── tiny lock icon ─────────────────────────────── */
const LockIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect x={4} y={9} width={12} height={8} rx={2} fill={C.indigo} />
    <path d="M7 9V7a3 3 0 016 0v2" stroke={C.indigo2} strokeWidth={1.5} fill="none" />
    <circle cx={10} cy={13} r={1.2} fill={C.bg} />
  </svg>
);

/* ── nav button helper ──────────────────────────── */
const NavLink: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <span
    style={{
      color: active ? C.ink : C.inkMuted,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      fontFamily: 'system-ui',
      cursor: 'pointer',
    }}
  >
    {label}
  </span>
);

/* ── stats chip ─────────────────────────────────── */
const StatChip: React.FC<{ value: string; label: string; delay: number }> = ({ value, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 55 } });
  return (
    <div style={{ opacity: enter, textAlign: 'center', flex: 1 }}>
      <div style={{ color: C.indigo2, fontSize: 16, fontWeight: 700, fontFamily: 'system-ui' }}>{value}</div>
      <div style={{ color: C.inkMuted, fontSize: 10, fontWeight: 500, fontFamily: 'system-ui', marginTop: 2 }}>{label}</div>
    </div>
  );
};

/* ── orbit label floating tag ───────────────────── */
const OrbitLabel: React.FC<{
  text: string;
  angle: number;
  radius: number;
  frame: number;
  speed: number;
  color: string;
}> = ({ text, angle, radius, frame, speed, color }) => {
  const a = ((angle + frame * speed) * Math.PI) / 180;
  const x = Math.cos(a) * radius;
  const y = Math.sin(a) * radius;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
        padding: '3px 10px',
        borderRadius: 6,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color, fontSize: 9, fontWeight: 600, fontFamily: 'monospace' }}>{text}</span>
    </div>
  );
};

/* ── orbit ring (SVG ellipse that rotates) ──────── */
const OrbitRing: React.FC<{ r: number; frame: number; speed: number; opacity: number }> = ({
  r,
  frame,
  speed,
  opacity,
}) => (
  <ellipse
    cx={100}
    cy={100}
    rx={r}
    ry={r * 0.38}
    fill="none"
    stroke={C.indigo}
    strokeWidth={0.8}
    opacity={opacity}
    transform={`rotate(${frame * speed} 100 100)`}
  />
);

/* ── orbit dot ──────────────────────────────────── */
const OrbitDot: React.FC<{ r: number; frame: number; speed: number; color: string; startAngle: number }> = ({
  r,
  frame,
  speed,
  color,
  startAngle,
}) => {
  const a = ((startAngle + frame * speed) * Math.PI) / 180;
  const x = 100 + Math.cos(a) * r;
  const y = 100 + Math.sin(a) * r * 0.38;
  return <circle cx={x} cy={y} r={3.5} fill={color} opacity={0.9} />;
};

/* ════════════════════════════════════════════════════
   INTRO SCENE — Landing page hero inside BrowserFrame
   ════════════════════════════════════════════════════ */
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* timings */
  const navIn = spring({ frame: frame - 5, fps, config: { damping: 26, stiffness: 55 } });
  const heroIn = spring({ frame: frame - 20, fps, config: { damping: 28, stiffness: 45, mass: 1.2 } });
  const chipIn = spring({ frame: frame - 15, fps, config: { damping: 26, stiffness: 55 } });
  const paraIn = spring({ frame: frame - 40, fps, config: { damping: 26, stiffness: 50 } });
  const btnsIn = spring({ frame: frame - 55, fps, config: { damping: 26, stiffness: 50 } });
  const orbitIn = spring({ frame: frame - 25, fps, config: { damping: 30, stiffness: 40, mass: 1.4 } });
  const statsIn = spring({ frame: frame - 75, fps, config: { damping: 26, stiffness: 55 } });

  const pulseDot = 0.6 + Math.sin(frame * 0.12) * 0.4;

  return (
    <AbsoluteFill>
      <GradientBackground />

      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
        <BrowserFrame enterDelay={0} scale={1.35} url="shadowlend.xyz">
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
              {/* left brand */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <LockIcon size={16} />
                <span style={{ color: C.ink, fontSize: 14, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: -0.3 }}>
                  ShadowLend
                </span>
              </div>
              {/* center links */}
              <div style={{ display: 'flex', gap: 22 }}>
                <NavLink label="Home" active />
                <NavLink label="How It Works" />
                <NavLink label="Privacy" />
              </div>
              {/* right CTA */}
              <div
                style={{
                  padding: '5px 16px',
                  borderRadius: 8,
                  background: C.indigo,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'system-ui' }}>Launch App</span>
              </div>
            </div>

            {/* ── Hero section ────────────────────── */}
            <div
              style={{
                display: 'flex',
                flex: 1,
                padding: '32px 32px 0 32px',
                gap: 24,
                height: 'calc(100% - 44px - 52px)',
              }}
            >
              {/* LEFT — text */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 10,
                  opacity: heroIn,
                  transform: `translateY(${interpolate(heroIn, [0, 1], [20, 0])}px)`,
                }}
              >
                {/* FHE chip */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    opacity: chipIn,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: C.green,
                      opacity: pulseDot,
                      boxShadow: `0 0 6px ${C.green}`,
                    }}
                  />
                  <div
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: C.greenDark,
                      border: `1px solid ${C.green}25`,
                    }}
                  >
                    <span style={{ color: C.green, fontSize: 9, fontWeight: 600, fontFamily: 'system-ui' }}>
                      Zama FHE Encryption
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: C.ink,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      letterSpacing: -1.5,
                      lineHeight: 1.1,
                    }}
                  >
                    Borrow Without
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      letterSpacing: -1.5,
                      lineHeight: 1.1,
                      background: `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: `drop-shadow(0 0 12px ${C.indigoGlow})`,
                    }}
                  >
                    Revealing Anything
                  </div>
                </div>

                {/* Paragraph */}
                <p
                  style={{
                    fontSize: 12,
                    color: C.inkSoft,
                    fontFamily: 'system-ui',
                    fontWeight: 400,
                    margin: 0,
                    lineHeight: 1.6,
                    maxWidth: 300,
                    opacity: paraIn,
                  }}
                >
                  Privacy-preserving DeFi lending powered by fully homomorphic encryption.
                  Your credit score is encrypted before it ever touches the blockchain.
                </p>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 6, opacity: btnsIn }}>
                  <div
                    style={{
                      padding: '8px 20px',
                      borderRadius: 8,
                      background: `linear-gradient(135deg, ${C.indigo}, ${C.indigo2})`,
                      boxShadow: `0 4px 16px ${C.indigoGlow}`,
                    }}
                  >
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'system-ui' }}>Launch App</span>
                  </div>
                  <div
                    style={{
                      padding: '8px 20px',
                      borderRadius: 8,
                      border: `1px solid ${C.cardBorder}`,
                      background: 'transparent',
                    }}
                  >
                    <span style={{ color: C.inkSoft, fontSize: 12, fontWeight: 600, fontFamily: 'system-ui' }}>
                      Learn More
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT — orbit visualization */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  opacity: orbitIn,
                  transform: `scale(${interpolate(orbitIn, [0, 1], [0.85, 1])})`,
                }}
              >
                {/* orbit SVG */}
                <svg width={200} height={200} viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
                  {/* rings */}
                  <OrbitRing r={50} frame={frame} speed={0.4} opacity={0.2} />
                  <OrbitRing r={72} frame={frame} speed={-0.3} opacity={0.15} />
                  <OrbitRing r={92} frame={frame} speed={0.25} opacity={0.1} />

                  {/* center lock */}
                  <circle cx={100} cy={100} r={22} fill={C.card} stroke={C.indigo} strokeWidth={1.5} opacity={0.9} />
                  <rect x={92} y={97} width={16} height={11} rx={2.5} fill={C.indigo} opacity={0.85} />
                  <path d="M96 97v-3a4 4 0 018 0v3" stroke={C.indigo2} strokeWidth={1.5} fill="none" />
                  <circle cx={100} cy={102} r={1.5} fill={C.bg} />

                  {/* animated dots */}
                  <OrbitDot r={50} frame={frame} speed={1.2} color={C.indigo2} startAngle={0} />
                  <OrbitDot r={72} frame={frame} speed={-0.9} color={C.teal} startAngle={120} />
                  <OrbitDot r={92} frame={frame} speed={0.7} color={C.green} startAngle={240} />
                </svg>

                {/* floating data labels */}
                <OrbitLabel text="0x7a3f..." angle={30} radius={105} frame={frame} speed={0.5} color={C.indigo2} />
                <OrbitLabel text="tfhe-256bit" angle={150} radius={95} frame={frame} speed={-0.35} color={C.teal} />
                <OrbitLabel text='score: [REDACTED]' angle={240} radius={110} frame={frame} speed={0.4} color={C.amber} />
                <OrbitLabel text="zk-proof: valid" angle={330} radius={88} frame={frame} speed={-0.45} color={C.green} />
              </div>
            </div>

            {/* ── Stats bar at bottom ─────────────── */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 52,
                borderTop: `1px solid ${C.cardBorder}`,
                background: C.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                opacity: statsIn,
              }}
            >
              <StatChip value="100%" label="Privacy" delay={80} />
              <div style={{ width: 1, height: 24, background: C.cardBorder }} />
              <StatChip value="5" label="FHE Operations" delay={85} />
              <div style={{ width: 1, height: 24, background: C.cardBorder }} />
              <StatChip value="4" label="Smart Contracts" delay={90} />
              <div style={{ width: 1, height: 24, background: C.cardBorder }} />
              <StatChip value="650" label="Score Threshold" delay={95} />
            </div>
          </div>
        </BrowserFrame>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
