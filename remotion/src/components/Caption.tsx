import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { C } from '../constants';

type Props = {
  text: string;
  delay?: number;
};

/**
 * Sentence-by-sentence subtitle synced to voiceover.
 * Splits on sentence boundaries, times proportionally by word count.
 * Sentences appear slightly ahead of speech so viewers read along.
 */
export const Caption: React.FC<Props> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Split into sentences (keep the period with each sentence)
  const sentences = text
    .split(/(?<=\.)\s+/)
    .filter((s) => s.trim().length > 0);

  // Compute word counts to distribute time proportionally
  const wordCounts = sentences.map((s) => s.split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);

  // Audio starts almost immediately — match that
  const startFrame = delay;
  const endFrame = durationInFrames - 5;
  const usableFrames = endFrame - startFrame;

  // Build timing: each sentence gets frames proportional to its word count
  const timings: { start: number; end: number }[] = [];
  let cursor = startFrame;
  for (let i = 0; i < sentences.length; i++) {
    const share = (wordCounts[i] / totalWords) * usableFrames;
    timings.push({ start: Math.round(cursor), end: Math.round(cursor + share) });
    cursor += share;
  }

  // Find current sentence
  let activeIndex = 0;
  for (let i = 0; i < timings.length; i++) {
    if (frame >= timings[i].start) activeIndex = i;
  }

  const currentSentence = sentences[activeIndex] || '';
  const t = timings[activeIndex];

  // Quick fade in per sentence
  const sentenceAge = frame - t.start;
  const fadeIn = spring({
    frame: sentenceAge,
    fps,
    config: { damping: 30, stiffness: 120, mass: 0.6 },
  });

  // Global fade out at scene end
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: '50%',
        transform: `translateX(-50%) translateY(${interpolate(fadeIn, [0, 1], [6, 0])}px)`,
        opacity: fadeIn * fadeOut,
        maxWidth: 1000,
        minWidth: 300,
        padding: '14px 36px',
        background: 'rgba(7, 7, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: '1px solid rgba(99,102,241,0.12)',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          color: C.ink,
          fontSize: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 500,
          lineHeight: 1.5,
          letterSpacing: -0.2,
        }}
      >
        {currentSentence}
      </span>
    </div>
  );
};
