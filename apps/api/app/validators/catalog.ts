import vine from '@vinejs/vine'

/**
 * Local catalog typeahead — short `q`, capped pagination for debounce-friendly clients.
 */
export const catalogSearchValidator = vine.create({
  q: vine.string().trim().maxLength(120).optional(),
  limit: vine.number().withoutDecimals().min(1).max(30).optional(),
  page: vine.number().withoutDecimals().min(1).max(100).optional(),
})

/**
 * Barcode digits only (EAN-8 … GTIN-14). Non-digits are stripped server-side after validate length.
 */
export const catalogBarcodeValidator = vine.create({
  barcode: vine
    .string()
    .trim()
    .regex(/^\d{8,14}$/)
})
