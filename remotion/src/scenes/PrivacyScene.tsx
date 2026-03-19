import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { FadeSlide } from '../components/FadeSlide';
import { C } from '../constants';

type CellColor = 'green' | 'rose' | 'amber' | 'indigo' | 'teal';

const colorMap: Record<CellColor, { text: string; bg: string }> = {
  green:  { text: C.green,   bg: 'rgba(74,222,128,0.10)' },
  rose:   { text: C.rose,    bg: 'rgba(251,113,133,0.10)' },
  amber:  { text: C.amber,   bg: 'rgba(251,191,36,0.10)' },
  indigo: { text: C.indigo2,  bg: 'rgba(129,140,248,0.10)' },
  teal:   { text: C.teal,    bg: 'rgba(45,212,191,0.10)' },
};

type Cell = { text: string; color: CellColor };
type Row = { data: string; cells: Cell[] };

const rows: Row[] = [
  { data: 'Financial Signals', cells: [
    { text: 'Sees', color: 'green' }, { text: 'Sees', color: 'green' },
    { text: 'Never', color: 'rose' }, { text: 'Never', color: 'rose' },
  ]},
  { data: 'Raw Credit Score', cells: [
    { text: 'Never', color: 'rose' }, { text: 'Ephemeral', color: 'amber' },
    { text: 'Never', color: 'rose' }, { text: 'Never', color: 'rose' },
  ]},
  { data: 'Encrypted Score', cells: [
    { text: 'No', color: 'rose' }, { text: 'Submits', color: 'indigo' },
    { text: 'Ciphertext', color: 'indigo' }, { text: 'No', color: 'rose' },
  ]},
  { data: 'Eligibility (bool)', cells: [
    { text: 'Event', color: 'teal' }, { text: 'No', color: 'rose' },
    { text: 'Decrypted', color: 'indigo' }, { text: 'Event', color: 'teal' },
  ]},
  { data: 'Loan Amount', cells: [
    { text: 'Yes', color: 'green' }, { text: 'No', color: 'rose' },
    { text: 'Public', color: 'teal' }, { text: 'Yes', color: 'green' },
  ]},
];

const columns = ['Data', 'Borrower', 'Agent', 'Blockchain', 'Lender'];

/* ── floating particle ──────────────────────────────────────────── */
const Particle: React.FC<{ x: number; y: number; size: number; speed: number; color: string }> = ({
  x, y, size, speed, color,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin((frame + x * 100) * speed * 0.01) * 12;
  const floatY = Math.cos((frame + y * 80) * speed * 0.008) * 8;
  const pulse = interpolate(frame % 90, [0, 45, 90], [0.3, 0.7, 0.3]);

  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      width: size, height: size, borderRadius: '50%',
      background: color, opacity: pulse,
      transform: `translate(${drift}px, ${floatY}px)`,
      filter: 'blur(1px)',
    }} />
  );
};

