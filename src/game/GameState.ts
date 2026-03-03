import type {
  AppGameState,
  City,
  GlobalParams,
  InfrastructureObject,
  OblastFeature,
  PowerLine,
  RegionState,
} from '@/types';

const SAVE_KEY = 'rl_save';
const CHECKPOINT_KEY = 'rl_checkpoint';
const CHECKPOINT_TIMESTAMP_KEY = 'rl_checkpoint_timestamp';
const TRANSACTION_KEY = 'rl_transaction';

// ---------------------------------------------------------------------------
// Transactional Save API
// ---------------------------------------------------------------------------

/**
 * Create a checkpoint with a unique ID before entering NIGHT phase.
 * Saves current state to localStorage with timestamp for recovery.
 */
export function saveCheckpoint(state: AppGameState): string {
  try {
    const checkpointId = `checkpoint_${Date.now()}`;
    const checkpointData = {
      id: checkpointId,
      state: JSON.stringify(state),
      timestamp: Date.now(),
    };

    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpointData));
    localStorage.setItem(CHECKPOINT_TIMESTAMP_KEY, checkpointData.timestamp.toString());

    console.log(`[GameState] Checkpoint saved: ${checkpointId}`);
    return checkpointId;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('[GameState] QuotaExceededError: localStorage full. Attempting fallback to IndexedDB...');
      // Fallback: attempt IndexedDB or notify user
      _fallbackSaveToIndexedDB(state);
    }
    throw error;
  }
}

/**
 * Restore a checkpoint by checkpointId.
 * Used for recovery from crash or NIGHT simulation rollback.
 */
export function restoreGameState(checkpointId: string): AppGameState | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) {
      console.warn(`[GameState] Checkpoint ${checkpointId} not found`);
      return null;
    }

    const checkpointData = JSON.parse(raw) as { id: string; state: string; timestamp: number };
    if (checkpointData.id !== checkpointId) {
      console.warn(`[GameState] Checkpoint ID mismatch: expected ${checkpointId}, got ${checkpointData.id}`);
      return null;
    }

    const state = JSON.parse(checkpointData.state) as AppGameState;
    console.log(`[GameState] Restored from checkpoint: ${checkpointId}`);
    return state;
  } catch (error) {
    console.error('[GameState] Error restoring checkpoint:', error);
    return null;
  }
}

/**
 * Save game state to a transaction key during NIGHT simulation.
 * Only commits to main save if successful.
 */
export function saveGameState(state: AppGameState, checkpointId?: string): boolean {
  try {
    const transactionData = {
      state: JSON.stringify(state),
      checkpointId: checkpointId || null,
      timestamp: Date.now(),
    };

    // Write to transaction key first
    localStorage.setItem(TRANSACTION_KEY, JSON.stringify(transactionData));

    // Commit to main save
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));

    // Clear transaction key on success
    localStorage.removeItem(TRANSACTION_KEY);

    console.log(`[GameState] Game state saved successfully`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('[GameState] QuotaExceededError during save. Attempting IndexedDB fallback...');
      _fallbackSaveToIndexedDB(state);
      return false;
    }
    console.error('[GameState] Error saving game state:', error);
    return false;
  }
}

/**
 * Check if a NIGHT simulation was in progress at startup.
 * Returns the checkpoint timestamp if recovery needed, null otherwise.
 */
export function checkCrashRecovery(): { lastCheckpointTimestamp: number; checkpointId: string } | null {
  try {
    const transactionRaw = localStorage.getItem(TRANSACTION_KEY);
    const checkpointRaw = localStorage.getItem(CHECKPOINT_KEY);
    const timestampRaw = localStorage.getItem(CHECKPOINT_TIMESTAMP_KEY);

    if (transactionRaw && checkpointRaw && timestampRaw) {
      const checkpointData = JSON.parse(checkpointRaw) as { id: string; timestamp: number };
      console.warn('[GameState] Crash recovery detected. NIGHT was in progress.');
      return {
        lastCheckpointTimestamp: parseInt(timestampRaw),
        checkpointId: checkpointData.id,
      };
    }

    return null;
  } catch (error) {
    console.error('[GameState] Error checking crash recovery:', error);
    return null;
  }
}

/**
 * Fallback save to IndexedDB when localStorage quota is exceeded.
 */
