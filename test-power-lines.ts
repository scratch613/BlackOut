/**
 * Test script to verify city power line generation
 * Run with: ts-node test-power-lines.ts
 */

import { generateCityPowerLines } from './src/map/CityPowerConnector';

// Sample data (manually created for testing)
const sampleInfrastructure = [
    {
        id: "npp_rivne",
        name: "Рівненська АЕС",
        type: "nuclear" as const,
        lat: 51.3276,
        lon: 25.892,
        capacity: 2835,
        status: "active" as const,
    },
    {
        id: "sub750_kyivska",
        name: "Київська ПС",
        type: "substation" as const,
        lat: 50.3,
        lon: 30.2,
        capacity: 1000,
        status: "active" as const,
    },
];

const sampleCities = [
    {
        id: 26150422,
        name: "Київ",
        lat: 50.4500336,
        lon: 30.5241361,
        population: 2952301,
        tier: 1,
    },
    {
        id: 1685829423,
        name: "Харків",
        lat: 49.9923181,
        lon: 36.2310146,
        population: 1447652,
        tier: 1,
    },
];

const samplePowerLines: any[] = [];

// Test
console.log("Testing city power line generation...");
console.log(`Input: ${sampleCities.length} cities, ${sampleInfrastructure.length} infrastructure objects`);

const generatedLines = generateCityPowerLines(sampleCities, sampleInfrastructure, samplePowerLines);

console.log(`\nGenerated ${generatedLines.length} new power lines:`);
generatedLines.forEach((line) => {
    console.log(`  - ${line.id}: ${line.from} → ${line.to} (${line.voltage})`);
});

if (generatedLines.length === sampleCities.length) {
    console.log("\n✓ SUCCESS: All cities are connected to power sources!");
} else {
    console.log(`\n✗ WARNING: Only ${generatedLines.length} of ${sampleCities.length} cities connected`);
}
