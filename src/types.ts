export type Role = 'maker' | 'checker' | 'admin'

export type VersionStatus = 'draft' | 'scoring' | 'in_review' | 'approved' | 'rejected' | 'released'

export type CheckId = 'foreign_logo' | 'brand' | 'mas'

export type Band = 'pass' | 'review' | 'fail'

export interface User {
  id: string
  name: string
  email: string
  orgAdmin: boolean
}

export interface Membership {
  userId: string
  campaignId: string
  role: Role
}

export interface GuidelineDoc {
  id: string
  name: string
  kind: 'brand' | 'mas'
}

export interface Campaign {
  id: string
  name: string
  description: string
  ownerId: string
  deadline: string
  guidelines: GuidelineDoc[]
  createdAt: string
}

export interface Asset {
  id: string
  campaignId: string
  name: string
  createdBy: string
  createdAt: string
}

export interface HumanDecision {
  verdict: 'pass' | 'fail'
  comment: string
  by: string
  at: string
  isOverride: boolean
}

export interface CheckResult {
  check: CheckId
  score: number
  reason: string
  ruleRef: string
  quote?: string
  human?: HumanDecision
}

export interface ScoringJob {
  state: 'queued' | 'running' | 'done' | 'failed'
  attempts: number
  maxAttempts: number
  lastError?: string
  startedAt?: string
  finishedAt?: string
}

export interface Version {
  id: string
  assetId: string
  campaignId: string
  number: number
  fileName: string
  fileType: string
  fileSize: number
  preview?: string
  extractedText: string
  uploadedBy: string
  uploadedAt: string
  note: string
  status: VersionStatus
  job?: ScoringJob
  scores: CheckResult[]
  promptVersion?: string
  modelVersion?: string
  injectionFlag?: string
  manualReviewRequired?: boolean
  decision?: { verdict: 'approved' | 'rejected'; comment: string; by: string; at: string }
  release?: { by: string; at: string; comment: string }
}

export interface AuditEvent {
  id: string
  at: string
  actorId: string
  action: string
  campaignId?: string
  versionId?: string
  detail: string
}

export interface Notification {
  id: string
  userId: string
  at: string
  text: string
  link?: string
  read: boolean
}

export interface DB {
  users: User[]
  memberships: Membership[]
  campaigns: Campaign[]
  assets: Asset[]
  versions: Version[]
  audit: AuditEvent[]
  notifications: Notification[]
  currentUserId: string
}
