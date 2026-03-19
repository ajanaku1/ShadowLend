import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig, OffthreadVideo, staticFile } from 'remotion';
import { GradientBackground } from '../components/GradientBackground';
import { C } from '../constants';

export const IntroScene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Landing page recording fades in
  const videoIn = spring({ frame: frame - 5, fps, config: { damping: 30, stiffness: 40, mass: 1.3 } });

  // Title overlay appears at frame 60 then fades
  const titleIn = spring({ frame: frame - 60, fps, config: { damping: 26, stiffness: 50 } });
  const titleOut = interpolate(frame, [durationInFrames - 60, durationInFrames - 30], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <GradientBackground />

      {/* Real landing page recording */}
      <AbsoluteFill style={{
        opacity: videoIn,
        transform: `scale(${interpolate(videoIn, [0, 1], [1.05, 1])})`,
      }}>
        <OffthreadVideo
          src={staticFile('clips/final/intro.mp4')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Subtle dark overlay so text is readable */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(1,1,4,0.3) 0%, rgba(1,1,4,0.1) 50%, rgba(1,1,4,0.5) 100%)',
        }} />
      </AbsoluteFill>

      {/* "Meet ShadowLend" overlay text */}
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: titleIn * titleOut,
        transform: `translateY(${interpolate(titleIn, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{
          padding: '24px 48px', borderRadius: 20,
          background: 'rgba(1,1,4,0.7)', backdropFilter: 'blur(16px)',
          border: `1px solid ${C.cardBorder2}`,
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <img src={staticFile('logo.png')} width={48} height={48} />
            <h1 style={{
              fontSize: 52, fontWeight: 800, margin: 0,
              fontFamily: 'system-ui', letterSpacing: -2,
              background: `linear-gradient(135deg, ${C.indigo2}, ${C.teal})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              ShadowLend
            </h1>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, margin: '8px 0 0',
          }}>
            <p style={{
              fontSize: 22, color: C.inkSoft, fontFamily: 'system-ui',
              fontWeight: 400, margin: 0, letterSpacing: -0.3,
            }}>
              Uncollateralized lending. Private credit scoring. Powered by
            </p>
            <img src={staticFile('zama-logo-white.svg')} width={74} height={30} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
