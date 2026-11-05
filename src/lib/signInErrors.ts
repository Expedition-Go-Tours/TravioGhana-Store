/**
 * Copy for a failed email/password sign-in.
 *
 * The backend sends three deliberate 401s where the credentials were not wrong
 * — the account simply cannot sign in this way. A generic "Email or password is
 * incorrect." is a dead end there: a Google-only user is stuck on a password
 * box with no idea the button they need is right next to it.
 *
 * Everything else stays generic. Never say which of the two credentials was
 * wrong, and never echo a server string that is not on this list.
 */

const SAFE_SIGN_IN_MESSAGES: Record<string, string> = {
  "This account uses social login. Please sign in with Google.":
    "This account uses Google sign-in. Use Continue with Google below — the password box cannot work for this account.",
  "Password not set. Please use the forgot password option to create one.":
    "This account has no password yet. Use Forgot password? to set one, then sign in with it.",
  "Account has been deactivated":
    "This account has been deactivated. Contact support if you think this is a mistake.",
}

interface SignInFailure {
  status?: number
  message?: string
}

export function getSignInErrorMessage(
  error: unknown,
  fallback = "Sign in failed. Please try again.",
): string {
  const failure = error as SignInFailure | null
  const status = failure?.status
  const message = failure?.message

  if (status === 401) {
    return (message && SAFE_SIGN_IN_MESSAGES[message]) || "Email or password is incorrect."
  }

  return message || fallback
}
