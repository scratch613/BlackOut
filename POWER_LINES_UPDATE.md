# Power Lines Logic Update - City Connections

## Problem
Cities were not connected to power infrastructure in the power grid visualization. Only explicit power lines from the data files were displayed, leaving many cities without visible power connections.

## Solution
Implemented automatic generation of power lines connecting all cities to their closest power infrastructure (substations, power plants, nuclear plants, hydro plants, CHP facilities).

## Changes Made

### 1. New File: `src/map/CityPowerConnector.ts`
A utility module that:
- Calculates geographic distances between cities and infrastructure
- Identifies power sources (substations, nuclear, hydro, thermal, CHP)
- Finds the closest power source for each city
- Generates synthetic PowerLine objects connecting cities to nearest sources
- Assigns appropriate voltage levels based on infrastructure type:
  - **750kV**: Nuclear, thermal, and hydro plants (major generation)
  - **330kV**: Substations (distribution)
  - **chp**: CHP facilities (district heating)

### 2. Updated: `src/game/GameEngine.ts`
- Added import for `generateCityPowerLines`
- After loading power lines from assets, generates additional lines for cities
- Merges generated city-to-infrastructure lines with existing power lines
- Passes the complete set to MapRenderer

### 3. Updated: `src/map/PowerGridLayer.ts`
- Added `City` to imports
- Modified `init()` signature to accept cities parameter
- Enhanced power line endpoint resolution to handle both:
  - Infrastructure objects (existing behavior)
  - City objects (new behavior)
- Cities are treated as always "active" since they don't have a status field
- Updated `resize()` method to pass cities when re-initializing

### 4. Updated: `src/map/MapRenderer.ts`
- Updated call to `_powerGridLayer.init()` to include cities parameter

## How It Works

1. When the game starts, it loads cities and infrastructure data
2. `generateCityPowerLines()` is called to create connections:
   - Iterates through all cities
   - For each city, finds the closest power source using Haversine-like distance
   - Creates a synthetic PowerLine with appropriate voltage
   - Skips cities that already have explicit connections
3. All power lines (original + generated) are passed to PowerGridLayer
4. PowerGridLayer renders connection lines with animated dots:
   - Cities are endpoints just like infrastructure objects
   - Voltage type determines visual styling (color, width, dot speed)
   - Status is determined by the destination infrastructure's status

## Result
✓ All cities now have visible power line connections
✓ Cities automatically connect to nearest power source
✓ Maintains consistent visualization with existing power grid
✓ Handles city and infrastructure endpoints uniformly
✓ No changes to game logic or state management

## Distance Calculation
Uses approximate geographic distance:
```
1 degree latitude ≈ 111 km
1 degree longitude ≈ 111 km × cos(latitude)
```
This provides accurate-enough distances for visual connection purposes without full Haversine precision overhead.
