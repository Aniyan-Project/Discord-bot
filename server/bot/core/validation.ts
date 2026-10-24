import { z } from 'zod'
export const idSchema = z.string().regex(/^[1-9]\d{0,19}$/)
export const statusSchema = z.enum(['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'])
