import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCampaign, roleIn, useDB } from '../store'
import type { DB, Version } from '../types'
import { Avatar, Modal, PageHeader, RoleBadge, daysLeft, fmtDate, nameOf, useAction } from '../ui'

export function latestVersions(db: DB, campaignId: string): Version[] {
  return db.assets
    .filter((a) => a.campaignId === campaignId)
    .map((a) => db.versions.filter((v) => v.assetId === a.id).sort((x, y) => y.number - x.number)[0])
    .filter(Boolean)
}

export function progress(db: DB, campaignId: string) {
  const latest = latestVersions(db, campaignId)
  return {
    total: latest.length,
    waiting: latest.filter((v) => ['draft', 'scoring', 'rejected'].includes(v.status)).length,
    review: latest.filter((v) => ['in_review', 'approved'].includes(v.status)).length,
    released: latest.filter((v) => v.status === 'released').length,
  }
}

export function ProgressBar({ p }: { p: ReturnType<typeof progress> }) {
  const pct = (n: number) => (p.total ? (n / p.total) * 100 : 0)
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-indigo-500" style={{ width: `${pct(p.released)}%` }} />
        <div className="bg-sky-400" style={{ width: `${pct(p.review)}%` }} />
        <div className="bg-amber-300" style={{ width: `${pct(p.waiting)}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300" />
          Waiting {p.waiting}
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />
          In review {p.review}
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />
          Released {p.released}
        </span>
      </div>
    </div>
  )
}

export default function Campaigns() {
  const db = useDB()
  const me = db.users.find((u) => u.id === db.currentUserId)!
  const [open, setOpen] = useState(false)
  const visible = db.campaigns.filter((c) => me.orgAdmin || roleIn(db, me.id, c.id))
  const versions = db.versions.filter((v) => visible.some((c) => c.id === v.campaignId))
  const stats = [
    { label: 'Scoring now', value: versions.filter((v) => v.status === 'scoring').length },
    { label: 'Waiting on a checker', value: versions.filter((v) => v.status === 'in_review').length },
    { label: 'Waiting on release', value: versions.filter((v) => v.status === 'approved').length },
    { label: 'Released', value: versions.filter((v) => v.status === 'released').length },
  ]

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Assets, their AI checks and their approvals, in one place."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)} title={me.orgAdmin ? '' : 'Only an org admin can create campaigns'}>
            + New campaign
          </button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((c) => {
          const p = progress(db, c.id)
          const dl = daysLeft(c.deadline)
          return (
            <Link key={c.id} to={`/campaigns/${c.id}`} className="card block p-5 transition hover:border-indigo-300 hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
                <RoleBadge role={roleIn(db, me.id, c.id)} />
              </div>
              <p className="mb-4 line-clamp-2 text-sm text-slate-500">{c.description}</p>
              <ProgressBar p={p} />
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-2">
                  <Avatar name={nameOf(db, c.ownerId)} size={22} /> Owner: {nameOf(db, c.ownerId)}
                </span>
                <span className={dl <= 3 ? 'font-semibold text-rose-600' : ''}>
                  Deadline {fmtDate(c.deadline)} · {dl >= 0 ? `${dl}d left` : 'overdue'}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
      <NewCampaign open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function NewCampaign({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDB()
  const nav = useNavigate()
  const { run, error } = useAction()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState(db.users[0].id)
  const [deadline, setDeadline] = useState(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10))
  return (
    <Modal open={open} onClose={onClose} title="New campaign">
      {error}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          let id = ''
          if (run(() => (id = createCampaign({ name, description, ownerId, deadline })))) {
            onClose()
            nav(`/campaigns/${id}`)
          }
        }}
      >
        <div>
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chinese New Year 2027" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Owner</label>
            <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" className="input" required value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  )
}
