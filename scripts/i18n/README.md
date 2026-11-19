# Locale translation pipeline

The app ships 41 language options from `src/i18n/languages.json`. English is
the source locale; the other 40 locale files are generated and validated with
Azure Translator.

## Credentials

Add these to `.env` (it is gitignored):

```env
TRANSLATE_PROVIDER=azure
AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_REGION=
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
AZURE_MAX_CHARS=1900000
AZURE_REQUEST_INTERVAL_MS=2500
```

`AZURE_MAX_CHARS` is a safety ceiling for the Azure F0 free tier (2M
characters/month). The script refuses to exceed it.

`TRANSLATE_PROVIDER=google` switches to the free unofficial Google endpoint.
That is a quota/bootstrap fallback, **not** the production default: it has no
SLA, can rate-limit, and should be replaced by an Azure run when the monthly
quota resets.

> Every locale in `languages.json` must have a JSON file because
> `src/i18n/config.ts` statically imports them all. When adding a language,
> create at least an empty `{}` file before starting the dev server; otherwise
> Vite cannot resolve the module graph and the app renders blank.

## Commands

```bash
# Fill in every missing string, including new plural categories.
npm run translate:locales

# Only translate specific bundle sources.
npm run translate:locales -- --locales=de,ja,pt-BR

# Retranslate everything (expensive; normally only missing keys are sent).
npm run translate:locales -- --force

# Validate every locale without calling Azure.
npm run translate:validate
```

After a successful run, the script writes review CSV files to
`scripts/i18n/reports/` (gitignored). They are sorted by key and flag
legal/booking/payment/auth namespaces as high priority.

## How strings are protected

Before a string is sent to Azure:

- `{{placeholders}}` are replaced with opaque sentinels.
- Rich-text tags such as `<a href="/faq">` and `<brand>` are replaced with
  opaque sentinels.
- Brand/proper names and URLs are protected.
- Plural strings use a representative number so the provider selects the right
  grammatical form, then the number is restored to `{{count}}`.

The script refuses to write a locale if a placeholder, HTML tag, sentinel or
required plural category is missing. If a provider drops or reverses a tag in
a long string, the script translates the text around the tags separately and
reassembles the original tags. A locale that fails validation is cached and
can be resumed without paying for the same API calls again.

## Regional variants

Azure does not expose separate models for every regional variant. These files
are generated from their base and then post-processed:

- `de-AT` and `de-CH` ← `de` (`de-CH` also converts `ß` to `ss`)
- `en-AU` ← `en` (common US → Australian spellings)
- `es-MX` ← `es`
- `zh-HK` ← `zh-TW`

The files are still separate so the picker can show and persist each variant.
If you need genuinely distinct Austrian/Swiss German or Mexican Spanish copy,
add the corrections to `scripts/i18n/overrides/<locale>.json` or have a native
translator review them.

## Human overrides

Create `scripts/i18n/overrides/<locale>.json` with flat keys:

```json
{
  "nav.listAnExperience": "…",
  "empty.experiencesCount_one": "…"
}
```

Overrides are applied before validation and always win over machine output.
They are never sent to Azure.

## Review gate

Automated checks catch structural problems, not tone or legal accuracy. Before
calling a locale production-ready, a native speaker should review at least:

- legal/policy namespaces
- booking and payment copy
- the high-priority rows in the generated CSV
- any row whose translation length is more than ~2.2× the English source
