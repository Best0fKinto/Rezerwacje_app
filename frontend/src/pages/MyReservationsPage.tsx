import { useEffect, useState } from 'react'
import { format, isAfter } from 'date-fns'
import { toast } from 'sonner'
import { CalendarX } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Reservation {
  id: number
  date: string
  time_slot: string
  table_number: string | number
  party_size: number
  status: 'pending' | 'confirmed' | 'cancelled'
  notes?: string
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' | undefined {
  switch (status) {
    case 'confirmed':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'cancelled':
      return 'destructive'
    default:
      return 'outline'
  }
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function isCancellable(reservation: Reservation): boolean {
  if (reservation.status === 'cancelled') return false
  const dt = new Date(`${reservation.date}T${reservation.time_slot}`)
  return isAfter(dt, new Date())
}

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setLoading(true)
        const res = await api.get('/reservations/my')
        setReservations(res.data)
      } catch {
        setError('Failed to load reservations.')
      } finally {
        setLoading(false)
      }
    }
    fetchReservations()
  }, [])

  const handleCancel = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return
    setCancellingId(id)
    try {
      await api.patch(`/reservations/${id}/cancel`)
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
      )
      toast.success('Reservation cancelled.')
    } catch (error: any) {
      const message =
        error.response?.data?.detail || error.response?.data?.message || 'Failed to cancel'
      toast.error(message)
    } finally {
      setCancellingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Reservations</h1>

      {reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="60" cy="60" r="50" fill="#f1f5f9" />
            <CalendarX
              x="35"
              y="35"
              width="50"
              height="50"
              className="text-muted-foreground"
              color="#94a3b8"
            />
          </svg>
          <h2 className="text-xl font-semibold">No reservations yet</h2>
          <p className="text-muted-foreground">
            You haven't made any reservations. Book a table to get started!
          </p>
          <Button asChild>
            <a href="/reservations/new">Book a Table</a>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {format(new Date(r.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')} at {r.time_slot}
                  </CardTitle>
                  <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Table {r.table_number}</span>
                  <span>
                    {r.party_size} guest{r.party_size !== 1 ? 's' : ''}
                  </span>
                  {r.notes && <span className="italic">"{r.notes}"</span>}
                </div>
                {isCancellable(r) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(r.id)}
                    disabled={cancellingId === r.id}
                  >
                    {cancellingId === r.id ? 'Cancelling...' : 'Cancel'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
