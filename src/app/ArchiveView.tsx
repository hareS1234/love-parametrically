import { useMemo } from 'react';
import type { LocalBouquetRecord } from '../data/archive';
import { serializeRecipe, downloadBlob, safeFilename } from '../data/files';
import { buildBouquetScene } from '../geometry/scene';
import { layoutPrint } from '../export/printLayout';
import { ScenePreview } from './ScenePreview';

export function ArchiveView({ records, onOpen, onDelete, onBack }: { records: LocalBouquetRecord[]; onOpen(record: LocalBouquetRecord): void; onDelete(record: LocalBouquetRecord): void; onBack(): void }) {
  return (
    <main className="archive-page">
      <div className="archive-heading"><div><h1>Your archive</h1><p>These are saved in this browser. Export a bouquet file if you want to keep one elsewhere.</p></div><button className="secondary-button" onClick={onBack}>Back to bouquet</button></div>
      {records.length === 0 ? <div className="archive-empty"><BotanicalOutline /><h2>No bouquets yet.</h2><p>Finish one and it will appear here.</p></div> : <div className="archive-grid">{records.map((record) => <ArchiveCard key={record.id} record={record} onOpen={() => onOpen(record)} onDelete={() => onDelete(record)} />)}</div>}
    </main>
  );
}

function ArchiveCard({ record, onOpen, onDelete }: { record: LocalBouquetRecord; onOpen(): void; onDelete(): void }) {
  const scene = useMemo(() => buildBouquetScene(record.recipe), [record.recipe]);
  const print = useMemo(() => layoutPrint(record.recipe, scene), [record.recipe, scene]);
  const date = record.recipe.dedication.displayDate ?? record.recipe.createdAt.slice(0, 10);
  return <article className="archive-card"><div className="archive-thumbnail"><ScenePreview scene={print} label={`Archived print with ${record.recipe.flowers.length} flowers`} /></div><div className="archive-card-copy"><h2>{record.recipe.dedication.to ? `For ${record.recipe.dedication.to}` : 'Untitled bouquet'}</h2><p>{record.recipe.dedication.note || `${record.recipe.flowers.length} flower arrangement`}</p><time dateTime={record.updatedAt}>{new Date(record.updatedAt).toLocaleDateString()}</time></div><div className="archive-card-actions"><button onClick={onOpen}>Open</button><button disabled={record.recipe.flowers.length === 0} title={record.recipe.flowers.length === 0 ? 'Add a flower before exporting a gift file.' : undefined} onClick={() => downloadBlob(new Blob([serializeRecipe(record.recipe)], { type: 'application/json' }), safeFilename(date, 'bouquet.json', record.recipe.dedication.to))}>Export recipe</button><button onClick={onDelete}>Delete</button></div></article>;
}

function BotanicalOutline() {
  return <svg viewBox="0 0 180 180" aria-hidden="true"><path d="M90 154 C80 118 104 89 91 42 M91 42 C60 30 50 60 91 64 C132 59 121 28 91 42 M88 108 C62 87 48 104 80 119 M96 87 C120 68 136 85 103 99" /></svg>;
}
