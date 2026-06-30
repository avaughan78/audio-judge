import crypto from 'crypto'

// AES-256-GCM encryption for API keys stored in the database.
// To enable: set SETTINGS_ENCRYPTION_KEY to a 64-char hex string (32 bytes).
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Without this env var, values are stored as plaintext (backwards compatible).
// Existing plaintext values in the DB are still readable after the key is added —
// decrypt() recognises the 'enc1:' prefix and falls back gracefully.

const PREFIX = 'enc1:'

function getKey(): Buffer | null {
  const k = process.env.SETTINGS_ENCRYPTION_KEY
  if (!k || k.length !== 64) return null
  try { return Buffer.from(k, 'hex') } catch { return null }
}

// Stored format: "enc1:<base64(iv[12] | authTag[16] | ciphertext)>"
export function encrypt(plaintext: string): string {
  const key = getKey()
  if (!key) return plaintext  // no key configured — store as plaintext
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored  // plaintext legacy value
  const key = getKey()
  if (!key) {
    // Key was removed after values were encrypted — can't decrypt
    throw new Error('SETTINGS_ENCRYPTION_KEY is not set but stored values are encrypted')
  }
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
