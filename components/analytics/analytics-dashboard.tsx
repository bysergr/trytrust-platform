"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertCircle, CheckCircle2, CircleDollarSign, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react"
import type { AnalyticsDataset } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const config = { value: { label: "Volume", color: "var(--chart-1)" }, count: { label: "Transactions", color: "var(--chart-2)" }, spend: { label: "Spend", color: "var(--chart-1)" } } satisfies ChartConfig

export function AnalyticsDashboard() {
  const [range, setRange] = useState("30d")
  const [currency, setCurrency] = useState<string>()
  const [data, setData] = useState<AnalyticsDataset>()
  const [error, setError] = useState<string>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const load = async (quiet = false) => {
      if (!quiet) setRefreshing(true)
      try {
        const params = new URLSearchParams({ range })
        if (currency) params.set("currency", currency)
        const response = await fetch(`/api/analytics?${params}`, { cache: "no-store", signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Analytics are unavailable")
        setData(payload as AnalyticsDataset)
        setError(undefined)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Analytics are unavailable")
      } finally {
        if (!controller.signal.aborted && !quiet) setRefreshing(false)
      }
    }
    void load()
    const interval = window.setInterval(() => void load(true), 15_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [range, currency, refreshKey])

  if (error && !data) return <AnalyticsError message={error} onRetry={() => setRefreshKey((value) => value + 1)} />
  if (!data || data.range !== range || (currency && data.currency !== currency)) return <AnalyticsSkeleton />
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency, maximumFractionDigits: 0 })
  return <main className="min-h-svh px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
    <div className="mx-auto max-w-[1440px]">
      <header className="enter mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><span className="size-1.5 rounded-full bg-primary" />Verified activity</div><h1 className="editorial-title text-4xl font-medium sm:text-5xl">Transaction intelligence.</h1><p className="mt-3 text-sm text-muted-foreground">A live view built from your agent&apos;s mandate-scoped audit trail.</p></div><div className="flex flex-wrap items-center justify-end gap-2">{data.currencies.length > 1 && <div className="flex rounded-full border bg-card p-1">{data.currencies.map((item) => <Button key={item} size="sm" variant={data.currency === item ? "secondary" : "ghost"} onClick={() => setCurrency(item)} className="font-mono text-[10px] uppercase">{item}</Button>)}</div>}<div className="flex rounded-full border bg-card p-1">{["7d", "30d", "90d", "all"].map((item) => <Button key={item} size="sm" variant={range === item ? "default" : "ghost"} onClick={() => setRange(item)} className="min-w-12 font-mono text-[10px] uppercase">{item}</Button>)}</div><Button size="icon-sm" variant="outline" className="rounded-full" onClick={() => setRefreshKey((value) => value + 1)} disabled={refreshing} aria-label="Refresh analytics"><RefreshCw className={refreshing ? "animate-spin" : ""} /></Button></div></header>
      {error && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-amber-700/20 bg-amber-700/5 px-4 py-2 text-xs text-amber-900"><AlertCircle className="size-4" />The last refresh failed. Showing the most recent verified data.</div>}
      <section className="enter-delay grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Captured volume" value={money.format(data.summary.capturedVolume)} detail={`${data.summary.capturedCount} completed`} icon={<CircleDollarSign />} />
        <Metric label="Approval rate" value={`${data.summary.approvalRate.toFixed(1)}%`} detail={`${data.summary.totalAttempts} total attempts`} icon={<ShieldCheck />} />
        <Metric label="Average transaction" value={money.format(data.summary.averageTransaction)} detail="Captured only" icon={<ReceiptText />} />
        <Metric label="Audit state" value="Verified" detail={`Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} icon={<CheckCircle2 />} />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="surface"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Transactions over time</CardTitle><p className="mt-1 text-xs text-muted-foreground">Captured volume in {data.currency}</p></div><Badge variant="outline" className="font-mono text-[9px]">15s live</Badge></CardHeader><CardContent>{data.timeseries.length ? <ChartContainer config={config} className="h-[280px] w-full aspect-auto"><AreaChart data={data.timeseries} margin={{ left: 4, right: 8 }}><defs><linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(5)} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => money.format(Number(value))} width={64} /><ChartTooltip content={<ChartTooltipContent />} /><Area type="monotone" dataKey="value" stroke="var(--color-value)" fill="url(#volumeFill)" strokeWidth={2} /></AreaChart></ChartContainer> : <EmptyChart />}</CardContent></Card>
        <Card className="surface"><CardHeader><CardTitle>Purchases by merchant</CardTitle><p className="mt-1 text-xs text-muted-foreground">Share of captured spend</p></CardHeader><CardContent>{data.byMerchant.length ? <ChartContainer config={config} className="h-[280px] w-full aspect-auto"><BarChart data={data.byMerchant} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="merchant" axisLine={false} tickLine={false} width={88} tick={{ fontSize: 10 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="spend" fill="var(--color-spend)" radius={[0, 7, 7, 0]} /></BarChart></ChartContainer> : <EmptyChart />}</CardContent></Card>
      </section>
      <Card className="surface mt-4 overflow-hidden"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>All transactions</CardTitle><p className="mt-1 text-xs text-muted-foreground">Mandate-scoped, newest first</p></div><Badge variant="secondary">{data.transactions.length} records</Badge></CardHeader><CardContent className="px-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-6">Date</TableHead><TableHead>Merchant</TableHead><TableHead>Offer</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="pr-6 text-right">Reference</TableHead></TableRow></TableHeader><TableBody>{data.transactions.length ? data.transactions.map((transaction) => <TableRow key={transaction.purchaseId}><TableCell className="pl-6 font-mono text-[10px]">{new Date(transaction.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}</TableCell><TableCell className="font-medium">{transaction.merchant}</TableCell><TableCell className="max-w-56 truncate text-muted-foreground">{transaction.offer}</TableCell><TableCell className="font-mono text-xs">{money.format(transaction.amount)}</TableCell><TableCell><Status status={transaction.status} /></TableCell><TableCell className="pr-6 text-right font-mono text-[10px] text-muted-foreground">{transaction.receiptId ?? transaction.purchaseId}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No transactions in this range.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    </div>
  </main>
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) { return <Card className="surface"><CardContent className="p-5"><div className="mb-7 flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span><span className="[&_svg]:size-4">{icon}</span></div><div className="font-mono text-2xl font-medium tracking-[-.04em]">{value}</div><div className="mt-2 text-[10px] text-muted-foreground">{detail}</div></CardContent></Card> }
function Status({ status }: { status: string }) { const ok = status === "captured", pending = status === "escalated"; return <Badge variant="outline" className={`${ok ? "border-primary/25 bg-primary/10 text-primary" : pending ? "border-amber-700/20 bg-amber-700/5 text-amber-800" : "border-destructive/20 bg-destructive/5 text-destructive"} font-mono text-[9px] uppercase`}>{status}</Badge> }
function AnalyticsSkeleton() { return <main className="p-6 lg:p-10"><div className="mx-auto max-w-[1440px]"><Skeleton className="mb-4 h-12 w-72" /><Skeleton className="mb-8 h-4 w-96 max-w-full" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div><div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div></div></main> }
function EmptyChart() { return <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed text-center"><ReceiptText className="mb-3 size-6 text-muted-foreground/60" /><p className="text-sm font-medium">No transactions in this range</p><p className="mt-1 text-xs text-muted-foreground">New agent activity will appear automatically.</p></div> }
function AnalyticsError({ message, onRetry }: { message: string; onRetry: () => void }) { return <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6"><Card className="surface w-full max-w-md"><CardContent className="flex flex-col items-center p-8 text-center"><span className="mb-4 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertCircle className="size-5" /></span><h1 className="editorial-title text-2xl">Analytics unavailable.</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><Button className="mt-6" onClick={onRetry}><RefreshCw />Try again</Button></CardContent></Card></main> }
