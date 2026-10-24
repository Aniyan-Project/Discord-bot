import type { Locale } from '../../../shared/domain.js'
import { hasMessage, t } from '../../../shared/i18n.js'
import { AppError } from '../../security.js'
export function errorMessage(error: unknown, locale: Locale): string {
  if (error instanceof AppError && error.code.startsWith('cooldown:'))
    return t(locale, 'cooldownError', { seconds: error.code.split(':')[1]! })
  return t(locale, error instanceof AppError && hasMessage(error.code) ? error.code : 'requestFailed')
}
