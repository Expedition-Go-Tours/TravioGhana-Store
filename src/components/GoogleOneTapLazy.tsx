import { GoogleOAuthProvider, useGoogleOneTapLogin } from '@react-oauth/google'

/**
 * Isolated so `@react-oauth/google` is not part of the entry bundle: this
 * module is dynamically imported only after GoogleOneTapPrompt arms (signed
 * out, within caps, healthy connection).
 */
interface Props {
  clientId: string
  onSuccess: (credential?: string) => void
  onError: () => void
}

function OneTapInner({ onSuccess, onError }: { onSuccess: Props['onSuccess']; onError: Props['onError'] }) {
  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => onSuccess(credentialResponse?.credential),
    onError,
    cancel_on_tap_outside: false,
  })
  return null
}

export default function GoogleOneTapLazy({ clientId, onSuccess, onError }: Props) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <OneTapInner onSuccess={onSuccess} onError={onError} />
    </GoogleOAuthProvider>
  )
}
