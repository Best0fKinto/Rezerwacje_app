import { useEffect, useState } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Reservation {
  id: number
  date: string
  time_slot: string
  table_number: string | number
  party_size: number
  status: 'pending' | 'confirmed' | 'cancelled'
  customer_name?: string
  customer_email?: string
  notes?: string
}

interface Table {
  id: number
  table_number: string | number
  capacity: number
  is_active: boolean
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled'

function statusColor(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return ''
  }
}

export default function AdminPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [actionId, setActionId] = useState<number | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [resRes, tablesRes] = await Promise.all([
          api.get('/reservations'),
          api.get('/restaurants/1/tables'),
        ])
        setReservations(resRes.data)
        setTables(tablesRes.data)
      } catch {
        setError('Failed to load admin data.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleConfirm = async (id: number) => {
    setActionId(id)
    try {
      await api.patch(`/reservations/${id}/confirm`)
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'confirmed' } : r))
      )
      toast.success('Reservation confirmed.')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to confirm')
    } finally {
      setActionId(null)
    }
  }

  const handleCancel = async (id: number) => {
    if (!window.confirm('Cancel this reservation?')) return
    setActionId(id)
    try {
      await api.patch(`/reservations/${id}/cancel`)
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
      )
      toast.success('Reservation cancelled.')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to cancel')
    } finally {
      setActionId(null)
    }
  }

  // Stats
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayReservations = reservations.filter((r) => r.date === today)
  const pendingCount = reservations.filter((r) => r.status === 'pending').length
  const confirmedCount = reservations.filter((r) => r.status === 'confirmed').length
  const cancelledCount = reservations.filter((r) => r.status === 'cancelled').length

  // Chart: last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i)
    const dayStr = format(day, 'yyyy-MM-dd')
    const count = reservations.filter((r) => r.date === dayStr).length
    return { day: format(day, 'MMM d'), count }
  })

  // Filtered reservations
  const filtered = reservations.filter(
    (r) => statusFilter === 'all' || r.status === statusFilter
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
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
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{todayReservations.length}</p>
            <p className="text-xs text-muted-foreground">reservations today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">awaiting confirmation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{confirmedCount}</p>
            <p className="text-xs text-muted-foreground">confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{cancelledCount}</p>
            <p className="text-xs text-muted-foreground">cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Reservations – Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Reservations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>All Reservations</CardTitle>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left font-medium">ID</th>
                  <th className="pb-2 text-left font-medium">Customer</th>
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-left font-medium">Time</th>
                  <th className="pb-2 text-left font-medium">Table</th>
                  <th className="pb-2 text-left font-medium">Guests</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No reservations found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">#{r.id}</td>
                      <td className="py-2 pr-4">
                        {r.customer_name || r.customer_email || '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {format(parseISO(r.date), 'MMM d, yyyy')}
                      </td>
                      <td className="py-2 pr-4">{r.time_slot}</td>
                      <td className="py-2 pr-4">Table {r.table_number}</td>
                      <td className="py-2 pr-4">{r.party_size}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${statusColor(
                            r.status
                          )}`}
                        >
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {r.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirm(r.id)}
                              disabled={actionId === r.id}
                              className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                            >
                              Confirm
                            </Button>
                          )}
                          {r.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(r.id)}
                              disabled={actionId === r.id}
                              className="h-7 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tables */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Tables</CardTitle>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <p className="text-muted-foreground">No tables found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">Table {t.table_number}</p>
                    <p className="text-xs text-muted-foreground">Capacity: {t.capacity}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={t.is_active ? 'default' : 'secondary'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Toggle coming soon</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
