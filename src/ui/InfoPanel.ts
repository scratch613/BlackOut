import type { City, InfrastructureObject, RegionState } from '@/types';

export type PanelContent =
  | { type: 'region'; state: RegionState }
  | { type: 'city'; city: City }
  | { type: 'infra'; obj: InfrastructureObject };

const INFRA_TYPE_LABELS: Record<string, string> = {
  nuclear: 'Nuclear Power Plant',
  hydro: 'Hydro Power Plant',
  thermal: 'Thermal Power Plant',
  substation: 'Substation',
  chp: 'Combined Heat & Power',
};

const CSS = `
#rl-info-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 260px;
  background: rgba(10, 14, 26, 0.92);
  border: 1px solid #2a3f6f;
  border-radius: 8px;
  color: #c8d8f0;
  font-family: monospace;
  font-size: 13px;
  backdrop-filter: blur(6px);
  box-shadow: 0 0 24px rgba(0, 212, 255, 0.08);
  transition: opacity 0.15s ease;
  pointer-events: auto;
  z-index: 10;
}
#rl-info-panel.hidden {
  opacity: 0;
  pointer-events: none;
}
#rl-info-panel .panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 14px 8px;
  border-bottom: 1px solid #1e2e50;
  gap: 8px;
}
#rl-info-panel .panel-title {
  font-size: 14px;
  font-weight: bold;
  color: #00d4ff;
  line-height: 1.3;
}
#rl-info-panel .panel-subtitle {
  font-size: 11px;
  color: #5577aa;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
#rl-info-panel .close-btn {
  background: none;
  border: none;
  color: #5577aa;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  transition: color 0.1s;
}
#rl-info-panel .close-btn:hover { color: #00d4ff; }
#rl-info-panel .panel-body {
  padding: 10px 14px 14px;
}
#rl-info-panel .row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #111e35;
}
#rl-info-panel .row:last-child { border-bottom: none; }
#rl-info-panel .row-label { color: #556688; }
#rl-info-panel .row-value { color: #e0eeff; text-align: right; }
#rl-info-panel .row-value.ok    { color: #00ff88; }
#rl-info-panel .row-value.warn  { color: #ff8800; }
#rl-info-panel .row-value.bad   { color: #ff3344; }
#rl-info-panel .row-value.neon  { color: #00d4ff; }
#rl-info-panel .divider {
  border: none;
  border-top: 1px solid #1e2e50;
  margin: 8px 0;
}
`;

function fmt(n: number): string {
  return n.toLocaleString();
}

export class InfoPanel {
  private readonly _el: HTMLDivElement;
  private readonly _titleEl: HTMLDivElement;
  private readonly _subtitleEl: HTMLDivElement;
  private readonly _bodyEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    // Inject styles once
    if (!document.getElementById('rl-info-panel-style')) {
      const style = document.createElement('style');
      style.id = 'rl-info-panel-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    this._el = document.createElement('div');
    this._el.id = 'rl-info-panel';
    this._el.classList.add('hidden');

    const header = document.createElement('div');
    header.className = 'panel-header';

    const titleWrap = document.createElement('div');
    this._titleEl = document.createElement('div');
    this._titleEl.className = 'panel-title';
    this._subtitleEl = document.createElement('div');
    this._subtitleEl.className = 'panel-subtitle';
    titleWrap.appendChild(this._titleEl);
    titleWrap.appendChild(this._subtitleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    this._bodyEl = document.createElement('div');
    this._bodyEl.className = 'panel-body';

    this._el.appendChild(header);
    this._el.appendChild(this._bodyEl);
    container.appendChild(this._el);
  }

  show(content: PanelContent): void {
    switch (content.type) {
      case 'region': this._renderRegion(content.state); break;
      case 'city': this._renderCity(content.city); break;
      case 'infra': this._renderInfra(content.obj); break;
    }
    this._el.classList.remove('hidden');
  }

  hide(): void {
    this._el.classList.add('hidden');
  }

  destroy(): void {
    this._el.remove();
  }

  // ---------------------------------------------------------------------------

  private _renderRegion(s: RegionState): void {
    this._titleEl.textContent = s.name;
    this._subtitleEl.textContent = 'Oblast';
    this._bodyEl.innerHTML = '';

    const depClass = s.depression < 30 ? 'ok' : s.depression < 60 ? 'warn' : 'bad';

    this._bodyEl.appendChild(this._rows([
      ['Population', fmt(s.population) + ' units', ''],
      ['Budget', '₴' + fmt(s.budget), 'neon'],
      ['Depression', s.depression + '%', depClass],
      ['Power', s.hasPower ? '✓ Online' : '✗ Offline', s.hasPower ? 'ok' : 'bad'],
      ['Heat', s.hasHeat ? '✓ Online' : '✗ Offline', s.hasHeat ? 'ok' : 'bad'],
    ]));
  }

  private _renderCity(c: City): void {
    this._titleEl.textContent = c.name;
    this._subtitleEl.textContent = 'City · Tier ' + c.tier;
    this._bodyEl.innerHTML = '';

    this._bodyEl.appendChild(this._rows([
      ['Population', fmt(c.population), 'neon'],
      ['Tier', '★'.repeat(4 - c.tier) + '☆'.repeat(c.tier - 1), ''],
      ['Lat / Lon', `${c.lat.toFixed(3)}° / ${c.lon.toFixed(3)}°`, ''],
    ]));
  }

  private _renderInfra(o: InfrastructureObject): void {
    this._titleEl.textContent = o.name;
    this._subtitleEl.textContent = INFRA_TYPE_LABELS[o.type] ?? o.type;
    this._bodyEl.innerHTML = '';

    const statusClass = o.status === 'active' ? 'ok' : o.status === 'damaged' ? 'warn' : 'bad';
    const statusLabel = o.status.charAt(0).toUpperCase() + o.status.slice(1);

    const rows: [string, string, string][] = [
      ['Type', INFRA_TYPE_LABELS[o.type] ?? o.type, ''],
      ['Capacity', o.capacity != null ? fmt(o.capacity) + ' MW' : '—', 'neon'],
      ['Status', statusLabel, statusClass],
    ];
    if (o.voltage) rows.push(['Voltage', o.voltage, '']);
    if (o.heat !== undefined) rows.push(['Provides Heat', o.heat ? 'Yes' : 'No', o.heat ? 'ok' : '']);
    rows.push(['Lat / Lon', `${o.lat.toFixed(3)}° / ${o.lon.toFixed(3)}°`, '']);

    this._bodyEl.appendChild(this._rows(rows));
  }

  private _rows(rows: [string, string, string][]): DocumentFragment {
    const frag = document.createDocumentFragment();
    for (const [label, value, cls] of rows) {
      const row = document.createElement('div');
      row.className = 'row';
      const lEl = document.createElement('span');
      lEl.className = 'row-label';
      lEl.textContent = label;
      const vEl = document.createElement('span');
      vEl.className = 'row-value' + (cls ? ' ' + cls : '');
      vEl.textContent = value;
      row.appendChild(lEl);
      row.appendChild(vEl);
      frag.appendChild(row);
    }
    return frag;
  }
}
