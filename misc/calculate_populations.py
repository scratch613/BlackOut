#!/usr/bin/env python3
"""
Calculate regional populations based on cities data.
For each region (oblast), sum all city populations within it and multiply by 1.6
"""

import json
from shapely.geometry import shape, Point


def main():
    # Load cities
    with open('../public/assets/cities.json', 'r', encoding='utf-8') as f:
        cities = json.load(f)
    
    # Load oblasts
    with open('../public/assets/ukraine_oblasts.geojson', 'r', encoding='utf-8') as f:
        oblasts_geojson = json.load(f)
    
    # Create oblast geometries
    oblast_data = {}
    for feature in oblasts_geojson['features']:
        oblast_id = feature['properties']['id']
        oblast_name = feature['properties']['name']
        oblast_geometry = shape(feature['geometry'])
        oblast_data[oblast_id] = {
            'name': oblast_name,
            'geometry': oblast_geometry,
            'city_population': 0,
            'cities': []
        }
    
    # Map cities to oblasts
    unmatched_cities = []
    for city in cities:
        point = Point(city['lon'], city['lat'])
        matched = False
        
        for oblast_id, oblast_info in oblast_data.items():
            if oblast_info['geometry'].contains(point):
                oblast_info['city_population'] += city['population']
                oblast_info['cities'].append(city['name'])
                matched = True
                break
        
        if not matched:
            unmatched_cities.append(city['name'])
    
    # Calculate final populations (city_population * 1.6)
    print("=== Regional Populations (City Population × 1.6) ===\n")
    print(f"{'Oblast ID':<20} {'Oblast Name':<25} {'Cities':<8} {'City Pop':>12} {'Final Pop':>12}")
    print("=" * 90)
    
    results = {}
    for oblast_id, oblast_info in sorted(oblast_data.items()):
        city_pop = oblast_info['city_population']
        final_pop = int(city_pop * 1.6)
        results[oblast_id] = {
            'name': oblast_info['name'],
            'city_population': city_pop,
            'final_population': final_pop,
            'num_cities': len(oblast_info['cities'])
        }
        
        print(f"{oblast_id:<20} {oblast_info['name']:<25} {len(oblast_info['cities']):>8} {city_pop:>12,} {final_pop:>12,}")
    
    print("\n" + "=" * 90)
    print(f"Total: {sum(r['final_population'] for r in results.values()):,}")
    
    if unmatched_cities:
        print(f"\nWarning: {len(unmatched_cities)} cities could not be matched to any oblast:")
        for city in unmatched_cities[:10]:
            print(f"  - {city}")
        if len(unmatched_cities) > 10:
            print(f"  ... and {len(unmatched_cities) - 10} more")
    
    # Save results to JSON
    output = {}
    for oblast_id, data in results.items():
        output[oblast_id] = data['final_population']
    
    with open('oblast_populations.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved to oblast_populations.json")
    
    # Generate TypeScript code
    print("\n=== TypeScript Code for GameState.ts ===\n")
    print("// Regional populations calculated from city data (2012)")
    print("// Each region's population = sum of cities × 1.6")
    print("const REGIONAL_POPULATIONS: Record<string, number> = {")
    for oblast_id, data in sorted(results.items()):
        print(f"  '{oblast_id}': {data['final_population']},  // {data['name']}: {data['num_cities']} cities")
    print("};")


if __name__ == '__main__':
    main()
