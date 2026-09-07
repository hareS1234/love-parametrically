export function Header({ cameraRunning, saveLabel, onHome, onArchive, onHelp, onCameraOff }: { cameraRunning: boolean; saveLabel: string; onHome(): void; onArchive(): void; onHelp(): void; onCameraOff(): void }) {
  return (
    <header className="app-header">
      <button className="wordmark" onClick={onHome}>Love, Parametrically</button>
      <nav aria-label="Application">
        <span className="save-indicator" aria-live="polite">{saveLabel}</span>
        <button className="header-button" onClick={onArchive}>Archive</button>
        <button className="header-button" onClick={onHelp}>Help</button>
        {cameraRunning ? <button className="camera-off-button" onClick={onCameraOff}><span /> Camera off</button> : <span className="camera-status"><span /> Camera off</span>}
      </nav>
    </header>
  );
}
