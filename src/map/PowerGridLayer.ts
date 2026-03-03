import { Container, Graphics } from 'pixi.js';
import type { Ticker } from 'pixi.js';

import { project, UKRAINE_BOUNDS } from '@/map/Projection';
import type {
  City,
  FeatureCollection,
  InfrastructureObject,
  MapBounds,
  OblastFeature,
  OccupiedZoneFeature,
  PowerLine,
  PowerLineVoltage,
  RegionState,
} from '@/types';

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const VOLT: Record<PowerLineVoltage, {
  lineColor: number;
  lineColorOff: number;
  lineWidth: number;
  dotColor: number;
  dotRadius: number;
  speed: number;   // phase units per millisecond
  dotsPerLine: number;
}> = {
  '750kV': { lineColor: 0x1a4a8a, lineColorOff: 0x0d1a33, lineWidth: 2.0, dotColor: 0x00ccff, dotRadius: 2.5, speed: 0.00022, dotsPerLine: 3 },
  '330kV': { lineColor: 0x112255, lineColorOff: 0x09111f, lineWidth: 1.5, dotColor: 0x0088cc, dotRadius: 2.0, speed: 0.00015, dotsPerLine: 2 },
  'chp': { lineColor: 0x3a1a08, lineColorOff: 0x160a03, lineWidth: 1.0, dotColor: 0xff8844, dotRadius: 1.5, speed: 0.00010, dotsPerLine: 2 },
};

// ---------------------------------------------------------------------------
// Internal edge representation (screen-space, ready to render)
// ---------------------------------------------------------------------------

