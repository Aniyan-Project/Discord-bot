import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
export function useTicketUnsaved(dirty: boolean, message: string) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(message)) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker, message])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [dirty])
}
