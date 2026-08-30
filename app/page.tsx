"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  RappiConfigButton,
  RappiConfigPanel,
  useRappiStatus,
} from "@/components/rappi-config";
import { Button } from "@/components/ui/button";
import { askKernel, KERNEL_URL, type ChatTurn } from "@/lib/bridge";

const WELCOME: ChatTurn = {
  role: "system",
  text:
    "Tower Control: el chat de tu agente con mandato. Conecta la cuenta de Rappi con «Config Rappi» (arriba a la derecha) para habilitar compras reales — el login es OTP y el token se queda en esta máquina.",
};

export default function Home() {
  const [panelOpen, setPanelOpen] = useState(false);
  const { status, reachable, refresh } = useRappiStatus(panelOpen);
  const [messages, setMessages] = useState<ChatTurn[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, thinking]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setMessages((previous) => [...previous, { role: "user", text }]);
    setThinking(true);
    try {
      if (KERNEL_URL) {
        const { reply, agent_name } = await askKernel(text);
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            text: agent_name ? `[${agent_name}] ${reply}` : reply,
          },
        ]);
      } else {
        setMessages((previous) => [
          ...previous,
          {
            role: "system",
            text:
              "Kernel no configurado (NEXT_PUBLIC_KERNEL_URL): el chat responde en modo eco. «Config Rappi» funciona igual — habla directo con el bridge local.",
          },
        ]);
      }
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "system",
          text: `No pude hablar con el kernel (${KERNEL_URL}): ${(error as Error).message}`,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }, [input, thinking]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900">Tower Control</h1>
          <p className="text-xs text-zinc-500">
            TryTrust · compras de agentes bajo mandato verificable
          </p>
        </div>
        <RappiConfigButton status={status} onClick={() => setPanelOpen(true)} />
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        {messages.map((message, index) => (
          <Message key={index} turn={message} />
        ))}
        {thinking && (
          <div className="max-w-md self-start rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-400">
            pensando…
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-zinc-200 bg-white p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={KERNEL_URL ? "Pídele algo a tu agente…" : "Escribe para probar (modo eco)…"}
          className="h-10 flex-1 rounded-full border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-400"
        />
        <Button type="submit" disabled={!input.trim() || thinking}>
          Enviar
        </Button>
      </form>

      {panelOpen && (
        <RappiConfigPanel
          status={status}
          reachable={reachable}
          onClose={() => setPanelOpen(false)}
          onRefresh={() => void refresh()}
        />
      )}
    </div>
  );
}

function Message({ turn }: { turn: ChatTurn }) {
  if (turn.role === "system") {
    return (
      <p className="mx-auto max-w-lg text-center text-xs leading-relaxed text-zinc-500">
        {turn.text}
      </p>
    );
  }
  const isUser = turn.role === "user";
  return (
    <div className={isUser ? "self-end" : "self-start"}>
      <div
        className={`max-w-md whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "rounded-br-sm bg-zinc-900 text-zinc-50"
            : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-800"
        }`}
      >
        {turn.text}
      </div>
    </div>
  );
}
