/* shared/ui/strings.js: strings every tool in the hub uses, in en, es, it.
 *
 *   HUB_STRINGS = { en: {...}, es: {...}, it: {...} }
 *
 * Merge them under a tool's own strings with mergeStrings() from
 * shared/ui/i18n.js. Keys stay as they were in Choordination, so its
 * data-i18n attributes keep working. Interval names (iv0..iv12) are shared by
 * the Piano and the Ear Trainer. A tool-specific string (anything that
 * names the tool or its features) belongs in the tool, not here.
 */

export const HUB_STRINGS = {
  en: {
    // Hub footer and links
    supportLink: "Support on Patreon", designedBy: "Designed by",
    // Common controls
    lang: "Language", vol: "Master Volume", closeAria: "Close", retry: "Retry",
    settings: "Settings", about: "About", home: "Home: all the tools",
    // Patreon window (shared/ui/page.js createSupportPrompt)
    supportContinue: "Continue", supportWait: "Continue in {s} s…",
    // Themes (shared/ui/themes.css)
    theme: "Aesthetic Theme", themeLiquid: "Liquid Glass", themeY2k: "Y2K Cyber", themePink: "Soft Pink", themeBw: "Monochrome", themeRetro: "Retro CRT",
    // Instrument rack (shared/sound.js INSTRUMENTS)
    inst: "Instrument Rack", instPiano: "Grand Piano", instEpiano: "Classic Electric Piano", instEsynth: "Electric Synth", instPad: "Smooth Analog Pad", instOrgan: "Warm Organ", instHarp: "Dream Harp",
    // Metronome sounds (shared/transport.js CLICK_SOUNDS)
    metClick: "Click", metBeep: "Beep", metWood: "Wood", metHat: "Hi-hat",
    // Interval names by semitones (shared/theory.js INTERVAL_SHORT; iv0 and iv12 are the octave)
    iv0: "octave", iv1: "minor 2nd", iv2: "major 2nd", iv3: "minor 3rd", iv4: "major 3rd", iv5: "perfect 4th", iv6: "tritone",
    iv7: "perfect 5th", iv8: "minor 6th", iv9: "major 6th", iv10: "minor 7th", iv11: "major 7th", iv12: "octave",
  },
  es: {
    // Hub footer and links
    supportLink: "Apóyanos en Patreon", designedBy: "Diseñado por",
    // Common controls
    lang: "Idioma", vol: "Volumen", closeAria: "Cerrar", retry: "Reintentar",
    settings: "Ajustes", about: "Información", home: "Inicio: todas las herramientas",
    // Patreon window (shared/ui/page.js createSupportPrompt)
    supportContinue: "Continuar", supportWait: "Continuar en {s} s…",
    // Themes (shared/ui/themes.css)
    theme: "Tema Estético", themeLiquid: "Cristal Líquido", themeY2k: "Cyber Y2K", themePink: "Rosa Suave", themeBw: "Monocromo", themeRetro: "CRT Retro",
    // Instrument rack (shared/sound.js INSTRUMENTS)
    inst: "Instrumento", instPiano: "Piano de Cola", instEpiano: "Piano Eléctrico Clásico", instEsynth: "Sinte Eléctrico", instPad: "Pad Analógico Suave", instOrgan: "Órgano Cálido", instHarp: "Arpa de Ensueño",
    // Metronome sounds (shared/transport.js CLICK_SOUNDS)
    metClick: "Clic", metBeep: "Bip", metWood: "Madera", metHat: "Hi-hat",
    // Interval names by semitones (shared/theory.js INTERVAL_SHORT; iv0 and iv12 are the octave)
    iv0: "octava", iv1: "segunda menor", iv2: "segunda mayor", iv3: "tercera menor", iv4: "tercera mayor", iv5: "cuarta justa", iv6: "tritono",
    iv7: "quinta justa", iv8: "sexta menor", iv9: "sexta mayor", iv10: "séptima menor", iv11: "séptima mayor", iv12: "octava",
  },
  it: {
    // Hub footer and links
    supportLink: "Sostienici su Patreon", designedBy: "Progettato da",
    // Common controls
    lang: "Lingua", vol: "Volume", closeAria: "Chiudi", retry: "Riprova",
    settings: "Impostazioni", about: "Informazioni", home: "Home: tutti gli strumenti",
    // Patreon window (shared/ui/page.js createSupportPrompt)
    supportContinue: "Continua", supportWait: "Continua tra {s} s…",
    // Themes (shared/ui/themes.css)
    theme: "Tema Estetico", themeLiquid: "Vetro Liquido", themeY2k: "Cyber Y2K", themePink: "Rosa Tenue", themeBw: "Monocromatico", themeRetro: "CRT Retrò",
    // Instrument rack (shared/sound.js INSTRUMENTS)
    inst: "Strumento", instPiano: "Pianoforte a Coda", instEpiano: "Piano Elettrico Classico", instEsynth: "Synth Elettrico", instPad: "Pad Analogico Morbido", instOrgan: "Organo Caldo", instHarp: "Arpa da Sogno",
    // Metronome sounds (shared/transport.js CLICK_SOUNDS)
    metClick: "Clic", metBeep: "Bip", metWood: "Legno", metHat: "Hi-hat",
    // Interval names by semitones (shared/theory.js INTERVAL_SHORT; iv0 and iv12 are the octave)
    iv0: "ottava", iv1: "seconda minore", iv2: "seconda maggiore", iv3: "terza minore", iv4: "terza maggiore", iv5: "quarta giusta", iv6: "tritono",
    iv7: "quinta giusta", iv8: "sesta minore", iv9: "sesta maggiore", iv10: "settima minore", iv11: "settima maggiore", iv12: "ottava",
  },
};
