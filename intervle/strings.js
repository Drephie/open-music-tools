/* intervle/strings.js: Intervle's own strings in en, es, it.
 * Merged over HUB_STRINGS (shared/ui/strings.js: themes, footer, Patreon window
 * buttons, interval names iv1..iv12). {patreon}, {instagram} and {repo} are
 * interpolated; {n}, {date}, {note}, {name}, {t} are filled in by intervle.js.
 * ch_<id>: Hard's chord buttons (ids from intervle/game.js ANSWERS.hard);
 * chw_<id>: their name in words, under the button.
 */
const ABOUT_CREDITS = {
  en: 'Piano sound: <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noopener noreferrer">Salamander Grand Piano</a> by Alexander Holm, licensed under <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>.',
  es: 'Sonido de piano: <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noopener noreferrer">Salamander Grand Piano</a> de Alexander Holm, con licencia <a href="https://creativecommons.org/licenses/by/3.0/deed.es" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>.',
  it: 'Suono del pianoforte: <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noopener noreferrer">Salamander Grand Piano</a> di Alexander Holm, con licenza <a href="https://creativecommons.org/licenses/by/3.0/deed.it" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>.',
};
const CHORDS = { ch_sus2: 'sus2', ch_sus4: 'sus4', ch_7: '7', ch_maj7: 'maj7', ch_m7: 'm7', ch_6: '6', ch_9: '9' };

