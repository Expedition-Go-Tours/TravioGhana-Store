import { describe, expect, it } from 'vitest'
import { getSignInErrorMessage } from '../signInErrors'

const err = (status: number, message: string) => Object.assign(new Error(message), { status })

describe('getSignInErrorMessage', () => {
  it('tells a Google-only account to use Google', () => {
    const message = getSignInErrorMessage(
      err(401, 'This account uses social login. Please sign in with Google.'),
    )
    expect(message).toContain('Google sign-in')
    expect(message).toContain('Continue with Google')
  })

  it('points a password-less account at Forgot password?', () => {
    const message = getSignInErrorMessage(
      err(401, 'Password not set. Please use the forgot password option to create one.'),
    )
    expect(message).toContain('Forgot password?')
  })

  it('says when an account is deactivated', () => {
    expect(getSignInErrorMessage(err(401, 'Account has been deactivated'))).toContain('deactivated')
  })

  it('stays generic for a wrong password', () => {
    expect(getSignInErrorMessage(err(401, 'Invalid email or password'))).toBe(
      'Email or password is incorrect.',
    )
  })

  it('never echoes an unrecognised 401 string', () => {
    const message = getSignInErrorMessage(
      err(401, 'This account uses social login. Please sign in with Google. — plus injected text'),
    )
    expect(message).toBe('Email or password is incorrect.')
    expect(message).not.toContain('injected')
  })

  it('passes through non-401 failures and honours the fallback', () => {
    expect(getSignInErrorMessage(err(500, 'Something broke on our side'))).toBe(
      'Something broke on our side',
    )
    expect(getSignInErrorMessage(new Error('Network Error'))).toBe('Network Error')
    expect(getSignInErrorMessage({}, 'Please try again.')).toBe('Please try again.')
  })
})
