import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Ticker } from 'pixi.js';

import { project, UKRAINE_BOUNDS } from '@/map/Projection';
import { PowerGridLayer } from '@/map/PowerGridLayer';
import type {
  City,
  FeatureCollection,
  GeoMultiPolygon,
  GeoPolygon,
  InfrastructureObject,
  MapBounds,
  MapData,
  OblastFeature,
  OccupiedZoneFeature,
  River,
} from '@/types';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const COLOR = {
  OBLAST_FILL: 0x1a2035,
  OBLAST_BORDER: 0x2a3f6f,
  OBLAST_HOVER: 0x00d4ff,
  OCCUPIED_FILL: 0xcc3333,
  OCCUPIED_BORDER: 0x990000,
  RIVER: 0x1a3a5c,
  CITY_CORE: 0xffffff,
  CITY_GLOW: 0xffee88,
  INFRA: {
    nuclear: 0x00ff88,
    hydro: 0x00d4ff,
    thermal: 0xff8800,
    substation: 0xaaaaaa,
    chp: 0xff6644,
    damaged: 0xff2222,
  },
} as const;

// ---------------------------------------------------------------------------
// Helper: flatten polygon rings from a feature's geometry
// ---------------------------------------------------------------------------
type CoordRing = number[][];
function getRings(geometry: GeoPolygon | GeoMultiPolygon): CoordRing[] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ring);
  }
  const rings: CoordRing[] = [];
  for (const poly of geometry.coordinates) {
    for (const ring of poly) {
      rings.push(ring);
    }
  }
  return rings;
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

