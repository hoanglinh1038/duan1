import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addGuideline, roleIn, uploadVersion, useDB } from '../store'
import type { Asset } from '../types'
import { SAMPLE_ASSETS } from '../seed'
import { Artwork, Empty, Modal, PageHeader, RoleBadge, StatusBadge, daysLeft, fmt, fmtDate, nameOf, useAction } from '../ui'
import { ProgressBar, progress } from './Campaigns'
import { effectiveVerdict } from '../scoring'

export default function CampaignDetail() {
  const { id } = useParams()
  const db = useDB()
  const c = db.campaigns.find((x) => x.id === id)
  const [upload, setUpload] = useState<{ asset?: Asset } | null>(null)
  const [doc, setDoc] = useState(false)
  if (!c) return <Empty>Campaign not found.</Empty>
  const myRole = roleIn(db, db.currentUserId, c.id)
  const assets = db.assets.filter((a) => a.campaignId === c.id)
  const members = db.memberships.filter((m) => m.campaignId === c.id)

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/" className="hover:text-indigo-600">
          Campaigns
        </Link>{' '}
        / {c.name}
      </div>
      <PageHeader
        title={c.name}
        subtitle={
          <>
            {c.description} · Owner {nameOf(db, c.ownerId)} · Deadline {fmtDate(c.deadline)} ({daysLeft(c.deadline)}d left) · You are <RoleBadge role={myRole} />
          </>
        }
        actions={
          <button className="btn-primary" onClick={() => setUpload({})} title={myRole === 'maker' ? '' : 'Only makers can upload'}>
            + Upload asset
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <ProgressBar p={progress(db, c.id)} />
          </div>
          {assets.length === 0 && <Empty>No assets yet. A maker can upload the first one.</Empty>}
          {assets.map((a) => {
            const versions = db.versions.filter((v) => v.assetId === a.id).sort((x, y) => y.number - x.number)
            const latest = versions[0]
            const canNew = myRole === 'maker' && latest?.status === 'rejected'
            return (
              <div key={a.id} className="card overflow-hidden">
                <div className="flex flex-col gap-4 p-4 sm:flex-row">
                  <div className="w-full sm:w-44">
                    <Artwork src={latest?.preview} name={latest?.fileName ?? a.name} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{a.name}</h3>
                      {latest && <StatusBadge status={latest.status} />}
                    </div>
                    <p className="text-xs text-slate-500">Created by {nameOf(db, a.createdBy)} · {versions.length} version(s)</p>
                    {latest?.status === 'rejected' && latest.decision && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <b>Rejected:</b> {latest.decision.comment}
                      </p>
                    )}
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full">
                        <tbody>
                          {versions.map((v) => (
                            <tr key={v.id} className="border-t border-slate-100">
                              <td className="td font-mono text-xs font-semibold">v{v.number}</td>
                              <td className="td text-xs text-slate-500">{v.fileName}</td>
                              <td className="td">
                                <StatusBadge status={v.status} />
                              </td>
                              <td className="td text-xs">
                                {v.scores.map((s) => (
                                  <span key={s.check} className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${{ pass: 'bg-emerald-500', review: 'bg-amber-400', fail: 'bg-rose-500' }[effectiveVerdict(s)]}`} title={`${s.check}: ${s.score}`} />
                                ))}
                              </td>
                              <td className="td text-right">
                                <Link to={`/versions/${v.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                                  Open →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {canNew && (
                      <button className="btn-primary mt-3" onClick={() => setUpload({ asset: a })}>
                        Upload v{latest.number + 1}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Guideline documents</h3>
              {myRole === 'admin' && (
                <button className="text-sm font-medium text-indigo-600" onClick={() => setDoc(true)}>
                  + Attach
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {c.guidelines.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${g.kind === 'mas' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>{g.kind}</span>
                  {g.name}
                </li>
              ))}
              {c.guidelines.length === 0 && <li className="text-sm text-slate-500">None attached. The document check needs at least one.</li>}
            </ul>
          </div>
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Members</h3>
              <Link to="/team" className="text-sm font-medium text-indigo-600">
                Manage
              </Link>
            </div>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between text-sm">
                  {nameOf(db, m.userId)} <RoleBadge role={m.role} />
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="mb-3 font-semibold">Recent activity</h3>
            <ul className="space-y-3">
              {db.audit
                .filter((e) => e.campaignId === c.id)
                .slice(-6)
                .reverse()
                .map((e) => (
                  <li key={e.id} className="text-xs">
                    <div className="text-slate-700">{e.detail}</div>
                    <div className="text-slate-400">
                      {nameOf(db, e.actorId)} · {fmt(e.at)}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>

      {upload && <UploadModal campaignId={c.id} asset={upload.asset} onClose={() => setUpload(null)} />}
      <AttachDoc open={doc} campaignId={c.id} onClose={() => setDoc(false)} />
    </>
  )
}

function readFile(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size > 1_500_000) return resolve(undefined)
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => resolve(undefined)
    r.readAsDataURL(file)
  })
}

function UploadModal({ campaignId, asset, onClose }: { campaignId: string; asset?: Asset; onClose: () => void }) {
  const nav = useNavigate()
  const { run, error } = useAction()
  const [assetName, setAssetName] = useState(asset?.name ?? '')
  const [file, setFile] = useState<{ name: string; type: string; size: number; preview?: string } | null>(null)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')

  const submit = (submitNow: boolean) => {
    if (!file) return
    let id = ''
    if (
      run(() => {
        id = uploadVersion({ campaignId, assetId: asset?.id, assetName: assetName || file.name, fileName: file.name, fileType: file.type, fileSize: file.size, preview: file.preview, extractedText: text, note, submit: submitNow })
      })
    ) {
      onClose()
      nav(`/versions/${id}`)
    }
  }

  return (
    <Modal open onClose={onClose} title={asset ? `Upload a new version of “${asset.name}”` : 'Upload asset'}>
      {error}
      <div className="space-y-4">
        {!asset && (
          <div>
            <label className="label">Asset name</label>
            <input className="input" value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Bus stop poster" />
          </div>
        )}
        <div>
          <label className="label">File (image or PDF)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setFile({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, preview: await readFile(f) })
              if (!assetName) setAssetName(f.name.replace(/\.[^.]+$/, ''))
            }}
          />
          <p className="mt-2 text-xs text-slate-500">Or use a sample asset to see each outcome:</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {SAMPLE_ASSETS.map((s) => (
              <button
                key={s.fileName}
                type="button"
                className="rounded-full border border-slate-200 px-2 py-1 text-xs hover:border-indigo-300 hover:bg-indigo-50"
                onClick={() => {
                  setFile({ name: s.fileName, type: 'image/svg+xml', size: s.preview.length, preview: s.preview })
                  setText(s.text)
                  if (!asset && !assetName) setAssetName(s.label.split(' (')[0])
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {file && (
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
            <div className="w-24">
              <Artwork src={file.preview} name={file.name} />
            </div>
            <div className="text-sm">
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-slate-500">
                {file.type} · {(file.size / 1024).toFixed(0)} KB
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="label">Text in the artwork (simulated OCR)</label>
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Headline, body copy and small print as it appears on the asset" />
          <p className="mt-1 text-xs text-slate-500">In production this is extracted from the file. It is untrusted input and is never treated as instructions.</p>
        </div>
        <div>
          <label className="label">Note for the checker</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" disabled={!file} onClick={() => submit(false)}>
            Save as draft
          </button>
          <button className="btn-primary" disabled={!file} onClick={() => submit(true)}>
            Upload &amp; start AI scoring
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AttachDoc({ open, campaignId, onClose }: { open: boolean; campaignId: string; onClose: () => void }) {
  const { run, error } = useAction()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'brand' | 'mas'>('brand')
  return (
    <Modal open={open} onClose={onClose} title="Attach guideline document">
      {error}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => addGuideline(campaignId, name, kind))) {
            setName('')
            onClose()
          }
        }}
      >
        <div>
          <label className="label">Document</label>
          <input
            type="file"
            accept="application/pdf"
            className="mb-2 block w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setName(f.name)
            }}
          />
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Document name" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as 'brand' | 'mas')}>
            <option value="brand">Brand / compliance guideline</option>
            <option value="mas">MAS advertising rules</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary">Attach</button>
        </div>
      </form>
    </Modal>
  )
}
