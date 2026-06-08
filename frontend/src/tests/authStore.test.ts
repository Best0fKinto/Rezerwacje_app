import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'

const mockUser = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'customer' as const,
}

// Reset store state before each test by calling logout
beforeEach(() => {
  useAuthStore.getState().logout()
})

describe('authStore', () => {
  it('initial state has null user and tokens', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
  })

  it('setAuth stores user and tokens', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-token-123', 'refresh-token-456')
    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.accessToken).toBe('access-token-123')
    expect(state.refreshToken).toBe('refresh-token-456')
  })

  it('logout clears user and tokens', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-token-123', 'refresh-token-456')
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
  })

  it('setTokens updates only tokens without changing user', () => {
    useAuthStore.getState().setAuth(mockUser, 'old-access', 'old-refresh')
    useAuthStore.getState().setTokens('new-access', 'new-refresh')
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('new-access')
    expect(state.refreshToken).toBe('new-refresh')
    expect(state.user).toEqual(mockUser)
  })
})
