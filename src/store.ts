import { useSyncExternalStore } from 'react'
import type { AuditEvent, CheckId, DB, Role, Version, VersionStatus } from './types'
import { CHECK_LABELS, MODEL_VERSION, PROMPT_VERSION, band, effectiveVerdict, scoreVersion, simulateFault } from './scoring'
import { seed } from './seed'

const KEY = 'bcai-db-v1'

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`
const now = () => new Date().toISOString()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* storage unavailable */
  }
  return seed()
}

let db: DB = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Quota exceeded: drop large previews of older versions and retry once.
    try {
      db.versions.slice(0, -3).forEach((v) => {
        if (v.preview && v.preview.length > 200_000) v.preview = undefined
      })
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* keep in memory only */
    }
  }
}

function commit(mutator: (d: DB) => void) {
  const next = structuredClone(db)
  mutator(next)
  db = next
  persist()
  listeners.forEach((l) => l())
}

export function useDB(): DB {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => db,
  )
}

export function getDB() {
  return db
}

export function resetDemo() {
  db = seed()
  persist()
  listeners.forEach((l) => l())
  resumeJobs()
}

// ---------- permissions (enforced in every action, not only hidden in the UI) ----------

export class PermissionError extends Error {}

export function roleIn(d: DB, userId: string, campaignId: string): Role | undefined {
  return d.memberships.find((m) => m.userId === userId && m.campaignId === campaignId)?.role
}

function require(d: DB, campaignId: string, roles: Role[], what: string) {
  const r = roleIn(d, d.currentUserId, campaignId)
  if (!r || !roles.includes(r)) {
    throw new PermissionError(`Not allowed: ${what} requires role ${roles.join(' or ')} in this campaign (you are ${r ?? 'not a member'}).`)
  }
}

function requireOrgAdmin(d: DB, what: string) {
  const u = d.users.find((x) => x.id === d.currentUserId)
  if (!u?.orgAdmin) throw new PermissionError(`Not allowed: ${what} requires an organisation admin.`)
}

function audit(d: DB, e: Omit<AuditEvent, 'id' | 'at' | 'actorId'> & { actorId?: string }) {
  d.audit.push({ id: uid('evt'), at: now(), actorId: e.actorId ?? d.currentUserId, ...e })
}

function notify(d: DB, userId: string, text: string, link?: string) {
  d.notifications.unshift({ id: uid('ntf'), userId, at: now(), text, link, read: false })
}

function getVersion(d: DB, id: string): Version {
  const v = d.versions.find((x) => x.id === id)
  if (!v) throw new Error('Version not found')
  return v
}

function assertStatus(v: Version, allowed: VersionStatus[]) {
  if (!allowed.includes(v.status)) throw new Error(`Version is ${v.status}; this action needs ${allowed.join('/')}.`)
}

const userName = (d: DB, id: string) => d.users.find((u) => u.id === id)?.name ?? id

// ---------- actions ----------

export function switchUser(userId: string) {
  commit((d) => {
    d.currentUserId = userId
  })
}

export function createCampaign(input: { name: string; description: string; ownerId: string; deadline: string }) {
  let id = ''
  commit((d) => {
    requireOrgAdmin(d, 'creating a campaign')
    id = uid('cmp')
    d.campaigns.push({ id, ...input, guidelines: [], createdAt: now() })
    d.memberships.push({ userId: d.currentUserId, campaignId: id, role: 'admin' })
    if (input.ownerId !== d.currentUserId) d.memberships.push({ userId: input.ownerId, campaignId: id, role: 'maker' })
    audit(d, { action: 'campaign.created', campaignId: id, detail: `Campaign “${input.name}” created, deadline ${input.deadline}` })
  })
  return id
}

export function addGuideline(campaignId: string, name: string, kind: 'brand' | 'mas') {
  commit((d) => {
    require(d, campaignId, ['admin'], 'attaching guideline documents')
    const c = d.campaigns.find((x) => x.id === campaignId)!
    c.guidelines.push({ id: uid('doc'), name, kind })
    audit(d, { action: 'guideline.attached', campaignId, detail: `Attached ${kind === 'mas' ? 'MAS rules' : 'brand guideline'} “${name}”` })
  })
}

export function setMembership(campaignId: string, userId: string, role: Role | null) {
  commit((d) => {
    require(d, campaignId, ['admin'], 'managing members')
    d.memberships = d.memberships.filter((m) => !(m.userId === userId && m.campaignId === campaignId))
    if (role) d.memberships.push({ userId, campaignId, role })
    audit(d, { action: 'member.role_changed', campaignId, detail: `${userName(d, userId)} → ${role ?? 'removed'}` })
  })
}

export function inviteUser(name: string, email: string) {
  commit((d) => {
    requireOrgAdmin(d, 'inviting members')
    if (d.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error('A member with this email already exists.')
    d.users.push({ id: uid('usr'), name, email, orgAdmin: false })
    audit(d, { action: 'member.invited', detail: `Invited ${name} <${email}>` })
  })
}

export interface UploadInput {
  campaignId: string
  assetId?: string
  assetName: string
  fileName: string
  fileType: string
  fileSize: number
  preview?: string
  extractedText: string
  note: string
  submit: boolean
}

export function uploadVersion(input: UploadInput): string {
  let versionId = ''
  commit((d) => {
    require(d, input.campaignId, ['maker'], 'uploading an asset')
    let assetId = input.assetId
    if (!assetId) {
      assetId = uid('ast')
      d.assets.push({ id: assetId, campaignId: input.campaignId, name: input.assetName, createdBy: d.currentUserId, createdAt: now() })
    } else {
      const prev = d.versions.filter((v) => v.assetId === assetId)
      if (prev.some((v) => v.status === 'released')) throw new Error('This asset has a released version and is locked.')
      if (prev.some((v) => ['draft', 'scoring', 'in_review', 'approved'].includes(v.status)))
        throw new Error('The current version is still in the flow. A new version can be uploaded after a rejection.')
    }
    const number = d.versions.filter((v) => v.assetId === assetId).length + 1
    versionId = uid('ver')
    d.versions.push({
      id: versionId,
      assetId,
      campaignId: input.campaignId,
      number,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      preview: input.preview,
      extractedText: input.extractedText,
      uploadedBy: d.currentUserId,
      uploadedAt: now(),
      note: input.note,
      status: 'draft',
      scores: [],
    })
    audit(d, { action: 'version.uploaded', campaignId: input.campaignId, versionId, detail: `${input.assetName} v${number} uploaded (${input.fileName})` })
    if (input.submit) queueScoring(d, versionId)
  })
  if (input.submit) scheduleJob(versionId)
  return versionId
}

function queueScoring(d: DB, versionId: string) {
  const v = getVersion(d, versionId)
  v.status = 'scoring'
  v.scores = []
  v.manualReviewRequired = false
  v.job = { state: 'queued', attempts: 0, maxAttempts: 3 }
  audit(d, { action: 'scoring.queued', campaignId: v.campaignId, versionId, detail: `AI scoring job queued (${PROMPT_VERSION})` })
}

export function submitDraft(versionId: string) {
  commit((d) => {
    const v = getVersion(d, versionId)
    require(d, v.campaignId, ['maker'], 'submitting for scoring')
    assertStatus(v, ['draft'])
    queueScoring(d, versionId)
  })
  scheduleJob(versionId)
}

export function retryScoring(versionId: string) {
  commit((d) => {
    const v = getVersion(d, versionId)
    require(d, v.campaignId, ['maker', 'checker', 'admin'], 'retrying a scoring job')
    if (!(v.status === 'in_review' && v.manualReviewRequired) && v.job?.state !== 'failed') throw new Error('Nothing to retry.')
    queueScoring(d, versionId)
  })
  scheduleJob(versionId)
}

// ---------- background scoring worker (simulated job queue) ----------

const timers = new Map<string, number>()

function scheduleJob(versionId: string, delay = 600) {
  if (timers.has(versionId)) return
  timers.set(versionId, window.setTimeout(() => runJob(versionId), delay))
}

function runJob(versionId: string) {
  timers.delete(versionId)
  const v = db.versions.find((x) => x.id === versionId)
  if (!v || v.status !== 'scoring' || !v.job) return
  commit((d) => {
    const x = getVersion(d, versionId)
    x.job!.state = 'running'
    x.job!.attempts += 1
    x.job!.startedAt = now()
  })
  const duration = 1500 + Math.random() * 2000
  timers.set(
    versionId,
    window.setTimeout(() => {
      timers.delete(versionId)
      const cur = db.versions.find((x) => x.id === versionId)
      if (!cur || cur.status !== 'scoring' || !cur.job) return
      const fault = simulateFault(cur.fileName, cur.job.attempts)
      let retry = false
      commit((d) => {
        const x = getVersion(d, versionId)
        const job = x.job!
        if (fault) {
          job.lastError = fault
          audit(d, { action: 'scoring.attempt_failed', actorId: 'system', campaignId: x.campaignId, versionId, detail: `Attempt ${job.attempts}/${job.maxAttempts}: ${fault}` })
          if (job.attempts < job.maxAttempts) {
            job.state = 'queued'
            retry = true
          } else {
            // Never leave a version stuck in scoring: hand it to a human.
            job.state = 'failed'
            job.finishedAt = now()
            x.status = 'in_review'
            x.manualReviewRequired = true
            audit(d, { action: 'scoring.failed', actorId: 'system', campaignId: x.campaignId, versionId, detail: 'AI scoring gave up after retries; version moved to manual review' })
            notifyCheckers(d, x, `AI scoring failed for ${assetName(d, x)} v${x.number}; manual review needed`)
          }
          return
        }
        const out = scoreVersion(x.fileName, x.extractedText, x.id + job.attempts)
        x.scores = out.scores
        x.injectionFlag = out.injectionFlag
        x.promptVersion = PROMPT_VERSION
        x.modelVersion = MODEL_VERSION
        job.state = 'done'
        job.finishedAt = now()
        x.status = 'in_review'
        audit(d, {
          action: 'scoring.completed',
          actorId: 'system',
          campaignId: x.campaignId,
          versionId,
          detail: out.scores.map((s) => `${CHECK_LABELS[s.check]} ${s.score}`).join(' · ') + ` [${PROMPT_VERSION}, ${MODEL_VERSION}]`,
        })
        if (out.injectionFlag) audit(d, { action: 'scoring.injection_flagged', actorId: 'system', campaignId: x.campaignId, versionId, detail: out.injectionFlag })
        notifyCheckers(d, x, `${assetName(d, x)} v${x.number} is ready for review`)
      })
      if (retry) scheduleJob(versionId, 1000 * 2 ** (getVersion(db, versionId).job!.attempts - 1))
    }, duration),
  )
}

function assetName(d: DB, v: Version) {
  return d.assets.find((a) => a.id === v.assetId)?.name ?? 'Asset'
}

function notifyCheckers(d: DB, v: Version, text: string) {
  d.memberships.filter((m) => m.campaignId === v.campaignId && m.role === 'checker').forEach((m) => notify(d, m.userId, text, `/versions/${v.id}`))
}

export function resumeJobs() {
  const pending = db.versions.filter((v) => v.status === 'scoring')
  if (pending.length) {
    commit((d) => {
      d.versions.filter((v) => v.status === 'scoring' && v.job?.state === 'running').forEach((v) => (v.job!.state = 'queued'))
    })
  }
  pending.forEach((v) => scheduleJob(v.id, 800))
}

// ---------- checker ----------

function requireChecker(d: DB, v: Version, what: string) {
  require(d, v.campaignId, ['checker'], what)
  if (v.uploadedBy === d.currentUserId) throw new PermissionError('Separation of duties: the maker who uploaded this version cannot check it.')
}

export function decideCheck(versionId: string, check: CheckId, verdict: 'pass' | 'fail', comment: string) {
  commit((d) => {
    const v = getVersion(d, versionId)
    requireChecker(d, v, 'deciding a check')
    assertStatus(v, ['in_review'])
    const s = v.scores.find((x) => x.check === check)
    if (!s) throw new Error('Check not found')
    const ai = band(s.score)
    const isOverride = ai !== 'review' && ai !== verdict
    if (isOverride && !comment.trim()) throw new Error('An override needs a comment explaining why you disagree with the model.')
    s.human = { verdict, comment, by: d.currentUserId, at: now(), isOverride }
    audit(d, {
      action: isOverride ? 'check.overridden' : 'check.confirmed',
      campaignId: v.campaignId,
      versionId,
      detail: `${CHECK_LABELS[check]}: AI ${s.score} (${ai}) → human ${verdict}${comment ? ` — “${comment}”` : ''}`,
    })
  })
}

export function approveVersion(versionId: string, comment: string) {
  commit((d) => {
    const v = getVersion(d, versionId)
    requireChecker(d, v, 'approving')
    assertStatus(v, ['in_review'])
    if (v.manualReviewRequired && !comment.trim()) throw new Error('AI scoring failed for this version; record what you checked manually in the comment.')
    const open = v.scores.filter((s) => effectiveVerdict(s) !== 'pass')
    if (open.length) throw new Error(`Resolve these checks first (mark them pass, or reject): ${open.map((s) => CHECK_LABELS[s.check]).join(', ')}`)
    v.status = 'approved'
    v.decision = { verdict: 'approved', comment, by: d.currentUserId, at: now() }
    audit(d, { action: 'version.approved', campaignId: v.campaignId, versionId, detail: `Checker approved${comment ? `: “${comment}”` : ''}` })
    d.memberships.filter((m) => m.campaignId === v.campaignId && m.role === 'admin').forEach((m) => notify(d, m.userId, `${assetName(d, v)} v${v.number} approved, waiting for release`, `/versions/${v.id}`))
  })
}

export function rejectVersion(versionId: string, comment: string) {
  commit((d) => {
    const v = getVersion(d, versionId)
    if (v.status === 'approved') require(d, v.campaignId, ['admin'], 'sending back an approved version')
    else requireChecker(d, v, 'rejecting')
    assertStatus(v, ['in_review', 'approved'])
    if (!comment.trim()) throw new Error('A rejection needs a comment for the maker.')
    v.status = 'rejected'
    v.decision = { verdict: 'rejected', comment, by: d.currentUserId, at: now() }
    audit(d, { action: 'version.rejected', campaignId: v.campaignId, versionId, detail: `Sent back to maker: “${comment}”` })
    notify(d, v.uploadedBy, `${assetName(d, v)} v${v.number} was rejected: ${comment}`, `/versions/${v.id}`)
  })
}

// ---------- admin ----------

export function releaseVersion(versionId: string, comment: string) {
  commit((d) => {
    const v = getVersion(d, versionId)
    require(d, v.campaignId, ['admin'], 'releasing for print')
    assertStatus(v, ['approved'])
    v.status = 'released'
    v.release = { by: d.currentUserId, at: now(), comment }
    audit(d, { action: 'version.released', campaignId: v.campaignId, versionId, detail: `Released for print: ${assetName(d, v)} v${v.number} (${v.fileName})${comment ? ` — “${comment}”` : ''}` })
    const c = d.campaigns.find((x) => x.id === v.campaignId)!
    notify(d, c.ownerId, `${assetName(d, v)} v${v.number} released for print`, `/versions/${v.id}`)
    notify(d, v.uploadedBy, `${assetName(d, v)} v${v.number} released for print`, `/versions/${v.id}`)
  })
}

export function markNotificationsRead() {
  commit((d) => {
    d.notifications.forEach((n) => {
      if (n.userId === d.currentUserId) n.read = true
    })
  })
}
