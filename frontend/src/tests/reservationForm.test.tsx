import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock the api module before importing the component
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock authStore with a logged-in customer user
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      email: 'customer@example.com',
      full_name: 'Test Customer',
      role: 'customer',
    },
    accessToken: 'mock-token',
    refreshToken: 'mock-refresh',
    setAuth: vi.fn(),
    logout: vi.fn(),
  }),
}))

import NewReservationPage from '@/pages/NewReservationPage'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NewReservationPage', () => {
  it('renders the "Select Date" heading on the first step', () => {
    render(
      <MemoryRouter>
        <NewReservationPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Select Date')).toBeInTheDocument()
  })

  it('renders the step indicator with 5 steps', () => {
    render(
      <MemoryRouter>
        <NewReservationPage />
      </MemoryRouter>
    )
    // Steps 1–5 should be present as numbered buttons in the indicator
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders the date input on step 1', () => {
    render(
      <MemoryRouter>
        <NewReservationPage />
      </MemoryRouter>
    )
    const dateInput = screen.getByLabelText('Reservation Date')
    expect(dateInput).toBeInTheDocument()
    expect(dateInput).toHaveAttribute('type', 'date')
  })

  it('Next button is disabled when no date is selected', () => {
    render(
      <MemoryRouter>
        <NewReservationPage />
      </MemoryRouter>
    )
    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toBeDisabled()
  })
})
