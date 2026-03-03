/**
 * Utility to connect cities to the closest power infrastructure.
 * Cities are connected to substations, power plants, and CHP plants.
 */

import type {
    City,
    FeatureCollection,
    GeoMultiPolygon,
    GeoPolygon,
    InfrastructureObject,
    OccupiedZoneFeature,
    PowerLine,
} from '@/types';

const DISTANCE_TO_METERS = 111_000; // approximately 1 degree = 111 km

// Fallback list for occupied cities in case polygon data is coarse or incomplete.
const KNOWN_OCCUPIED_CITY_NAMES = new Set([
    'донецьк',
    'луганськ',
    'луганск',
    'маріуполь',
    'мариуполь',
]);

// Explicitly unoccupied cities even if polygon data overlaps.
const EXPLICIT_UNOCCUPIED_CITY_NAMES = new Set([
    'енергодар',
    'південноукраїнськ',
]);

const OCCUPIED_CITY_ENDPOINT_TOKENS = [
    'donetsk',
    'donetsk',
    'донец',
    'донець',
    'mariupol',
    'маріуп',
    'мариуп',
    'luhansk',
    'lugansk',
    'луган',
];

/**
 * Calculate the straight-line distance between two geographic points in meters.
 */
function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * DISTANCE_TO_METERS;
    const dLon = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2 * Math.PI / 180) * DISTANCE_TO_METERS;
    return Math.sqrt(dLat * dLat + dLon * dLon);
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

