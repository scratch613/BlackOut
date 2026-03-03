import type {
  AppGameState,
  City,
  GlobalParams,
  InfrastructureObject,
  OblastFeature,
  RegionState,
} from '@/types';

const SAVE_KEY = 'rl_save';

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
// Build initial state
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
        isOccupied: OCCUPIED_REGIONS.has(region.id),
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
