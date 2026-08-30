"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, Store, WalletCards } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  BRIDGE_URL,
  connectManualToken,
  disconnectRappi,
  fetchPaymentMethods,
  fetchSessionStatus,
  startRappiLogin,
  type PaymentMethodView,
  type SessionStatus,
} from "@/lib/bridge"
import { cn } from "@/lib/utils"

const STATE_LABEL: Record<SessionStatus["state"], string> = {
  idle: "Rappi no conectado",
  waiting_login: "Esperando tu acceso…",
  captured: "Rappi conectado",
  error: "Error de conexión",
}

const STATE_DOT: Record<SessionStatus["state"], string> = {
  idle: "bg-muted-foreground/55",
  waiting_login: "animate-pulse bg-amber-500",
  captured: "bg-emerald-500",
  error: "bg-destructive",
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la acción."
}

export function useRappiStatus(pollWhile: boolean) {
  const [status, setStatus] = useState<SessionStatus | null>(null)
  const [reachable, setReachable] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchSessionStatus())
      setReachable(true)
    } catch {
      setReachable(false)
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

  return { status, reachable, refresh }
}

export function RappiConfigButton({
  onClick,
  status,
}: {
  onClick: () => void
  status: SessionStatus | null
}) {
  const state = status?.state ?? "idle"

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={state === "captured" ? "Configurar Rappi, conectado" : "Configurar Rappi"}
      className="w-full justify-start gap-2.5 px-2.5 text-muted-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
    >
      <span className={cn("size-2 rounded-full", STATE_DOT[state])} aria-hidden />
      <span className="group-data-[collapsible=icon]:hidden">
        {state === "captured" ? "Rappi conectado" : "Configurar Rappi"}
      </span>
    </Button>
  )
}

export function RappiConfigPanel({
  open,
  status,
  reachable,
  onOpenChange,
  onRefresh,
}: {
  open: boolean
  status: SessionStatus | null
  reachable: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [manualToken, setManualToken] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [methods, setMethods] = useState<PaymentMethodView[] | null>(null)

  useEffect(() => {
    if (status?.state !== "captured") return

    let active = true
    fetchPaymentMethods()
      .then((nextMethods) => {
        if (active) setMethods(nextMethods)
      })
      .catch((error) => {
        if (active) setActionError(errorMessage(error))
      })

    return () => {
      active = false
    }
  }, [status?.state])

  const runAction = useCallback(
    async (action: () => Promise<unknown>, afterSuccess?: () => void) => {
      setBusy(true)
      setActionError(null)
      try {
        await action()
        afterSuccess?.()
        await onRefresh()
      } catch (error) {
        setActionError(errorMessage(error))
      } finally {
        setBusy(false)
      }
    },
    [onRefresh]
  )

  const state = status?.state ?? "idle"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(100%,26rem)] overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/70 pb-5 pr-14">
          <div className="mb-2 grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="size-5" />
          </div>
          <SheetTitle>Configurar Rappi</SheetTitle>
          <SheetDescription>
            Conecta una sesión local para que el agente pueda consultar y preparar compras autorizadas.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-6">
          {!reachable && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">El bridge local no responde.</p>
              <p className="mt-1 text-xs leading-relaxed text-destructive/80">
                Verifica que esté activo en <code className="font-mono">{BRIDGE_URL}</code>.
              </p>
            </div>
          )}

          <section className="rounded-2xl border border-border/80 bg-muted/25 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <span className={cn("size-2 rounded-full", STATE_DOT[state])} aria-hidden />
              {STATE_LABEL[state]}
            </div>
            {status?.account_label && (
              <p className="mt-3 text-muted-foreground">
                Cuenta: <span className="font-medium text-foreground">{status.account_label}</span>
              </p>
            )}
            {status?.address_label && (
              <p className="mt-1 text-muted-foreground">
                Dirección: <span className="font-medium text-foreground">{status.address_label}</span>
              </p>
            )}
            {status?.error && <p className="mt-3 text-destructive">{status.error}</p>}
          </section>

          {actionError && (
            <p role="alert" className="rounded-xl bg-destructive/8 px-3 py-2 text-xs text-destructive">
              {actionError}
            </p>
          )}

          {state !== "captured" ? (
            <section className="space-y-4">
              <Button
                className="w-full"
                disabled={busy || !reachable || state === "waiting_login"}
                onClick={() => void runAction(startRappiLogin)}
              >
                {busy && <LoaderCircle className="animate-spin" />}
                {state === "waiting_login" ? "Esperando tu acceso…" : "Iniciar acceso con OTP"}
              </Button>
              <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
                <li>El bridge abre Rappi en una ventana local de Chrome.</li>
                <li>Ingresa tu teléfono y solicita un código OTP nuevo.</li>
                <li>Cuando accedas, la sesión se captura localmente y la ventana se cierra.</li>
              </ol>

              <details className="rounded-2xl border border-border/80 p-4">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Conectar manualmente
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Si el OTP falla, pega el valor completo del encabezado Authorization de una petición autenticada de Rappi.
                </p>
                <Input
                  type="password"
                  value={manualToken}
                  onChange={(event) => setManualToken(event.target.value)}
                  placeholder="ft.gAAAA…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Token de sesión de Rappi"
                  className="mt-3 rounded-xl bg-muted/40 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  disabled={busy || !manualToken.trim() || !reachable}
                  onClick={() =>
                    void runAction(
                      () => connectManualToken(manualToken.trim()),
                      () => setManualToken("")
                    )
                  }
                >
                  Conectar con token
                </Button>
              </details>
            </section>
          ) : (
            <section className="space-y-4">
              {methods && methods.length > 0 && (
                <div className="rounded-2xl border border-border/80 p-4 text-xs">
                  <p className="mb-3 flex items-center gap-2 font-medium">
                    <WalletCards className="size-4 text-primary" />
                    Métodos de pago
                  </p>
                  <ul className="space-y-2">
                    {methods.map((method) => (
                      <li key={method.id} className="flex items-center justify-between gap-3 text-muted-foreground">
                        <span className="truncate">
                          {method.main_description ?? method.id}
                          {method.cash ? " · efectivo" : ""}
                        </span>
                        {method.selected && (
                          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase text-emerald-700">
                            Activo
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                La sesión permanece en esta máquina. Para cambiar de cuenta, desconecta y vuelve a iniciar el acceso.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                disabled={busy}
                onClick={() => void runAction(disconnectRappi)}
              >
                {busy && <LoaderCircle className="animate-spin" />}
                Desconectar Rappi
              </Button>
            </section>
          )}
        </div>

        <p className="mt-auto border-t border-border/70 px-6 py-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Bridge local · modo DRY_RUN por defecto · límites y dirección se validan en cada compra.
        </p>
      </SheetContent>
    </Sheet>
  )
}
