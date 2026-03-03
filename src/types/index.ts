// ---------------------------------------------------------------------------
// Domain types for Resilience Light (Світло Стійкості)
// ---------------------------------------------------------------------------

export type GamePhase = 'day' | 'night';

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// ---------------------------------------------------------------------------
// GeoJSON
// ---------------------------------------------------------------------------

export interface OblastProperties {
  id: string;
  name: string;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export interface OblastFeature {
  type: 'Feature';
  properties: OblastProperties;
  geometry: GeoPolygon | GeoMultiPolygon;
}

export interface FeatureCollection<F> {
  type: 'FeatureCollection';
  features: F[];
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export type InfrastructureType = 'nuclear' | 'hydro' | 'thermal' | 'substation' | 'chp';
export type InfrastructureStatus = 'active' | 'damaged' | 'destroyed' | 'occupied';

export interface InfrastructureObject {
  id: string;
  name: string;
  type: InfrastructureType;
  lat: number;
  lon: number;
  capacity: number;
  status: InfrastructureStatus;
  heat?: boolean;
  voltage?: string;
}

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

export interface City {
  id: number;
  name: string;
  lat: number;
  lon: number;
  population: number;
  tier: number;
}

// ---------------------------------------------------------------------------
// Rivers
// ---------------------------------------------------------------------------

export interface River {
  name: string;
  /** Each point is [lat, lon] */
  path: [number, number][];
}

// ---------------------------------------------------------------------------
// Game State
// ---------------------------------------------------------------------------

export interface RegionState {
  id: string;
  name: string;
  population: number;
  budget: number;               // Region-specific budget (can be spent only in this region)
  depression: number;
  hasPower: boolean;
  hasHeat: boolean;
  isOccupied?: boolean;         // True if region is under occupation
}

export interface GlobalParams {
  countryBudget: number;        // National budget (can be spent anywhere in country)
  foreignBudget: number;        // International support (can only be fully spent on specific tasks)
  internationalSupport: number; // Support level (affects foreign budget generation)
  depression: number;
  day: number;
  phase: GamePhase;
  checkpointId?: string;        // ID of last checkpoint before entering NIGHT phase (for recovery)
}

export interface AppGameState {
  regions: RegionState[];
  globalParams: GlobalParams;
  phase: GamePhase;
}

// ---------------------------------------------------------------------------
// Power grid
// ---------------------------------------------------------------------------

export type PowerLineVoltage = '750kV' | '330kV' | 'chp';
export type PowerLineStatus = 'active' | 'damaged' | 'inactive';

export interface PowerLine {
  id: string;
  from: string;
  to: string;
  voltage: PowerLineVoltage;
  status: PowerLineStatus;
}

// ---------------------------------------------------------------------------
// Map data bundle passed to MapRenderer
// ---------------------------------------------------------------------------

export interface OccupiedZoneFeature {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
  };
  geometry: GeoPolygon;
}

export interface MapData {
  border: FeatureCollection<OblastFeature>;
  oblasts: FeatureCollection<OblastFeature>;
  infrastructure: InfrastructureObject[];
  cities: City[];
  rivers: River[];
  powerLines: PowerLine[];
  regions?: RegionState[]; // Region states including occupied status
  occupiedZones?: FeatureCollection<OccupiedZoneFeature>;
}
