import { Container, Graphics, Text, TextStyle } from 'pixi.js';

import type { GameLoop } from '@/game/GameLoop';
import type { GamePhase } from '@/types';

const COLOR = {
  DAY_LABEL: 0xffd700,
  NIGHT_LABEL: 0x7b68ee,
  BAR_BG: 0x222244,
  BAR_FILL: 0x7b68ee,
  BUTTON_BG: 0x1a3a5c,
  BUTTON_TEXT: 0xffd700,
  DAY_COUNTER: 0xaaaacc,
  PANEL_BG: 0x0d1120,
};

const NIGHT_TOTAL = 30; // must match GameLoop constant

export class PhaseTimer extends Container {
  private readonly _phaseLabel: Text;
  private readonly _dayCounter: Text;
  private readonly _barBg: Graphics;
  private readonly _barFill: Graphics;
  private readonly _btn: Container;
  private readonly _btnBg: Graphics;
  private readonly _btnText: Text;
  private readonly _panelBg: Graphics;

  constructor(private readonly _gameLoop: GameLoop) {
    super();

    // Panel background
    this._panelBg = new Graphics();
    this.addChild(this._panelBg);

    // Phase label
    this._phaseLabel = new Text({
      text: 'DAY',
      style: new TextStyle({
        fontSize: 22,
        fontWeight: 'bold',
        fill: COLOR.DAY_LABEL,
        fontFamily: 'monospace',
      }),
    });
    this._phaseLabel.x = 12;
    this._phaseLabel.y = 10;
    this.addChild(this._phaseLabel);

    // Day counter
    this._dayCounter = new Text({
      text: 'Day 1',
      style: new TextStyle({
        fontSize: 13,
        fill: COLOR.DAY_COUNTER,
        fontFamily: 'monospace',
      }),
    });
    this._dayCounter.x = 12;
    this._dayCounter.y = 40;
    this.addChild(this._dayCounter);

    // Night countdown bar background
    this._barBg = new Graphics();
    this._barBg.rect(12, 62, 180, 10);
    this._barBg.fill({ color: COLOR.BAR_BG });
    this._barBg.visible = false;
    this.addChild(this._barBg);

    // Night countdown bar fill
    this._barFill = new Graphics();
    this._barFill.visible = false;
    this.addChild(this._barFill);

    // "End Day" button
    this._btn = new Container();
    this._btn.x = 12;
    this._btn.y = 62;

    this._btnBg = new Graphics();
    this._btnBg.roundRect(0, 0, 110, 28, 6);
    this._btnBg.fill({ color: COLOR.BUTTON_BG });
    this._btnBg.stroke({ width: 1, color: COLOR.DAY_LABEL });
    this._btn.addChild(this._btnBg);

    this._btnText = new Text({
      text: 'End Day →',
      style: new TextStyle({
        fontSize: 13,
        fill: COLOR.BUTTON_TEXT,
        fontFamily: 'monospace',
      }),
    });
    this._btnText.x = 10;
    this._btnText.y = 7;
    this._btn.addChild(this._btnText);

    this._btn.eventMode = 'static';
    this._btn.cursor = 'pointer';
    this._btn.on('pointerdown', () => this._gameLoop.endDay());
    this._btn.on('pointerover', () => {
      this._btnBg.tint = 0xaaddff;
    });
    this._btn.on('pointerout', () => {
      this._btnBg.tint = 0xffffff;
    });

    this.addChild(this._btn);

    // Draw panel
    this._panelBg.roundRect(0, 0, 204, 100, 8);
    this._panelBg.fill({ color: COLOR.PANEL_BG, alpha: 0.85 });
    this._panelBg.stroke({ width: 1, color: 0x2a3f6f });
  }

  /** Call once per frame from the ticker. */
  update(_phase: GamePhase, secondsLeft: number, dayNumber: number): void {
    const isNight = _phase === 'night';

    this._dayCounter.text = `Day ${dayNumber}`;

    if (isNight) {
      this._phaseLabel.text = 'NIGHT';
      (this._phaseLabel.style as TextStyle).fill = COLOR.NIGHT_LABEL;
      this._btn.visible = false;
      this._barBg.visible = true;
      this._barFill.visible = true;

      // Update bar fill
      const ratio = Math.min(1, Math.max(0, secondsLeft / NIGHT_TOTAL));
      this._barFill.clear();
      this._barFill.rect(12, 62, 180 * ratio, 10);
      this._barFill.fill({ color: COLOR.BAR_FILL, alpha: 0.9 });

      // Show seconds
      this._dayCounter.text = `Day ${dayNumber}  — ${secondsLeft}s`;
    } else {
      this._phaseLabel.text = 'DAY';
      (this._phaseLabel.style as TextStyle).fill = COLOR.DAY_LABEL;
      this._btn.visible = true;
      this._barBg.visible = false;
      this._barFill.visible = false;
    }
  }

  destroy(): void {
    this._btn.off('pointerdown');
    this._btn.off('pointerover');
    this._btn.off('pointerout');
    super.destroy({ children: true });
  }
}
