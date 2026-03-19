import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { C } from '../constants';

type Props = {
  children: React.ReactNode;
  enterDelay?: number;
  scale?: number;
  url?: string;
};

export const BrowserFrame: React.FC<Props> = ({ children, enterDelay = 0, scale = 1, url = 'shadowlend.xyz' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - enterDelay,
    fps,
    config: { damping: 26, stiffness: 50, mass: 1.3 },
  });
  const translateY = interpolate(entrance, [0, 1], [50, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const scaleIn = interpolate(entrance, [0, 1], [0.92, 1]);

  const w = 700 * scale;
  const h = 480 * scale;

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 12 * scale,
        border: '1px solid rgba(99,102,241,0.15)',
        background: C.surface,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.08)`,
        transform: `translateY(${translateY}px) scale(${scaleIn})`,
        opacity,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 36 * scale,
          background: C.card,
          borderBottom: '1px solid rgba(99,102,241,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${14 * scale}px`,
          gap: 8 * scale,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 6 * scale }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div key={c} style={{ width: 10 * scale, height: 10 * scale, borderRadius: '50%', background: c, opacity: 0.8 }} />
          ))}
        </div>
        {/* Address bar */}
        <div
          style={{
            flex: 1,
            height: 22 * scale,
            borderRadius: 6 * scale,
            background: 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8 * scale,
          }}
        >
          <span style={{ color: C.inkMuted, fontSize: 11 * scale, fontFamily: 'system-ui', fontWeight: 500 }}>
            {url}
          </span>
        </div>
      </div>
      {/* Content */}
      <div style={{ position: 'absolute', top: 36 * scale, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};
