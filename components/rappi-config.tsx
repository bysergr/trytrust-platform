"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  fetchSessionStatus,
  startRappiLogin,
  type SessionStatus,
} from "@/lib/bridge"

export function useRappiStatus(pollWhile: boolean) {
  const [status, setStatus] = useState<SessionStatus | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchSessionStatus())
    } catch {
      // The action button reports connection failures only when the user asks to sign in.
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0)
    if (!pollWhile) return () => window.clearTimeout(initialRefresh)

    const timer = window.setInterval(() => void refresh(), 2000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(timer)
    }
  }, [pollWhile, refresh])

  return { status, refresh }
}

export function RappiConfigPanel({
  open,
  status,
  onOpenChange,
  onRefresh,
}: {
  open: boolean
  status: SessionStatus | null
  onOpenChange: (open: boolean) => void
  onRefresh: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const runAction = useCallback(
    async () => {
      setBusy(true)
      setActionError(null)
      try {
        await startRappiLogin()
        await onRefresh()
      } catch {
        setActionError("No pudimos iniciar sesión. Inténtalo nuevamente.")
      } finally {
        setBusy(false)
      }
    },
    [onRefresh]
  )

  const state = status?.state ?? "idle"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(100%,24rem)] p-6 sm:max-w-sm">
        <SheetHeader className="p-0 pr-12">
          <SheetTitle>Configurar Rappi</SheetTitle>
          <SheetDescription className="sr-only">
            Inicia una sesión de Rappi.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-3">
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
          <Button
            className="w-full"
            disabled={busy || state === "waiting_login" || state === "captured"}
            onClick={() => void runAction()}
          >
            {(busy || state === "waiting_login") && <LoaderCircle className="animate-spin" />}
            {state === "captured"
              ? "Rappi conectado"
              : state === "waiting_login"
                ? "Iniciando sesión…"
                : "Iniciar sesión"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
