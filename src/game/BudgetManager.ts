/**
 * Budget management system for the game.
 *
 * Budget tiers:
 * - Country budget: spent on national projects, can be supplemented from region budgets
 * - Region budgets: regional-specific spending, can request country budget supplement
 * - Foreign budget: only for designated foreign-funded projects, must be fully funded
 */

import type { AppGameState } from '@/types';

/**
 * Budget spending options for a task/project
 */
export interface BudgetAllocation {
    fromRegionBudget: number;     // Amount to take from region budget
    fromCountryBudget: number;    // Amount to take from country budget (for region overage)
    fromForeignBudget: number;    // Amount to take from foreign budget (must be 0 or full amount)
}

/**
 * Validates that a spending plan is valid
 */
export function validateBudgetAllocation(
    allocation: BudgetAllocation,
    regionBudget: number,
    countryBudget: number,
    foreignBudget: number,
): boolean {
    // Check region budget not exceeded
    if (allocation.fromRegionBudget > regionBudget) return false;

    // Check country budget not exceeded
    if (allocation.fromCountryBudget > countryBudget) return false;

    // Check foreign budget not exceeded
    if (allocation.fromForeignBudget > foreignBudget) return false;

    // Foreign budget must be fully funded or not at all
    // (can't supplement foreign budget from other sources)
    if (allocation.fromForeignBudget > 0) {
        const totalNeeded = allocation.fromRegionBudget + allocation.fromCountryBudget + allocation.fromForeignBudget;
        if (allocation.fromForeignBudget !== totalNeeded) {
            return false; // Foreign budget must cover entire cost or not be used
        }
    }

    return true;
}

/**
 * Apply a budget allocation to the game state
 */
export function applyBudgetAllocation(
    state: AppGameState,
    regionId: string,
    allocation: BudgetAllocation,
): boolean {
    // Validate first
    const region = state.regions.find(r => r.id === regionId);
    if (!region) return false;

    if (!validateBudgetAllocation(
        allocation,
        region.budget,
        state.globalParams.countryBudget,
        state.globalParams.foreignBudget,
    )) {
        return false;
    }

    // Apply the allocation
    region.budget -= allocation.fromRegionBudget;
    state.globalParams.countryBudget -= allocation.fromCountryBudget;
    state.globalParams.foreignBudget -= allocation.fromForeignBudget;

    return true;
}

/**
 * Suggest optimal budget allocation for a task cost
 * Prefers region budget first, then country budget, avoids foreign budget
 */
export function suggestBudgetAllocation(
    cost: number,
    regionBudget: number,
    countryBudget: number,
): BudgetAllocation {
    const fromRegionBudget = Math.min(cost, regionBudget);
    const remaining = cost - fromRegionBudget;
    const fromCountryBudget = Math.min(remaining, countryBudget);

    return {
        fromRegionBudget,
        fromCountryBudget,
        fromForeignBudget: 0,
    };
}

/**
 * Calculate monthly budget distribution to regions
 * Region receives: (region population / total population) * base regional income
 */
export function distributeRegionalBudgets(
    state: AppGameState,
    baseMonthlyRegionalIncome: number,
): void {
    const totalPopulation = state.regions.reduce((sum, r) => sum + r.population, 0);
    if (totalPopulation === 0) return;

    for (const region of state.regions) {
        const share = region.population / totalPopulation;
        region.budget += Math.round(baseMonthlyRegionalIncome * share);
    }
}

/**
 * Calculate monthly country budget income
 * Country receives: base income * (all regional population units / 10000)
 */
export function distributeCountryBudget(
    state: AppGameState,
    baseMonthlyCountryIncome: number,
): void {
    state.globalParams.countryBudget += baseMonthlyCountryIncome;
}

/**
 * Calculate monthly foreign budget income
/**
 * Calculate monthly foreign budget income
 * For now: formula is undefined, returns 0
 * Can be updated with actual formula later
 */
export function distributeForeignBudget(
    _state: AppGameState,
    _internationalSupportLevel: number,
): void {
    // TODO: Define formula for foreign budget distribution
    // For now, no foreign budget income each month
    // _state.globalParams.foreignBudget += 0;
}

/**
 * Process monthly budget distribution
 * Called once per month during day phase
 */
export function processMonthlyBudgetDistribution(
    state: AppGameState,
    baseMonthlyRegionalIncome: number = 100_000,
    baseMonthlyCountryIncome: number = 1_000_000,
): void {
    distributeRegionalBudgets(state, baseMonthlyRegionalIncome);
    distributeCountryBudget(state, baseMonthlyCountryIncome);
    distributeForeignBudget(state, state.globalParams.internationalSupport);
}
