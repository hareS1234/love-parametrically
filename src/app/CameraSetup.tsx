import type { RefObject } from 'react';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: string;
  ready: boolean;
  handVisible: boolean;
  practiceComplete: boolean;
  error: string | null;
  onContinue(): void;
  onMouse(): void;
  onRetry(): void;
  onStop(): void;
}

export function CameraSetup({ videoRef, status, ready, handVisible, practiceComplete, error, onContinue, onMouse, onRetry, onStop }: Props) {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <h1>{practiceComplete ? 'That’s it.' : handVisible ? 'Touch your thumb and index finger together.' : 'Bring one hand into view.'}</h1>
        <p>Camera video stays on this computer. Pinch once for the stem, then again for the flower.</p>
        <div className="setup-preview-wrap">
          <video ref={videoRef} className="setup-preview" muted playsInline />
          <div className="active-region-guide" />
          <span className={`practice-seed ${practiceComplete ? 'is-awake' : ''}`} aria-hidden="true" />
        </div>
        <p className={`setup-status ${error ? 'error-copy' : ''}`} role="status">{error ?? status}</p>
        <div className="setup-actions">
          {error ? <button className="primary-button" onClick={onRetry}>Retry hands</button> : <button className="primary-button" onClick={onContinue} disabled={!ready}>Continue</button>}
          <button className="secondary-button" onClick={onMouse}>Use my mouse</button>
          <button className="text-button" onClick={onStop}>Camera off</button>
        </div>
      </section>
    </main>
  );
}
