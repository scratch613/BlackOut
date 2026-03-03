/**
 * Utility to connect cities to the closest power infrastructure.
 * Cities are connected to substations, power plants, and CHP plants.
 */

import type { City, InfrastructureObject, PowerLine } from '@/types';

const DISTANCE_TO_METERS = 111_000; // approximately 1 degree = 111 km

/**
 * Calculate the straight-line distance between two geographic points in meters.
 */
function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * DISTANCE_TO_METERS;
    const dLon = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2 * Math.PI / 180) * DISTANCE_TO_METERS;
    return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Filter infrastructure by type.
 */
function getInfraByType(infra: InfrastructureObject[], types: string[]): InfrastructureObject[] {
    return infra.filter(i => types.includes(i.type));
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
): PowerLine[] {
    // Create a set of city IDs that already have power connections
    const connectedCityIds = new Set<number | string>();

    for (const line of existingLines) {
        // Check if either endpoint is a city
        for (const city of cities) {
            if (line.from === String(city.id) || line.to === String(city.id)) {
                connectedCityIds.add(city.id);
            }
        }
    }

    const newLines: PowerLine[] = [];

    for (const city of cities) {
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
