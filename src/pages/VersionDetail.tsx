import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { approveVersion, decideCheck, rejectVersion, releaseVersion, retryScoring, roleIn, submitDraft, useDB } from '../store'
import type { CheckResult, DB, Version } from '../types'
import { CHECK_LABELS, CHECK_QUESTIONS, band, effectiveVerdict } from '../scoring'
import { Artwork, BandBadge, Empty, RoleBadge, ScoreRing, StatusBadge, fmt, nameOf, useAction } from '../ui'

const STEPS = ['Maker uploads', 'AI scores', 'Checker reviews', 'Admin releases']

function stepIndex(v: Version) {
  return { draft: 0, scoring: 1, in_review: 2, approved: 3, rejected: 2, released: 4 }[v.status]
}

function Stepper({ v }: { v: Version }) {
  const idx = stepIndex(v)
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((s, i) => {
        const done = i < idx
        const active = i === idx
        const rejected = v.status === 'rejected' && i === 2
        return (
          <li key={s} className={`rounded-lg border px-3 py-2 text-xs ${rejected ? 'border-rose-200 bg-rose-50 text-rose-700' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : active ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400'}`}>
            <div className="font-semibold">Step {i + 1}</div>
            <div>{rejected ? 'Rejected → back to maker' : s}</div>
          </li>
        )
      })}
    </ol>
  )
}

