import { project } from '@/map/Projection';
import type { City, InfrastructureObject, MapBounds } from '@/types';

const MAX_CITY_POP = 3000;
const CITY_BASE_RADIUS = 4;
const CITY_POP_SCALE = 16;
const CITY_GLOW_SCALE = 2.5;
const MIN_CLEARANCE = 8;
const DISPLACEMENT_SCALE = 0.2;
const NUCLEAR_PLANT_SHOWN_RADIUS = 16;
const OTHER_PLANT_SHOWN_RADIUS = 10;
const PLANT_STATION_EXTRA_GAP = 2;

function cityOuterActiveRadius(city: City): number {
    const coreRadius = CITY_BASE_RADIUS + (city.population / MAX_CITY_POP) * CITY_POP_SCALE;
    return coreRadius * CITY_GLOW_SCALE;
}

function hashAngle(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
    }
    return (Math.abs(hash) % 360) * (Math.PI / 180);
}

function isPowerPlant(obj: InfrastructureObject): boolean {
    return obj.type === 'nuclear' || obj.type === 'hydro' || obj.type === 'thermal' || obj.type === 'chp';
}

function plantShownRadius(obj: InfrastructureObject): number {
    return obj.type === 'nuclear' ? NUCLEAR_PLANT_SHOWN_RADIUS : OTHER_PLANT_SHOWN_RADIUS;
}

/**
 * Displace infrastructure screen positions away from city active-radius glow circles.
 * The push amount is proportional to city outer active radius.
 */
export function getSeparatedInfrastructurePositions(
    infra: InfrastructureObject[],
    cities: City[],
    bounds: MapBounds,
    width: number,
    height: number,
): Map<string, { x: number; y: number }> {
    const cityScreen = cities.map((city) => {
        const p = project(city.lat, city.lon, bounds, width, height);
        return {
            x: p.x,
            y: p.y,
            outerRadius: cityOuterActiveRadius(city),
        };
    });

    const result = new Map<string, { x: number; y: number }>();
    const basePositions = new Map<string, { x: number; y: number }>();

    for (const obj of infra) {
        const p = project(obj.lat, obj.lon, bounds, width, height);
        basePositions.set(obj.id, { x: p.x, y: p.y });
    }

    for (const obj of infra) {
        const base = basePositions.get(obj.id)!;
        let x = base.x;
        let y = base.y;

        // Two passes improve separation stability in dense areas.
        for (let pass = 0; pass < 2; pass++) {
            for (const city of cityScreen) {
                const dx = x - city.x;
                const dy = y - city.y;
                let dist = Math.hypot(dx, dy);

                const requiredDistance = city.outerRadius + MIN_CLEARANCE * DISPLACEMENT_SCALE;
                if (dist >= requiredDistance) continue;

                if (dist < 1e-6) {
                    const angle = hashAngle(obj.id);
                    const ux = Math.cos(angle);
                    const uy = Math.sin(angle);
                    const push = requiredDistance + city.outerRadius * 0.175;
                    x += ux * push;
                    y += uy * push;
                    continue;
                }

                const ux = dx / dist;
                const uy = dy / dist;
                const overlap = requiredDistance - dist;
                const proportionalPush = city.outerRadius * 0.175;
                const push = overlap + proportionalPush;
                x += ux * push;
                y += uy * push;

                dist = Math.hypot(x - city.x, y - city.y);
                if (dist < requiredDistance) {
                    const extra = requiredDistance - dist;
                    x += ux * extra;
                    y += uy * extra;
                }
            }
        }

        result.set(obj.id, { x, y });
    }

    // Additional pass: move transfer substations away from power plants
    // by the shown-area radius of each plant.
    const plants = infra.filter((obj) => isPowerPlant(obj));
    const substations = infra.filter((obj) => obj.type === 'substation');

    for (let pass = 0; pass < 2; pass++) {
        for (const substation of substations) {
            const current = result.get(substation.id);
            if (!current) continue;

            let x = current.x;
            let y = current.y;

            for (const plant of plants) {
                const plantPos = result.get(plant.id) ?? basePositions.get(plant.id);
                if (!plantPos) continue;

                const dx = x - plantPos.x;
                const dy = y - plantPos.y;
                const dist = Math.hypot(dx, dy);
                const requiredDistance = plantShownRadius(plant) + PLANT_STATION_EXTRA_GAP;

                if (dist >= requiredDistance) continue;

                if (dist < 1e-6) {
                    const angle = hashAngle(`${substation.id}:${plant.id}`);
                    x += Math.cos(angle) * requiredDistance;
                    y += Math.sin(angle) * requiredDistance;
                    continue;
                }

                const ux = dx / dist;
                const uy = dy / dist;
                const overlap = requiredDistance - dist;
                x += ux * overlap;
                y += uy * overlap;
            }

            result.set(substation.id, { x, y });
        }
    }

    return result;
}
