'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, History, Crown, Settings, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

interface Subscription {
  plan_type: 'free' | 'premium'
  reports_limit: number
  reports_used: number
  can_create_report: boolean
}

interface DataSanityNavProps {
  user: User | null
  onSignOut?: () => void
}

export function DataSanityNav({ user, onSignOut }: DataSanityNavProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchSubscription()
    }
  }, [user])

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/user/subscription')
      if (response.ok) {
        const data = await response.json()
        setSubscription(data)
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    if (onSignOut) onSignOut()
  }

  if (!user) return null

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Menu</span>
          </NavigationMenuTrigger>
          <NavigationMenuContent className="bg-background border shadow-lg">
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              {/* Home */}
              <li className="row-span-3">
                <NavigationMenuLink asChild>
                  <Link
                    className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                    href="/"
                  >
                    <Home className="h-6 w-6" />
                    <div className="mb-2 mt-4 text-lg font-medium">
                      Data Sanity
                    </div>
                    <p className="text-sm leading-tight text-muted-foreground">
                      AI-powered data quality assessment platform
                    </p>
                  </Link>
                </NavigationMenuLink>
              </li>

              {/* Reports History */}
              <li>
                <NavigationMenuLink asChild>
                  <Link
                    href="/history"
                    className={cn(
                      "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      <History className="h-4 w-4" />
                      <div className="text-sm font-medium leading-none">Reports History</div>
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                      View and manage your processed reports
                    </p>
                    {subscription && (
                      <div className="flex items-center space-x-2 pt-1">
                        <Badge variant="secondary" className="text-xs">
                          {subscription.reports_used}
                          {subscription.plan_type === 'free' && ` / ${subscription.reports_limit}`}
                        </Badge>
                        {subscription.plan_type === 'premium' && (
                          <Crown className="h-3 w-3 text-yellow-500" />
                        )}
                      </div>
                    )}
                  </Link>
                </NavigationMenuLink>
              </li>

              {/* Account Settings */}
              <li>
                <NavigationMenuLink asChild>
                  <div className={cn(
                    "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none"
                  )}>
                    <div className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <div className="text-sm font-medium leading-none">Account</div>
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="pt-2 space-y-2">
                      {subscription?.plan_type === 'free' && (
                        <Button size="sm" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                          <Crown className="h-3 w-3 mr-1" />
                          Upgrade to Premium
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

const ListItem = ({ className, title, children, ...props }: {
  className?: string
  title: string
  children: React.ReactNode
  href?: string
}) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  )
}