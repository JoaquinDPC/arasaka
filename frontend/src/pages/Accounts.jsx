import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import Spinner from '../components/Spinner'

const ACCOUNT_TYPES = ['Cuenta corriente', 'Cuenta de ahorro', 'Cuenta vista', 'Inversión', 'Otra']
const CURRENCIES = ['CLP', 'USD', 'EUR']

const TYPE_COLORS = {
  'Cuenta corriente': 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  'Cuenta de ahorro':  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  'Cuenta vista':      'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  'Inversión':         'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  'Otra':              'bg-slate-500/20 text-slate-300 border border-slate-500/30',
}

const DOT_COLORS = ['bg-violet-400', 'bg-emerald-400', 'bg-cyan-400', 'bg-amber-400', 'bg-rose-400', 'bg-indigo-400']

function AccountCard({ account, dotColor, onDeleted }) {
  const badgeCls = TYPE_COLORS[account.type] ?? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
  const balance  = account.balance ?? 0
  const lastDate = account.last_movement
    ? new Date(account.last_movement).toISOString().slice(0, 10)
    : null

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3 relative">
      <div className="flex items-start justify-between">
        <span className={`w-2.5 h-2.5 rounded-full mt-0.5 ${dotColor}`} />
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
          {account.type || 'Cuenta'}
        </span>
      </div>
      <div>
        <p className="text-xs text-white/35">{account.bank_name}</p>
        <p className="text-base font-bold text-white mt-0.5">{account.name}</p>
      </div>
      <p className={`text-2xl font-bold tabular ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {formatCLP(balance)}
      </p>
      <p className="text-xs text-white/25">
        {account.movement_count ?? 0} movimientos
        {lastDate && <> · último: {lastDate}</>}
      </p>
    </div>
  )
}

function AddModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    bank_name: '',
    name:      '',
    type:      ACCOUNT_TYPES[0],
    currency:  'CLP',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.bank_name || !form.name) return
    setSaving(true)
    setError(null)
    try {
      await api.createAccount(form)
      onSaved()
    } catch {
      setError('No se pudo crear la cuenta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-strong rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Nueva cuenta</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl leading-none transition-colors">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] text-white/35 mb-1">Banco</label>
            <input
              type="text" value={form.bank_name} onChange={e => set('bank_name', e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm w-full" required placeholder="Ej: Banco de Chile"
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/35 mb-1">Nombre de la cuenta</label>
            <input
              type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm w-full" required placeholder="Ej: Cuenta principal"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/35 mb-1">Tipo</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm w-full">
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-white/35 mb-1">Moneda</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm w-full">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer">
              {saving ? 'Guardando…' : 'Crear cuenta'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl glass text-white/50 hover:text-white text-sm transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)

  function load() {
    setLoading(true)
    api.accounts()
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 max-w-4xl">
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cuentas</h1>
          <p className="text-white/35 text-sm mt-0.5">Gestiona tus cuentas bancarias</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          + Nueva cuenta
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {accounts.map((acc, i) => (
            <AccountCard
              key={acc.id}
              account={acc}
              dotColor={DOT_COLORS[i % DOT_COLORS.length]}
              onDeleted={load}
            />
          ))}

          {/* Empty add card */}
          <button
            onClick={() => setShowAdd(true)}
            className="glass rounded-2xl p-5 flex flex-col items-center justify-center gap-2 border-dashed hover:bg-white/5 transition-colors cursor-pointer min-h-[160px]"
          >
            <span className="text-3xl text-white/20">+</span>
            <span className="text-xs text-white/25">Nueva cuenta</span>
          </button>
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <p className="text-center py-8 text-white/25 text-sm">
          No hay cuentas. Crea una para comenzar.
        </p>
      )}
    </div>
  )
}
