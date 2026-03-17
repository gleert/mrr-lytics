/**
 * Stores "known accounts" in localStorage so the user can quickly
 * switch between previously-used accounts (Google-style account picker).
 *
 * Only display data is persisted -- no tokens or secrets.
 */

const STORAGE_KEY = 'mrrlytics-known-accounts'
const MAX_ACCOUNTS = 5

export interface KnownAccount {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  provider: string // 'google' | 'email' | etc.
  lastUsed: number // timestamp
}

export function getKnownAccounts(): KnownAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.sort((a: KnownAccount, b: KnownAccount) => b.lastUsed - a.lastUsed)
  } catch {
    return []
  }
}

export function addKnownAccount(account: Omit<KnownAccount, 'lastUsed'>): void {
  try {
    const accounts = getKnownAccounts()
    const existing = accounts.findIndex(a => a.id === account.id)

    const entry: KnownAccount = {
      ...account,
      lastUsed: Date.now(),
    }

    if (existing >= 0) {
      accounts[existing] = { ...accounts[existing], ...entry }
    } else {
      accounts.unshift(entry)
    }

    const trimmed = accounts.slice(0, MAX_ACCOUNTS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Ignore storage errors
  }
}

export function removeKnownAccount(id: string): void {
  try {
    const accounts = getKnownAccounts().filter(a => a.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // Ignore storage errors
  }
}

export function clearKnownAccounts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}
