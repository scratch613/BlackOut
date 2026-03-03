import type { Ticker } from 'pixi.js';

import type { GamePhase } from '@/types';

/** Duration of the night phase in seconds (game time). */
const NIGHT_DURATION_SECONDS = 30;

export interface DayReport {
  day: number;
}

export class GameLoop {
  phase: GamePhase = 'day';
  dayNumber = 1;
  nightTicksRemaining = 0;

  // Callbacks
  onPhaseChange: ((phase: GamePhase) => void) | null = null;
  onNightTick: ((secondsLeft: number) => void) | null = null;
  onDayReport: ((report: DayReport) => void) | null = null;

  private _elapsed = 0;

  /** Call from app.ticker.add() each frame. */
  update(ticker: Ticker): void {
    if (this.phase !== 'night') return;
    if (this.nightTicksRemaining <= 0) return;

    this._elapsed += ticker.deltaMS;
    if (this._elapsed >= 1000) {
      this._elapsed -= 1000;
      this.nightTicksRemaining = Math.max(0, this.nightTicksRemaining - 1);
      this.onNightTick?.(this.nightTicksRemaining);

      if (this.nightTicksRemaining === 0) {
        this._endNight();
      }
    }
  }

  /** Player presses "End Day" — transition DAY → NIGHT. */
  endDay(): void {
    if (this.phase !== 'day') return;
    this.phase = 'night';
    this.nightTicksRemaining = NIGHT_DURATION_SECONDS;
    this._elapsed = 0;
    this.onPhaseChange?.('night');
    this.onNightTick?.(this.nightTicksRemaining);
  }

  private _endNight(): void {
    this.phase = 'day';
    this.dayNumber += 1;
    this.onDayReport?.({ day: this.dayNumber });
    this.onPhaseChange?.('day');
  }
}
