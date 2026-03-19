import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring, staticFile, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { C } from '../constants';

/* ── floating particle ──────────────────────────────────────────── */
const Particle: React.FC<{
  x: number; y: number; size: number; speed: number; color: string; phase: number;
}> = ({ x, y, size, speed, color, phase }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin((frame + phase) * speed * 0.012) * 18;
  const floatY = Math.cos((frame + phase * 1.3) * speed * 0.009) * 14;
  const pulse = interpolate((frame + phase) % 100, [0, 50, 100], [0.15, 0.55, 0.15]);

  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      width: size, height: size, borderRadius: '50%',
      background: color, opacity: pulse,
      transform: `translate(${drift}px, ${floatY}px)`,
      filter: `blur(${size > 4 ? 2 : 1}px)`,
      pointerEvents: 'none' as const,
    }} />
  );
};

/* ── stat badge ─────────────────────────────────────────────────── */
const badgeData: { label: string; color: string; bg: string }[] = [
  { label: '5 Contracts', color: C.indigo2, bg: 'rgba(129,140,248,0.10)' },
  { label: '6 FHE Ops', color: C.teal, bg: 'rgba(45,212,191,0.10)' },
  { label: 'AI Scoring', color: C.amber, bg: 'rgba(251,191,36,0.10)' },
  { label: 'ERC4626 Vault', color: C.green, bg: 'rgba(74,222,128,0.10)' },
  { label: 'Sepolia Live', color: C.rose, bg: 'rgba(251,113,133,0.10)' },
];

