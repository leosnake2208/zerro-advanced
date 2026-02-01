import React, { FC, memo, useCallback, useMemo, useState } from 'react'
import { shallowEqual } from 'react-redux'
import { isEqual } from 'lodash'
import { Box, Collapse, Paper } from '@mui/material'
import { TFxAmount, TISOMonth } from '6-shared/types'
import { useToggle } from '6-shared/hooks/useToggle'
import { useTranslation } from 'react-i18next'
import { addFxAmount } from '6-shared/helpers/money'

import { useAppSelector } from 'store/index'
import { envelopeModel, TEnvelopeId, TGroupNode } from '5-entities/envelope'
import { balances } from '5-entities/envBalances'

import { Parent } from './Parent'
import { Row } from './Row'
import { Header } from './Header'
import { RenderColumnsProvider, useMetric } from './models/useMetric'
import { useExpandEnvelopes } from './models/useExpandEnvelopes'
import { useEnvRenderInfo, TEnvRenderInfo } from './models/envRenderInfo'
import { Footer } from './Footer'
import { Group } from './Group'
import { NewGroup } from './NewGroup'
import { SectionHeader } from './SectionHeader'

type TagTableProps = {
  month: TISOMonth
  className?: string
  onOpenDetails: (id: TEnvelopeId) => void
  onOpenOverview: () => void
  onShowTransactions: (conditions: {
    id: TEnvelopeId
    isExact?: boolean | undefined
  }) => void
}