interface GridEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lineColor: number;
  lineWidth: number;
  lineAlpha: number;
  dotColor: number;
  dotRadius: number;
  dotsPerLine: number;
  speed: number;
  phase: number;   // [0, 1), advanced each frame
  active: boolean; // false → draw dim line, no dots
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(lon: number, lat: number, feat: OblastFeature | OccupiedZoneFeature): boolean {
  if (feat.geometry.type === 'Polygon') {
    const [outer, ...holes] = feat.geometry.coordinates;
    if (!pointInRing(lon, lat, outer)) return false;
    for (const hole of holes) {
      if (pointInRing(lon, lat, hole)) return false;
    }
    return true;
  }

  for (const poly of feat.geometry.coordinates) {
    const [outer, ...holes] = poly;
    if (!pointInRing(lon, lat, outer)) continue;
    let inHole = false;
    for (const hole of holes) {
      if (pointInRing(lon, lat, hole)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// PowerGridLayer
// ---------------------------------------------------------------------------

export class PowerGridLayer extends Container {
  private _edges: GridEdge[] = [];
  private _powerLines: PowerLine[] = [];
  private _infra: InfrastructureObject[] = [];
  private _cities: City[] = [];
  private _oblasts: FeatureCollection<OblastFeature> | null = null;
  private _occupiedZones: FeatureCollection<OccupiedZoneFeature> | null = null;
  private _regions: RegionState[] = [];
  private _bounds: MapBounds = UKRAINE_BOUNDS;

  private readonly _lineGfx = new Graphics();
  private readonly _dotGfx = new Graphics();

  constructor() {
    super();
    this.addChild(this._lineGfx);
    this.addChild(this._dotGfx);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  init(
    powerLines: PowerLine[],
    infra: InfrastructureObject[],
    cities: City[],
    w: number,
    h: number,
    oblasts?: FeatureCollection<OblastFeature>,
    occupiedZones?: FeatureCollection<OccupiedZoneFeature>,
    regions?: RegionState[],
    bounds: MapBounds = UKRAINE_BOUNDS,
  ): void {
    this._powerLines = powerLines;
    this._infra = infra;
    this._cities = cities;
    this._oblasts = oblasts ?? null;
    this._occupiedZones = occupiedZones ?? null;
    this._regions = regions ?? [];
    this._bounds = bounds;

    // Preserve animation phases across resize
    const savedPhases = new Map<string, number>();
    for (const e of this._edges) savedPhases.set(e.id, e.phase);

    const infraById = new Map<string, InfrastructureObject>();
    for (const obj of infra) infraById.set(obj.id, obj);

    const citiesById = new Map<string | number, City>();
    for (const city of cities) citiesById.set(city.id, city);

    const occupiedZoneFeatures = this._occupiedZones?.features ?? [];

    const isInOccupiedZone = (lat: number, lon: number): boolean => {
      for (const feat of occupiedZoneFeatures) {
        if (pointInFeature(lon, lat, feat as any)) return true;
      }
      return false;
    };

    this._edges = [];

    for (const line of powerLines) {
      // Try to resolve source (could be infrastructure or city)
      const srcInfra = infraById.get(line.from);
      const srcCity = citiesById.get(Number(line.from)) || citiesById.get(line.from);
      const src = srcInfra || srcCity;
      if (!src) continue;

      // Try to resolve destination (could be infrastructure or city)
      const dstInfra = infraById.get(line.to);
      const dstCity = citiesById.get(Number(line.to)) || citiesById.get(line.to);
      const dst = dstInfra || dstCity;
      if (!dst) continue;

      const p1 = project(src.lat, src.lon, bounds, w, h);
      const p2 = project(dst.lat, dst.lon, bounds, w, h);

      const style = VOLT[line.voltage];

      // Determine if line is active
      // For infrastructure: check status field
      // For cities: assume active (they don't have status field)
      const srcActive = 'status' in src ? src.status === 'active' : true;
      const dstActive = 'status' in dst ? dst.status === 'active' : true;
      const srcOccupied = isInOccupiedZone(src.lat, src.lon);
      const dstOccupied = isInOccupiedZone(dst.lat, dst.lon);
      const active =
        line.status === 'active' &&
        srcActive &&
        dstActive &&
        !srcOccupied &&
        !dstOccupied;

      this._edges.push({
        id: line.id,
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        lineColor: active ? style.lineColor : style.lineColorOff,
        lineWidth: style.lineWidth,
        lineAlpha: active ? 0.7 : 0.25,
        dotColor: style.dotColor,
        dotRadius: style.dotRadius,
        dotsPerLine: style.dotsPerLine,
        speed: style.speed,
        phase: savedPhases.get(line.id) ?? Math.random(),
        active,
      });
    }

    this._drawLines();
  }

  /** Called every frame from MapRenderer.update(). */
  update(ticker: Ticker): void {
    const dt = ticker.deltaMS;
    const g = this._dotGfx;
    g.clear();

    // Collect dot positions per colour AND radius for batched fills
    // Use composite key: "color:radius"
    const buckets = new Map<string, { color: number; r: number; pts: Array<[number, number]> }>();

    for (const edge of this._edges) {
      edge.phase = (edge.phase + edge.speed * dt) % 1;
      if (!edge.active) continue;

      const bucketKey = `${edge.dotColor}:${edge.dotRadius}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = { color: edge.dotColor, r: edge.dotRadius, pts: [] };
        buckets.set(bucketKey, bucket);
      }

      const spacing = 1 / edge.dotsPerLine;
      for (let i = 0; i < edge.dotsPerLine; i++) {
        const t = (edge.phase + i * spacing) % 1;
        bucket.pts.push([
          edge.x1 + (edge.x2 - edge.x1) * t,
          edge.y1 + (edge.y2 - edge.y1) * t,
        ]);
      }
    }

    for (const [, { color, r, pts }] of buckets) {
      for (const [x, y] of pts) {
        g.circle(x, y, r);
      }
      g.fill({ color, alpha: 0.9 });
    }
  }

  resize(w: number, h: number): void {
    this.init(this._powerLines, this._infra, this._cities, w, h, this._oblasts ?? undefined, this._occupiedZones ?? undefined, this._regions, this._bounds);
  }

  override destroy(): void {
    super.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _drawLines(): void {
    const g = this._lineGfx;
    g.clear();
    for (const e of this._edges) {
      g.moveTo(e.x1, e.y1);
      g.lineTo(e.x2, e.y2);
      g.stroke({ width: e.lineWidth, color: e.lineColor, alpha: e.lineAlpha });
    }
  }
}
