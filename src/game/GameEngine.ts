import { Application } from 'pixi.js';

import { processMonthlyBudgetDistribution } from '@/game/BudgetManager';
import { GameLoop } from '@/game/GameLoop';
import { buildInitialState, checkCrashRecovery, loadState, restoreGameState, saveCheckpoint, saveGameState, saveState } from '@/game/GameState';
import { generateCityPowerLines } from '@/map/CityPowerConnector';
import { MapRenderer } from '@/map/MapRenderer';
import { BudgetPanel } from '@/ui/BudgetPanel';
import { InfoPanel } from '@/ui/InfoPanel';
import { PhaseTimer } from '@/ui/PhaseTimer';
import type {
  AppGameState,
  City,
  FeatureCollection,
  InfrastructureObject,
  OblastFeature,
  PowerLine,
  River,
} from '@/types';

const ASSETS_BASE = 'assets/';

export class GameEngine {
  private _app: Application;
  private _map: MapRenderer | null = null;
  private _timer: PhaseTimer | null = null;
  private _panel: InfoPanel | null = null;
  private _budgetPanel: BudgetPanel | null = null;
  private _state: AppGameState | null = null;
  private _nightSecondsLeft = 0;
  private _onResize: (() => void) | null = null;

  constructor() {
    this._app = new Application();
  }

  async start(container: HTMLElement): Promise<void> {
    // 0. Check for crash recovery
    const recoveryInfo = checkCrashRecovery();
    if (recoveryInfo) {
      console.warn('[GameEngine] Crash recovery detected. Attempting to restore checkpoint...');
      const recovered = restoreGameState(recoveryInfo.checkpointId);
      if (recovered) {
        console.log('[GameEngine] Successfully recovered from checkpoint');
        // TODO: Show recovery UI to user and replay queued DAY actions if any
      }
    }

    // 1. Init PixiJS
    await this._app.init({
      backgroundColor: 0x0a0e1a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      resizeTo: container,
    });
    container.style.position = 'relative'; // needed for absolute panel positioning
    container.appendChild(this._app.canvas);

    // 2. Fetch all data files
    const [border, oblasts, infrastructure, cities, rivers, powerLines, occupiedZones] = await Promise.all([
      this._fetchJson<FeatureCollection<OblastFeature>>(`${ASSETS_BASE}ukraine_border.geojson`),
      this._fetchJson<FeatureCollection<OblastFeature>>(`${ASSETS_BASE}ukraine_oblasts.geojson`),
      this._fetchJson<InfrastructureObject[]>(`${ASSETS_BASE}infrastructure.json`),
      this._fetchJson<City[]>(`${ASSETS_BASE}cities.json`),
      this._fetchJson<River[]>(`${ASSETS_BASE}rivers.json`),
      this._fetchJson<PowerLine[]>(`${ASSETS_BASE}power_lines.json`),
      this._fetchJson<FeatureCollection<any>>(`${ASSETS_BASE}occupied_territories.geojson`),
    ]);

    // Generate power lines connecting cities to closest power infrastructure
    const cityPowerLines = generateCityPowerLines(cities, infrastructure, powerLines);
    const allPowerLines = [...powerLines, ...cityPowerLines];

    // 3. Game state
    this._state = loadState() ?? buildInitialState(oblasts.features, cities, infrastructure);
    const state = this._state;

    const mapData = {
      border,
      oblasts,
      infrastructure,
      cities,
      rivers,
      powerLines: allPowerLines,
      regions: state.regions,
      occupiedZones,
    };

    // 4. Info panel (HTML overlay)
    const panel = new InfoPanel(container);
    this._panel = panel;

    // 5. Budget panel (HTML overlay)
    const budgetPanel = new BudgetPanel(container);
    this._budgetPanel = budgetPanel;
    budgetPanel.update(state);

    // 6. Map renderer
    const map = new MapRenderer();
    this._map = map;
    map.init(mapData, this._app.screen.width, this._app.screen.height);
    this._app.stage.addChild(map);

    map.onRegionClick((id) => {
      const regionState = state.regions.find((r) => r.id === id);
      if (regionState) {
        panel.show({ type: 'region', state: regionState });
      }
    });

    map.onInfraClick((obj: InfrastructureObject) => {
      panel.show({ type: 'infra', obj });
    });

    map.onCityClick((city: City) => {
      panel.show({ type: 'city', city });
    });

    // 6. Game loop
    const loop = new GameLoop();
    loop.dayNumber = state.globalParams.day;

    loop.onPhaseChange = (phase) => {
      state.phase = phase;
      state.globalParams.phase = phase;
      if (phase === 'night') {
        this._nightSecondsLeft = 30;
        // Create checkpoint before entering NIGHT phase
        const checkpointId = saveCheckpoint(state);
        state.globalParams.checkpointId = checkpointId;
      }
    };

    loop.onNightTick = (secondsLeft) => {
      this._nightSecondsLeft = secondsLeft;
    };

    loop.onDayReport = (report) => {
      state.globalParams.day = report.day;

      // Distribute monthly budget when a new day begins (1st day of each month would be: day % 30 === 1)
      // For simplicity, distribute budget every day, or define monthly cycle as needed
      if (report.day % 30 === 1) {
        processMonthlyBudgetDistribution(state);
        budgetPanel.update(state);
        console.log(`[GameEngine] Monthly budget distribution on day ${report.day}`);
      }

      // Save game state with transactional API and error handling
      console.log(`[GameEngine] Day ${report.day} begins — auto-saving...`);
      try {
        const checkpointId = state.globalParams.checkpointId as string | undefined;
        const success = saveGameState(state, checkpointId);
        if (!success) {
          console.error('[GameEngine] Failed to save game state. User notification recommended.');
          // TODO: Show error notification to user
        }
      } catch (error) {
        console.error('[GameEngine] Error during save:', error);
        // Rollback: restore from last checkpoint if save failed
        if (state.globalParams.checkpointId) {
          const checkpoint = state.globalParams.checkpointId as string;
          const restored = restoreGameState(checkpoint);
          if (restored) {
            Object.assign(state, restored);
            console.log('[GameEngine] Rolled back to checkpoint after save error');
          }
        }
      }
    };

    // 7. Phase timer UI
    const timer = new PhaseTimer(loop);
    this._timer = timer;
    timer.x = 12;
    timer.y = 12;
    this._app.stage.addChild(timer);

    // 8. Ticker
    this._app.ticker.add((ticker) => {
      loop.update(ticker);
      timer.update(loop.phase, this._nightSecondsLeft, loop.dayNumber);
      map.update(ticker);
    });

    // 9. Resize handler
    this._onResize = () => {
      if (this._map) {
        this._map.resize(this._app.screen.width, this._app.screen.height);
      }
    };
    window.addEventListener('resize', this._onResize);
  }

  private async _fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  destroy(): void {
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
    this._map?.destroy();
    this._timer?.destroy();
    this._panel?.destroy();
    this._budgetPanel?.destroy();
    this._app.destroy(true, { children: true });
  }
}
