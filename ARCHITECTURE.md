# Architecture

Love, Parametrically is a static React app with a small TypeScript core.

## Scene changes

Hand, pointer, and keyboard controls produce the same input events. `SceneController` owns the active gesture. Cancelling a gesture clears its preview and keeps every finished flower.

The first gesture draws the stem. The second changes petal width and bloom turn. The flower enters history only after that second release.

The camera sends one frame at a time to a classic worker. Session and frame IDs stop old results from changing the scene. The worker closes every bitmap after use.

## Recipes

`BouquetV1` is the portable recipe format. It stores a version, flower seeds, four stem points, petal width, bloom turn, size, colors, order, and dedication.

Zod checks every imported value. Invalid and oversized files stop before they reach the renderer.

## Drawing

`buildBouquetScene(recipe)` is a pure function. It uses FNV-1a and `mulberry32-v1` for repeatable variation. The geometry code has no DOM, camera, clock, or network access.

One ordered scene description feeds three renderers:

- The live SVG stage
- Standalone SVG export
- Canvas PNG export

## Local storage

IndexedDB holds drafts and recent bouquets. Saves carry a revision number and run in order. Exported files provide the durable copy.

The production build uses relative asset paths. The offline ZIP includes a small read-only Node server. It listens on `127.0.0.1` and uses Node standard modules only.
