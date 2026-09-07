import { useEffect, useRef } from 'react';
import type { Scene } from '../geometry/types';
import { renderScene } from '../render/svg';

export function ScenePreview({ scene, className = '', label }: { scene: Scene; className?: string; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { if (ref.current) renderScene(ref.current, scene); }, [scene]);
  return <svg ref={ref} className={className} role="img" aria-label={label} />;
}
