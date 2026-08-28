export default {
  locales: ['en', 'es', 'fr', 'de', 'nl'],
  output: 'src/i18n/locales/$LOCALE.json',
  input: ['src/**/*.{ts,tsx}'],
  defaultLocale: 'en',
  namespaceSeparator: false,
  keySeparator: '.',
  createOldCatalogs: false,
  sort: true,
}