function pointInFeature(lon: number, lat: number, feat: OblastFeature): boolean {
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
// MapRenderer
// ---------------------------------------------------------------------------

export class MapRenderer extends Container {
  private _w = 0;
  private _h = 0;
  private _data: MapData | null = null;
  private _bounds: MapBounds = UKRAINE_BOUNDS;

  // Graphics layers (back-to-front)
  private readonly _riverLayer = new Graphics();
  private readonly _borderLayer = new Graphics();
  private readonly _oblastLayer = new Container();
  private readonly _powerGridLayer = new PowerGridLayer();
  private readonly _cityLayer = new Container();  // one child per city
  private readonly _infraLayer = new Container();  // one child per infra object

  // Per-oblast graphics for hover/selection
  private readonly _oblastGraphics = new Map<string, Graphics>();

  // Callbacks
  private _onRegionClick: ((id: string) => void) | null = null;
  private _onInfraClick: ((obj: InfrastructureObject) => void) | null = null;

  constructor() {
    super();
    this.addChild(this._riverLayer);
    this.addChild(this._borderLayer);
    this.addChild(this._oblastLayer);
    this.addChild(this._powerGridLayer); // grid lines above oblasts, below cities
    this.addChild(this._cityLayer);
    this.addChild(this._infraLayer);     // infra icons on top so they stay clickable
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  init(data: MapData, w: number, h: number): void {
    this._data = data;
    this._w = w;
    this._h = h;
    this._draw();
  }

  resize(w: number, h: number): void {
    this._w = w;
    this._h = h;
    if (this._data) this._draw();
  }

  onRegionClick(cb: (id: string) => void): void { this._onRegionClick = cb; }
  onInfraClick(cb: (obj: InfrastructureObject) => void): void { this._onInfraClick = cb; }

  /** Drive electricity dot animation — call from app.ticker each frame. */
  update(ticker: Ticker): void {
    this._powerGridLayer.update(ticker);
  }

  setRegionHighlight(oblastId: string, color: number): void {
    const g = this._oblastGraphics.get(oblastId);
    if (!g) return;
    g.stroke({ width: 2, color });
  }

  destroy(): void {
    super.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  private _draw(): void {
    if (!this._data) return;
    const { border, oblasts, infrastructure, cities, rivers, powerLines, regions, occupiedZones } = this._data;

    // Clear layers
    this._riverLayer.clear();
    this._borderLayer.clear();
    for (const g of this._oblastGraphics.values()) g.destroy();
    this._oblastGraphics.clear();
    this._oblastLayer.removeChildren().forEach((c) => c.destroy());
    this._infraLayer.removeChildren().forEach((c) => c.destroy());
    this._cityLayer.removeChildren().forEach((c) => c.destroy());

    this._drawRivers(rivers);
    this._drawBorder(border);
    this._drawOblasts(oblasts);
    if (occupiedZones) this._drawOccupiedZones(occupiedZones);
    this._powerGridLayer.init(powerLines, infrastructure, cities, this._w, this._h, oblasts, occupiedZones, regions);
    this._drawInfrastructure(infrastructure);
    this._drawCities(cities);
  }

  private _proj(lat: number, lon: number): { x: number; y: number } {
    return project(lat, lon, this._bounds, this._w, this._h);
  }

  private _projPair(pair: [number, number]): [number, number] {
    const { x, y } = this._proj(pair[0], pair[1]);
    return [x, y];
  }

  // ---------------------------------------------------------------------------
  // Rivers
  // ---------------------------------------------------------------------------
  private _drawRivers(rivers: River[]): void {
    const g = this._riverLayer;
    for (const river of rivers) {
      if (river.path.length < 2) continue;
      g.moveTo(...this._projPair(river.path[0]));
      for (let i = 1; i < river.path.length; i++) {
        g.lineTo(...this._projPair(river.path[i]));
      }
      g.stroke({ width: 1, color: COLOR.RIVER, alpha: 0.6 });
    }
  }

  // ---------------------------------------------------------------------------
  // Country border
  // ---------------------------------------------------------------------------
  private _drawBorder(border: FeatureCollection<OblastFeature>): void {
    const g = this._borderLayer;
    for (const feat of border.features) {
      this._drawGeometry(g, feat, 0x0d1120, 0x3a5080, 1.5);
    }
  }

  // ---------------------------------------------------------------------------
  // Oblast polygons
  // ---------------------------------------------------------------------------
  private _drawOblasts(oblasts: FeatureCollection<OblastFeature>): void {
    for (const feat of oblasts.features) {
      const id = feat.properties.id;

      const g = new Graphics();
      this._oblastLayer.addChild(g);
      this._oblastGraphics.set(id, g);

      this._drawGeometry(g, feat, COLOR.OBLAST_FILL, COLOR.OBLAST_BORDER, 1);

      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointerdown', () => {
        this._onRegionClick?.(id);
      });
      g.on('pointerover', () => {
        g.stroke({ width: 2, color: COLOR.OBLAST_HOVER });
      });
      g.on('pointerout', () => {
        g.stroke({ width: 1, color: COLOR.OBLAST_BORDER });
      });
    }
  }

  private _drawOccupiedZones(occupiedZones: FeatureCollection<OccupiedZoneFeature>): void {
    for (const feat of occupiedZones.features) {
      const overlay = new Graphics();
      this._oblastLayer.addChild(overlay);

      // Draw occupied zone polygon
      const rings = getRings(feat.geometry);
      for (const ring of rings) {
        if (ring.length < 3) continue;
        const first = this._proj(ring[0][1], ring[0][0]);
        overlay.moveTo(first.x, first.y);
        for (let i = 1; i < ring.length; i++) {
          const pt = this._proj(ring[i][1], ring[i][0]);
          overlay.lineTo(pt.x, pt.y);
        }
        overlay.closePath();
        overlay.fill({ color: COLOR.OCCUPIED_FILL, alpha: 0.75 });
        overlay.stroke({ width: 2, color: COLOR.OCCUPIED_BORDER, alpha: 1.0 });
      }

      // Block all clicks in occupied zone
      overlay.eventMode = 'static';
      overlay.cursor = 'not-allowed';
      overlay.on('pointerdown', (e) => e.stopPropagation());
      overlay.on('pointerup', (e) => e.stopPropagation());
      overlay.on('pointertap', (e) => e.stopPropagation());
      overlay.on('pointermove', (e) => e.stopPropagation());
      overlay.on('pointerover', (e) => e.stopPropagation());
    }
  }

  private _drawGeometry(
    g: Graphics,
    feat: OblastFeature,
    fillColor: number,
    strokeColor: number,
    strokeWidth: number,
  ): void {
    const rings = getRings(feat.geometry);
    for (const ring of rings) {
      if (ring.length < 3) continue;
      const first = this._proj(ring[0][1], ring[0][0]);
      g.moveTo(first.x, first.y);
      for (let i = 1; i < ring.length - 1; i++) {
        const pt = this._proj(ring[i][1], ring[i][0]);
        g.lineTo(pt.x, pt.y);
      }
      g.closePath();
      g.fill({ color: fillColor, alpha: 0.85 });
      g.stroke({ width: strokeWidth, color: strokeColor });
    }
  }

  // ---------------------------------------------------------------------------
  // Infrastructure — one interactive Container per object
  // ---------------------------------------------------------------------------
  private _drawInfrastructure(infra: InfrastructureObject[]): void {
    const data = this._data;
    const occupiedZones = data?.occupiedZones?.features ?? [];

    const isInOccupiedZone = (lat: number, lon: number): boolean => {
      for (const feat of occupiedZones) {
        if (pointInFeature(lon, lat, feat as any)) return true;
      }
      return false;
    };

    for (const obj of infra) {
      const { x, y } = this._proj(obj.lat, obj.lon);
      const isOccupiedArea = isInOccupiedZone(obj.lat, obj.lon);

      const isDamaged = obj.status === 'damaged' || obj.status === 'destroyed';
      const color = isDamaged
        ? COLOR.INFRA.damaged
        : (isOccupiedArea ? COLOR.OCCUPIED_BORDER : (COLOR.INFRA[obj.type] ?? COLOR.INFRA.thermal));

      // Container positioned at dot center; circles drawn at (0,0) so
      // scale pivots correctly around the dot, not the canvas origin.
      const wrapper = new Container();
      wrapper.x = x;
      wrapper.y = y;

      const g = new Graphics();
      g.circle(0, 0, 10);                              // invisible hit area
      g.fill({ color: 0xffffff, alpha: 0 });
      g.circle(0, 0, 4);                               // visual dot
      g.fill({ color, alpha: isOccupiedArea ? 0.7 : 0.9 });
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
      wrapper.addChild(g);

      wrapper.eventMode = isOccupiedArea ? 'none' : 'static';
      wrapper.cursor = isOccupiedArea ? 'not-allowed' : 'pointer';
      if (!isOccupiedArea) {
        wrapper.on('pointerdown', (e) => {
          e.stopPropagation();
          this._onInfraClick?.(obj);
        });
        wrapper.on('pointerover', () => { wrapper.scale.set(1.5); });
        wrapper.on('pointerout', () => { wrapper.scale.set(1); });
      }

      this._infraLayer.addChild(wrapper);
    }
  }

  // ---------------------------------------------------------------------------
  // Cities — one interactive Container per city
  // ---------------------------------------------------------------------------
  private _drawCities(cities: City[]): void {
    const MAX_POP = 3000; // units (thousands of persons)
    const data = this._data;
    const occupiedZones = data?.occupiedZones?.features ?? [];

    const isInOccupiedZone = (lat: number, lon: number): boolean => {
      for (const feat of occupiedZones) {
        if (pointInFeature(lon, lat, feat as any)) return true;
      }
      return false;
    };

    for (const city of cities) {
      const isOccupiedCity = isInOccupiedZone(city.lat, city.lon);
      const { x, y } = this._proj(city.lat, city.lon);
      const radius = isOccupiedCity ? 4 : 4 + (city.population / MAX_POP) * 16;

      const wrapper = new Container();

      const g = new Graphics();
      if (!isOccupiedCity) {
        // Outer glow for non-occupied cities only
        g.circle(0, 0, radius * 2.5);
        g.fill({ color: COLOR.CITY_GLOW, alpha: 0.08 });
      }
      // Inner dot
      g.circle(0, 0, radius);
      g.fill({ color: isOccupiedCity ? COLOR.OCCUPIED_BORDER : COLOR.CITY_CORE, alpha: 0.7 });

      wrapper.addChild(g);
      wrapper.x = x;
      wrapper.y = y;

      // Label for tier-1 cities outside occupied territories
      if (city.tier === 1 && !isOccupiedCity) {
        const label = new Text({
          text: city.name,
          style: new TextStyle({ fontSize: 10, fill: 0xccddff, fontFamily: 'monospace' }),
        });
        label.x = radius + 3;
        label.y = -5;
        wrapper.addChild(label);
      }

      // Cities are visual markers only (no interaction).
      wrapper.eventMode = 'none';
      wrapper.cursor = 'default';

      this._cityLayer.addChild(wrapper);
    }
  }
}
