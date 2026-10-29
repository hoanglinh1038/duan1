import { useState } from 'react'
import { Link } from 'react-router-dom'
import { roleIn, useDB } from '../store'
import { CHECK_LABELS, band } from '../scoring'
import type { CheckId } from '../types'
import { PageHeader, fmt, nameOf } from '../ui'

export default function Audit() {
  const db = useDB()
  const me = db.users.find((u) => u.id === db.currentUserId)!
  const [campaign, setCampaign] = useState('all')
  const [q, setQ] = useState('')
  const visible = db.campaigns.filter((c) => me.orgAdmin || roleIn(db, me.id, c.id))
  const events = db.audit
    .filter((e) => !e.campaignId || visible.some((c) => c.id === e.campaignId))
    .filter((e) => campaign === 'all' || e.campaignId === campaign)
    .filter((e) => !q || `${e.action} ${e.detail} ${nameOf(db, e.actorId)}`.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .reverse()

  const decided = db.versions.flatMap((v) => v.scores).filter((s) => s.human)
  const overrides = decided.filter((s) => s.human!.isOverride)
  const rate = decided.length ? Math.round((overrides.length / decided.length) * 100) : 0
  const perCheck = (Object.keys(CHECK_LABELS) as CheckId[]).map((c) => {
    const all = db.versions.flatMap((v) => v.scores).filter((s) => s.check === c)
    return {
      c,
      avg: all.length ? Math.round(all.reduce((a, s) => a + s.score, 0) / all.length) : 0,
      fails: all.filter((s) => band(s.score) === 'fail').length,
      overrides: all.filter((s) => s.human?.isOverride).length,
    }
  })

  const exportCsv = () => {
    const rows = [['timestamp', 'actor', 'action', 'campaign', 'version', 'detail'], ...events.map((e) => [e.at, nameOf(db, e.actorId), e.action, db.campaigns.find((c) => c.id === e.campaignId)?.name ?? '', e.versionId ?? '', e.detail])]
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'audit-trail.csv'
    a.click()
  }

  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Append-only record: asset, version, score, reason, approver, timestamp."
        actions={
          <button className="btn-ghost" onClick={exportCsv}>
            ↓ Export CSV
          </button>
        }
      />
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="card p-4">
          <div className="text-2xl font-bold">{rate}%</div>
          <div className="text-xs text-slate-500">
            Checker override rate ({overrides.length}/{decided.length} human decisions)
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Too low can mean over-trust; too high means the criteria need work.</div>
        </div>
        {perCheck.map((p) => (
          <div key={p.c} className="card p-4">
            <div className="text-sm font-semibold">{CHECK_LABELS[p.c]}</div>
            <div className="mt-1 text-xs text-slate-500">
              Avg score {p.avg} · {p.fails} fails · {p.overrides} overrides
            </div>
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="input w-auto" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
          <option value="all">All campaigns</option>
          {visible.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input className="input max-w-xs" placeholder="Search actor, action, detail…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">When</th>
              <th className="th">Actor</th>
              <th className="th">Action</th>
              <th className="th">Detail</th>
              <th className="th">Version</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const v = db.versions.find((x) => x.id === e.versionId)
              const a = v && db.assets.find((x) => x.id === v.assetId)
              return (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="td whitespace-nowrap text-xs text-slate-500">{fmt(e.at)}</td>
                  <td className="td whitespace-nowrap">{nameOf(db, e.actorId)}</td>
                  <td className="td">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{e.action}</span>
                  </td>
                  <td className="td text-slate-700">{e.detail}</td>
                  <td className="td whitespace-nowrap">
                    {v && a && (
                      <Link to={`/versions/${v.id}`} className="text-indigo-600 hover:underline">
                        {a.name} v{v.number}
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
