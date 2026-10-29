import { PageHeader } from '../ui'

const STEPS = [
  ['1. Maker uploads', 'An asset is added to a campaign as a new version. Nothing is overwritten.'],
  ['2. AI scores', 'A background job runs three checks. Each returns a score 0–100, a written reason and the rule it came from.'],
  ['3. Checker reviews', 'A different person reads the assessment beside the artwork. They agree, override a single check, or send it back.'],
  ['4. Admin releases', 'Final confirmation on an approved version. The version is locked and the release record goes to the print vendor.'],
]

const GUARDS = [
  ['The model advises, it does not approve', 'Approval always needs a checker and a release always needs an admin.'],
  ['A verdict needs a reason', 'Every score carries a sentence and a rule reference. A fail needs a quote from the source, otherwise it is downgraded to "needs a human look".'],
  ['Scoring runs in the background', 'Upload returns immediately. Jobs retry with backoff (3 attempts). If they still fail, the version moves to manual review instead of staying stuck.'],
  ['Overrides are data', 'Every human decision is stored with the AI score it agreed or disagreed with. The audit page tracks the override rate.'],
  ['Prompt injection', 'Text extracted from an asset is untrusted data. Instructions such as "ignore the guidelines" are flagged and never followed.'],
  ['Non-determinism', 'Each score is stored with the prompt version and model version that produced it.'],
  ['Roles are enforced', 'Every action checks the role server-side (here: in the action layer). The maker of a version can never check it.'],
]

export default function About() {
  return (
    <>
      <PageHeader title="How it works" subtitle="An AI-assisted Maker–Checker platform for approving marketing assets." />
      <div className="mb-8 grid gap-3 md:grid-cols-4">
        {STEPS.map(([t, d]) => (
          <div key={t} className="card p-4">
            <div className="font-semibold text-indigo-700">{t}</div>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
      <div className="mb-8 grid gap-3 md:grid-cols-3">
        {[
          ['71 – 100', 'Passes the check', 'bg-emerald-50 text-emerald-700'],
          ['31 – 70', 'Needs a human look', 'bg-amber-50 text-amber-700'],
          ['0 – 30', 'Fails the check', 'bg-rose-50 text-rose-700'],
        ].map(([r, l, c]) => (
          <div key={r} className={`rounded-xl p-4 ${c}`}>
            <div className="text-xl font-bold">{r}</div>
            <div className="text-sm">{l}</div>
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-semibold">Design decisions and safeguards</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {GUARDS.map(([t, d]) => (
          <div key={t} className="card p-4">
            <div className="font-semibold">{t}</div>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
      <div className="card mt-8 p-4 text-sm text-slate-600">
        <b>Try the demo:</b> as <b>An Nguyen</b> (maker) upload a sample asset in Q4 Savings Push → switch to <b>Chi Le</b> (checker) and review it → switch to <b>Kent Phung</b> (admin) and release it. Reject once to see the version loop. Data is stored in your browser; use “Reset demo data” in the user menu to start over.
      </div>
    </>
  )
}
