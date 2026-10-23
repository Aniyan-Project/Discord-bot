import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
export const randomToken = () => randomBytes(32).toString('base64url')
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex')
export function constantEqual(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
export class Vault {
  private readonly key: Buffer
  constructor(key: string) {
    if (!/^[a-f\d]{64}$/i.test(key)) throw Error('Invalid encryption key')
    this.key = Buffer.from(key, 'hex')
  }
  encrypt(value: unknown, context = ''): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    cipher.setAAD(Buffer.from(context))
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
    return [iv, cipher.getAuthTag(), data].map((v) => v.toString('base64url')).join('.')
  }
  decrypt<T>(value: string, context = ''): T {
    const [iv, tag, data, extra] = value.split('.')
    if (!iv || !tag || !data || extra) throw Error('Invalid encrypted record')
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from(context))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return JSON.parse(
      Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8'),
    ) as T
  }
}
export function canManageGuild(guild: { owner?: boolean; permissions: string }): boolean {
  try {
    const permissions = BigInt(guild.permissions)
    return guild.owner === true || (permissions & 32n) === 32n || (permissions & 8n) === 8n
  } catch {
    return false
  }
}
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code)
  }
}
export function requireOrigin(origin: string | undefined, expected: string): void {
  if (origin !== expected) throw new AppError(403, 'invalidOrigin')
}
