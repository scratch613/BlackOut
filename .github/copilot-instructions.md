# GitHub Copilot Instructions

## Project Overview

This is "Resilience Light" (Світло Стійкості) - a PixiJS-based WebGL economic strategy game about Ukrainian energy infrastructure resilience during crisis.

## Technology Stack

- **Engine:** PixiJS (latest) - WebGL rendering
- **Language:** TypeScript (Strict mode - no `any` types)
- **Build Tool:** Vite with ESM modules
- **Package Manager:** pnpm
- **State Management:** localStorage/IndexedDB persistence via GameState module
- **Graphics:** SVG and PNG assets with WebGL effects

## Architecture & Design Patterns

### Core Principles

1. **Strict Modularity:** Each game object is a separate class extending `PIXI.Container` or `PIXI.Sprite`
2. **Component-Based Design:** Use composition over inheritance for game logic
3. **Decoupled State:** Game state logic separate from PixiJS rendering tree
4. **Centralized Assets:** All assets loaded via `PIXI.Assets` with `AssetsManifest`
5. **Resource Cleanup:** Every module must implement `destroy()` to prevent memory leaks

### Project Structure

```
src/
├── game/               # Game engine, state management, loop
│   ├── GameEngine.ts   # Main orchestrator
│   ├── GameState.ts    # Save/load with transactional API
│   ├── GameLoop.ts     # Phase management (DAY/NIGHT)
│   └── BudgetManager.ts
├── map/                # Map rendering and interactions
│   ├── MapRenderer.ts  # Renders regions, cities, infrastructure
│   ├── PowerGridLayer.ts
│   ├── CityPowerConnector.ts
│   └── Projection.ts   # Mercator projection (lat/lon → x/y)
├── ui/                 # UI panels and HUD
│   ├── InfoPanel.ts
│   ├── BudgetPanel.ts
│   └── PhaseTimer.ts
├── types/              # TypeScript interfaces
│   └── index.ts        # Central type definitions
├── assets/             # Asset loading utilities
│   └── AssetsManifest.ts
└── main.ts             # Entry point

public/assets/          # Static game data (GeoJSON, JSON)
├── ukraine_oblasts.geojson
├── ukraine_border.geojson
├── cities.json
├── infrastructure.json
├── power_lines.json
└── rivers.json
```

### Current Code Organization Details

#### `src/game/` - Game Core Logic

- **GameEngine.ts** (210 lines)
  - Main orchestrator: initializes PixiJS, loads assets, wires up all systems
  - Manages game loop, phase transitions (DAY/NIGHT), timer
  - Handles crash recovery at startup via `checkCrashRecovery()`
  - Routes map/UI clicks to appropriate handlers (region, infrastructure, city)
  - Implements proper cleanup: `destroy()` removes resize listener, destroys all subsystems
- **GameState.ts** (331 lines)
  - Centralized state management with transactional save API
  - `saveCheckpoint(state)` - Creates timestamped checkpoint before NIGHT phase with QuotaExceededError fallback to IndexedDB
  - `saveGameState(state, checkpointId?)` - Atomic transactional save using TRANSACTION_KEY pattern
  - `checkCrashRecovery()` - Detects in-progress NIGHT by checking orphaned TRANSACTION_KEY
  - `restoreGameState(checkpointId)` - Recovers from checkpoint with validation
  - `_fallbackSaveToIndexedDB(state)` - Private helper for IndexedDB persistence on quota overflow
  - Built-in state migration/compatibility handling for older saves
- **GameLoop.ts** - Phase management
  - DAY/NIGHT cycle timing and event callbacks
  - Manages day counter and phase transitions
- **BudgetManager.ts** - Budget distribution logic
  - `processMonthlyBudgetDistribution()` calculates budget updates across regions

#### `src/map/` - Map Rendering & Geography

- **MapRenderer.ts** (416 lines)
  - Main map container with layer hierarchy: rivers → borders → regions → power grid → cities → infrastructure
  - `_drawOblasts()` - Renders 26 Ukrainian regions with hover highlighting
  - `_drawOccupiedZones()` - Renders occupation polygon overlays (GeoJSON-based)
  - `_drawCities()` - All cities now interactive (including partially occupied): click triggers `onCityClick()` callback
  - `_drawInfrastructure()` - Infrastructure dots with type-specific colors; occupation check prevents clicks
  - Region click detection via `pointInFeature()` - raycasting polygon containment
  - Callbacks: `onRegionClick()`, `onInfraClick()`, `onCityClick()` wired to GameEngine
