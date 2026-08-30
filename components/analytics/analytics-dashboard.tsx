"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { CheckCircle2, CircleDollarSign, ReceiptText, ShieldCheck } from "lucide-react"
import type { AnalyticsDataset } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const config = { value: { label: "Volume", color: "var(--chart-1)" }, count: { label: "Transactions", color: "var(--chart-2)" }, spend: { label: "Spend", color: "var(--chart-1)" } } satisfies ChartConfig

export function AnalyticsDashboard() {
  const [range, setRange] = useState("30d"), [data, setData] = useState<AnalyticsDataset>()
  useEffect(() => {
    void fetch(`/api/analytics?range=${range}`, { cache: "no-store" })
      .then((response) => response.json())
      .then(setData)
  }, [range])
  if (!data || data.range !== range) return <AnalyticsSkeleton />
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency, maximumFractionDigits: 0 })
  return <main className="min-h-svh px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
    <div className="mx-auto max-w-[1440px]">
      <header className="enter mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><span className="size-1.5 rounded-full bg-primary" />Verified activity</div><h1 className="editorial-title text-4xl font-medium sm:text-5xl">Transaction intelligence.</h1><p className="mt-3 text-sm text-muted-foreground">A live view built from your mandate-scoped audit trail.</p></div><div className="flex rounded-full border bg-card p-1">{["7d", "30d", "90d", "all"].map((item) => <Button key={item} size="sm" variant={range === item ? "default" : "ghost"} onClick={() => setRange(item)} className="min-w-12 font-mono text-[10px] uppercase">{item}</Button>)}</div></header>
      <section className="enter-delay grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Captured volume" value={money.format(data.summary.capturedVolume)} detail={`${data.summary.capturedCount} completed`} icon={<CircleDollarSign />} />
        <Metric label="Approval rate" value={`${data.summary.approvalRate.toFixed(1)}%`} detail={`${data.summary.totalAttempts} total attempts`} icon={<ShieldCheck />} />
        <Metric label="Average transaction" value={money.format(data.summary.averageTransaction)} detail="Captured only" icon={<ReceiptText />} />
        <Metric label="Audit state" value="Verified" detail={`Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} icon={<CheckCircle2 />} />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="surface"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Transactions over time</CardTitle><p className="mt-1 text-xs text-muted-foreground">Captured volume in {data.currency}</p></div><Badge variant="outline" className="font-mono text-[9px]">15s live</Badge></CardHeader><CardContent><ChartContainer config={config} className="h-[280px] w-full aspect-auto"><AreaChart data={data.timeseries} margin={{ left: 4, right: 8 }}><defs><linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(5)} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} width={44} /><ChartTooltip content={<ChartTooltipContent />} /><Area type="monotone" dataKey="value" stroke="var(--color-value)" fill="url(#volumeFill)" strokeWidth={2} /></AreaChart></ChartContainer></CardContent></Card>
        <Card className="surface"><CardHeader><CardTitle>Purchases by merchant</CardTitle><p className="mt-1 text-xs text-muted-foreground">Share of captured spend</p></CardHeader><CardContent><ChartContainer config={config} className="h-[280px] w-full aspect-auto"><BarChart data={data.byMerchant} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="merchant" axisLine={false} tickLine={false} width={88} tick={{ fontSize: 10 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="spend" fill="var(--color-spend)" radius={[0, 7, 7, 0]} /></BarChart></ChartContainer></CardContent></Card>
      </section>
      <Card className="surface mt-4 overflow-hidden"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>All transactions</CardTitle><p className="mt-1 text-xs text-muted-foreground">Mandate-scoped, newest first</p></div><Badge variant="secondary">{data.transactions.length} records</Badge></CardHeader><CardContent className="px-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-6">Date</TableHead><TableHead>Merchant</TableHead><TableHead>Offer</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="pr-6 text-right">Reference</TableHead></TableRow></TableHeader><TableBody>{data.transactions.map((transaction) => <TableRow key={transaction.purchaseId}><TableCell className="pl-6 font-mono text-[10px]">{new Date(transaction.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}</TableCell><TableCell className="font-medium">{transaction.merchant}</TableCell><TableCell className="max-w-56 truncate text-muted-foreground">{transaction.offer}</TableCell><TableCell className="font-mono text-xs">{money.format(transaction.amount)}</TableCell><TableCell><Status status={transaction.status} /></TableCell><TableCell className="pr-6 text-right font-mono text-[10px] text-muted-foreground">{transaction.receiptId ?? transaction.purchaseId}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  </main>
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) { return <Card className="surface"><CardContent className="p-5"><div className="mb-7 flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span><span className="[&_svg]:size-4">{icon}</span></div><div className="font-mono text-2xl font-medium tracking-[-.04em]">{value}</div><div className="mt-2 text-[10px] text-muted-foreground">{detail}</div></CardContent></Card> }
function Status({ status }: { status: string }) { const ok = status === "captured", pending = status === "escalated"; return <Badge variant="outline" className={`${ok ? "border-primary/25 bg-primary/10 text-primary" : pending ? "border-amber-700/20 bg-amber-700/5 text-amber-800" : "border-destructive/20 bg-destructive/5 text-destructive"} font-mono text-[9px] uppercase`}>{status}</Badge> }
function AnalyticsSkeleton() { return <main className="p-6 lg:p-10"><div className="mx-auto max-w-[1440px]"><Skeleton className="mb-4 h-12 w-72" /><Skeleton className="mb-8 h-4 w-96 max-w-full" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div><div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div></div></main> }
