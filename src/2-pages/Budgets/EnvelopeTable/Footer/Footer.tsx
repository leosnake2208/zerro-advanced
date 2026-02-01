import React, { FC } from 'react'
import { Box, Typography } from '@mui/material'
import { TableRow } from '../shared/shared'

import { Metric } from '../models/useMetric'
import { TFxAmount, TISOMonth } from '6-shared/types'
import { balances } from '5-entities/envBalances'
import { DisplayAmount, displayCurrency } from '5-entities/currency/displayCurrency'
import { useTranslation } from 'react-i18next'

type FooterProps = {
  month: TISOMonth
  metric: Metric
}

export const Footer: FC<FooterProps> = props => {
  const { month } = props
  const totals = balances.useTotals()[month]
  const { t } = useTranslation(['common', 'budgets'])
  const toDisplay = displayCurrency.useToDisplay(month)

  const Sum: FC<{ value: TFxAmount }> = ({ value }) => (
    <Typography
      variant="overline"
      align="right"
      noWrap
      sx={{
        color: 'text.secondary',
      }}
    >
      <DisplayAmount value={value} decMode="ifOnly" month={month} noCurrency />
    </Typography>
  )

  // Calculate balance value for color
  const balanceValue = toDisplay(totals.balance)
  const balanceColor =
    balanceValue > 0 ? 'success.main' : balanceValue < 0 ? 'error.main' : 'text.secondary'

  return (
    <Box>
      {/* Totals row */}
      <TableRow
        name={
          <div>
            <Typography
              variant="overline"
              noWrap
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('common:total')}
            </Typography>
          </div>
        }
        budgeted={<Sum value={totals.budgeted} />}
        outcome={<Sum value={totals.envActivity} />}
        available={<Sum value={totals.available} />}
        goal={null}
      />

      {/* Balance row - income minus expenses */}
      <TableRow
        sx={{
          pt: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
        name={
          <div>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{
                fontWeight: 700,
                color: balanceColor,
              }}
            >
              {t('budgets:totalBalance')}
            </Typography>
          </div>
        }
        budgeted={null}
        outcome={
          <Typography
            variant="subtitle2"
            align="right"
            noWrap
            sx={{
              fontWeight: 700,
              color: balanceColor,
            }}
          >
            <DisplayAmount
              value={totals.balance}
              decMode="ifOnly"
              month={month}
              noCurrency
            />
          </Typography>
        }
        available={null}
        goal={null}
      />
    </Box>
  )
}
