import React, { FC } from 'react'
import { Box, Typography, IconButton, Collapse } from '@mui/material'
import { ChevronDownIcon, ChevronRightIcon } from '6-shared/ui/Icons'
import { TFxAmount, TISOMonth } from '6-shared/types'
import { TableRow } from './shared/shared'
import { displayCurrency } from '5-entities/currency/displayCurrency'
import { Amount } from '6-shared/ui/Amount'

type SectionHeaderProps = {
  title: string
  budgeted: TFxAmount
  activity: TFxAmount
  available: TFxAmount
  month: TISOMonth
  isExpanded: boolean
  onToggle: () => void
  isIncome?: boolean
}

export const SectionHeader: FC<SectionHeaderProps> = ({
  title,
  budgeted,
  activity,
  available,
  month,
  isExpanded,
  onToggle,
  isIncome = false,
}) => {
  const toDisplay = displayCurrency.useToDisplay(month)

  const Sum: FC<{ value: number; positive?: boolean }> = ({
    value,
    positive,
  }) => (
    <Typography
      variant="subtitle2"
      align="right"
      noWrap
      sx={{
        fontWeight: 700,
        color: positive
          ? 'success.main'
          : value < 0
            ? 'error.main'
            : 'text.secondary',
      }}
    >
      <Amount value={value} decMode="ifOnly" />
    </Typography>
  )

  const activityValue = toDisplay(activity)

  return (
    <TableRow
      sx={{
        py: 1.5,
        px: 2,
        bgcolor: isIncome ? 'success.50' : 'background.default',
        borderBottom: `1px solid`,
        borderColor: 'divider',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: isIncome ? 'success.100' : 'action.hover',
        },
      }}
      onClick={onToggle}
      name={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <IconButton size="small" sx={{ p: 0 }}>
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: isIncome ? 'success.dark' : 'text.primary',
            }}
          >
            {title}
          </Typography>
        </Box>
      }
      budgeted={<Sum value={toDisplay(budgeted)} />}
      outcome={<Sum value={activityValue} positive={isIncome && activityValue > 0} />}
      available={<Sum value={toDisplay(available)} />}
      goal={null}
    />
  )
}
