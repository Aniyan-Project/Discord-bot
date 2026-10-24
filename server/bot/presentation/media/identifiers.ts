export function mediaChoiceValue(mediaId: string): string {
  return `branilist:${mediaId}`
}
export function selectedMediaId(value: string): string | undefined {
  return /^branilist:([1-9]\d{0,19})$/.exec(value)?.[1]
}
