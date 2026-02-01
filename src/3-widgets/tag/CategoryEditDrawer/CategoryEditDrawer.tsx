import React, { FC, useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Divider,
  Button,
  Stack,
  Drawer,
  IconButton,
  ButtonBase,
  MenuItem,
  Select,
  SelectChangeEvent,
  Radio,
  RadioGroup,
  FormLabel,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useAppDispatch } from 'store'
import { TTagId, TFxCode, TInstrumentId, TTag } from '6-shared/types'
import { tagModel, TTagPopulated } from '5-entities/tag'
import {
  envelopeModel,
  EnvType,
  TCategoryType,
} from '5-entities/envelope'

// Use TTag's icon type for proper type checking
type TIconName = TTag['icon']
import {
  setTagComment,
  setTagCurrency,
  getMetaForTag,
} from '5-entities/old-hiddenData/tagMeta'
import { useAppSelector } from 'store'
import { useConfirm } from '6-shared/ui/SmartConfirm'
import { useColorPicker, ColorPicker } from '6-shared/ui/ColorPickerPopover'
import { useIconPicker, IconPicker } from './IconPickerPopover'
import { instrumentModel } from '5-entities/currency/instrument'
import { userModel } from '5-entities/user'
import { accountModel } from '5-entities/account'
import { int2hex, hex2int } from '6-shared/helpers/color'
import tagIcons from '6-shared/tagIcons.json'

// Helper to convert between TFxCode and TInstrumentId
const useInstrumentIdByCode = () => {
  const instruments = instrumentModel.useInstrumentsByCode()
  return useCallback(
    (code: TFxCode | null): TInstrumentId | undefined => {
      if (!code) return undefined
      return instruments[code]?.id
    },
    [instruments]
  )
}

const useFxCodeById = () => {
  const instCodeMap = useAppSelector(instrumentModel.getInstCodeMap)
  return useCallback(
    (id: TInstrumentId | undefined): TFxCode | null => {
      if (id === undefined) return null
      return instCodeMap[id] || null
    },
    [instCodeMap]
  )
}

// Simple currency select component
type CurrencySelectProps = {
  value: TFxCode | null
  onChange: (value: TFxCode | null) => void
  disabled?: boolean
}

const CurrencySelect: FC<CurrencySelectProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const instrumentsByCode = instrumentModel.useInstrumentsByCode()
  const userCurrency = userModel.useUserCurrency()
  const accs = accountModel.useInBudgetAccounts()

  const fxSet = new Set(accs.map(a => a.fxCode))
  fxSet.add(userCurrency)
  if (value) fxSet.add(value)
  const codes = [...fxSet]

  return (
    <Select
      value={value || ''}
      onChange={(e: SelectChangeEvent<string>) =>
        onChange(e.target.value || null)
      }
      disabled={disabled}
      fullWidth
      size="small"
      displayEmpty
    >
      <MenuItem value="">
        <em>—</em>
      </MenuItem>
      {codes.map(code => {
        const instr = instrumentsByCode[code]
        return (
          <MenuItem key={code} value={code}>
            {code} {instr ? `(${instr.title})` : ''}
          </MenuItem>
        )
      })}
    </Select>
  )
}

type CategoryEditDrawerProps = {
  tagId?: TTagId
  open: boolean
  onClose: () => void
}