function pointInGeometry(lon: number, lat: number, geometry: GeoPolygon | GeoMultiPolygon): boolean {
    if (geometry.type === 'Polygon') {
        const [outer, ...holes] = geometry.coordinates;
        if (!pointInRing(lon, lat, outer)) return false;
        for (const hole of holes) {
            if (pointInRing(lon, lat, hole)) return false;
        }
        return true;
    }

    for (const polygon of geometry.coordinates) {
        const [outer, ...holes] = polygon;
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

function isCityInOccupiedZone(
    city: City,
    occupiedZones?: FeatureCollection<OccupiedZoneFeature>,
): boolean {
    const normalizedCityName = city.name.trim().toLowerCase();
    if (EXPLICIT_UNOCCUPIED_CITY_NAMES.has(normalizedCityName)) return false;
    if (KNOWN_OCCUPIED_CITY_NAMES.has(normalizedCityName)) return true;

    if (!occupiedZones) return false;
    return occupiedZones.features.some((zone) => pointInGeometry(city.lon, city.lat, zone.geometry));
}

export function getOccupiedCityIds(
    cities: City[],
    occupiedZones?: FeatureCollection<OccupiedZoneFeature>,
): Set<string> {
    return new Set(
        cities
            .filter((city) => isCityInOccupiedZone(city, occupiedZones))
            .map((city) => String(city.id)),
    );
}

function endpointMatchesOccupiedCityId(endpoint: string, cityId: string): boolean {
    return endpoint === cityId || endpoint === `city_${cityId}`;
}

export function isOccupiedCityEndpoint(
    endpoint: string,
    occupiedCityIds: Set<string>,
): boolean {
    const endpointNormalized = endpoint.trim().toLowerCase();

    for (const cityId of occupiedCityIds) {
        if (endpointMatchesOccupiedCityId(endpointNormalized, cityId)) {
            return true;
        }
    }

    // Defensive fallback for named city endpoints in source datasets.
    return OCCUPIED_CITY_ENDPOINT_TOKENS.some((token) => endpointNormalized.includes(token));
}

/**
 * Remove power lines connected to cities that are inside occupied zones.
 */
export function filterOutOccupiedCityConnections(
    lines: PowerLine[],
    cities: City[],
    occupiedZones?: FeatureCollection<OccupiedZoneFeature>,
): PowerLine[] {
    const occupiedCityIds = getOccupiedCityIds(cities, occupiedZones);

    if (occupiedCityIds.size === 0) return lines;

    return lines.filter(
        (line) => {
            const fromEndpoint = String(line.from);
            const toEndpoint = String(line.to);
            return !isOccupiedCityEndpoint(fromEndpoint, occupiedCityIds)
                && !isOccupiedCityEndpoint(toEndpoint, occupiedCityIds);
        },
    );
}

/**
 * Filter infrastructure by type.
 */
function getInfraByType(infra: InfrastructureObject[], types: string[]): InfrastructureObject[] {
    return infra.filter((i) => {
        const isAllowedType = types.includes(i.type);
        const isOperational = i.status === 'active';
        return isAllowedType && isOperational;
    });
}

/**
 * Find the closest infrastructure of a specific type to a city.
 */
function findClosestOfType(
    city: City,
    infrastructure: InfrastructureObject[],
    types: string[],
): InfrastructureObject | null {
    const candidates = getInfraByType(infrastructure, types);
    if (candidates.length === 0) return null;

    let closest: InfrastructureObject | null = null;
    let minDistance = Infinity;

    for (const source of candidates) {
        const dist = geoDistance(city.lat, city.lon, source.lat, source.lon);
        if (dist < minDistance) {
            minDistance = dist;
            closest = source;
        }
    }

    return closest;
}

/**
 * Find the closest power infrastructure to a city.
 * Prefers substations (distribution points), falls back to generation plants.
 */
function findClosestPowerTarget(
    city: City,
    infrastructure: InfrastructureObject[],
): InfrastructureObject | null {
    // First priority: substations (distribution points)
    let closest = findClosestOfType(city, infrastructure, ['substation']);
    if (closest) return closest;

    // Secondary priority: power plants and CHP
    closest = findClosestOfType(city, infrastructure, ['nuclear', 'hydro', 'thermal', 'chp']);
    return closest;
}

/**
 * Generate power lines connecting all cities to their closest power infrastructure.
 * Returns an array of new PowerLine objects for cities that don't already have connections.
 *
 * Power flow model:
 * - Power plants (nuclear, thermal, hydro) generate electricity
 * - Electricity flows to substations (distribution points) or directly to cities if no substation
 * - Cities consume electricity (connect to substations or power plants)
 */
export function generateCityPowerLines(
    cities: City[],
    infrastructure: InfrastructureObject[],
    existingLines: PowerLine[],
    occupiedZones?: FeatureCollection<OccupiedZoneFeature>,
): PowerLine[] {
    const occupiedCityIds = getOccupiedCityIds(cities, occupiedZones);

    // Create a set of city IDs that already have power connections
    const connectedCityIds = new Set<number | string>();

    for (const line of existingLines) {
        if (line.status !== 'active') continue;

        // Check if either endpoint is a city
        for (const city of cities) {
            if (line.from === String(city.id) || line.to === String(city.id)) {
                connectedCityIds.add(city.id);
            }
        }
    }

    const newLines: PowerLine[] = [];

    for (const city of cities) {
        // Do not connect cities located inside occupied zones
        if (occupiedCityIds.has(String(city.id))) continue;

        // Skip cities that already have power connections
        if (connectedCityIds.has(city.id)) continue;

        const target = findClosestPowerTarget(city, infrastructure);
        if (!target) continue;

        // Determine voltage based on target type
        // Substations inherit their connected voltage
        // Direct plant connections use high voltage
        let voltage: '750kV' | '330kV' | 'chp' = '330kV';
        if (target.type === 'substation') {
            // Substations typically handle 330kV or lower
            voltage = '330kV';
        } else if (target.type === 'nuclear' || target.type === 'thermal' || target.type === 'hydro') {
            // Major generation plants transmit at high voltage
            voltage = '750kV';
        } else if (target.type === 'chp') {
            // CHP uses their own voltage tier
            voltage = 'chp';
        }

        // Power flows FROM the power source TO the city
        const lineId = `${target.id}_to_city_${city.id}`;
        newLines.push({
            id: lineId,
            from: String(target.id),
            to: String(city.id),
            voltage,
            status: 'active',
        });
    }

    return newLines;
}