- **PowerGridLayer.ts** (272 lines)
  - Animates electricity flow as moving dots along power lines
  - `update()` batches dots by composite key `color:radius` to ensure correct rendering radius per bucket
  - Supports voltage-based styling (750kV, 330kV, CHP)
  - Checks occupation status for both line endpoints to skip rendering if either is occupied
- **CityPowerConnector.ts** (131 lines)
  - `generateCityPowerLines()` - Creates synthetic power line connections from cities to nearest infrastructure
  - Determines voltage based on target type (substations use 330kV, generators use 750kV, CHP uses 'chp')
  - Endpoint IDs coerced to strings for consistency: `from: String(target.id)`, `to: String(city.id)`
- **Projection.ts** - Web Mercator projection
  - `project(lat, lon)` converts WGS84 coordinates to canvas pixel coordinates
  - `UKRAINE_BOUNDS` defines map boundaries for projection
  - Powers all geographic-to-visual positioning

#### `src/ui/` - User Interface Panels

- **InfoPanel.ts** (230 lines)
  - Displays information for clicked objects: regions, cities, infrastructure
  - `show()` dispatches to `_renderRegion()`, `_renderCity()`, or `_renderInfra()` based on content type
  - Styled as dark glassmorphic panel (top-right corner)
  - Close button hides panel without destroying
- **BudgetPanel.ts** - Budget overview & allocation
  - Shows country/regional budgets and economic status
  - Updates when phase changes or budgets shift
- **PhaseTimer.ts** - Game timer HUD
  - Displays current phase (DAY/NIGHT), day counter, phase timer
  - Updates every frame via `update()`

#### `src/types/index.ts` - Type Definitions (155 lines)

Central type definitions governing all game code:

- **Infrastructure types:** `InfrastructureType = 'nuclear' | 'hydro' | 'thermal' | 'substation' | 'chp'`
- **Infrastructure status:** `'active' | 'damaged' | 'destroyed' | 'occupied'`
- **Power line voltage:** `PowerLineVoltage = '750kV' | '330kV' | 'chp'`
- **Game phases:** `GamePhase = 'day' | 'night'`
- **Key Interfaces:**
  - `City` - id (number), name, lat/lon, population, tier (1-4)
  - `InfrastructureObject` - id (string), name, type, capacity (MW), status, voltage?, heat?
  - `PowerLine` - id, from (string), to (string), voltage, status
  - `RegionState` - id, name, population, budget, depression, hasPower, hasHeat, isOccupied?
  - `GlobalParams` - countryBudget, foreignBudget, internationalSupport, depression, day, phase, checkpointId?
  - `AppGameState` - regions[], globalParams, phase

#### `src/assets/AssetsManifest.ts` - Asset Loading

- Centralized asset loading via `PIXI.Assets`
- Manages GeoJSON, JSON, and texture assets
- TODO: Integrate validation schema checks per CONTEXT.md § 4.1

#### `src/main.ts` - Entry Point

- Initializes GameEngine and mounts to DOM element with id `app-container`

### Data Flow Lifecycle

1. **Startup:** `GameEngine.start()` → Load all assets → Build initial state → Initialize subsystems
2. **DAY Phase:** Player clicks regions/cities → InfoPanel shows details → Callbacks routed via GameEngine
3. **Phase Transition:** `GameLoop.onPhaseChange(phase='night')` → Create checkpoint via `saveCheckpoint()` → Transition to NIGHT
4. **NIGHT Phase:** Simulate attacks/blackouts → Apply state changes → `GameLoop.onDayReport()` → Transactional save via `saveGameState()`
5. **Crash Recovery:** Startup detects orphaned TRANSACTION_KEY → `checkCrashRecovery()` returns checkpoint metadata → Option to restore
6. **Shutdown:** `GameEngine.destroy()` → All subsystems cleaned up → Event listeners removed

