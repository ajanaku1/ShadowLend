import { AbsoluteFill, Audio, Composition, OffthreadVideo, Sequence, staticFile } from 'remotion';
import { ProblemScene2 } from './scenes/ProblemScene2';
import { IntroScene2 } from './scenes/IntroScene2';
import { PrivacyScene } from './scenes/PrivacyScene';
import { ClosingScene } from './scenes/ClosingScene';
import { SceneTransition } from './components/SceneTransition';
import { Caption } from './components/Caption';
import { FPS, WIDTH, HEIGHT, SCENES, VOICEOVER } from './constants';

const OVERLAP = 15;

// Real screen recording scenes
const clipScenes = [
  { key: 'connect', clip: 'connect', audio: 'connect' },
  { key: 'scoring', clip: 'scoring', audio: 'scoring' },
  { key: 'encryption', clip: 'encryption', audio: 'encryption' },
  { key: 'loanRequest', clip: 'loanRequest', audio: 'loanRequest' },
  { key: 'repayment', clip: 'repayment', audio: 'repayment' },
  { key: 'supply', clip: 'supply', audio: 'supply' },
] as const;

/* ── Watermark overlay — appears on every frame ─────────────── */
const Watermark: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 9999 }}>
    <div style={{
      position: 'absolute', top: 24, right: 32,
      display: 'flex', alignItems: 'center', gap: 8,
      opacity: 0.45,
    }}>
      <img src={staticFile('logo.png')} width={28} height={28} />
      <span style={{
        color: '#f1eeff', fontSize: 15, fontFamily: 'system-ui',
        fontWeight: 700, letterSpacing: -0.3,
      }}>ShadowLend</span>
    </div>
  </AbsoluteFill>
);

const DemoVideo: React.FC = () => {
  return (
    <>
      {/* Watermark on every frame */}
      <Watermark />

      {/* Problem — animated, sets up the pain */}
      {(() => {
        const t = SCENES.problem;
        return (
          <Sequence from={t.start * FPS} durationInFrames={t.duration * FPS + OVERLAP} name="problem">
            <SceneTransition><ProblemScene2 /></SceneTransition>
            <Caption text={VOICEOVER.problem} delay={0} />
            <Audio src={staticFile('audio/problem.mp3')} />
          </Sequence>
        );
      })()}

      {/* Intro — real landing page recording with overlay */}
      {(() => {
        const t = SCENES.intro;
        return (
          <Sequence from={t.start * FPS} durationInFrames={t.duration * FPS + OVERLAP} name="intro">
            <SceneTransition><IntroScene2 /></SceneTransition>
            <Caption text={VOICEOVER.intro} delay={0} />
            <Audio src={staticFile('audio/intro.mp3')} />
          </Sequence>
        );
      })()}

      {/* Real screen recordings */}
      {clipScenes.map(({ key, clip, audio }) => {
        const t = SCENES[key as keyof typeof SCENES];
        return (
          <Sequence key={key} from={t.start * FPS} durationInFrames={t.duration * FPS + OVERLAP} name={key}>
            <SceneTransition>
              <AbsoluteFill style={{ background: '#010104' }}>
                <OffthreadVideo
                  src={staticFile(`clips/final/${clip}.mp4`)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </AbsoluteFill>
            </SceneTransition>
            <Caption text={VOICEOVER[key]} delay={0} />
            <Audio src={staticFile(`audio/${audio}.mp3`)} />
          </Sequence>
        );
      })}

      {/* Privacy — animated table */}
      {(() => {
        const t = SCENES.privacy;
        return (
          <Sequence from={t.start * FPS} durationInFrames={t.duration * FPS + OVERLAP} name="privacy">
            <SceneTransition><PrivacyScene /></SceneTransition>
            <Caption text={VOICEOVER.privacy} delay={0} />
            <Audio src={staticFile('audio/privacy.mp3')} />
          </Sequence>
        );
      })()}

      {/* Closing — animated */}
      {(() => {
        const t = SCENES.closing;
        return (
          <Sequence from={t.start * FPS} durationInFrames={t.duration * FPS + OVERLAP} name="closing">
            <SceneTransition><ClosingScene /></SceneTransition>
            <Caption text={VOICEOVER.closing} delay={0} />
            <Audio src={staticFile('audio/closing.mp3')} />
          </Sequence>
        );
      })()}
    </>
  );
};

const totalFrames =
  SCENES.closing.start * FPS + SCENES.closing.duration * FPS + OVERLAP;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ShadowLendDemo"
      component={DemoVideo}
      durationInFrames={totalFrames}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
