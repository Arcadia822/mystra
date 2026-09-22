export const MAX_PNG_SIZE: number
export const MAX_PNG_PIXELS: number
export const PNG_DATA_URL_PREFIX: string
export function validatePngBytes(bytes: Uint8Array, path: string): Uint8Array<ArrayBuffer>
export function decodePng(content: string, path: string): Uint8Array<ArrayBuffer>
