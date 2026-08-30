"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  BRIDGE_URL,
  disconnectRappi,
  fetchSessionStatus,
  startRappiLogin,
  type SessionStatus,
} from "@/lib/bridge";

const STATE_LABEL: Record<SessionStatus["state"], string> = {
  idle: "Rappi no conectado",
  waiting_login: "Esperando tu OTP…",
  captured: "Rappi conectado",
  error: "Error de conexión",
};

const STATE_DOT: Record<SessionStatus["state"], string> = {
  idle: "bg-zinc-400",
  waiting_login: "bg-amber-500 animate-pulse",
  captured: "bg-emerald-500",
  error: "bg-red-500",
};

export function useRappiStatus(pollWhile: boolean) {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [reachable, setReachable] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchSessionStatus());
      setReachable(true);
    } catch {
      setReachable(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollWhile) {
      timer.current = setInterval(() => void refresh(), 2000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
  }, [pollWhile, refresh]);

  return { status, reachable, refresh };
}

export function RappiConfigButton({ onClick, status }: { onClick: () => void; status: SessionStatus | null }) {
  const state = status?.state ?? "idle";
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-2">
      <span className={`size-2 rounded-full ${STATE_DOT[state]}`} aria-hidden />
      {state === "captured" ? "Rappi conectado" : "Config Rappi"}
    </Button>
  );
}

export function RappiConfigPanel({
  status,
  reachable,
  onClose,
  onRefresh,
}: {
  status: SessionStatus | null;
  reachable: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const startLogin = useCallback(async () => {
    setBusy(true);
    try {
      await startRappiLogin();
      onRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  }, [onRefresh]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectRappi();
      onRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  }, [onRefresh]);

  const state = status?.state ?? "idle";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-white p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Config Rappi</h2>
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar" onClick={onClose}>
            ✕
          </Button>
        </header>

        {!reachable && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            El bridge de Rappi no responde en <code>{BRIDGE_URL}</code>. Levántalo con{" "}
            <code>uvicorn --factory src.rappi_bridge.app:create_app --port 8010</code>.
          </p>
        )}

        <section className="rounded-xl border border-zinc-200 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-zinc-900">
            <span className={`size-2 rounded-full ${STATE_DOT[state]}`} aria-hidden />
            {STATE_LABEL[state]}
          </div>
          {status?.account_label && (
            <p className="mt-2 text-zinc-700">
              Cuenta: <span className="font-medium">{status.account_label}</span>
            </p>
          )}
          {status?.address_label && (
            <p className="text-zinc-700">
              Dirección activa: <span className="font-medium">{status.address_label}</span>
            </p>
          )}
          {status?.error && <p className="mt-2 text-red-600">{status.error}</p>}
        </section>

        {state !== "captured" && (
          <section className="flex flex-col gap-3">
            <Button onClick={() => void startLogin()} disabled={busy || !reachable || state === "waiting_login"}>
              {state === "waiting_login" ? "Esperando tu login…" : "Iniciar login OTP"}
            </Button>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-500">
              <li>Se abre una ventana de Chrome con rappi.com.co/login.</li>
              <li>Ingresa tu teléfono y el código OTP de WhatsApp.</li>
              <li>
                Al entrar, capturamos el token de sesión y la ventana se cierra sola. El
                token nunca sale de esta máquina.
              </li>
            </ol>
          </section>
        )}

        {state === "captured" && (
          <section className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500">
              Listo: las compras del agente usarán esta sesión bajo mandato. Para cambiar de
              cuenta, desconecta y vuelve a hacer login.
            </p>
            <Button variant="destructive" onClick={() => void disconnect()} disabled={busy}>
              Desconectar Rappi
            </Button>
          </section>
        )}

        <footer className="mt-auto border-t border-zinc-100 pt-3 text-[11px] leading-relaxed text-zinc-400">
          Bridge: {BRIDGE_URL} · DRY_RUN por defecto · tope y dirección se verifican por
          código en cada compra (decisión 0030).
        </footer>
      </aside>
    </div>
  );
}
