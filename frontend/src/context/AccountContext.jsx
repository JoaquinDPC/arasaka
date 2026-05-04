import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([])
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

  function select(id) {
    setSelectedId(id)
    if (id === null) localStorage.removeItem('arasaka_account_id')
    else localStorage.setItem('arasaka_account_id', String(id))
  }

  const selectedAccount = accounts.find(a => a.id === selectedId) ?? null

  return (
    <AccountContext.Provider value={{ accounts, selectedAccount, selectedId, select, reload }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
