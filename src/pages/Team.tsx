import { useState } from 'react'
import { inviteUser, roleIn, setMembership, useDB } from '../store'
import type { Role } from '../types'
import { Avatar, PageHeader, ROLE_STYLE, useAction } from '../ui'

const ROLE_INFO: Record<Role, string> = {
  maker: 'Uploads assets, answers rejections, uploads the next version.',
  checker: 'Reviews the AI assessment and decides the verdict.',
  admin: 'Manages members and campaigns, and releases for print.',
}

export default function Team() {
  const db = useDB()
  const me = db.users.find((u) => u.id === db.currentUserId)!
  const { run, error } = useAction()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  return (
    <>
      <PageHeader title="Team & roles" subtitle="Roles are assigned per campaign. Permissions decide which actions each person can take." />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
          <div key={r} className="card p-4">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${ROLE_STYLE[r]}`}>{r}</span>
            <p className="mt-2 text-sm text-slate-600">{ROLE_INFO[r]}</p>
          </div>
        ))}
      </div>
      {error}
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Member</th>
              {db.campaigns.map((c) => (
                <th key={c.id} className="th">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="td">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} />
                    <div>
                      <div className="font-medium">
                        {u.name} {u.orgAdmin && <span className="ml-1 rounded bg-slate-800 px-1 text-[10px] text-white">ORG ADMIN</span>}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                {db.campaigns.map((c) => (
                  <td key={c.id} className="td">
                    <select
                      className="input w-36 py-1"
                      value={roleIn(db, u.id, c.id) ?? ''}
                      onChange={(e) => run(() => setMembership(c.id, u.id, (e.target.value || null) as Role | null))}
                    >
                      <option value="">— none —</option>
                      <option value="maker">Maker</option>
                      <option value="checker">Checker</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card max-w-xl p-4">
        <h2 className="mb-3 font-semibold">Invite a member</h2>
        {!me.orgAdmin && <p className="mb-3 text-xs text-slate-500">Only an org admin can invite. Switch to Kent Phung, or try anyway to see the refusal.</p>}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (run(() => inviteUser(name, email))) {
              setName('')
              setEmail('')
            }
          }}
        >
          <input className="input flex-1" required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input flex-1" required type="email" placeholder="email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary">Invite</button>
        </form>
      </div>
    </>
  )
}