export const INTERVLE_STRINGS = {
  en: {
    title: "Intervle", alpha: "Alpha",
    aboutTitle: "About Intervle",
    aboutBody: 'Free, <a href="{repo}" target="_blank" rel="noopener noreferrer">open-source</a> music tools by <a href="{instagram}" target="_blank" rel="noopener noreferrer">Drephie</a>. No ads, no trackers, nothing uploaded: everything runs in your browser.<br><br>Three ear puzzles a day, the same for everyone, with 3 tries each. <strong>Easy</strong>: how far apart are two notes (the <strong>interval</strong>, counted in half steps: one piano key to the very next)? <strong>Medium</strong>: you know the first note; name the second. <strong>Hard</strong>: you know the first note; then comes a whole chord: pick its note and its type (e.g. F♯m7). A new puzzle every midnight.',
    aboutCredits: ABOUT_CREDITS.en,
    aboutKeys: "On a computer: Space plays the puzzle, the number keys answer (as shown on the buttons), or type your answer (\"m3\", \"E\", \"Mi\", \"F#m7\") and press Enter.",
    supportTitle: "Support Intervle",
    supportBody: "Enjoying your daily ear puzzle? Help keep these music tools free, ad-free and growing!",
    modesAria: "Modes", easy: "Easy", medium: "Medium", hard: "Hard",
    backToday: "Back to today",
    askEasy: "How far apart are the two notes?", askMedium: "This note is {note}. Which note comes next?", askHard: "This note is {note}. Which chord comes next?", rootAria: "The chord's note", typeGroupAria: "The chord's type",
    play: "Play", triesAria: "{n} of 3 tries left",
    typeHint: "Or type your answer, then Enter", typeAria: "Type your answer",
    right1: "Right, first try!", rightN: "Right in {n} tries!", wrong: "Not quite", lost: "Out of tries", answerWas: "The answer was: {name}",
    halfSteps: "{n} half steps", halfStep1: "1 half step",
    copy: "Copy result", copied: "Copied!", copyFailed: "Couldn't copy",
    past: "Past games", pastNote: "Past days don't count for your streak.", notPlayed: "not played",
    streak: "{name} streak {n}", bestStreak: "best {n}",
    moreThemes: "More themes coming soon", names: "Note names", namesSolfege: "Do Re Mi", namesLetters: "C D E",
    loading: "Loading the piano sound…", loadFailed: "The piano sound didn't load. Check your connection, then press Play again.",
    ...CHORDS,
    chw_sus2: "suspended 2nd", chw_sus4: "suspended 4th", chw_7: "dominant 7th", chw_maj7: "major 7th", chw_m7: "minor 7th", chw_6: "sixth", chw_9: "ninth",
  },
  es: {
    title: "Intervle", alpha: "Alfa",
    aboutTitle: "Sobre Intervle",
    aboutBody: 'Herramientas musicales gratuitas y de <a href="{repo}" target="_blank" rel="noopener noreferrer">código abierto</a> de <a href="{instagram}" target="_blank" rel="noopener noreferrer">Drephie</a>. Sin anuncios, sin rastreadores, nada se sube: todo funciona en tu navegador.<br><br>Tres retos de oído al día, iguales para todos, con 3 intentos cada uno. <strong>Fácil</strong>: ¿qué distancia hay entre dos notas (el <strong>intervalo</strong>, contado en semitonos: de una tecla del piano a la siguiente)? <strong>Medio</strong>: conoces la primera nota; di cuál es la segunda. <strong>Difícil</strong>: conoces la primera nota; luego suena un acorde entero: elige su nota y su tipo (p. ej. Fa♯m7). Un reto nuevo cada medianoche.',
    aboutCredits: ABOUT_CREDITS.es,
    aboutKeys: "En el ordenador: Espacio toca el reto, las teclas numéricas responden (como en los botones), o escribe tu respuesta (\"m3\", \"Mi\", \"E\", \"Fa#m7\") y pulsa Intro.",
    supportTitle: "Apoya Intervle",
    supportBody: "¿Te gusta tu reto de oído diario? ¡Ayuda a que estas herramientas sigan siendo gratis, sin anuncios y creciendo!",
    modesAria: "Modos", easy: "Fácil", medium: "Medio", hard: "Difícil",
    backToday: "Volver a hoy",
    askEasy: "¿Qué distancia hay entre las dos notas?", askMedium: "Esta nota es {note}. ¿Qué nota viene después?", askHard: "Esta nota es {note}. ¿Qué acorde viene después?", rootAria: "La nota del acorde", typeGroupAria: "El tipo de acorde",
    play: "Tocar", triesAria: "Quedan {n} de 3 intentos",
    typeHint: "O escribe tu respuesta y pulsa Intro", typeAria: "Escribe tu respuesta",
    right1: "¡Correcto, al primer intento!", rightN: "¡Correcto en {n} intentos!", wrong: "No es esa", lost: "Sin intentos", answerWas: "La respuesta era: {name}",
    halfSteps: "{n} semitonos", halfStep1: "1 semitono",
    copy: "Copiar resultado", copied: "¡Copiado!", copyFailed: "No se pudo copiar",
    past: "Retos anteriores", pastNote: "Los días pasados no cuentan para tu racha.", notPlayed: "sin jugar",
    streak: "Racha {name} {n}", bestStreak: "mejor {n}",
    moreThemes: "Más temas muy pronto", names: "Nombres de las notas", namesSolfege: "Do Re Mi", namesLetters: "C D E",
    loading: "Cargando el sonido del piano…", loadFailed: "El sonido del piano no se cargó. Revisa tu conexión y pulsa Tocar de nuevo.",
    ...CHORDS,
    chw_sus2: "2.ª suspendida", chw_sus4: "4.ª suspendida", chw_7: "séptima de dominante", chw_maj7: "séptima mayor", chw_m7: "séptima menor", chw_6: "sexta", chw_9: "novena",
  },
  it: {
    title: "Intervle", alpha: "Alfa",
    aboutTitle: "Informazioni su Intervle",
    aboutBody: 'Strumenti musicali gratuiti e <a href="{repo}" target="_blank" rel="noopener noreferrer">open source</a> di <a href="{instagram}" target="_blank" rel="noopener noreferrer">Drephie</a>. Niente pubblicità, niente tracciamento, niente viene caricato: tutto funziona nel tuo browser.<br><br>Tre giochi d\'orecchio al giorno, uguali per tutti, con 3 tentativi ciascuno. <strong>Facile</strong>: quanto sono distanti due note (l\'<strong>intervallo</strong>, contato in semitoni: da un tasto del pianoforte al successivo)? <strong>Medio</strong>: conosci la prima nota; di\' qual è la seconda. <strong>Difficile</strong>: conosci la prima nota; poi arriva un accordo intero: scegli la sua nota e il suo tipo (es. Fa♯m7). Un gioco nuovo ogni mezzanotte.',
    aboutCredits: ABOUT_CREDITS.it,
    aboutKeys: "Al computer: Spazio suona il gioco, i tasti numerici rispondono (come sui pulsanti), oppure scrivi la risposta (\"m3\", \"Mi\", \"E\", \"Fa#m7\") e premi Invio.",
    supportTitle: "Sostieni Intervle",
    supportBody: "Ti piace il tuo gioco d'orecchio quotidiano? Aiuta questi strumenti a restare gratuiti, senza pubblicità e a crescere!",
    modesAria: "Modalità", easy: "Facile", medium: "Medio", hard: "Difficile",
    backToday: "Torna a oggi",
    askEasy: "Quanto sono distanti le due note?", askMedium: "Questa nota è {note}. Quale nota viene dopo?", askHard: "Questa nota è {note}. Quale accordo viene dopo?", rootAria: "La nota dell'accordo", typeGroupAria: "Il tipo di accordo",
    play: "Suona", triesAria: "Restano {n} tentativi su 3",
    typeHint: "Oppure scrivi la risposta, poi Invio", typeAria: "Scrivi la risposta",
    right1: "Giusto, al primo tentativo!", rightN: "Giusto in {n} tentativi!", wrong: "Non proprio", lost: "Tentativi finiti", answerWas: "La risposta era: {name}",
    halfSteps: "{n} semitoni", halfStep1: "1 semitono",
    copy: "Copia il risultato", copied: "Copiato!", copyFailed: "Impossibile copiare",
    past: "Giochi passati", pastNote: "I giorni passati non contano per la serie.", notPlayed: "non giocato",
    streak: "Serie {name} {n}", bestStreak: "record {n}",
    moreThemes: "Altri temi in arrivo", names: "Nomi delle note", namesSolfege: "Do Re Mi", namesLetters: "C D E",
    loading: "Caricamento del suono del pianoforte…", loadFailed: "Il suono del pianoforte non si è caricato. Controlla la connessione, poi premi di nuovo Suona.",
    ...CHORDS,
    chw_sus2: "seconda sospesa", chw_sus4: "quarta sospesa", chw_7: "settima di dominante", chw_maj7: "settima maggiore", chw_m7: "settima minore", chw_6: "sesta", chw_9: "nona",
  },
};

