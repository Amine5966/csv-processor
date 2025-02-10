"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { X, LogOut, User } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const sidebarNavItems = [
  {
    title: "CSV Processor",
    href: "/dashboard/csv-processor",
  },
  {
    title: "Excel Converter",
    href: "/dashboard/excel-converter",
  },
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ className, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { logout } = useAuth()

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:translate-x-0",
        className,
      )}
    >
      <div className="flex justify-between items-center p-4 md:hidden">
        <Link href="/dashboard" className="flex items-center">
          <Image src="/cdlogo.webp" alt="Chrono Diali Logo" width={150} height={30} priority />
        </Link>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-6 w-6" />
        </Button>
      </div>
      <div className="flex-grow space-y-4 py-4">
        <div className="px-3 py-2 hidden md:block">
          <Link href="/dashboard" className="flex items-center mb-4">
            <Image src="/cdlogo.webp" alt="Chrono Diali Logo" width={220} height={40} className="mr-2" priority />
          </Link>
        </div>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Navigation</h2>
          <div className="space-y-1">
            {sidebarNavItems.map((item) => (
              <React.Fragment key={item.href}>
                <Button
                  asChild
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  className={`w-full justify-start ${pathname === item.href ? "font-bold" : "font-normal"}`}
                >
                  <Link href={item.href} onClick={onClose}>
                    {item.title}
                  </Link>
                </Button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 border-t">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            <span className="font-medium">chronodiali-finance</span>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  )
}

