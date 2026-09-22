// PNG-only wire contract shared by the offline CLI and browser runtime.
export const MAX_PNG_SIZE = 10 * 1024 * 1024
export const MAX_PNG_PIXELS = 40_000_000
export const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const signature = [137, 80, 78, 71, 13, 10, 26, 10]
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

export function validatePngBytes(bytes, path) {
  if (!bytes.length) throw new Error(`Empty PNG image: ${path}; supply a non-empty PNG`)
  if (bytes.length > MAX_PNG_SIZE) {
    throw new Error(`PNG image exceeds 10 MiB limit: ${path} (${bytes.length} bytes); optimize or exclude with --ignore`)
  }
  const corrupt = () => { throw new Error(`Corrupt or invalid PNG image: ${path}; re-export the PNG or exclude with --ignore`) }
  if (signature.some((byte, index) => bytes[index] !== byte)) corrupt()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  let header = false
  let data = false
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const end = offset + 8 + length
    if (end + 4 > bytes.length) corrupt()
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (!/^[A-Za-z]{4}$/.test(type)) corrupt()
    let crc = 0xffffffff
    for (let i = offset + 4; i < end; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8)
    if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end)) corrupt()
    if (!header && type !== 'IHDR') corrupt()
    if (type === 'IHDR') {
      if (header || length !== 13) corrupt()
      const width = view.getUint32(offset + 8)
      const height = view.getUint32(offset + 12)
      const depth = bytes[offset + 16]
      const color = bytes[offset + 17]
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }
      if (!width || !height || !depths[color]?.includes(depth) || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] > 1) corrupt()
      if (width > 16384 || height > 16384 || width * height > MAX_PNG_PIXELS) {
        throw new Error(`PNG dimensions exceed limit: ${path} (${width}×${height}); resize to at most 16384 per side and 40 million pixels`)
      }
      header = true
    }
    if (type === 'IDAT' && length) data = true
    if (type === 'IEND') {
      if (length || !data || end + 4 !== bytes.length) corrupt()
      return bytes
    }
    offset = end + 4
  }
  corrupt()
}

export function decodePng(content, path) {
  // Bound before regex/decoding: imported bundles are untrusted too.
  if (content.length > PNG_DATA_URL_PREFIX.length + 4 * Math.ceil(MAX_PNG_SIZE / 3)) {
    throw new Error(`PNG image exceeds 10 MiB limit: ${path}; optimize or exclude with --ignore`)
  }
  if (!content.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error(`PNG file requires a valid base64 data URL: ${path}`)
  }
  const base64 = content.slice(PNG_DATA_URL_PREFIX.length)
  let binary
  try {
    binary = atob(base64)
    if (btoa(binary) !== base64) throw new Error('noncanonical base64')
  } catch {
    throw new Error(`PNG file requires a valid base64 data URL: ${path}`)
  }
  return validatePngBytes(Uint8Array.from(binary, (char) => char.charCodeAt(0)), path)
}