## TypeScript Coding Standards

### Type Safety

- ✓ **Required:** Type all function parameters and return values
- ✓ **Required:** Use interfaces for configs, state, and component data
- ✗ **Forbidden:** Never use `any` type
- ✓ **Pattern:** Define types in `src/types/index.ts` as single source of truth

**Example:**

```typescript
// ✓ Correct
interface ComponentConfig {
  position: { x: number; y: number };
  scale: number;
}
function createComponent(config: ComponentConfig): PIXI.Container { ... }

// ✗ Wrong
function createComponent(config: any): any { ... }
```

### Module Imports

- Group imports in order: PixiJS → Internal components → Types
- Use ESM syntax (`import`/`export`)
- Use path aliases configured in tsconfig: `@/types`, `@/game`, `@/map`, `@/ui`

**Example:**

```typescript
import { Container, Graphics } from "pixi.js";

import { GameEngine } from "@/game/GameEngine";
import { MapRenderer } from "@/map/MapRenderer";

import type { AppGameState, City } from "@/types";
```

### Vite Integration

- Access environment variables: `import.meta.env.MODE`, `import.meta.env.PROD`
- Asset paths relative to `/public`: Use string literals like `'assets/cities.json'`

## PixiJS Best Practices

### Memory Management

- **REQUIRED:** Implement `destroy()` in every game class
- Remove event listeners: `element.off('event', handler)` or `element.removeAllListeners()`
- Clean up textures: `texture.destroy(true)`
- Clear containers: `container.removeAllChildren()`

**Pattern:**

```typescript
class MyGameObject extends PIXI.Container {
  private _onResize: (() => void) | null = null;

  constructor() {
    super();
  }

  destroy(): void {
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._onResize = null;
    }
    super.destroy({ children: true });
  }
}
```

### Graphics & Rendering

- Default anchor for game objects: `anchor.set(0.5)`
- High DPI support: Always set `resolution: window.devicePixelRatio || 1`
- Use `ParticleContainer` for 100+ similar objects
- WebGL effects: Implement as `PIXI.Filter` or `PIXI.Shader` classes
- No anonymous event handlers: Store bound handlers as class fields for cleanup

**Pattern:**

```typescript
class MapRenderer extends PIXI.Container {
  private _onResize: (() => void) | null = null;

  init() {
    this._onResize = () => {
      this.resize(this._w, this._h);
    };
    window.addEventListener("resize", this._onResize);
  }

  destroy(): void {
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._onResize = null;
    }
    super.destroy({ children: true });
  }
}
```

## Game-Specific Patterns

### State Management

- Game state defined in `AppGameState` interface in `src/types/index.ts`
- State persistence via `GameState` module:
  - `saveState(state)` - Simple save to localStorage
  - `saveCheckpoint(state)` - Timestamped backup before NIGHT phase
  - `restoreGameState(checkpointId)` - Restore from checkpoint
  - `saveGameState(state, checkpointId?)` - Transactional save with rollback
  - `checkCrashRecovery()` - Detect in-progress NIGHT at startup

**Pattern:**

```typescript
const state = loadState() ?? buildInitialState(...);
// During DAY actions
saveGameState(state);  // Incremental save
// Before NIGHT phase
const checkpointId = saveCheckpoint(state);
state.globalParams.checkpointId = checkpointId;
```

### Event Callbacks

- Map renderer emits: `onRegionClick(callback)`, `onInfraClick(callback)`, `onCityClick(callback)`
- GameEngine listens and routes to InfoPanel for display
- Always check for callback existence: `this._onXClick?.(data)`

**Pattern:**

```typescript
map.onRegionClick((id) => {
  const region = state.regions.find((r) => r.id === id);
  panel.show({ type: "region", state: region });
});
```

### Data Validation

- Static assets (GeoJSON, JSON) must be validated against TypeScript interfaces
- Validation happens in `src/assets/dataValidation.ts`
- Fail-fast for critical assets (regions, infrastructure)
- Graceful degradation for optional assets (rivers)

**Pattern:**

```typescript
const validation = validateAsset("cities.json", citiesData);
if (!validation.valid) {
  throw new Error(`Asset validation failed: ${validation.errors.join("; ")}`);
}
const cities: City[] = validation.data!;
```

