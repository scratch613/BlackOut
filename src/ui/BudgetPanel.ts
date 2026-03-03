/**
 * Global budget display panel showing country, regional, and foreign funds
 */

import type { AppGameState } from '@/types';

const CSS = `
#rl-budget-panel {
  position: absolute;
  bottom: 12px;
  left: 12px;
  min-width: 240px;
  background: rgba(10, 14, 26, 0.92);
  border: 1px solid #2a3f6f;
  border-radius: 8px;
  color: #c8d8f0;
  font-family: monospace;
  font-size: 13px;
  backdrop-filter: blur(6px);
  box-shadow: 0 0 24px rgba(0, 212, 255, 0.08);
  z-index: 10;
  pointer-events: auto;
}
#rl-budget-panel .panel-header {
  padding: 10px 12px;
  border-bottom: 1px solid #1e2e50;
}
#rl-budget-panel .panel-title {
  font-size: 13px;
  font-weight: bold;
  color: #00d4ff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
#rl-budget-panel .panel-body {
  padding: 8px 12px 10px;
}
#rl-budget-panel .budget-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  gap: 12px;
}
#rl-budget-panel .budget-label {
  color: #8899bb;
  font-size: 12px;
}
#rl-budget-panel .budget-value {
  color: #e0eeff;
  font-weight: bold;
  text-align: right;
  white-space: nowrap;
}
#rl-budget-panel .budget-value.primary { color: #00ff88; }
#rl-budget-panel .budget-value.secondary { color: #ffcc00; }
#rl-budget-panel .budget-value.foreign { color: #00d4ff; }
#rl-budget-panel .divider {
  border: none;
  border-top: 1px solid #1e2e50;
  margin: 6px 0;
}
#rl-budget-panel .total-row {
  padding-top: 6px;
  margin-top: 6px;
  border-top: 1px solid #2a3f6f;
}
#rl-budget-panel .total-row .budget-label {
  color: #aabbdd;
  font-weight: bold;
}
#rl-budget-panel .total-row .budget-value {
  color: #00d4ff;
  font-size: 14px;
}
`;

function fmt(n: number): string {
    return n.toLocaleString();
}

export class BudgetPanel {
    private readonly _el: HTMLDivElement;
    private readonly _bodyEl: HTMLDivElement;

    constructor(container: HTMLElement) {
        // Inject styles once
        if (!document.getElementById('rl-budget-panel-style')) {
            const style = document.createElement('style');
            style.id = 'rl-budget-panel-style';
            style.textContent = CSS;
            document.head.appendChild(style);
        }

        this._el = document.createElement('div');
        this._el.id = 'rl-budget-panel';

        const header = document.createElement('div');
        header.className = 'panel-header';
        const title = document.createElement('div');
        title.className = 'panel-title';
        title.textContent = '💰 Budget Overview';
        header.appendChild(title);

        this._bodyEl = document.createElement('div');
        this._bodyEl.className = 'panel-body';

        this._el.appendChild(header);
        this._el.appendChild(this._bodyEl);
        container.appendChild(this._el);
    }

    update(state: AppGameState): void {
        const totalRegionalBudget = state.regions.reduce((sum, r) => sum + r.budget, 0);
        const totalAvailable = state.globalParams.countryBudget + totalRegionalBudget + state.globalParams.foreignBudget;

        this._bodyEl.innerHTML = '';

        // Country budget
        this._bodyEl.appendChild(this._row(
            'Country Budget',
            '₴' + fmt(state.globalParams.countryBudget),
            'primary'
        ));

        // Regional budgets total
        this._bodyEl.appendChild(this._row(
            'Regional Budgets',
            '₴' + fmt(totalRegionalBudget),
            'secondary'
        ));

        // Foreign budget
        this._bodyEl.appendChild(this._row(
            'Foreign Funds',
            '₴' + fmt(state.globalParams.foreignBudget),
            'foreign'
        ));

        // Total available
        const totalRow = this._row(
            'Total Available',
            '₴' + fmt(totalAvailable),
            ''
        );
        totalRow.classList.add('total-row');
        this._bodyEl.appendChild(totalRow);
    }

    destroy(): void {
        this._el.remove();
    }

    private _row(label: string, value: string, colorClass: string): HTMLDivElement {
        const row = document.createElement('div');
        row.className = 'budget-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'budget-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('span');
        valueEl.className = 'budget-value' + (colorClass ? ' ' + colorClass : '');
        valueEl.textContent = value;

        row.appendChild(labelEl);
        row.appendChild(valueEl);

        return row;
    }
}
