import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, MapPin, Phone, Clock, Users } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Restaurant {
  id: number
  name: string
  address: string
  phone: string
  open_time: string
  close_time: string
  description?: string
}

interface Reservation {
  id: number
  date: string
  time_slot: string
  status: string
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [upcomingCount, setUpcomingCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [restaurantsRes, reservationsRes] = await Promise.all([
          api.get('/restaurants'),
          api.get('/reservations/my'),
        ])

        const restaurants: Restaurant[] = restaurantsRes.data
        if (restaurants.length > 0) {
          setRestaurant(restaurants[0])
        }

        const reservations: Reservation[] = reservationsRes.data
        const now = new Date()
        const upcoming = reservations.filter((r) => {
          const reservationDate = new Date(`${r.date}T${r.time_slot}`)
          return reservationDate > now && r.status !== 'cancelled'
        })
        setUpcomingCount(upcoming.length)
      } catch {
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
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
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.full_name}!</h1>
        <p className="mt-1 text-muted-foreground">
          Ready to book your next dining experience?
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Restaurant Info Card */}
        {restaurant ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{restaurant.name}</CardTitle>
              {restaurant.description && (
                <CardDescription>{restaurant.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{restaurant.address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{restaurant.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {restaurant.open_time} – {restaurant.close_time}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex h-48 items-center justify-center">
              <p className="text-muted-foreground">No restaurant info available.</p>
            </CardContent>
          </Card>
        )}

        {/* Stats + CTA Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Your Reservations</CardTitle>
            <CardDescription>Upcoming bookings at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-4">
              <div className="rounded-full bg-primary/10 p-2">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingCount}</p>
                <p className="text-sm text-muted-foreground">upcoming reservation{upcomingCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link to="/reservations/new">
                  <Users className="mr-2 h-4 w-4" />
                  Book a Table
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/reservations/my">View All</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
