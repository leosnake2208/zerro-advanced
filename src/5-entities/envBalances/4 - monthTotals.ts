import type { ById, ByMonth, TFxAmount, TISOMonth } from '6-shared/types'
import type { TSelector } from 'store'
import { createSelector } from '@reduxjs/toolkit'
import { shallowEqual } from 'react-redux'
import { toISOMonth } from '6-shared/helpers/date'
import { addFxAmount, subFxAmount } from '6-shared/helpers/money'
import { withPerf } from '6-shared/helpers/performance'

import { fxRateModel, TFxConverter } from '5-entities/currency/fxRate'
import { envelopeModel, TEnvelopeId } from '5-entities/envelope'
import { getCurrentFunds } from './1 - currentFunds'
import { getMonthList } from './1 - monthList'
import { getActivity, TActivityNode } from './2 - activity'
import { getEnvMetrics, TEnvMetrics } from './3 - envMetrics'

type TToBeBudgetedState = 'positive' | 'allocated' | 'negative'

export type TMonthTotals = {
  month: TISOMonth
  // Money amounts for month
  fundsStart: TFxAmount
  fundsChange: TFxAmount
  fundsEnd: TFxAmount
  // Detailed money movements
  transferFees: TFxAmount // Transfer fees
  generalIncome: TFxAmount // Unsorted income
  envActivity: TFxAmount // Transactions associated with envelopes
  // Envelope totals
  budgeted: TFxAmount
  positiveBudgeted: TFxAmount // Used to calculate budgetedInFuture
  available: TFxAmount

  budgetedInFuture: TFxAmount // Total amount of money budgeted in future months
  freeFunds: TFxAmount
  toBeBudgeted: TFxAmount
  toBeBudgetedState: TToBeBudgetedState
  overspend: TFxAmount

  // Income/Expense category totals
  incomeBudgeted: TFxAmount
  incomeActivity: TFxAmount
  incomeAvailable: TFxAmount
  expenseBudgeted: TFxAmount
  expenseActivity: TFxAmount
  expenseAvailable: TFxAmount
  // Balance = income - expense for each column
  balanceBudgeted: TFxAmount
  balanceActivity: TFxAmount
  balanceAvailable: TFxAmount
}

export const getMonthTotals: TSelector<ByMonth<TMonthTotals>> = createSelector(
  [
    getMonthList,
    getCurrentFunds,
    getActivity,
    getEnvMetrics,
    fxRateModel.converter,
    envelopeModel.getIncomeEnvelopeIds,
  ],
  withPerf('🖤 getMonthTotals', calcMonthTotals)
)