function _fallbackSaveToIndexedDB(state: AppGameState): void {
  const dbRequest = indexedDB.open('VibeGameDB', 1);

  dbRequest.onerror = () => {
    console.error('[GameState] IndexedDB open failed. User notification needed.');
  };

  dbRequest.onupgradeneeded = (event: any) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('saves')) {
      db.createObjectStore('saves', { keyPath: 'id' });
    }
  };

  dbRequest.onsuccess = (event: any) => {
    const db = event.target.result;
    const transaction = db.transaction(['saves'], 'readwrite');
    const store = transaction.objectStore('saves');
    store.put({ id: 'fallback_save', state, timestamp: Date.now() });
    console.log('[GameState] Fallback save to IndexedDB successful');
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Haversine distance in km between two lat/lon points. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Return the centroid lat/lon of an oblast's first polygon ring. */
function oblastCentroid(feat: OblastFeature): { lat: number; lon: number } {
  const coords =
    feat.geometry.type === 'Polygon'
      ? feat.geometry.coordinates[0]
      : feat.geometry.coordinates[0][0];

  let sumLon = 0;
  let sumLat = 0;
  const n = coords.length;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  return { lat: sumLat / n, lon: sumLon / n };
}

// ---------------------------------------------------------------------------
// Occupied regions (temporarily controlled by Russian forces as of 2026)
// ---------------------------------------------------------------------------

const OCCUPIED_REGIONS = new Set<string>([
  'crimea',        // Full occupation since 2014
  'donetsk',       // Partially occupied (Donetsk People's Republic control)
  'luhansk',       // Partially occupied (Luhansk People's Republic control)
  'zaporizhzhia',  // Partially occupied (southern districts)
  'kherson',       // Contested/partially occupied
  'sevastopol',    // Occupied (part of Crimea)
]);

// ---------------------------------------------------------------------------
// Regional populations (2012, official Ukrainian State Statistics)
// Source: State Statistics Service of Ukraine
// ---------------------------------------------------------------------------

const REGIONAL_POPULATIONS: Record<string, number> = {
  'cherkasy': 1280,      // Черкаська (units: 1000 persons)
  'chernihiv': 1091,     // Чернігівська
  'chernivtsi': 908,     // Чернівецька
  'crimea': 1967,        // АРК Крим
  'dnipropetrovsk': 3344, // Дніпропетровська
  'donetsk': 4420,       // Донецька
  'ivano_frankivsk': 1380, // Івано-Франківська
  'kharkiv': 2755,       // Харківська
  'kherson': 1091,       // Херсонська
  'khmelnytskyi': 1326,  // Хмельницька
  'kirovohrad': 1019,    // Кіровоградська
  'kyiv_city': 4534,     // м. Київ (includes Kyiv city + surrounding oblast)
  'kyiv_oblast': 4534,   // Київська (same as kyiv_city - combined)
  'luhansk': 2280,       // Луганська
  'lviv': 2550,          // Львівська
  'mykolaiv': 1181,      // Миколаївська
  'odesa': 2388,         // Одеська
  'poltava': 1480,       // Полтавська
  'rivne': 1159,         // Рівненська
  'sevastopol': 384,     // м. Севастополь
  'sumy': 1160,          // Сумська
  'ternopil': 1077,      // Тернопільська
  'vinnytsia': 1639,     // Вінницька
  'volyn': 1042,         // Волинська (includes Lutsk, Kovel, etc.)
  'zakarpattia': 1258,   // Закарпатська
  'zaporizhzhia': 1805,  // Запорізька
  'zhytomyr': 1283,      // Житомирська (includes Korosten, Berdychiv, etc.)
};

// ---------------------------------------------------------------------------
// Calculate power connectivity
// ---------------------------------------------------------------------------

/**
 * Calculate which regions have power based on active infrastructure connectivity.
 * A region has power if it has:
 * 1. At least one active power source (nuclear, hydro, thermal, chp), OR
 * 2. At least one active substation with connection to a power source
 * Occupied infrastructure does not count toward power availability.
 */
export function calculatePowerConnectivity(
  regions: RegionState[],
  infrastructure: InfrastructureObject[],
  powerLines: PowerLine[],
  oblastFeatures: OblastFeature[],
): void {
  // Build adjacency map: which regions are directly connected to power sources
  const regionsToPowerSources = new Map<string, InfrastructureObject[]>();

  // Check each infrastructure object
  for (const infra of infrastructure) {
    // Skip occupied infrastructure
    if (infra.status === 'occupied') continue;

    // Skip damaged/destroyed
    if (infra.status === 'damaged' || infra.status === 'destroyed') continue;

    // Find which region this infrastructure is in
    const region = findClosestOblast(infra.lat, infra.lon, oblastFeatures);
    if (!region) continue;

    const regionId = region.properties.id;

    // Generation sources: nuclear, hydro, thermal, chp
    const isGenerationSource = ['nuclear', 'hydro', 'thermal', 'chp'].includes(infra.type);

    if (isGenerationSource) {
      if (!regionsToPowerSources.has(regionId)) {
        regionsToPowerSources.set(regionId, []);
      }
      regionsToPowerSources.get(regionId)!.push(infra);
    }
  }

  // A region has power if:
  // 1. It contains at least one active generation source, OR
  // 2. It contains a substation connected to a region with generation
  const regionsWithGeneration = new Set(regionsToPowerSources.keys());

  // Use BFS to find all regions reachable from generation regions through substations
  const regionsWithPower = new Set(regionsWithGeneration);
  const queue = Array.from(regionsWithGeneration);
  const visited = new Set(regionsWithGeneration);

  while (queue.length > 0) {
    const currentRegionId = queue.shift()!;

    // Find all power lines connected to this region
    for (const line of powerLines) {
      if (line.status === 'damaged' || line.status === 'inactive') continue;

      // Find infrastructure endpoints
      const fromInfra = infrastructure.find(i => i.id === line.from);
      const toInfra = infrastructure.find(i => i.id === line.to);

      if (!fromInfra || !toInfra) continue;
      if (fromInfra.status === 'occupied' || toInfra.status === 'occupied') continue;
      if (fromInfra.status === 'damaged' || fromInfra.status === 'destroyed') continue;
      if (toInfra.status === 'damaged' || toInfra.status === 'destroyed') continue;

      const fromRegion = findClosestOblast(fromInfra.lat, fromInfra.lon, oblastFeatures);
      const toRegion = findClosestOblast(toInfra.lat, toInfra.lon, oblastFeatures);

      if (!fromRegion || !toRegion) continue;

      const fromRegionId = fromRegion.properties.id;
      const toRegionId = toRegion.properties.id;

      // If power flows from the current powered region to an unvisited region
      if (fromRegionId === currentRegionId && !visited.has(toRegionId)) {
        regionsWithPower.add(toRegionId);
        visited.add(toRegionId);
        queue.push(toRegionId);
      }

      // If power flows to the current powered region from an unvisited region
      if (toRegionId === currentRegionId && !visited.has(fromRegionId)) {
        regionsWithPower.add(fromRegionId);
        visited.add(fromRegionId);
        queue.push(fromRegionId);
      }
    }
  }

  // Update hasPower for all regions
  for (const region of regions) {
    region.hasPower = regionsWithPower.has(region.id);
  }
}

// ---------------------------------------------------------------------------

export function buildInitialState(
  oblastFeatures: OblastFeature[],
  _cities: City[],
  _infrastructure: InfrastructureObject[],
): AppGameState {
  const regions: RegionState[] = oblastFeatures.map((feat) => {
    const oblastId = feat.properties.id;
    const population = REGIONAL_POPULATIONS[oblastId] || 500000; // Fallback for any missing oblasts
    const isOccupied = OCCUPIED_REGIONS.has(oblastId);

    return {
      id: oblastId,
      name: feat.properties.name,
      population,
      budget: 500_000,  // Regional budget
      depression: 20,
      hasPower: true,
      hasHeat: true,
      isOccupied,
    };
  });

  const globalParams: GlobalParams = {
    countryBudget: 10_000_000,    // National budget
    foreignBudget: 0,             // International support funds
    internationalSupport: 75,     // Support level (affects foreign budget generation)
    depression: 20,
    day: 1,
    phase: 'day',
  };

  return { regions, globalParams, phase: 'day' };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function saveState(state: AppGameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    console.warn('[GameState] Could not save to localStorage');
  }
}

export function loadState(): AppGameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppGameState;

    // Backward compatibility: older saves may not have `isOccupied` on regions.
    if (Array.isArray(parsed.regions)) {
      parsed.regions = parsed.regions.map((region) => ({
        ...region,
        isOccupied: region.isOccupied ?? OCCUPIED_REGIONS.has(region.id),
      }));
    }

    return parsed;
  } catch {
    console.warn('[GameState] Could not load from localStorage');
    return null;
  }
}

/** Closest-oblast assignment — exported for future use by other modules. */
export function findClosestOblast(
  lat: number,
  lon: number,
  oblastFeatures: OblastFeature[],
): OblastFeature | null {
  let best: OblastFeature | null = null;
  let bestDist = Infinity;
  for (const feat of oblastFeatures) {
    const c = oblastCentroid(feat);
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d < bestDist) {
      bestDist = d;
      best = feat;
    }
  }
  return best;
}
