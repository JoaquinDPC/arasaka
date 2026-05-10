import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api/client'

const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([])
  const [syncVersion, setSyncVersion] = useState(0)
  const [selectedId, setSelectedId] = useState(() => {
    const stored = localStorage.getItem('arasaka_account_id')
    return stored ? parseInt(stored, 10) : null
  })

  const reload = useCallback(() => {
    api.accounts()
      .then(d => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (selectedId !== null && accounts.length > 0 && !accounts.find(a => a.id === selectedId)) {
      select(null)
    }
  }, [accounts, selectedId])

  const select = useCallback((id) => {
    setSelectedId(id)
    if (id === null) localStorage.removeItem('arasaka_account_id')
    else localStorage.setItem('arasaka_account_id', String(id))
  }, [])

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedId) ?? null,
    [accounts, selectedId]
  )

  const notifySynced = useCallback(() => setSyncVersion(v => v + 1), [])

  const contextValue = useMemo(
    () => ({ accounts, selectedAccount, selectedId, select, reload, syncVersion, notifySynced }),
    [accounts, selectedAccount, selectedId, select, reload, syncVersion, notifySynced]
  )

  return (
    <AccountContext.Provider value={contextValue}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
