import { describe, expect, it } from 'vitest'
import { parseGoogleMapsLocation } from '../googleMapsLink'

describe('parseGoogleMapsLocation', () => {
  it('prefers the exact place pin (!3d/!4d) over the @ viewport, and reads the place name', () => {
    const url =
      'https://www.google.com/maps/place/Kaneshie+Market/@5.57,-0.25,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d5.5735016!4d-0.2456554!16s%2Fm%2F02qfnpq'
    expect(parseGoogleMapsLocation(url)).toEqual({
      ok: true,
      lat: 5.5735016,
      lng: -0.2456554,
      label: 'Kaneshie Market',
    })
  })

  it('reads the @ viewport centre when there is no exact place pin', () => {
    expect(parseGoogleMapsLocation('https://www.google.com/maps/@5.6037,-0.1870,15z')).toEqual({
      ok: true,
      lat: 5.6037,
      lng: -0.187,
    })
  })

  it('reads a URL without the scheme', () => {
    expect(parseGoogleMapsLocation('www.google.com/maps/@5.6037,-0.187,15z')).toEqual({
      ok: true,
      lat: 5.6037,
      lng: -0.187,
    })
  })

  it('reads ?q= coordinates', () => {
    expect(parseGoogleMapsLocation('https://maps.google.com/?q=5.6037,-0.1870')).toEqual({
      ok: true,
      lat: 5.6037,
      lng: -0.187,
    })
  })

  it('decodes URL-encoded commas and the loc: prefix', () => {
    expect(parseGoogleMapsLocation('https://www.google.com/maps?q=loc%3A5.6037%2C-0.1870')).toEqual({
      ok: true,
      lat: 5.6037,
      lng: -0.187,
    })
  })

  it('reads the query, ll and center parameters', () => {
    const query = parseGoogleMapsLocation('https://www.google.com/maps/search/?api=1&query=5.6037%2C-0.1870')
    expect(query.ok && query.lat === 5.6037 && query.lng === -0.187).toBe(true)

    const ll = parseGoogleMapsLocation('https://maps.google.com/?ll=5.6037,-0.187')
    expect(ll.ok && ll.lat === 5.6037 && ll.lng === -0.187).toBe(true)

    const center = parseGoogleMapsLocation('https://www.google.com/maps/@?api=1&center=5.6037,-0.187&zoom=15')
    expect(center.ok && center.lat === 5.6037 && center.lng === -0.187).toBe(true)
  })

  it('reads the destination parameter', () => {
    const result = parseGoogleMapsLocation('https://www.google.com/maps/dir/?api=1&destination=5.6037,-0.187')
    expect(result.ok && result.lat === 5.6037 && result.lng === -0.187).toBe(true)
  })

  it('takes the destination from a directions path', () => {
    expect(
      parseGoogleMapsLocation('https://www.google.com/maps/dir/5.60,-0.18/5.6037,-0.1870/data=!4m2!4m1!3e0'),
    ).toEqual({ ok: true, lat: 5.6037, lng: -0.187 })
  })

  it('reads the embed payload (!2d is longitude, !3d is latitude)', () => {
    const url =
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3970.3!2d-0.1316677!3d5.6604422!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1'
    expect(parseGoogleMapsLocation(url)).toEqual({ ok: true, lat: 5.6604422, lng: -0.1316677 })
  })

  it('accepts plain copied coordinates', () => {
    expect(parseGoogleMapsLocation('5.603717, -0.186964')).toEqual({
      ok: true,
      lat: 5.603717,
      lng: -0.186964,
    })
  })

  it('accepts geo: URIs', () => {
    expect(parseGoogleMapsLocation('geo:5.6037,-0.187')).toEqual({ ok: true, lat: 5.6037, lng: -0.187 })
  })

  it('extracts the link from shared message text', () => {
    const text = 'Kaneshie Market\nhttps://www.google.com/maps/place/Kaneshie+Market/@5.5735,-0.2456,17z'
    const result = parseGoogleMapsLocation(text)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lat).toBe(5.5735)
      expect(result.lng).toBe(-0.2456)
      expect(result.label).toBe('Kaneshie Market')
    }
  })

  it('decodes an encoded place name for the label', () => {
    const result = parseGoogleMapsLocation('https://www.google.com/maps/place/Osu%2C+Accra/@5.557,-0.19,17z')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.label).toBe('Osu, Accra')
  })

  it('flags shortened share links with their own reason', () => {
    expect(parseGoogleMapsLocation('https://maps.app.goo.gl/AbC123xyz')).toEqual({
      ok: false,
      reason: 'short-link',
    })
    expect(parseGoogleMapsLocation('https://goo.gl/maps/AbC123')).toEqual({ ok: false, reason: 'short-link' })
  })

  it('returns no-coords for a maps URL without coordinates', () => {
    expect(parseGoogleMapsLocation('https://www.google.com/maps/place/?q=place_id:ChIJ1234567890')).toEqual({
      ok: false,
      reason: 'no-coords',
    })
  })

  it('rejects out-of-range coordinates', () => {
    expect(parseGoogleMapsLocation('95.5, -0.18').ok).toBe(false)
  })

  it('returns not-a-link for unrelated text', () => {
    expect(parseGoogleMapsLocation('my hotel near the beach')).toEqual({ ok: false, reason: 'not-a-link' })
  })

  it('returns not-a-link for empty input', () => {
    expect(parseGoogleMapsLocation('   ')).toEqual({ ok: false, reason: 'not-a-link' })
  })
})
