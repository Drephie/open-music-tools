/* shared/ui/strings.js: strings every tool in the hub uses, in en, es, it.
 *
 *   HUB_STRINGS = { en: {...}, es: {...}, it: {...} }
 *
 * Merge them under a tool's own strings with mergeStrings() from
 * shared/ui/i18n.js. Keys stay as they were in Choordination, so its
 * data-i18n attributes keep working. A tool-specific string (anything that
 * names the tool or its features) belongs in the tool, not here.
 */

export const HUB_STRINGS = {
  en: {
    // Hub footer and links
    supportLink: "Support on Patreon", designedBy: "Designed by",
    // Common controls
    lang: "Language", vol: "Master Volume", closeAria: "Close", retry: "Retry",
    settings: "Settings", about: "About",
    // Themes (shared/ui/themes.css)
    theme: "Aesthetic Theme", themeLiquid: "Liquid Glass", themeY2k: "Y2K Cyber", themePink: "Soft Pink", themeBw: "Monochrome", themeRetro: "Retro CRT",
    // Instrument rack (shared/sound.js INSTRUMENTS)
    inst: "Instrument Rack", instPiano: "Grand Piano", instEpiano: "Classic Electric Piano", instEsynth: "Electric Synth", instPad: "Smooth Analog Pad", instOrgan: "Warm Organ", instHarp: "Dream Harp",
    // Metronome sounds (shared/transport.js CLICK_SOUNDS)
    metClick: "Click", metBeep: "Beep", metWood: "Wood", metHat: "Hi-hat",
  },
  es: {
    // Hub footer and links
    supportLink: "Apóyanos en Patreon", designedBy: "Diseñado por",
    // Common controls
    lang: "Idioma", vol: "Volumen", closeAria: "Cerrar", retry: "Reintentar",
    settings: "Ajustes", about: "Información",
    // Themes (shared/ui/themes.css)
    theme: "Tema Estético", themeLiquid: "Cristal Líquido", themeY2k: "Cyber Y2K", themePink: "Rosa Suave", themeBw: "Monocromo", themeRetro: "CRT Retro",
    // Instrument rack (shared/sound.js INSTRUMENTS)
    inst: "Instrumento", instPiano: "Piano de Cola", instEpiano: "Piano Eléctrico Clásico", instEsynth: "Sinte Eléctrico", instPad: "Pad Analógico Suave", instOrgan: "Órgano Cálido", instHarp: "Arpa de Ensueño",
    // Metronome sounds (shared/transport.js CLICK_SOUNDS)
    metClick: "Clic", metBeep: "Bip", metWood: "Madera", metHat: "Hi-hat",
  },
  it: {
    // Hub footer and links
    supportLink: "Sostienici su Patreon", designedBy: "Progettato da",
    // Common controls
    lang: "Lingua", vol: "Volume", closeAria: "Chiudi", retry: "Riprova",
    settings: "Impostazioni", about: "Informazioni",
    // Themes (shared/ui/themes.css)
    theme: "Tema Estetico", themeLiquid: "Vetro Liquido", themeY2k: "Cyber Y2K", themePink: "Rosa Tenue", themeBw: "Monocromatico", themeRetro: "CRT Retrò",
    // Instrument rack (shared/sound.js INSTRUMENTS)
    inst: "Strumento", instPiano: "Pianoforte a Coda", instEpiano: "Piano Elettrico Classico", instEsynth: "Synth Elettrico", instPad: "Pad Analogico Morbido", instOrgan: "Organo Caldo", instHarp: "Arpa da Sogno",
    // Metronome sounds (shared/transport.js CLICK_SOUNDS)
    metClick: "Clic", metBeep: "Bip", metWood: "Legno", metHat: "Hi-hat",
  },
};
