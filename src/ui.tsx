import { useState, type ReactNode } from 'react'
import type { Band, DB, Role, VersionStatus } from './types'
import { band } from './scoring'

export const STATUS_STYLE: Record<VersionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  scoring: 'bg-amber-50 text-amber-700 ring-amber-200',
  in_review: 'bg-sky-50 text-sky-700 ring-sky-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  released: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

export const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: 'Draft',
  scoring: 'Scoring',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  released: 'Released',
}

export function StatusBadge({ status }: { status: VersionStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {status === 'scoring' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
      {STATUS_LABEL[status]}
    </span>
  )
}

const BAND_STYLE: Record<Band, string> = {
  pass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  review: 'bg-amber-50 text-amber-700 ring-amber-200',
  fail: 'bg-rose-50 text-rose-700 ring-rose-200',
}
export const BAND_LABEL: Record<Band, string> = { pass: 'Passes', review: 'Needs a human look', fail: 'Fails' }

export function BandBadge({ b }: { b: Band }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BAND_STYLE[b]}`}>{BAND_LABEL[b]}</span>
}

export function ScoreRing({ score }: { score: number }) {
  const b = band(score)
  const color = b === 'pass' ? '#059669' : b === 'review' ? '#d97706' : '#e11d48'
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0" aria-label={`Score ${score}`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  )
}

export const ROLE_STYLE: Record<Role, string> = {
  maker: 'bg-violet-50 text-violet-700 ring-violet-200',
  checker: 'bg-sky-50 text-sky-700 ring-sky-200',
  admin: 'bg-slate-800 text-white ring-slate-800',
}

export function RoleBadge({ role }: { role?: Role }) {
  if (!role) return <span className="text-xs text-slate-400">not a member</span>
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${ROLE_STYLE[role]}`}>{role}</span>
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
  const hue = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ width: size, height: size, background: `hsl(${hue} 55% 45%)` }}>
      {initials}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>
}

export function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysLeft(date: string) {
  const ms = new Date(date + 'T23:59:59').getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export function nameOf(db: DB, id: string) {
  if (id === 'system') return 'System (AI worker)'
  return db.users.find((u) => u.id === id)?.name ?? 'Unknown'
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Runs a store action and surfaces permission or validation errors. */
export function useAction() {
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => void) => {
    try {
      setError(null)
      fn()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  const node = error ? (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <span>{error}</span>
      <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
        ✕
      </button>
    </div>
  ) : null
  return { run, error: node }
}

export function Artwork({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  if (!src)
    return (
      <div className={`flex aspect-[10/7] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500 ${className}`}>
        <div className="text-center">
          <div className="text-3xl">📄</div>
          <div className="mt-1">{name}</div>
          <div className="text-xs">No inline preview</div>
        </div>
      </div>
    )
  return <img src={src} alt={name} className={`w-full rounded-lg border border-slate-200 bg-white object-contain ${className}`} />
}
