import type { MapBounds } from '@/types';

/** Geographic extent of Ukraine (with slight padding). */
export const UKRAINE_BOUNDS: MapBounds = {
  minLat: 44.0,
  maxLat: 52.6,
  minLon: 22.0,
  maxLon: 40.3,
};

export interface Point2D {
  x: number;
  y: number;
}

const PADDING = 24; // px — keeps the map from touching the canvas edge

/**
 * Equirectangular projection with cos(lat) correction.
 *
 * - Longitude is scaled by cos(centerLat) so east-west distances match
 *   real-world proportions (avoids horizontal stretching at Ukraine's latitude).
 * - The map is fit inside the canvas with uniform padding, letterboxed if
 *   the canvas aspect ratio differs from the map's natural ratio.
 */
export function project(
  lat: number,
  lon: number,
  bounds: MapBounds,
  canvasW: number,
  canvasH: number,
): Point2D {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);

  // Geographic extents in "equirectangular units"
  const geoW = (bounds.maxLon - bounds.minLon) * cosLat;
  const geoH =  bounds.maxLat - bounds.minLat;

  // Usable canvas area after padding
  const drawW = canvasW - PADDING * 2;
  const drawH = canvasH - PADDING * 2;

  // Uniform scale that fits the map inside the draw area (letterbox)
  const scale = Math.min(drawW / geoW, drawH / geoH);

  // Center the map in the draw area
  const mapPxW = geoW * scale;
  const mapPxH = geoH * scale;
  const offsetX = PADDING + (drawW - mapPxW) / 2;
  const offsetY = PADDING + (drawH - mapPxH) / 2;

  const x = (lon - bounds.minLon) * cosLat * scale + offsetX;
  const y = (bounds.maxLat - lat)            * scale + offsetY;

  return { x, y };
}
