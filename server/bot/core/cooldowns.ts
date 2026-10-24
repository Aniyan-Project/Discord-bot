export class Cooldowns {
  private readonly entries = new Map<string, number>()
  check(key: string, seconds: number, now = Date.now()): number {
    const until = this.entries.get(key) ?? 0
    if (until > now) return Math.ceil((until - now) / 1000)
    if (this.entries.size > 10000) for (const [k, v] of this.entries) if (v <= now) this.entries.delete(k)
    this.entries.set(key, now + seconds * 1000)
    return 0
  }
}