function calcMonthTotals(
  months: TISOMonth[],
  currentFunds: TFxAmount,
  activity: ByMonth<TActivityNode>,
  envMetrics: ByMonth<ById<TEnvMetrics>>,
  convertFx: TFxConverter,
  incomeEnvelopeIds: Set<TEnvelopeId>
) {
  const result: ByMonth<TMonthTotals> = {}

  const currentMonth = toISOMonth(Date.now())
  const monthListReversed = [...months].reverse()

  let prev = monthListReversed[0]
  monthListReversed.forEach((month, idx) => {
    const toValue = (amount: TFxAmount) => convertFx(amount, 'USD', month)
    const isFuture = month > currentMonth
    const isCurrent = month === currentMonth
    const prevMonth = result[prev] || {}

    if (idx === 0) {
      console.assert(isFuture || isCurrent, 'Last month is in the past')
    }

    // Funds part
    let fundsEnd = isFuture || isCurrent ? currentFunds : prevMonth.fundsStart
    let fundsChange = activity[month]?.total || {}
    let fundsStart = subFxAmount(fundsEnd, fundsChange)

    let transferFees = activity[month]?.transferFees.total || {}
    let generalIncome = activity[month]?.generalIncome.total || {}
    let envActivity = activity[month]?.envActivity.total || {}
    console.assert(
      shallowEqual(
        fundsChange,
        addFxAmount(transferFees, generalIncome, envActivity)
      ),
      'Total change is not equal to sum of transfers + income + anv activity'
    )

    let positiveBudgeted = {} // Used for budgetedInFuture
    let budgeted = {}
    let available = {}
    let overspend = {}
    // Income/Expense totals for all three columns
    let incomeBudgeted = {} as TFxAmount
    let incomeActivity = {} as TFxAmount
    let incomeAvailable = {} as TFxAmount
    let expenseBudgeted = {} as TFxAmount
    let expenseActivity = {} as TFxAmount
    let expenseAvailable = {} as TFxAmount

    Object.values(envMetrics[month]).forEach(metrics => {
      if (metrics.parent) return // Skip children
      const { totalBudgeted, totalAvailable, selfAvailable, id, totalActivity } =
        metrics
      budgeted = addFxAmount(budgeted, totalBudgeted)
      available = addFxAmount(available, totalAvailable)

      let hasPositiveBudget = toValue(totalBudgeted) > 0
      if (hasPositiveBudget) {
        positiveBudgeted = addFxAmount(positiveBudgeted, totalBudgeted)
      }

      let hasOverspend = toValue(selfAvailable) < 0
      if (hasOverspend) {
        overspend = addFxAmount(overspend, selfAvailable)
      }

      // Calculate income/expense totals for all three columns
      if (incomeEnvelopeIds.has(id)) {
        incomeBudgeted = addFxAmount(incomeBudgeted, totalBudgeted)
        incomeActivity = addFxAmount(incomeActivity, totalActivity)
        incomeAvailable = addFxAmount(incomeAvailable, totalAvailable)
      } else {
        expenseBudgeted = addFxAmount(expenseBudgeted, totalBudgeted)
        expenseActivity = addFxAmount(expenseActivity, totalActivity)
        expenseAvailable = addFxAmount(expenseAvailable, totalAvailable)
      }
    })

    // Balance = income - expenses for each column
    const balanceBudgeted = subFxAmount(incomeBudgeted, expenseBudgeted)
    const balanceActivity = subFxAmount(incomeActivity, expenseActivity)
    const balanceAvailable = subFxAmount(incomeAvailable, expenseAvailable)

    let budgetedInFuture = addFxAmount(
      prevMonth.positiveBudgeted || {},
      prevMonth.budgetedInFuture || {}
    )

    let freeFunds = subFxAmount(fundsEnd, available)
    let toBeBudgetedInfo = calcToBeBudgeted(
      freeFunds,
      budgetedInFuture,
      toValue
    )

    result[month] = {
      month,
      fundsStart,
      fundsChange,
      fundsEnd,
      transferFees,
      generalIncome,
      envActivity,
      budgeted,
      positiveBudgeted,
      available,
      budgetedInFuture,
      freeFunds,
      toBeBudgeted: toBeBudgetedInfo.value,
      toBeBudgetedState: toBeBudgetedInfo.state,
      overspend,
      // Income/Expense category totals
      incomeBudgeted,
      incomeActivity,
      incomeAvailable,
      expenseBudgeted,
      expenseActivity,
      expenseAvailable,
      // Balance = income - expense for each column
      balanceBudgeted,
      balanceActivity,
      balanceAvailable,
    }
    prev = month
  })

  return result
}

function calcToBeBudgeted(
  freeNow: TFxAmount,
  needForFuture: TFxAmount,
  toValue: (amount: TFxAmount) => number
): { value: TFxAmount; state: TToBeBudgetedState } {
  if (toValue(freeNow) < 0) {
    return { value: freeNow, state: 'negative' }
  }
  const withFuture = subFxAmount(freeNow, needForFuture)
  if (toValue(withFuture) > 0) {
    return { value: withFuture, state: 'positive' }
  }
  return { value: {}, state: 'allocated' }
}
