import { Link } from 'react-router-dom'
import { roleIn, useDB } from '../store'
import type { DB, Version } from '../types'
import { effectiveVerdict } from '../scoring'
import { Empty, PageHeader, StatusBadge, daysLeft, fmt, nameOf } from '../ui'

function Row({ db, v, note }: { db: DB; v: Version; note?: string }) {
  const asset = db.assets.find((a) => a.id === v.assetId)!
  const c = db.campaigns.find((x) => x.id === v.campaignId)!
  const dl = daysLeft(c.deadline)
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="td">
        <Link to={`/versions/${v.id}`} className="font-medium text-indigo-700 hover:underline">
          {asset.name} v{v.number}
        </Link>
        {note && <div className="text-xs text-amber-700">{note}</div>}
      </td>
      <td className="td text-slate-600">{c.name}</td>
      <td className={`td ${dl <= 3 ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>{dl}d</td>
      <td className="td">
        <div className="flex gap-1">
          {v.scores.map((s) => (
            <span key={s.check} className={`rounded px-1.5 text-xs font-semibold ${{ pass: 'bg-emerald-100 text-emerald-700', review: 'bg-amber-100 text-amber-700', fail: 'bg-rose-100 text-rose-700' }[effectiveVerdict(s)]}`}>
              {s.score}
            </span>
          ))}
          {v.scores.length === 0 && <span className="text-xs text-slate-400">—</span>}
        </div>
      </td>
      <td className="td text-slate-600">{nameOf(db, v.uploadedBy)}</td>
      <td className="td text-xs text-slate-500">{fmt(v.decision?.at ?? v.uploadedAt)}</td>
      <td className="td">
        <StatusBadge status={v.status} />
      </td>
    </tr>
  )
}

function Table({ db, rows, empty, notes }: { db: DB; rows: Version[]; empty: string; notes?: (v: Version) => string | undefined }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>
  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="th">Asset</th>
            <th className="th">Campaign</th>
            <th className="th">Deadline</th>
            <th className="th">AI scores</th>
            <th className="th">Maker</th>
            <th className="th">Updated</th>
            <th className="th">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <Row key={v.id} db={db} v={v} note={notes?.(v)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Queue() {
  const db = useDB()
  const me = db.currentUserId
  const byDeadline = (a: Version, b: Version) => {
    const ca = db.campaigns.find((c) => c.id === a.campaignId)!
    const cb = db.campaigns.find((c) => c.id === b.campaignId)!
    return ca.deadline.localeCompare(cb.deadline) || a.uploadedAt.localeCompare(b.uploadedAt)
  }
  const review = db.versions.filter((v) => v.status === 'in_review' && roleIn(db, me, v.campaignId) === 'checker').sort(byDeadline)
  const release = db.versions.filter((v) => v.status === 'approved' && roleIn(db, me, v.campaignId) === 'admin').sort(byDeadline)
  const mine = db.versions.filter((v) => v.uploadedBy === me && ['draft', 'scoring', 'rejected'].includes(v.status)).sort(byDeadline)
  const scoring = db.versions.filter((v) => v.status === 'scoring' && roleIn(db, me, v.campaignId))

  return (
    <>
      <PageHeader title="Review & release" subtitle="Work waiting on you, ordered by campaign deadline." />
      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Review queue · checker ({review.length})</h2>
        <Table
          db={db}
          rows={review}
          empty="Nothing waiting on you as a checker. Switch to Chi Le or Dung Pham to see the checker queue."
          notes={(v) => (v.uploadedBy === me ? 'You uploaded this; another checker must review it.' : v.manualReviewRequired ? 'AI scoring failed: manual review' : v.injectionFlag ? 'Prompt injection flagged' : undefined)}
        />
      </section>
      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Release queue · admin ({release.length})</h2>
        <Table db={db} rows={release} empty="Nothing approved and waiting for release. Switch to Kent Phung to see the admin queue." />
      </section>
      <section className="mb-8">
        <h2 className="mb-3 font-semibold">My uploads needing action · maker ({mine.length})</h2>
        <Table db={db} rows={mine} empty="No drafts or rejected versions of yours." notes={(v) => (v.status === 'rejected' ? `Rejected: ${v.decision?.comment}` : undefined)} />
      </section>
      {scoring.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Scoring in the background ({scoring.length})</h2>
          <Table db={db} rows={scoring} empty="" notes={(v) => (v.job?.lastError ? `Retrying: ${v.job.lastError}` : undefined)} />
        </section>
      )}
    </>
  )
}