## Game Mechanics Reference

### Depression Metric (0-100%)

**Daily Change Formula:**

```
Δdepression = base_per_day (0.5%)
            + (bombing_per_casualty: 2.0% × casualties)
            + (bombing_per_infra: 0.8% × infrastructure_hits)
            + (no_power_penalty: 3.0% × winter_multiplier)
            + (no_heat_penalty: 5.0% × winter_multiplier)
            - (social_project_bonus: 1.5% × active_projects)
            - (decay_rate: 0.1 × current_depression / 100)

Result: clamp(depression + Δdepression, 0, 100)
```

### Infrastructure Types & Statuses

- **Types:** nuclear, hydro, thermal, substation, chp
- **Status:** active, damaged, destroyed, occupied
- **Voltage (substations):** '750kV', '330kV', 'chp'
- **Heat (CHP only):** Prevents depression spike in winter when active

### Game Phases

- **DAY (paused time):** Player allocates budgets, configures power grid
- **NIGHT (simulation):** Automatic enemy attacks, AD interception, blackout simulation
- Transition: `checkCrashRecovery()` → `saveCheckpoint()` → simulate NIGHT → `saveGameState()` → report → new DAY

## Code Examples

### Adding a New Interactive Element

```typescript
// In MapRenderer._drawSomething()
const wrapper = new Container();
wrapper.eventMode = "static"; // Must be 'static' or 'dynamic'
wrapper.cursor = "pointer";

wrapper.on("pointerdown", (e) => {
  e.stopPropagation();
  this._onElementClick?.(data);
});

wrapper.on("pointerover", () => {
  wrapper.scale.set(1.2);
});
wrapper.on("pointerout", () => {
  wrapper.scale.set(1);
});

this._layer.addChild(wrapper);
```

### Creating a Transactional Save

```typescript
try {
  const checkpointId = state.globalParams.checkpointId;
  const success = saveGameState(state, checkpointId);
  if (!success) console.error("Save failed");
} catch (error) {
  console.error("Error during save:", error);
  // Rollback to checkpoint
  if (state.globalParams.checkpointId) {
    const restored = restoreGameState(state.globalParams.checkpointId);
    if (restored) Object.assign(state, restored);
  }
}
```

## Testing & Debugging

### Debug Commands

- Console: `pnpm dev` logs game state to console on phase changes
- Browser DevTools → Application → localStorage to inspect saves
- Check `occupied_territories.geojson` for occupation zones
- Validate infrastructure via: `python3 -c "import json; data=json.load(open('public/assets/infrastructure.json')); print(f'{len(data)} objects')"`

### Common Pitfalls

1. ✗ Leaving event listeners unwired → Memory leaks → Frame rate drop
   - Solution: Always remove in `destroy()`
2. ✗ Using hardcoded absolute paths in code
   - Solution: Use relative paths or asset paths from `/public`
3. ✗ Missing type annotations
   - Solution: Define interface, use strict TypeScript
4. ✗ Modifying game state directly without save
   - Solution: Always call `saveGameState()` after state changes in DAY phase
5. ✗ Forgetting `e.stopPropagation()` in event handlers
   - Solution: Prevents unintended regional selection when clicking city/infra

## Quick Reference

| Task                | Location                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| Add new game metric | `src/types/index.ts` (interface) + `src/game/GameState.ts` (computation) |
| Add new UI panel    | `src/ui/` + register in `GameEngine.ts`                                  |
| Add new map layer   | `src/map/MapRenderer.ts` or extend `PowerGridLayer.ts`                   |
| Change game rules   | `src/game/GameLoop.ts` + `src/game/BudgetManager.ts`                     |
| Update map data     | `public/assets/*.json` + validation in `src/assets/`                     |
| Fix memory leak     | Check `destroy()` methods and event listener cleanup                     |

## Development Workflow

1. Make code changes in TypeScript
2. Vite hot-reload: Changes apply immediately in browser
3. Test in browser (F12 DevTools)
4. `pnpm typecheck` - Verify no TS errors
5. `pnpm build` - Production build
6. Commit changes with descriptive messages
