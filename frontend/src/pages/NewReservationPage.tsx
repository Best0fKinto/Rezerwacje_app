import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AvailableSlot {
  table_id: number
  table_number: string | number
  time: string
}

interface CreatedReservation {
  id: number
  date: string
  time: string
  table_number: string | number
  party_size: number
  notes?: string
}

const STEPS = ['Select Date', 'Party Size', 'Choose Time', 'Confirm', 'Done']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              i < current
                ? 'bg-primary text-primary-foreground'
                : i === current
                ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-6 ${i < current ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function NewReservationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdReservation, setCreatedReservation] = useState<CreatedReservation | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  const fetchSlots = async () => {
    setLoadingSlots(true)
    try {
      const res = await api.get(
        `/restaurants/1/availability?date=${selectedDate}&party_size=${partySize}`
      )
      // API returns { date, party_size, slots: [{ table_id, table_number, capacity, available_slots: [] }] }
      // flatten into one entry per (table, time)
      const flat: AvailableSlot[] = []
      for (const t of res.data.slots ?? []) {
        for (const time of t.available_slots ?? []) {
          flat.push({ table_id: t.table_id, table_number: t.table_number, time })
        }
      }
      setAvailableSlots(flat)
    } catch {
      toast.error('Failed to fetch available slots')
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 1) {
      await fetchSlots()
    }
    setCurrentStep((s) => s + 1)
  }

  const handleBack = () => {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedTableId(slot.table_id)
    setSelectedSlot(slot)
  }

  const handleSubmit = async () => {
    if (!selectedSlot) return
    setSubmitting(true)
    try {
      const res = await api.post('/reservations', {
        date: selectedDate,
        time_slot: selectedSlot.time,
        table_id: selectedSlot.table_id,
        party_size: partySize,
        notes: notes || undefined,
      })
      setCreatedReservation({
        id: res.data.id,
        date: res.data.date,
        time: res.data.time_slot ?? selectedSlot.time,
        table_number: selectedSlot.table_number,
        party_size: res.data.party_size ?? partySize,
        notes: res.data.notes,
      })
      setCurrentStep(4)
    } catch (error: any) {
      const message =
        error.response?.data?.detail || error.response?.data?.message || 'Failed to create reservation'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  // Group slots by table
  const slotsByTable: Record<string, AvailableSlot[]> = {}
  for (const slot of availableSlots) {
    const key = `Table ${slot.table_number}`
    if (!slotsByTable[key]) slotsByTable[key] = []
    slotsByTable[key].push(slot)
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-bold">Book a Table</h1>
      <StepIndicator current={currentStep} />

      {/* Step 0: Date */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Reservation Date</Label>
              <Input
                id="date"
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => setCurrentStep(1)}
              disabled={!selectedDate}
            >
              Next
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Party Size */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Party Size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partySize">How many guests?</Label>
              <Input
                id="partySize"
                type="number"
                min={1}
                max={10}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Between 1 and 10 guests</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleNext}
                disabled={partySize < 1 || partySize > 10}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Time Slot */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Time Slot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSlots ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-primary/10" />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-muted-foreground">
                No available slots for this date and party size.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(slotsByTable).map(([tableName, slots]) => (
                  <div key={tableName}>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">{tableName}</p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <button
                          key={`${slot.table_id}-${slot.time}`}
                          onClick={() => handleSlotSelect(slot)}
                          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                            selectedTableId === slot.table_id && selectedSlot?.time === slot.time
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setCurrentStep(3)}
                disabled={!selectedSlot}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Notes + Confirm */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm Reservation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {selectedDate ? format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{selectedSlot?.time ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Table</span>
                <span className="font-medium">
                  {selectedSlot ? `Table ${selectedSlot.table_number}` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guests</span>
                <span className="font-medium">{partySize}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Any special requests or dietary requirements?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success */}
      {currentStep === 4 && createdReservation && (
        <Card>
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold">Reservation Created!</h2>
            <p className="text-muted-foreground">
              Your table has been booked. See you there!
            </p>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booking ID</span>
                <span className="font-medium">#{createdReservation.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {format(new Date(createdReservation.date + 'T00:00:00'), 'MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{createdReservation.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Table</span>
                <span className="font-medium">Table {createdReservation.table_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guests</span>
                <span className="font-medium">{createdReservation.party_size}</span>
              </div>
              {createdReservation.notes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notes</span>
                  <span className="font-medium">{createdReservation.notes}</span>
                </div>
              )}
            </div>
            <Button asChild className="w-full">
              <Link to="/reservations/my">View My Reservations</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
