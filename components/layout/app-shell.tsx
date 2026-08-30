"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { BarChart3, Bot, ChevronsUpDown, FileText, LogOut, Plus, ShieldCheck, Store } from "lucide-react"
import { RappiConfigPanel, useRappiStatus } from "@/components/rappi-config"
import type { HankoUser, SiteRecord } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function AppShell({
  user,
  sites,
  children,
}: {
  user: HankoUser
  sites: SiteRecord[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [rappiOpen, setRappiOpen] = useState(false)
  const {
    status: rappiStatus,
    refresh: refreshRappi,
  } = useRappiStatus(rappiOpen)

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border/80">
        <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-2">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Expanded Typographic Logo */}
              <div className="min-w-0 flex flex-col group-data-[collapsible=icon]:hidden">
                <Logo size="md" />
                <span className="truncate font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground mt-0.5">
                  Human intent, verified
                </span>
              </div>

              {/* Collapsed Monogram */}
              <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center size-7 font-mono font-extrabold text-base text-primary">
                tt.
              </div>
            </Link>
            <SidebarTrigger className="hidden size-7 text-muted-foreground hover:text-foreground md:flex group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[.14em]">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem href="/" active={pathname === "/"} icon={<Bot />} label="Agent" />
                <NavItem href="/analytics" active={pathname === "/analytics"} icon={<BarChart3 />} label="Analytics" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {sites.length > 0 && <SidebarGroup className="min-h-0 flex-1">
            <div className="flex items-center justify-between pr-2 group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[.14em]">
                Sites
              </SidebarGroupLabel>
              <Badge variant="outline" className="h-5 font-mono text-[9px]">
                {sites.length}
              </Badge>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {sites.map((site) => (
                  <NavItem
                    key={site.id}
                    href={`/sites/${site.id}`}
                    active={pathname === `/sites/${site.id}`}
                    icon={<FileText />}
                    label={site.title}
                    suffix={
                      site.status === "published" ? (
                        <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                      ) : null
                    }
                  />
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/" />}
                    tooltip="Generate a site"
                    className="text-muted-foreground"
                  >
                    <Plus />
                    <span className="group-data-[collapsible=icon]:hidden">Generate a site</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
        </SidebarContent>

        <SidebarFooter className="p-2.5 group-data-[collapsible=icon]:p-2">
          <UserFooterMenu user={user} onConfigureRappi={() => setRappiOpen(true)} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <RappiConfigPanel
        open={rappiOpen}
        status={rappiStatus}
        onOpenChange={setRappiOpen}
        onRefresh={refreshRappi}
      />

      <SidebarInset className="min-w-0 bg-transparent">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl md:hidden">
          <SidebarTrigger />
          <Logo size="md" />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

function NavItem({
  href,
  active,
  icon,
  label,
  suffix,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
  suffix?: React.ReactNode
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        render={<Link href={href} />}
        tooltip={label}
        className="h-9"
      >
        <span className="[&_svg]:size-4">{icon}</span>
        <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
        {suffix && <span className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden">{suffix}</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function UserFooterMenu({
  user,
  onConfigureRappi,
}: {
  user: HankoUser
  onConfigureRappi: () => void
}) {
  const router = useRouter()
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === "collapsed" && !isMobile

  async function logout() {
    try {
      const api = process.env.NEXT_PUBLIC_HANKO_API_URL
      if (api) {
        const { register } = await import("@teamhanko/hanko-elements")
        const { hanko } = await register(api)
        await hanko.logout()
      }
    } finally {
      await fetch("/api/auth/logout", { method: "POST" })
      router.replace("/login")
      router.refresh()
    }
  }

  return (
    <DropdownMenu>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={isCollapsed ? user.name : undefined}
                className="data-[state=open]:bg-sidebar-accent"
              />
            }
          >
            <Avatar className="size-7 shrink-0">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
        </SidebarMenuItem>
      </SidebarMenu>

      <DropdownMenuContent
        side={isCollapsed ? "right" : "top"}
        align={isCollapsed ? "end" : "start"}
        sideOffset={8}
        className="w-56"
      >
        <DropdownMenuItem onClick={onConfigureRappi}>
          <Store />
          Configurar Rappi
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/security" />}>
          <ShieldCheck />
          Security & passkeys
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Typographic TryTrust Logo
 */
export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const sizeClasses =
    size === "lg"
      ? "text-2xl tracking-[-0.035em]"
      : size === "sm"
      ? "text-[14px] tracking-[-0.025em]"
      : "text-[17px] tracking-[-0.03em]"

  return (
    <span
      className={cn(
        "inline-flex items-center font-sans font-bold select-none leading-none",
        sizeClasses,
        className
      )}
    >
      <span className="text-foreground font-semibold">try</span>
      <span className="text-primary font-extrabold">trust</span>
      <span className="size-1.5 rounded-full bg-primary ml-0.5 inline-block" />
    </span>
  )
}

export function BrandMark({ small = false }: { small?: boolean }) {
  return <Logo size={small ? "sm" : "md"} />
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}