export const CategoryEditDrawer: FC<CategoryEditDrawerProps> = ({
  tagId,
  open,
  onClose,
}) => {
  const { t } = useTranslation('categoryEditor')
  const dispatch = useAppDispatch()

  const tags = tagModel.usePopulatedTags()
  const tag = tagId ? tags[tagId] : null
  const isNew = !tag

  const tagMeta = useAppSelector(state =>
    tagId ? getMetaForTag(tagId)(state) : {}
  )

  // Get envelope data for categoryType
  const envelopes = envelopeModel.useEnvelopes()
  const envelopeId = tagId ? envelopeModel.makeId(EnvType.Tag, tagId) : null
  const envelope = envelopeId ? envelopes[envelopeId] : null

  // Currency converters
  const getInstrumentId = useInstrumentIdByCode()
  const getFxCode = useFxCodeById()

  // Compute saved currency once from tagMeta (stable reference for useEffect)
  const savedCurrency = useMemo(
    () => getFxCode(tagMeta.currency),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tagMeta.currency]
  )

  // Check if tag has children
  const hasChildren = tag
    ? Object.values(tags).some(t => t.parent === tagId)
    : false

  // Get available parent tags (only top-level tags that don't have this tag as parent)
  const availableParents = Object.values(tags).filter(
    t => t.parent === null && t.id !== tagId
  )

  // Form state
  const [isEditing, setIsEditing] = useState(isNew)
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [parent, setParent] = useState<TTagId | null>(null)
  const [showIncome, setShowIncome] = useState(true)
  const [showOutcome, setShowOutcome] = useState(true)
  const [budgetIncome, setBudgetIncome] = useState(false)
  const [budgetOutcome, setBudgetOutcome] = useState(true)
  const [comment, setComment] = useState('')
  const [currency, setCurrency] = useState<TFxCode | null>(null)
  const [categoryType, setCategoryType] = useState<TCategoryType>('expense')

  // Reset form when tag changes (use tagId instead of tag object to avoid infinite loop)
  useEffect(() => {
    if (tag) {
      setTitle(tag.title)
      setIcon(tag.icon)
      setColor(tag.color ? int2hex(tag.color) : null)
      setParent(tag.parent)
      setShowIncome(tag.showIncome)
      setShowOutcome(tag.showOutcome)
      setBudgetIncome(tag.budgetIncome)
      setBudgetOutcome(tag.budgetOutcome)
      setComment(tagMeta.comment || '')
      setCurrency(savedCurrency)
      setCategoryType(envelope?.categoryType || 'expense')
      setIsEditing(false)
    } else {
      // New category defaults
      setTitle('')
      setIcon(null)
      setColor(null)
      setParent(null)
      setShowIncome(true)
      setShowOutcome(true)
      setBudgetIncome(false)
      setBudgetOutcome(true)
      setComment('')
      setCurrency(null)
      setCategoryType('expense')
      setIsEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId, open])

  const hasChanges = useCallback(() => {
    if (!tag) return title.trim().length > 0
    return (
      title !== tag.title ||
      icon !== tag.icon ||
      color !== (tag.color ? int2hex(tag.color) : null) ||
      parent !== tag.parent ||
      showIncome !== tag.showIncome ||
      showOutcome !== tag.showOutcome ||
      budgetIncome !== tag.budgetIncome ||
      budgetOutcome !== tag.budgetOutcome ||
      comment !== (tagMeta.comment || '') ||
      currency !== savedCurrency ||
      categoryType !== (envelope?.categoryType || 'expense')
    )
  }, [
    title,
    icon,
    color,
    parent,
    showIncome,
    showOutcome,
    budgetIncome,
    budgetOutcome,
    comment,
    currency,
    tag,
    tagMeta.comment,
    savedCurrency,
    categoryType,
    envelope?.categoryType,
  ])

  const handleSave = () => {
    if (!title.trim()) return

    // Convert currency code to instrument ID for saving
    const currencyInstrumentId = getInstrumentId(currency)

    if (tag) {
      // Update existing tag
      dispatch(
        tagModel.patchTag({
          id: tag.id,
          title: title.trim(),
          icon: icon as TIconName | null,
          color: color ? hex2int(color) : null,
          parent,
          showIncome,
          showOutcome,
          budgetIncome,
          budgetOutcome,
        })
      )

      // Update meta
      if (comment !== (tagMeta.comment || '')) {
        dispatch(setTagComment(tag.id, comment || undefined))
      }
      if (currency !== savedCurrency) {
        dispatch(setTagCurrency(tag.id, currencyInstrumentId))
      }
      // Update envelope categoryType
      if (envelopeId && categoryType !== (envelope?.categoryType || 'expense')) {
        dispatch(envelopeModel.patchEnvelope({ id: envelopeId, categoryType }))
      }
    } else {
      // Create new tag
      const newTags = dispatch(
        tagModel.createTag({
          title: title.trim(),
          icon: icon as TIconName | null,
          color: color ? hex2int(color) : null,
          parent,
          showIncome,
          showOutcome,
          budgetIncome,
          budgetOutcome,
        })
      )

      // Set meta for new tag
      if (newTags[0]) {
        if (comment) {
          dispatch(setTagComment(newTags[0].id, comment))
        }
        if (currency) {
          dispatch(setTagCurrency(newTags[0].id, currencyInstrumentId))
        }
        // Set categoryType for new envelope
        if (categoryType !== 'expense') {
          const newEnvelopeId = envelopeModel.makeId(EnvType.Tag, newTags[0].id)
          dispatch(
            envelopeModel.patchEnvelope({ id: newEnvelopeId, categoryType })
          )
        }
      }
    }

    setIsEditing(false)
    if (isNew) onClose()
  }

  const handleDelete = () => {
    if (tag) {
      dispatch(tagModel.deleteTag(tag.id))
      onClose()
    }
  }

  const showDeleteConfirm = useConfirm({
    title: t('deleteConfirmTitle'),
    description: t('deleteConfirmDescription'),
    okText: t('deleteConfirmOk'),
    okColor: 'error',
    onOk: handleDelete,
  })

  const handleCancel = () => {
    if (isNew) {
      onClose()
    } else {
      // Reset to original values
      if (tag) {
        setTitle(tag.title)
        setIcon(tag.icon)
        setColor(tag.color ? int2hex(tag.color) : null)
        setParent(tag.parent)
        setShowIncome(tag.showIncome)
        setShowOutcome(tag.showOutcome)
        setBudgetIncome(tag.budgetIncome)
        setBudgetOutcome(tag.budgetOutcome)
        setComment(tagMeta.comment || '')
        setCurrency(savedCurrency)
        setCategoryType(envelope?.categoryType || 'expense')
      }
      setIsEditing(false)
    }
  }

  const openColorPicker = useColorPicker(color, setColor)
  const openIconPicker = useIconPicker(icon, setIcon)

  // Get display emoji/icon
  const displayIcon = icon
    ? (tagIcons as Record<string, string>)[icon] || icon
    : '📁'

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      keepMounted={false}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100vw', sm: 400 },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6">
          {isNew ? t('createTitle') : isEditing ? t('editTitle') : t('viewTitle')}
        </Typography>
        <IconButton onClick={onClose} edge="end">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, pb: 4, overflow: 'auto', flex: 1 }}>
        {/* Icon and Color Row */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              {t('fieldIcon')}
            </Typography>
            <ButtonBase
              onClick={isEditing ? openIconPicker : undefined}
              disabled={!isEditing}
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'action.hover',
                fontSize: 28,
                border: 1,
                borderColor: 'divider',
                '&:hover': isEditing ? { bgcolor: 'action.selected' } : {},
              }}
            >
              {displayIcon}
            </ButtonBase>
          </Box>

          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              {t('fieldColor')}
            </Typography>
            <ButtonBase
              onClick={isEditing ? openColorPicker : undefined}
              disabled={!isEditing}
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: color || 'action.hover',
                border: 1,
                borderColor: 'divider',
                '&:hover': isEditing ? { opacity: 0.8 } : {},
              }}
            />
          </Box>
        </Stack>

        {/* Name */}
        <TextField
          label={t('fieldName')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          fullWidth
          size="small"
          disabled={!isEditing}
          error={isEditing && !title.trim()}
          helperText={isEditing && !title.trim() ? t('fieldNameError') : ''}
          sx={{ mb: 2 }}
        />

        {/* Parent Category */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.5 }}
          >
            {t('fieldParent')}
          </Typography>
          {hasChildren ? (
            <Typography variant="body2" color="text.disabled">
              {t('fieldParentDisabled')}
            </Typography>
          ) : (
            <Select
              value={parent || ''}
              onChange={(e: SelectChangeEvent<string>) =>
                setParent(e.target.value || null)
              }
              disabled={!isEditing}
              fullWidth
              size="small"
              displayEmpty
            >
              <MenuItem value="">
                <em>{t('fieldParentNone')}</em>
              </MenuItem>
              {availableParents.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  {t.symbol} {t.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Visibility */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Visibility
        </Typography>
        <Stack spacing={0} sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showIncome}
                onChange={e => setShowIncome(e.target.checked)}
                disabled={!isEditing}
              />
            }
            label={t('fieldShowIncome')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showOutcome}
                onChange={e => setShowOutcome(e.target.checked)}
                disabled={!isEditing}
              />
            }
            label={t('fieldShowOutcome')}
          />
        </Stack>

        {/* Budget */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Budget
        </Typography>
        <Stack spacing={0} sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={budgetIncome}
                onChange={e => setBudgetIncome(e.target.checked)}
                disabled={!isEditing}
              />
            }
            label={t('fieldBudgetIncome')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={budgetOutcome}
                onChange={e => setBudgetOutcome(e.target.checked)}
                disabled={!isEditing}
              />
            }
            label={t('fieldBudgetOutcome')}
          />
        </Stack>

        {/* Category Type */}
        <Box sx={{ mb: 2 }}>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            {t('fieldCategoryType')}
          </FormLabel>
          <RadioGroup
            value={categoryType}
            onChange={e => setCategoryType(e.target.value as TCategoryType)}
            row
          >
            <FormControlLabel
              value="expense"
              control={<Radio disabled={!isEditing} />}
              label={t('fieldCategoryTypeExpense')}
            />
            <FormControlLabel
              value="income"
              control={<Radio disabled={!isEditing} />}
              label={t('fieldCategoryTypeIncome')}
            />
          </RadioGroup>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Comment */}
        <TextField
          label={t('fieldComment')}
          value={comment}
          onChange={e => setComment(e.target.value)}
          fullWidth
          size="small"
          disabled={!isEditing}
          multiline
          rows={2}
          sx={{ mb: 2 }}
        />

        {/* Currency */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.5 }}
          >
            {t('fieldCurrency')}
          </Typography>
          <CurrencySelect
            value={currency}
            onChange={setCurrency}
            disabled={!isEditing}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
        }}
      >
        {isEditing ? (
          <>
            <Button variant="outlined" onClick={handleCancel} sx={{ flex: 1 }}>
              {t('btnCancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!title.trim() || !hasChanges()}
              sx={{ flex: 1 }}
            >
              {isNew ? t('btnCreate') : t('btnSave')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              color="error"
              onClick={showDeleteConfirm}
              disabled={hasChildren}
              title={hasChildren ? t('hasChildrenError') : ''}
            >
              {t('btnDelete')}
            </Button>
            <Button
              variant="contained"
              onClick={() => setIsEditing(true)}
              sx={{ flex: 1 }}
            >
              {t('btnEdit')}
            </Button>
          </>
        )}
      </Box>

      {/* Pickers */}
      <ColorPicker />
      <IconPicker />
    </Drawer>
  )
}
