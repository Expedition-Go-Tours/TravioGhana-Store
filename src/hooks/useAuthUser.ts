import { useEffect, useState } from "react"
import { subscribeToAuthState, getStoredAuthUser, type AuthUser } from "../lib/auth"

/** Reactive current-user hook backed by lib/auth storage + listener. */
export function useAuthUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(getStoredAuthUser)

  useEffect(() => {
    const unsub = subscribeToAuthState((u) => setUser(u))
    return () => {
      unsub.then((fn) => fn())
    }
  }, [])

  return user
}
