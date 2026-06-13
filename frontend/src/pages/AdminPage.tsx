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
  Cell,
} from 'recharts'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TableOptimizationStats {
  table_id: number
  table_number: string
  capacity: number
  is_active: boolean
  total_reservations: number
  confirmed_reservations: number
  avg_party_size: number
  avg_waste: number
  utilization_pct: number
}

interface OptimizationRecommendation {
  level: 'info' | 'warning' | 'danger'
  message: string
}

interface OptimizationData {
  window_days: number
  table_stats: TableOptimizationStats[]
  party_size_distribution: Record<string, number>
  recommendations: OptimizationRecommendation[]
}

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
  table_number: string
  capacity: number
  is_active: boolean
}

interface TableFormState {
  number: string
  capacity: string
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

  // Table management state
  const [showAddTable, setShowAddTable] = useState(false)
  const [addForm, setAddForm] = useState<TableFormState>({ number: '', capacity: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [editForm, setEditForm] = useState<TableFormState>({ number: '', capacity: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [tableActionId, setTableActionId] = useState<number | null>(null)

  // Optimization state
  const [optimizationData, setOptimizationData] = useState<OptimizationData | null>(null)
  const [optimizationLoading, setOptimizationLoading] = useState(false)
  const [showOptimization, setShowOptimization] = useState(false)

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

  const handleToggleTable = async (table: Table) => {
    setTableActionId(table.id)
    try {
      const { data } = await api.patch(`/tables/${table.id}/toggle`, { is_active: !table.is_active })
      setTables((prev) => prev.map((t) => (t.id === table.id ? data : t)))
      toast.success(`Table ${table.table_number} ${data.is_active ? 'activated' : 'deactivated'}.`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to toggle table ;(')
    } finally {
      setTableActionId(null)
    }
  }

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.number.trim() || !addForm.capacity) return
    setAddLoading(true)
    try {
      const { data } = await api.post('/restaurants/1/tables', {
        number: addForm.number.trim(),
        capacity: parseInt(addForm.capacity),
      })
      setTables((prev) => [...prev, data])
      setAddForm({ number: '', capacity: '' })
      setShowAddTable(false)
      toast.success(`Table ${data.table_number} added.`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to add table')
    } finally {
      setAddLoading(false)
    }
  }

  const handleEditTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTable) return
    setEditLoading(true)
    try {
      const { data } = await api.patch(`/tables/${editingTable.id}`, {
        number: editForm.number.trim() || undefined,
        capacity: editForm.capacity ? parseInt(editForm.capacity) : undefined,
      })
      setTables((prev) => prev.map((t) => (t.id === editingTable.id ? data : t)))
      setEditingTable(null)
      toast.success(`Table ${data.table_number} updated.`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update table')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteTable = async (table: Table) => {
    if (!window.confirm(`Delete table ${table.table_number}? This cannot be undone.`)) return
    setTableActionId(table.id)
    try {
      await api.delete(`/tables/${table.id}`)
      setTables((prev) => prev.filter((t) => t.id !== table.id))
      toast.success(`Table ${table.table_number} deleted.`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete table')
    } finally {
      setTableActionId(null)
    }
  }

  const openEdit = (table: Table) => {
    setEditingTable(table)
    setEditForm({ number: table.table_number, capacity: String(table.capacity) })
  }

  const fetchOptimization = async () => {
    setOptimizationLoading(true)
    try {
      const { data } = await api.get('/restaurants/1/optimization')
      setOptimizationData(data)
      setShowOptimization(true)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load optimization data')
    } finally {
      setOptimizationLoading(false)
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Restaurant Tables</CardTitle>
            <Button size="sm" onClick={() => { setShowAddTable((v) => !v); setAddForm({ number: '', capacity: '' }) }}>
              {showAddTable ? 'Cancel' : '+ Add Table'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add table form */}
          {showAddTable && (
            <form onSubmit={handleAddTable} className="flex flex-wrap items-end gap-3 rounded-lg border p-4 bg-muted/40">
              <div className="space-y-1">
                <Label htmlFor="add-number">Table number</Label>
                <Input
                  id="add-number"
                  placeholder="e.g. 11"
                  value={addForm.number}
                  onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))}
                  className="w-32"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-capacity">Capacity</Label>
                <Input
                  id="add-capacity"
                  type="number"
                  min={1}
                  placeholder="e.g. 4"
                  value={addForm.capacity}
                  onChange={(e) => setAddForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="w-28"
                  required
                />
              </div>
              <Button type="submit" disabled={addLoading}>
                {addLoading ? 'Adding…' : 'Add'}
              </Button>
            </form>
          )}

          {/* Edit table form */}
          {editingTable && (
            <form onSubmit={handleEditTable} className="flex flex-wrap items-end gap-3 rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
              <p className="w-full text-sm font-medium text-muted-foreground">
                Editing Table {editingTable.table_number}
              </p>
              <div className="space-y-1">
                <Label htmlFor="edit-number">Table number</Label>
                <Input
                  id="edit-number"
                  value={editForm.number}
                  onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
                  className="w-32"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-capacity">Capacity</Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  min={1}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="w-28"
                />
              </div>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingTable(null)}>
                Cancel
              </Button>
            </form>
          )}

          {tables.length === 0 ? (
            <p className="text-muted-foreground">No tables found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${!t.is_active ? 'opacity-50' : ''}`}
                >
                  <div>
                    <p className="font-medium">Table {t.table_number}</p>
                    <p className="text-xs text-muted-foreground">Capacity: {t.capacity}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={t.is_active ? 'default' : 'secondary'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="flex gap-1 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => openEdit(t)}
                        disabled={tableActionId === t.id}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-6 px-2 text-xs ${t.is_active ? 'text-yellow-700 border-yellow-300 hover:bg-yellow-50' : 'text-green-700 border-green-300 hover:bg-green-50'}`}
                        onClick={() => handleToggleTable(t)}
                        disabled={tableActionId === t.id}
                      >
                        {t.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => handleDeleteTable(t)}
                        disabled={tableActionId === t.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Optimization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Table Placement Optimization</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Analyse how well your table configuration matches actual demand.
              </p>
            </div>
            <Button
              onClick={showOptimization ? () => setShowOptimization(false) : fetchOptimization}
              disabled={optimizationLoading}
              variant={showOptimization ? 'outline' : 'default'}
            >
              {optimizationLoading ? 'Analysing…' : showOptimization ? 'Hide Analysis' : 'Run Analysis'}
            </Button>
          </div>
        </CardHeader>
        {showOptimization && optimizationData && (
          <CardContent className="space-y-6">
            {/* Recommendations */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Recommendations (±{optimizationData.window_days} days)</h3>
              {optimizationData.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${
                    rec.level === 'danger'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : rec.level === 'warning'
                      ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                      : 'border-blue-200 bg-blue-50 text-blue-800'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {rec.level === 'danger' ? '🔴' : rec.level === 'warning' ? '🟡' : 'ℹ️'}
                  </span>
                  <span>{rec.message}</span>
                </div>
              ))}
            </div>

            {/* Utilisation chart */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Table Utilisation (confirmed bookings)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={optimizationData.table_stats.map((t) => ({
                    name: `T${t.table_number}`,
                    utilization: t.utilization_pct,
                    confirmed: t.confirmed_reservations,
                    capacity: t.capacity,
                  }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'utilization') return [`${value}%`, 'Utilisation']
                      return [value, name]
                    }}
                  />
                  <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
                    {optimizationData.table_stats.map((t, index) => (
                      <Cell
                        key={index}
                        fill={
                          t.utilization_pct >= 70
                            ? '#16a34a'
                            : t.utilization_pct >= 30
                            ? 'hsl(var(--primary))'
                            : '#d97706'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Party size distribution vs table capacities */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Party Size Distribution vs Table Capacities</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs text-muted-foreground mb-2">Demand (party sizes)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={Object.entries(optimizationData.party_size_distribution)
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([size, count]) => ({ size: `${size}p`, count }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="size" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs text-muted-foreground mb-2">Supply (table capacities)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={(() => {
                        const dist: Record<string, number> = {}
                        optimizationData.table_stats.forEach((t) => {
                          const key = `${t.capacity}p`
                          dist[key] = (dist[key] || 0) + 1
                        })
                        return Object.entries(dist)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([cap, count]) => ({ cap, count }))
                      })()}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="cap" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Per-table detail table */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Per-Table Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Table</th>
                      <th className="pb-2 text-left font-medium">Capacity</th>
                      <th className="pb-2 text-left font-medium">Confirmed</th>
                      <th className="pb-2 text-left font-medium">Avg party</th>
                      <th className="pb-2 text-left font-medium">Avg wasted seats</th>
                      <th className="pb-2 text-left font-medium">Utilisation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationData.table_stats.map((t) => (
                      <tr key={t.table_id} className={`border-b last:border-0 ${!t.is_active ? 'opacity-50' : ''}`}>
                        <td className="py-2 pr-4 font-medium">
                          Table {t.table_number}
                          {!t.is_active && <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>}
                        </td>
                        <td className="py-2 pr-4">{t.capacity}</td>
                        <td className="py-2 pr-4">{t.confirmed_reservations}</td>
                        <td className="py-2 pr-4">{t.confirmed_reservations > 0 ? t.avg_party_size : '—'}</td>
                        <td className="py-2 pr-4">{t.confirmed_reservations > 0 ? t.avg_waste : '—'}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(t.utilization_pct, 100)}%`,
                                  background:
                                    t.utilization_pct >= 70 ? '#16a34a' : t.utilization_pct >= 30 ? 'hsl(var(--primary))' : '#d97706',
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{t.utilization_pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
