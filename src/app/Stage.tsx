import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { BouquetV1, FlowerV1, Vec2 } from '../data/schema';
import { buildBouquetScene, makeBloomShapingShapes, makeBlossomConstructionShapes, makeConstructionShapes } from '../geometry/scene';
import { blossomRadius } from '../geometry/species';
import type { Scene, SceneShape } from '../geometry/types';
import { activeRegionSourceRect, clientToStage } from '../input/coordinates';
import type { GrowthState, SceneController } from '../interaction/controller';
import { buildHandShapes, type GeometryView, type LivingHand } from '../render/livingGeometry';
import { renderScene } from '../render/svg';

export interface StageHandle {
  updateHands(hands: LivingHand[]): void;
  updatePreview(preview: FlowerV1 | null): void;
  updateMovedFlower(flower: FlowerV1 | null): void;
  captureCameraFrame(): void;
  clearCameraFrame(): void;
  getVideo(): HTMLVideoElement | null;
  focus(): void;
}

interface StageProps {
  recipe: BouquetV1;
  preview: FlowerV1 | null;
  selected: FlowerV1 | null;
  geometryView: GeometryView;
  showSeed: boolean;
  cameraUnderlay: boolean;
  controller: SceneController;
  growthState: GrowthState;
  inputLabel: 'Pointer' | 'Keyboard' | 'Estimated hand';
  onSelect(point: Vec2): void;
  moveSelected?: boolean;
  onMoveCommit?(flower: FlowerV1): void;
  pointerEnabled?: boolean;
}