export const PrivacyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* shield icon glow */
  const shieldGlow = interpolate(frame % 80, [0, 40, 80], [8, 20, 8]);

  /* header row entrance */
  const headerProg = spring({ frame: frame - 12, fps, config: { damping: 26, stiffness: 50, mass: 1.2 } });
  const headerOpacity = interpolate(headerProg, [0, 1], [0, 1]);
  const headerY = interpolate(headerProg, [0, 1], [16, 0]);

  /* particles */
  const particles = [
    { x: 5, y: 10, size: 4, speed: 1.2, color: C.indigo },
    { x: 92, y: 15, size: 3, speed: 0.8, color: C.teal },
    { x: 15, y: 80, size: 3, speed: 1.0, color: C.indigo2 },
    { x: 88, y: 75, size: 4, speed: 0.9, color: C.rose },
    { x: 50, y: 5, size: 3, speed: 1.1, color: C.teal },
    { x: 30, y: 90, size: 3, speed: 0.7, color: C.indigo },
    { x: 70, y: 88, size: 4, speed: 1.0, color: C.green },
    { x: 8, y: 50, size: 3, speed: 0.9, color: C.indigo2 },
    { x: 95, y: 45, size: 3, speed: 1.1, color: C.amber },
    { x: 45, y: 92, size: 3, speed: 0.8, color: C.teal },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground variant="cool" />

      {/* floating particles */}
      {particles.map((p, i) => <Particle key={i} {...p} />)}

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: '50px 100px 140px',
      }}>
        {/* ── TITLE ────────────────────────────────────── */}
        <FadeSlide delay={4}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              style={{ filter: `drop-shadow(0 0 ${shieldGlow}px ${C.teal})` }}>
              <path d="M12 2l8 4v6c0 5.25-3.5 10-8 11-4.5-1-8-5.75-8-11V6l8-4z"
                fill="rgba(45,212,191,0.1)" stroke={C.teal} strokeWidth="1.5" />
              <path d="M9 12l2 2 4-4" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 style={{
              color: C.ink, fontSize: 44, fontFamily: 'system-ui', fontWeight: 800,
              margin: 0, letterSpacing: -1,
            }}>
              Privacy{' '}
              <span style={{
                background: `linear-gradient(135deg, ${C.teal}, ${C.indigo2})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Guarantees</span>
            </h1>
          </div>
        </FadeSlide>

        <FadeSlide delay={10}>
          <p style={{
            color: C.inkSoft, fontSize: 20, fontFamily: 'system-ui', fontWeight: 500,
            margin: 0, marginBottom: 36, textAlign: 'center' as const,
          }}>
            No single party sees the full picture
          </p>
        </FadeSlide>

        {/* ── TABLE ────────────────────────────────────── */}
        <div style={{
          width: '100%', maxWidth: 1200, borderRadius: 16, overflow: 'hidden',
          border: `1px solid rgba(99,102,241,0.14)`,
          background: 'rgba(7,7,26,0.8)', backdropFilter: 'blur(12px)',
          boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(99,102,241,0.06)`,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', background: C.card,
            borderBottom: `1px solid rgba(99,102,241,0.12)`,
            opacity: headerOpacity, transform: `translateY(${headerY}px)`,
          }}>
            {columns.map((col) => (
              <div key={col} style={{
                flex: col === 'Data' ? 1.4 : 1, padding: '18px 28px',
                textAlign: col === 'Data' ? ('left' as const) : ('center' as const),
              }}>
                <span style={{
                  color: C.inkMuted, fontSize: 12, fontFamily: 'system-ui', fontWeight: 700,
                  textTransform: 'uppercase' as const, letterSpacing: 1.5,
                }}>{col}</span>
              </div>
            ))}
          </div>

          {/* Data rows — animate in one by one from left */}
          {rows.map((row, ri) => {
            const rowDelay = 22 + ri * 12;
            const rowProg = spring({
              frame: frame - rowDelay, fps,
              config: { damping: 24, stiffness: 50, mass: 1.1 },
            });
            const rowOpacity = interpolate(rowProg, [0, 1], [0, 1]);
            const rowX = interpolate(rowProg, [0, 1], [60, 0]);

            return (
              <div key={row.data} style={{
                display: 'flex',
                borderBottom: ri < rows.length - 1 ? `1px solid rgba(99,102,241,0.06)` : 'none',
                opacity: rowOpacity, transform: `translateX(${rowX}px)`,
                background: ri % 2 === 0 ? 'transparent' : 'rgba(99,102,241,0.015)',
              }}>
                {/* Data label */}
                <div style={{ flex: 1.4, padding: '20px 28px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: C.ink, fontSize: 16, fontFamily: 'system-ui', fontWeight: 600 }}>
                    {row.data}
                  </span>
                </div>

                {/* Value cells — stagger within each row */}
                {row.cells.map((cell, ci) => {
                  const cellDelay = rowDelay + 4 + ci * 3;
                  const cellProg = spring({
                    frame: frame - cellDelay, fps,
                    config: { damping: 22, stiffness: 60, mass: 1 },
                  });
                  const cellOpacity = interpolate(cellProg, [0, 1], [0, 1]);
                  const cellScale = interpolate(cellProg, [0, 1], [0.7, 1]);
                  const cm = colorMap[cell.color];

                  return (
                    <div key={ci} style={{
                      flex: 1, padding: '20px 28px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        color: cm.text, fontSize: 14, fontFamily: 'system-ui', fontWeight: 700,
                        opacity: cellOpacity, transform: `scale(${cellScale})`,
                        display: 'inline-block', padding: '5px 16px', borderRadius: 8,
                        background: cm.bg,
                      }}>{cell.text}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

    </AbsoluteFill>
  );
};