export default function VersionDetail() {
  const { id } = useParams()
  const db = useDB()
  const v = db.versions.find((x) => x.id === id)
  const [compare, setCompare] = useState(false)
  if (!v) return <Empty>Version not found.</Empty>
  const asset = db.assets.find((a) => a.id === v.assetId)!
  const campaign = db.campaigns.find((c) => c.id === v.campaignId)!
  const siblings = db.versions.filter((x) => x.assetId === v.assetId).sort((a, b) => a.number - b.number)
  const prev = siblings.find((x) => x.number === v.number - 1)
  const myRole = roleIn(db, db.currentUserId, v.campaignId)
  const isUploader = v.uploadedBy === db.currentUserId
  const canDecide = myRole === 'checker' && !isUploader && v.status === 'in_review'

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/" className="hover:text-indigo-600">
          Campaigns
        </Link>{' '}
        /{' '}
        <Link to={`/campaigns/${campaign.id}`} className="hover:text-indigo-600">
          {campaign.name}
        </Link>{' '}
        / {asset.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {asset.name} <span className="font-mono text-slate-400">v{v.number}</span>
        </h1>
        <StatusBadge status={v.status} />
        {v.status === 'released' && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">🔒 Locked</span>}
        <span className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          You are <RoleBadge role={myRole} />
        </span>
      </div>
      <div className="mb-6">
        <Stepper v={v} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {siblings.map((s) => (
          <Link key={s.id} to={`/versions/${s.id}`} className={`rounded-lg px-3 py-1 text-sm font-medium ${s.id === v.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            v{s.number} <span className="text-xs opacity-70">{s.status.replace('_', ' ')}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Artwork</h2>
              {prev && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with v{prev.number}
                </label>
              )}
            </div>
            {compare && prev ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-500">v{prev.number} · {prev.status}</div>
                  <Artwork src={prev.preview} name={prev.fileName} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-500">v{v.number} · {v.status}</div>
                  <Artwork src={v.preview} name={v.fileName} />
                </div>
              </div>
            ) : (
              <Artwork src={v.preview} name={v.fileName} />
            )}
            {compare && prev && <CompareTable prev={prev} cur={v} />}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <Meta k="File" val={v.fileName} />
              <Meta k="Size" val={`${(v.fileSize / 1024).toFixed(0)} KB`} />
              <Meta k="Uploaded" val={`${nameOf(db, v.uploadedBy)}, ${fmt(v.uploadedAt)}`} />
              <Meta k="Prompt version" val={v.promptVersion ?? '—'} />
              <Meta k="Model version" val={v.modelVersion ?? '—'} />
              <Meta k="Job" val={v.job ? `${v.job.state}, attempt ${v.job.attempts}/${v.job.maxAttempts}` : 'not started'} />
            </dl>
            {v.extractedText && (
              <div className="mt-4">
                <div className="label">Extracted text (untrusted data)</div>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">{v.extractedText}</pre>
              </div>
            )}
            {v.note && (
              <p className="mt-3 text-sm text-slate-600">
                <b>Maker note:</b> {v.note}
              </p>
            )}
          </div>
          <History db={db} v={v} />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <JobPanel v={v} />
          {v.injectionFlag && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              <b>⚠ Prompt-injection guard.</b> {v.injectionFlag}
            </div>
          )}
          {v.scores.map((s) => (
            <CheckCard key={s.check} v={v} s={s} canDecide={canDecide} />
          ))}
          <ActionPanel db={db} v={v} />
        </div>
      </div>
    </>
  )
}

function Meta({ k, val }: { k: string; val: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{k}</dt>
      <dd className="truncate font-medium text-slate-700" title={val}>
        {val}
      </dd>
    </div>
  )
}

function CompareTable({ prev, cur }: { prev: Version; cur: Version }) {
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="th">Check</th>
          <th className="th">v{prev.number}</th>
          <th className="th">v{cur.number}</th>
          <th className="th">Δ</th>
        </tr>
      </thead>
      <tbody>
        {cur.scores.map((s) => {
          const p = prev.scores.find((x) => x.check === s.check)
          const d = p ? s.score - p.score : 0
          return (
            <tr key={s.check} className="border-b border-slate-100">
              <td className="td">{CHECK_LABELS[s.check]}</td>
              <td className="td">{p?.score ?? '—'}</td>
              <td className="td">{s.score}</td>
              <td className={`td font-semibold ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-600' : 'text-slate-400'}`}>{p ? (d > 0 ? `+${d}` : d) : ''}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function JobPanel({ v }: { v: Version }) {
  const { run, error } = useAction()
  if (v.status === 'draft')
    return (
      <div className="card p-4 text-sm text-slate-600">
        This version is a draft. The maker submits it to start AI scoring.
      </div>
    )
  if (v.status === 'scoring' && v.job)
    return (
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <div className="text-sm">
            <div className="font-semibold">{v.job.state === 'running' ? 'AI scoring in progress…' : 'Queued for scoring…'}</div>
            <div className="text-xs text-slate-500">
              Background job · attempt {Math.max(1, v.job.attempts)}/{v.job.maxAttempts}. You can leave this page.
            </div>
          </div>
        </div>
        {v.job.lastError && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Last attempt failed: {v.job.lastError}. Retrying with backoff.</div>}
      </div>
    )
  if (v.manualReviewRequired)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
        <b>AI scoring failed</b> after {v.job?.attempts} attempts ({v.job?.lastError}). The version was moved to manual review so it is not stuck. A checker can review it by hand, or anyone in the campaign can retry the job.
        <div className="mt-3">
          <button className="btn-ghost" onClick={() => run(() => retryScoring(v.id))}>
            ↻ Retry AI scoring
          </button>
        </div>
      </div>
    )
  return null
}

function CheckCard({ v, s, canDecide }: { v: Version; s: CheckResult; canDecide: boolean }) {
  const db = useDB()
  const { run, error } = useAction()
  const [comment, setComment] = useState('')
  const ai = band(s.score)
  const eff = effectiveVerdict(s)
  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <ScoreRing score={s.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{CHECK_LABELS[s.check]}</h3>
            <BandBadge b={ai} />
          </div>
          <p className="text-xs text-slate-400">{CHECK_QUESTIONS[s.check]}</p>
          <p className="mt-2 text-sm text-slate-700">{s.reason}</p>
          <p className="mt-2 text-xs text-slate-500">
            <b>Rule:</b> {s.ruleRef}
          </p>
          {s.quote && <blockquote className="mt-2 border-l-4 border-slate-300 pl-3 text-xs italic text-slate-600">“{s.quote}”</blockquote>}
        </div>
      </div>
      {s.human && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${s.human.isOverride ? 'bg-violet-50 text-violet-800' : 'bg-slate-50 text-slate-700'}`}>
          <b>{s.human.isOverride ? 'Overridden' : 'Confirmed'} by {nameOf(db, s.human.by)}:</b> {s.human.verdict}
          {s.human.comment && <> — “{s.human.comment}”</>}
          <div className="text-xs opacity-70">{fmt(s.human.at)}</div>
        </div>
      )}
      {canDecide && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {error}
          <input className="input mb-2" placeholder={ai === 'review' ? 'Comment (optional)' : 'Comment (required to override the model)'} value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="flex gap-2">
            <button className={`btn flex-1 ${eff === 'pass' && s.human ? 'bg-emerald-600 text-white' : 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`} onClick={() => run(() => decideCheck(v.id, s.check, 'pass', comment)) && setComment('')}>
              Mark pass{ai === 'fail' ? ' (override)' : ''}
            </button>
            <button className={`btn flex-1 ${eff === 'fail' && s.human ? 'bg-rose-600 text-white' : 'border border-rose-300 text-rose-700 hover:bg-rose-50'}`} onClick={() => run(() => decideCheck(v.id, s.check, 'fail', comment)) && setComment('')}>
              Mark fail{ai === 'pass' ? ' (override)' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionPanel({ db, v }: { db: DB; v: Version }) {
  const { run, error } = useAction()
  const [comment, setComment] = useState('')
  const myRole = roleIn(db, db.currentUserId, v.campaignId)
  const isUploader = v.uploadedBy === db.currentUserId

  const asset = db.assets.find((a) => a.id === v.assetId)!
  const download = () => {
    const record = {
      asset: asset.name,
      version: v.number,
      file: v.fileName,
      released_by: nameOf(db, v.release!.by),
      released_at: v.release!.at,
      approved_by: v.decision ? nameOf(db, v.decision.by) : null,
      scores: v.scores.map((s) => ({ check: s.check, score: s.score, reason: s.reason, rule: s.ruleRef, human: s.human ?? null })),
      prompt_version: v.promptVersion,
      model_version: v.modelVersion,
    }
    const files: [string, string][] = [[`${asset.name}-v${v.number}-release.json`, URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }))]]
    if (v.preview) files.push([v.fileName, v.preview])
    files.forEach(([name, href]) => {
      const a = document.createElement('a')
      a.href = href
      a.download = name
      a.click()
    })
  }

  let body: React.ReactNode = null
  if (v.status === 'draft') {
    body = (
      <>
        <p className="mb-3 text-sm text-slate-600">Submit this draft to queue the three AI checks.</p>
        <button className="btn-primary w-full" onClick={() => run(() => submitDraft(v.id))}>
          Submit for AI scoring
        </button>
        {myRole !== 'maker' && <Hint>Only a maker in this campaign can submit. The button is shown so you can see the server-side check refuse it.</Hint>}
      </>
    )
  } else if (v.status === 'in_review') {
    const unresolved = v.scores.filter((s) => effectiveVerdict(s) !== 'pass')
    body = (
      <>
        <h3 className="mb-1 font-semibold">Checker decision</h3>
        <p className="mb-3 text-sm text-slate-600">
          {v.scores.length === 0 ? 'No AI scores. Check the asset manually against the guidelines and record what you checked.' : unresolved.length ? `${unresolved.length} check(s) are not passing yet. Mark them pass with a reason, or reject.` : 'All checks pass. Approve to send to the admin.'}
        </p>
        <textarea className="input mb-2" rows={2} placeholder="Comment for the maker / admin" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-success flex-1" onClick={() => run(() => approveVersion(v.id, comment)) && setComment('')}>
            ✓ Approve
          </button>
          <button className="btn-danger flex-1" onClick={() => run(() => rejectVersion(v.id, comment)) && setComment('')}>
            ✕ Reject to maker
          </button>
        </div>
        {myRole !== 'checker' && <Hint>You are not a checker in this campaign. Try the buttons: the action layer refuses them.</Hint>}
        {myRole === 'checker' && isUploader && <Hint>You uploaded this version, so you cannot check it (separation of duties).</Hint>}
      </>
    )
  } else if (v.status === 'approved') {
    body = (
      <>
        <h3 className="mb-1 font-semibold">Admin release for print</h3>
        <p className="mb-3 text-sm text-slate-600">
          Approved by {nameOf(db, v.decision!.by)} on {fmt(v.decision!.at)}. Releasing is the point of no return: the version is locked and this record goes to the print vendor.
        </p>
        <textarea className="input mb-2" rows={2} placeholder="Release note (e.g. vendor, print run)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            onClick={() => {
              if (confirm('Release this version for print? It will be locked.')) run(() => releaseVersion(v.id, comment)) && setComment('')
            }}
          >
            Release for print
          </button>
          <button className="btn-ghost" onClick={() => run(() => rejectVersion(v.id, comment))}>
            Send back
          </button>
        </div>
        {myRole !== 'admin' && <Hint>Only an admin in this campaign can release.</Hint>}
      </>
    )
  } else if (v.status === 'released') {
    body = (
      <>
        <h3 className="mb-1 font-semibold">Released for print</h3>
        <dl className="mb-3 space-y-1 text-sm">
          <div>
            <b>Who:</b> {nameOf(db, v.release!.by)}
          </div>
          <div>
            <b>When:</b> {fmt(v.release!.at)}
          </div>
          <div>
            <b>Which version:</b> v{v.number} · {v.fileName}
          </div>
          {v.release!.comment && (
            <div>
              <b>Note:</b> {v.release!.comment}
            </div>
          )}
        </dl>
        <button className="btn-ghost w-full" onClick={download}>
          ↓ Export file + release record
        </button>
        <Hint>Released versions are locked. No further edits or versions can be added to this asset.</Hint>
      </>
    )
  } else if (v.status === 'rejected') {
    body = (
      <>
        <h3 className="mb-1 font-semibold text-rose-700">Rejected</h3>
        <p className="text-sm text-slate-700">
          “{v.decision?.comment}” — {v.decision && nameOf(db, v.decision.by)}, {v.decision && fmt(v.decision.at)}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          The maker uploads the fix as v{v.number + 1} from the{' '}
          <Link className="text-indigo-600 underline" to={`/campaigns/${v.campaignId}`}>
            campaign page
          </Link>
          .
        </p>
      </>
    )
  }

  return (
    <div className="card p-4">
      {error}
      {body}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-slate-500">{children}</p>
}

function History({ db, v }: { db: DB; v: Version }) {
  const events = db.audit.filter((e) => e.versionId === v.id)
  return (
    <div className="card p-4">
      <h2 className="mb-3 font-semibold">Decision history (v{v.number})</h2>
      {events.length === 0 && <p className="text-sm text-slate-500">No events.</p>}
      <ol className="relative space-y-4 border-l border-slate-200 pl-4">
        {events.map((e) => (
          <li key={e.id} className="text-sm">
            <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-400" />
            <div className="font-mono text-xs text-indigo-600">{e.action}</div>
            <div className="text-slate-700">{e.detail}</div>
            <div className="text-xs text-slate-400">
              {nameOf(db, e.actorId)} · {fmt(e.at)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