export const Stage = forwardRef<StageHandle, StageProps>(function Stage(props, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const underlayRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<LivingHand[]>([]);
  const transientPreviewRef = useRef<FlowerV1 | null>(props.preview);
  const pointerDownRef = useRef(false);
  const movedRef = useRef(false);
  const movePreviewRef = useRef<FlowerV1 | null>(null);
  const moveStartRef = useRef<Vec2 | null>(null);
  const baseScene = useMemo(() => buildBouquetScene(props.recipe), [props.recipe]);

  const render = () => {
    const movedFlower = movePreviewRef.current;
    const displayRecipe = movedFlower ? { ...props.recipe, flowers: props.recipe.flowers.map((flower) => flower.id === movedFlower.id ? movedFlower : flower) } : props.recipe;
    const displayScene = movedFlower ? buildBouquetScene(displayRecipe) : baseScene;
    const shapes: SceneShape[] = [...displayScene.shapes];
    const constructionShapes: SceneShape[] = [];
    if (props.showSeed) {
      shapes.push(
        { kind: 'ellipse', center: [512, 626], rx: 24, ry: 7, fill: '#322824', opacity: 0.07, role: 'seed' },
        { kind: 'path', commands: [{ op: 'M', point: [512, 631] }, { op: 'C', c1: [493, 626], c2: [495, 603], point: [512, 609] }, { op: 'C', c1: [529, 603], c2: [531, 626], point: [512, 631] }, { op: 'Z' }], fill: '#bb8b42', stroke: '#7b293e', strokeWidth: 1.3, role: 'seed' },
      );
    }
    const effectivePreview = transientPreviewRef.current ?? props.preview;
    const constructionFlower = effectivePreview ?? movedFlower ?? props.selected;
    if (props.geometryView !== 'clean' && constructionFlower) {
      constructionShapes.push(...makeConstructionShapes(constructionFlower.stem, blossomRadius(constructionFlower), Boolean(props.selected && !props.preview)));
      if (!effectivePreview || props.growthState !== 'growing') constructionShapes.push(...makeBlossomConstructionShapes(constructionFlower));
    }
    if (effectivePreview) {
      const previewRecipe = { ...props.recipe, flowers: [...props.recipe.flowers, { ...effectivePreview, id: `preview-${effectivePreview.id}` }] };
      const previewScene = buildBouquetScene(previewRecipe);
      const previewPrefix = `flower:preview-${effectivePreview.id}:`;
      const visibleShapes = props.growthState === 'growing' ? previewScene.shapes.filter((shape) => {
        if (!shape.role?.startsWith(previewPrefix)) return true;
        return ![':petal:', ':petal-vein:', ':center', ':pollen:', ':stamen:'].some((part) => shape.role?.includes(part));
      }) : previewScene.shapes;
      shapes.splice(0, shapes.length, ...visibleShapes);
    }
    if (props.geometryView !== 'clean') shapes.unshift(...constructionShapes);
    if (props.geometryView !== 'clean') shapes.unshift(...buildHandShapes(handsRef.current, props.geometryView === 'expanded'));
    if (effectivePreview && props.growthState === 'shaping') shapes.push(...makeBloomShapingShapes(effectivePreview));
    shapes.push({ kind: 'text', point: [36, 48], text: props.inputLabel, fontSize: 12, fontFamily: 'mono', fill: '#6d6258', opacity: 0.78, role: 'input-label' });
    const scene: Scene = { ...displayScene, shapes };
    if (svgRef.current) renderScene(svgRef.current, scene);
  };

  useEffect(() => { transientPreviewRef.current = props.preview; render(); }, [baseScene, props.preview, props.selected, props.geometryView, props.showSeed, props.inputLabel, props.growthState]);
  useImperativeHandle(ref, () => ({
    updateHands(hands) { handsRef.current = hands; render(); },
    updatePreview(preview) { transientPreviewRef.current = preview; render(); },
    updateMovedFlower(flower) { movePreviewRef.current = flower; render(); },
    captureCameraFrame() {
      const video = videoRef.current; const canvas = underlayRef.current;
      if (!props.cameraUnderlay || !video || !canvas || !video.videoWidth || !video.videoHeight) return;
      const context = canvas.getContext('2d'); if (!context) return;
      const source = activeRegionSourceRect(video.videoWidth, video.videoHeight);
      context.save(); context.clearRect(0, 0, canvas.width, canvas.height); context.translate(canvas.width, 0); context.scale(-1, 1);
      context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
      context.restore();
    },
    clearCameraFrame() {
      const canvas = underlayRef.current; const context = canvas?.getContext('2d');
      if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    },
    getVideo() { return videoRef.current; },
    focus() { svgRef.current?.focus(); },
  }));

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): Vec2 => clientToStage(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());

  return (
    <div className="stage-frame" data-view={props.geometryView}>
      <div className="camera-crop" aria-hidden={!props.cameraUnderlay} data-visible={props.cameraUnderlay}>
        <canvas ref={underlayRef} width="1024" height="768" />
      </div>
      <video ref={videoRef} className="stage-source-video" muted playsInline aria-hidden="true" />
      <svg
        ref={svgRef}
        className="bouquet-stage"
        role="img"
        aria-label={`Bouquet with ${props.recipe.flowers.length} ${props.recipe.flowers.length === 1 ? 'flower' : 'flowers'}`}
        aria-describedby="stage-guidance"
        data-growth-state={props.growthState}
        tabIndex={0}
        onPointerMove={(event) => {
          if (props.pointerEnabled === false) return;
          const point = pointFromEvent(event);
          if (moveStartRef.current && props.selected) {
            movedRef.current = true;
            const delta: Vec2 = [point[0] - moveStartRef.current[0], point[1] - moveStartRef.current[1]];
            const original = props.selected;
            const targetX = Math.min(854, Math.max(170, original.stem[3][0] + delta[0]));
            const targetY = Math.min(510, Math.max(130, original.stem[3][1] + delta[1]));
            const actualDelta: Vec2 = [targetX - original.stem[3][0], targetY - original.stem[3][1]];
            const p2: Vec2 = [original.stem[2][0] + actualDelta[0], Math.min(original.stem[1][1] - 0.0001, Math.max(targetY + 0.0001, original.stem[2][1] + actualDelta[1]))];
            movePreviewRef.current = { ...original, stem: [original.stem[0], original.stem[1], p2, [targetX, targetY]] };
            render();
          }
          else if (pointerDownRef.current) { movedRef.current = true; props.controller.handle({ type: 'move', ownerId: 'pointer', point, timeMs: performance.now() }); }
          else props.controller.handle({ type: 'hover', ownerId: 'pointer', point, timeMs: performance.now() });
        }}
        onPointerDown={(event) => {
          if (props.pointerEnabled === false) return;
          if (event.button !== 0) return;
          pointerDownRef.current = true; movedRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointFromEvent(event);
          if (props.growthState === 'ready' && props.moveSelected && props.selected && Math.hypot(point[0] - props.selected.stem[3][0], point[1] - props.selected.stem[3][1]) <= blossomRadius(props.selected) + 24) moveStartRef.current = point;
          else props.controller.handle({ type: 'press', ownerId: 'pointer', point, timeMs: performance.now() });
        }}
        onPointerUp={(event) => {
          if (props.pointerEnabled === false) return;
          const point = pointFromEvent(event);
          if (moveStartRef.current) {
            if (movePreviewRef.current) props.onMoveCommit?.(movePreviewRef.current);
            moveStartRef.current = null; movePreviewRef.current = null; render();
          } else {
            props.controller.handle({ type: 'release', ownerId: 'pointer', point, timeMs: performance.now() });
            if (!movedRef.current && props.growthState === 'ready') props.onSelect(point);
          }
          pointerDownRef.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => { if (props.pointerEnabled === false) return; pointerDownRef.current = false; moveStartRef.current = null; movePreviewRef.current = null; render(); props.controller.handle({ type: 'cancel', ownerId: 'pointer', reason: 'Pointer movement was cancelled.', timeMs: performance.now() }); }}
        onLostPointerCapture={() => { if (pointerDownRef.current) props.controller.cancelActive('Pointer capture was lost.'); pointerDownRef.current = false; }}
      />
    </div>
  );
});
