/* shared/ui/i18n.js: translations for en, es and it.
 *
 *   LANGUAGES  ['en', 'es', 'it']
 *   mergeStrings(...dicts)  { en, es, it } dictionaries merged per language;
 *     later ones win. Usually mergeStrings(HUB_STRINGS, TOOL_STRINGS).
 *   const { t, interp, apply } = createI18n({ strings, getLang, vars })
 *     t(key)         the string in getLang()'s language, else English, else the key
 *     interp(str)    replaces {name} with vars.name (e.g. {repo}, {patreon})
 *     apply()        sets <html lang>, fills every [data-i18n] element's
 *                    innerHTML with interp(t(key)) and every [data-i18n-aria]
 *                    element's aria-label with t(key)
 *
 * Strings may contain HTML (links, <strong>); they are trusted, never user input.
 */

export const LANGUAGES = ['en', 'es', 'it'];

export function mergeStrings(...dicts) {
  const out = {};
  for (const dict of dicts) {
    for (const [lang, strings] of Object.entries(dict)) out[lang] = { ...out[lang], ...strings };
  }
  return out;
}

export function createI18n({ strings, getLang, vars = {} }) {
  const t = (key) => {
    const lang = getLang();
    return (strings[lang] && strings[lang][key]) ?? strings.en[key] ?? key;
  };
  const interp = (str) => {
    let out = String(str);
    for (const [name, value] of Object.entries(vars)) out = out.replaceAll(`{${name}}`, value);
    return out;
  };
  const apply = () => {
    document.documentElement.lang = getLang();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.innerHTML = interp(t(el.getAttribute('data-i18n')));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  };
  return { t, interp, apply };
}