const EnvelopeTable2: FC<TagTableProps> = props => {
  const {
    month,
    className,
    onOpenDetails,
    onOpenOverview,
    onShowTransactions,
  } = props

  const { t } = useTranslation('budgets')
  const structure = useAppSelector(envelopeModel.getEnvelopeStructure, isEqual)
  const envelopes = envelopeModel.useEnvelopes()
  const envData = balances.useEnvData()[month]
  const renderInfo = useEnvRenderInfo(month)
  const { expanded, toggle, expandAll, collapseAll } = useExpandEnvelopes()
  const { metric } = useMetric()
  const [showAll, toggleShowAll] = useToggle()
  const [reorderMode, toggleReorderMode] = useToggle()
  const [incomeExpanded, setIncomeExpanded] = useState(true)
  const [expenseExpanded, setExpenseExpanded] = useState(true)

  const onShowExactTransactions = useCallback(
    (id: TEnvelopeId) => onShowTransactions({ id, isExact: true }),
    [onShowTransactions]
  )
  const onShowAllTransactions = useCallback(
    (id: TEnvelopeId) => onShowTransactions({ id }),
    [onShowTransactions]
  )

  // Separate structure into income and expense groups
  const { incomeGroups, expenseGroups, incomeTotals, expenseTotals } =
    useMemo(() => {
      const incomeGroups: TGroupNode[] = []
      const expenseGroups: TGroupNode[] = []

      // Calculate totals
      let incomeBudgeted: TFxAmount = {}
      let incomeActivity: TFxAmount = {}
      let incomeAvailable: TFxAmount = {}
      let expenseBudgeted: TFxAmount = {}
      let expenseActivity: TFxAmount = {}
      let expenseAvailable: TFxAmount = {}

      structure.forEach(group => {
        const incomeChildren = group.children.filter(
          child => envelopes[child.id]?.categoryType === 'income'
        )
        const expenseChildren = group.children.filter(
          child => envelopes[child.id]?.categoryType !== 'income'
        )

        if (incomeChildren.length > 0) {
          incomeGroups.push({
            ...group,
            children: incomeChildren,
          })
          incomeChildren.forEach(child => {
            const data = envData?.[child.id]
            if (data) {
              incomeBudgeted = addFxAmount(incomeBudgeted, data.totalBudgeted)
              incomeActivity = addFxAmount(incomeActivity, data.totalActivity)
              incomeAvailable = addFxAmount(incomeAvailable, data.totalAvailable)
            }
          })
        }

        if (expenseChildren.length > 0) {
          expenseGroups.push({
            ...group,
            children: expenseChildren,
          })
          expenseChildren.forEach(child => {
            const data = envData?.[child.id]
            if (data) {
              expenseBudgeted = addFxAmount(expenseBudgeted, data.totalBudgeted)
              expenseActivity = addFxAmount(expenseActivity, data.totalActivity)
              expenseAvailable = addFxAmount(
                expenseAvailable,
                data.totalAvailable
              )
            }
          })
        }
      })

      return {
        incomeGroups,
        expenseGroups,
        incomeTotals: {
          budgeted: incomeBudgeted,
          activity: incomeActivity,
          available: incomeAvailable,
        },
        expenseTotals: {
          budgeted: expenseBudgeted,
          activity: expenseActivity,
          available: expenseAvailable,
        },
      }
    }, [structure, envelopes, envData])

  const renderGroupsForSection = useCallback(
    (groups: TGroupNode[], baseIdx: number) => {
      return groups
        .map((group, idx) => {
          const groupIdx = baseIdx + idx
          const parents = group.children
            .filter(parent => showAll || renderInfo[parent.id]?.isDefaultVisible)
            .map(parent => {
              const info = renderInfo[parent.id]
              if (!info) return null
              const { isDefaultVisible, showSelf } = info

              let renderChildren = parent.children
                .filter(
                  child => showAll || renderInfo[child.id]?.isDefaultVisible
                )
                .map((child, idx, arr) => (
                  <Row
                    key={'child' + child.id}
                    id={child.id}
                    month={month}
                    isDefaultVisible={
                      renderInfo[child.id]?.isDefaultVisible ?? false
                    }
                    isLastVisibleChild={idx === arr.length - 1}
                    isReordering={reorderMode}
                    openTransactionsPopover={onShowExactTransactions}
                    openDetails={onOpenDetails}
                  />
                ))

              if (showSelf) {
                renderChildren = [
                  <Row
                    isSelf
                    key={'self' + parent.id}
                    id={parent.id}
                    month={month}
                    isDefaultVisible={
                      renderInfo[parent.id]?.isDefaultVisible ?? false
                    }
                    isReordering={reorderMode}
                    openTransactionsPopover={onShowExactTransactions}
                    openDetails={onOpenDetails}
                  />,
                  ...renderChildren,
                ]
              }

              const isExpanded =
                !!renderChildren.length && expanded.includes(parent.id)

              return (
                <Parent
                  key={parent.id}
                  id={parent.id}
                  isExpanded={isExpanded}
                  onExpandToggle={toggle}
                  onExpandAll={expandAll}
                  onCollapseAll={collapseAll}
                  parent={
                    <Row
                      id={parent.id}
                      month={month}
                      isDefaultVisible={isDefaultVisible}
                      isExpanded={isExpanded}
                      isReordering={reorderMode}
                      openDetails={onOpenDetails}
                      openTransactionsPopover={onShowAllTransactions}
                    />
                  }
                  children={renderChildren}
                />
              )
            })
            .filter(Boolean)

          return {
            group,
            groupIdx,
            renderChildren: parents,
          }
        })
        .filter(data => data.renderChildren.length)
        .map((data, index, array) => {
          const { group, groupIdx, renderChildren } = data
          const prevVisibleIdx = array[index - 1]?.groupIdx
          const nextVisibleIdx = array[index + 1]?.groupIdx
          return (
            <Group
              key={group.id}
              name={group.id}
              groupIdx={groupIdx}
              prevIdx={prevVisibleIdx}
              nextIdx={nextVisibleIdx}
              isReordering={reorderMode}
            >
              {renderChildren}
            </Group>
          )
        })
    },
    [
      showAll,
      renderInfo,
      month,
      reorderMode,
      onShowExactTransactions,
      onOpenDetails,
      expanded,
      toggle,
      expandAll,
      collapseAll,
      onShowAllTransactions,
    ]
  )

  const hasIncome = incomeGroups.length > 0
  const hasExpense = expenseGroups.length > 0

  return (
    <Paper className={className} sx={{ position: 'relative', pb: 1 }}>
      <Header
        month={month}
        isAllShown={showAll}
        isReordering={reorderMode}
        onShowAllToggle={toggleShowAll}
        onReorderModeToggle={toggleReorderMode}
        onOpenOverview={onOpenOverview}
      />
      <NewGroup visible={reorderMode} />

      {/* Income Section */}
      {hasIncome && (
        <Box>
          <SectionHeader
            title={t('incomeSection')}
            budgeted={incomeTotals.budgeted}
            activity={incomeTotals.activity}
            available={incomeTotals.available}
            month={month}
            isExpanded={incomeExpanded}
            onToggle={() => setIncomeExpanded(!incomeExpanded)}
            isIncome
          />
          <Collapse in={incomeExpanded}>
            {renderGroupsForSection(incomeGroups, 0)}
          </Collapse>
        </Box>
      )}

      {/* Expense Section */}
      {hasExpense && (
        <Box>
          <SectionHeader
            title={t('expenseSection')}
            budgeted={expenseTotals.budgeted}
            activity={expenseTotals.activity}
            available={expenseTotals.available}
            month={month}
            isExpanded={expenseExpanded}
            onToggle={() => setExpenseExpanded(!expenseExpanded)}
          />
          <Collapse in={expenseExpanded}>
            {renderGroupsForSection(expenseGroups, incomeGroups.length)}
          </Collapse>
        </Box>
      )}

      <Footer month={month} metric={metric} />
    </Paper>
  )
}

export const EnvelopeTable = memo(
  (props: TagTableProps) => (
    <RenderColumnsProvider>
      <EnvelopeTable2 {...props} />
    </RenderColumnsProvider>
  ),
  shallowEqual
)