/* ── particles data ─────────────────────────────────────────────── */
const particles = [
  { x: 3, y: 8, size: 4, speed: 1.0, color: C.indigo, phase: 0 },
  { x: 95, y: 12, size: 3, speed: 0.8, color: C.teal, phase: 30 },
  { x: 12, y: 85, size: 5, speed: 0.9, color: C.indigo2, phase: 60 },
  { x: 88, y: 80, size: 3, speed: 1.1, color: C.rose, phase: 90 },
  { x: 50, y: 4, size: 3, speed: 0.7, color: C.teal, phase: 120 },
  { x: 25, y: 92, size: 4, speed: 1.0, color: C.indigo, phase: 150 },
  { x: 75, y: 90, size: 3, speed: 0.9, color: C.green, phase: 180 },
  { x: 6, y: 45, size: 3, speed: 1.2, color: C.indigo2, phase: 210 },
  { x: 94, y: 50, size: 4, speed: 0.8, color: C.amber, phase: 240 },
  { x: 40, y: 95, size: 3, speed: 1.0, color: C.teal, phase: 270 },
  { x: 60, y: 3, size: 3, speed: 0.9, color: C.indigo, phase: 300 },
  { x: 18, y: 20, size: 4, speed: 1.1, color: C.rose, phase: 330 },
  { x: 82, y: 25, size: 3, speed: 0.7, color: C.teal, phase: 15 },
  { x: 35, y: 70, size: 5, speed: 0.8, color: C.indigo2, phase: 45 },
  { x: 65, y: 65, size: 3, speed: 1.0, color: C.green, phase: 75 },
  { x: 10, y: 60, size: 3, speed: 1.1, color: C.amber, phase: 105 },
  { x: 90, y: 35, size: 4, speed: 0.9, color: C.indigo, phase: 135 },
  { x: 48, y: 50, size: 3, speed: 0.7, color: C.teal, phase: 165 },
  { x: 22, y: 35, size: 3, speed: 1.0, color: C.rose, phase: 195 },
  { x: 78, y: 55, size: 4, speed: 0.8, color: C.indigo2, phase: 225 },
  { x: 55, y: 15, size: 3, speed: 1.2, color: C.green, phase: 255 },
  { x: 32, y: 48, size: 3, speed: 0.9, color: C.amber, phase: 285 },
];

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* lock icon entrance + continuous pulse */
  const lockEntrance = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 35, mass: 1.4 } });
  const lockScale = interpolate(lockEntrance, [0, 1], [0.3, 1]);
  const lockOpacity = interpolate(lockEntrance, [0, 1], [0, 1]);
  const lockGlow = interpolate(frame % 80, [0, 40, 80], [12, 32, 12]);
  const lockPulse = interpolate(frame % 60, [0, 30, 60], [0.92, 1, 0.92]);

  /* title entrance */
  const titleProg = spring({ frame: frame - 14, fps, config: { damping: 22, stiffness: 40, mass: 1.4 } });
  const titleOpacity = interpolate(titleProg, [0, 1], [0, 1]);
  const titleScale = interpolate(titleProg, [0, 1], [0.85, 1]);

  /* tagline */
  const tagProg = spring({ frame: frame - 24, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const tagOpacity = interpolate(tagProg, [0, 1], [0, 1]);
  const tagY = interpolate(tagProg, [0, 1], [20, 0]);

  /* bottom text */
  const bottomProg = spring({ frame: frame - 65, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const bottomOpacity = interpolate(bottomProg, [0, 1], [0, 1]);

  /* glow pulse behind title */
  const glowPulse = interpolate(frame % 100, [0, 50, 100], [0.3, 1, 0.3]);

  /* bottom lock pulse */
  const bottomLockProg = spring({ frame: frame - 80, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const bottomLockOpacity = interpolate(bottomLockProg, [0, 1], [0, 1]);
  const bottomLockGlow = interpolate(frame % 70, [0, 35, 70], [8, 24, 8]);

  return (
    <AbsoluteFill>
      <GradientBackground />

      {/* floating particles */}
      {particles.map((p, i) => <Particle key={i} {...p} />)}

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: '0 120px 100px',
      }}>

        {/* ── LOGO with glow ──────────────────────── */}
        <div style={{
          opacity: lockOpacity * lockPulse,
          transform: `scale(${lockScale})`,
          marginBottom: 24,
          position: 'relative',
        }}>
          {/* glow layer */}
          <div style={{
            position: 'absolute', inset: -30, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)`,
            filter: `blur(${lockGlow}px)`,
            pointerEvents: 'none' as const,
          }} />
          <Img
            src={staticFile('logo.png')}
            width={100}
            height={100}
            style={{ filter: `drop-shadow(0 0 ${lockGlow}px ${C.indigo})`, position: 'relative' }}
          />
        </div>

        {/* ── TITLE ────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          opacity: titleOpacity, transform: `scale(${titleScale})`,
        }}>
          {/* glow behind title */}
          <div style={{
            position: 'absolute', inset: -60,
            background: `radial-gradient(ellipse at center, rgba(99,102,241,${0.12 * glowPulse}) 0%, transparent 70%)`,
            filter: 'blur(40px)', pointerEvents: 'none' as const,
          }} />
          <h1 style={{
            fontSize: 80, fontFamily: 'system-ui', fontWeight: 900,
            margin: 0, letterSpacing: -3, position: 'relative',
          }}>
            <span style={{ color: C.ink }}>Shadow</span>
            <span style={{
              background: `linear-gradient(135deg, ${C.indigo}, ${C.indigo2}, ${C.teal})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Lend</span>
          </h1>
        </div>

        {/* ── TAGLINE ──────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          margin: 0, marginTop: 16,
          opacity: tagOpacity, transform: `translateY(${tagY}px)`,
        }}>
          <p style={{
            color: C.inkSoft, fontSize: 28, fontFamily: 'system-ui', fontWeight: 500,
            margin: 0, letterSpacing: -0.3,
          }}>
            Uncollateralized Lending. Private Credit Scoring. Powered by
          </p>
          <img
            src={staticFile('zama-logo-white.svg')}
            width={98}
            height={40}
            style={{ marginTop: 2 }}
          />
        </div>

        {/* ── STAT BADGES ──────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 48,
          flexWrap: 'wrap' as const, justifyContent: 'center',
        }}>
          {badgeData.map((badge, i) => {
            const badgeDelay = 36 + i * 8;
            const badgeProg = spring({
              frame: frame - badgeDelay, fps,
              config: { damping: 22, stiffness: 55, mass: 1 },
            });
            const badgeOpacity = interpolate(badgeProg, [0, 1], [0, 1]);
            const badgeScale = interpolate(badgeProg, [0, 1], [0.7, 1]);
            const badgeY = interpolate(badgeProg, [0, 1], [16, 0]);
            /* subtle breathing per badge */
            const breathe = interpolate((frame + i * 20) % 90, [0, 45, 90], [0.95, 1, 0.95]);

            return (
              <div key={badge.label} style={{
                padding: '12px 28px', borderRadius: 12,
                background: badge.bg, border: `1px solid ${badge.color}22`,
                opacity: badgeOpacity, transform: `scale(${badgeScale * breathe}) translateY(${badgeY}px)`,
              }}>
                <span style={{
                  color: badge.color, fontSize: 17, fontFamily: 'system-ui',
                  fontWeight: 700, letterSpacing: 0.3,
                }}>{badge.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── BOTTOM TEXT ──────────────────────────────── */}
        <p style={{
          color: C.inkMuted, fontSize: 20, fontFamily: 'system-ui', fontWeight: 500,
          margin: 0, marginTop: 52, maxWidth: 800, textAlign: 'center' as const,
          lineHeight: 1.6, opacity: bottomOpacity,
        }}>
          The only protocol where you borrow on{' '}
          <span style={{ color: C.teal, fontWeight: 700 }}>creditworthiness</span>
          {' '}— and your score is never visible to anyone on-chain.
        </p>

        {/* ── BOTTOM LOGO ICON ─────────────────────────── */}
        <div style={{
          marginTop: 32, opacity: bottomLockOpacity * lockPulse,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Img
            src={staticFile('logo.png')}
            width={48}
            height={48}
            style={{ filter: `drop-shadow(0 0 ${bottomLockGlow}px ${C.indigo})` }}
          />
        </div>
      </div>

    </AbsoluteFill>
  );
};
