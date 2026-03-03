import type { AssetsManifest } from 'pixi.js';

/**
 * Central manifest for image/audio assets loaded via PIXI.Assets.
 * Data files (GeoJSON, JSON) are fetched directly via fetch() in GameEngine.
 */
export const ASSETS_MANIFEST: AssetsManifest = {
  bundles: [
    {
      name: 'boot',
      assets: [
        // Future image assets go here, e.g.:
        // { alias: 'logo', src: 'assets/images/logo.png' },
      ],
    },
  ],
};
