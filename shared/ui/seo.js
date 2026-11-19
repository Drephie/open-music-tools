/* shared/ui/seo.js: what search engines and link previews show for each page,
 * in English, Spanish and Italian: the tab title, the description under the
 * link in search results, and one or two plain sentences about the tool
 * (#seo-about, read by screen readers and search engines, not shown).
 *
 *   SEO[folder][lang]   { title, desc, about? }; folder '' is the home page
 *   applySeo(lang, urlLang)   sets <title>, the description and Open Graph
 *                       texts and #seo-about in lang, and the canonical link:
 *                       the page's address on openmusictools.org, with
 *                       ?lang=es or ?lang=it when the address asked for one
 *                       (urlLang). createI18n's apply() calls it.
 *
 * Each page's <head> has the English texts too, plus the language addresses
 * (hreflang), the share picture (share.jpg) and the schema.org description:
 * change a text here and there. sitemap.xml lists every page in every language.
 */

export const SEO = {
  "": {
    "en": {
      "title": "Open Music Tools – Free Online Music Tools by Drephie",
      "desc": "Free, open-source music tools by singer and vocal coach Drephie: online piano, ear trainer, metronome, vocal tuner, guitar tuner, pitch detector and Choordination. No ads, nothing uploaded."
    },
    "es": {
      "title": "Open Music Tools – Herramientas musicales gratis de Drephie",
      "desc": "Herramientas musicales gratis y de código abierto de la cantante y profesora de canto Drephie: piano online, entrenamiento auditivo, metrónomo, afinador de voz y de guitarra, y Choordination. Sin anuncios."
    },
    "it": {
      "title": "Open Music Tools – Strumenti musicali gratis di Drephie",
      "desc": "Strumenti musicali gratuiti e open source della cantante e vocal coach Drephie: pianoforte online, ear training, metronomo, accordatore per voce e chitarra, e Choordination. Niente pubblicità."
    }
  },
  "choordination": {
    "en": {
      "title": "Choordination – Play Chords with Hand Gestures | Open Music Tools",
      "desc": "Choordination by Drephie: play chords with your hands in front of your webcam. A free hand-tracking chord instrument in your browser for singers and songwriters. Nothing leaves your device.",
      "about": "Choordination is a free online chord instrument by Drephie: show your hands to the camera and your gestures play chords, so you can accompany yourself while you sing. The hand tracking runs on your device, on phone or computer, and you can record yourself playing."
    },
    "es": {
      "title": "Choordination – Toca acordes con gestos de las manos | Open Music Tools",
      "desc": "Choordination, de Drephie: toca acordes con las manos delante de la cámara. Un instrumento gratis en el navegador para cantantes y compositores. Nada sale de tu dispositivo.",
      "about": "Choordination es un instrumento de acordes gratis y online creado por Drephie: muestra las manos a la cámara y tus gestos tocan acordes, para acompañarte mientras cantas. El seguimiento de las manos funciona en tu dispositivo, en el móvil o el ordenador, y puedes grabarte tocando."
    },
    "it": {
      "title": "Choordination – Suona accordi con i gesti delle mani | Open Music Tools",
      "desc": "Choordination, di Drephie: suona accordi con le mani davanti alla webcam. Uno strumento gratuito nel browser per cantanti e cantautori. Niente lascia il tuo dispositivo.",
      "about": "Choordination è uno strumento di accordi gratuito e online creato da Drephie: mostra le mani alla fotocamera e i tuoi gesti suonano accordi, così puoi accompagnarti mentre canti. Il riconoscimento delle mani funziona sul tuo dispositivo, su telefono o computer, e puoi registrarti mentre suoni."
    }
  },
  "chordigits": {
    "en": {
      "title": "Chordigits – Count Chords on Your Fingers (I to VII) | Open Music Tools",
      "desc": "Chordigits: hold up one to seven fingers in front of your camera to play chords I to VII of any key, and show your palm or the back of your hand for major or minor. Free, in your browser; nothing is uploaded.",
      "about": "Chordigits is a free online chord instrument: hold up fingers in front of your camera to play the chords of a key by number, from I to VII, and show your palm or the back of your hand to switch between major and minor. A simple way to learn chord numbers."
    },
    "es": {
      "title": "Chordigits – Cuenta acordes con los dedos (I a VII) | Open Music Tools",
      "desc": "Chordigits: levanta de uno a siete dedos delante de la cámara para tocar los acordes I a VII de cualquier tonalidad, y muestra la palma o el dorso de la mano para mayor o menor. Gratis, en el navegador; nada se sube.",
      "about": "Chordigits es un instrumento de acordes gratis y online: levanta los dedos delante de la cámara para tocar los acordes de una tonalidad por número, del I al VII, y muestra la palma o el dorso de la mano para cambiar entre mayor y menor. Una forma sencilla de aprender los grados de los acordes."
    },
    "it": {
      "title": "Chordigits – Conta gli accordi con le dita (I–VII) | Open Music Tools",
      "desc": "Chordigits: alza da uno a sette dita davanti alla fotocamera per suonare gli accordi dal I al VII di qualsiasi tonalità, e mostra il palmo o il dorso della mano per maggiore o minore. Gratis, nel browser; niente viene caricato.",
      "about": "Chordigits è uno strumento di accordi gratuito e online: alza le dita davanti alla fotocamera per suonare gli accordi di una tonalità per numero, dal I al VII, e mostra il palmo o il dorso della mano per passare da maggiore a minore. Un modo semplice per imparare i gradi degli accordi."
    }
  },
  "piano": {
    "en": {
      "title": "Online Piano that Names Your Chords – Free | Open Music Tools",
      "desc": "A free online piano keyboard that tells you the name of the chord you play. Real piano sound, works with touch and mouse. Runs in your browser; nothing is uploaded.",
      "about": "A free online piano: play the keys on the screen and it shows the name of the chord or note you play. Useful for learning chords and checking the notes of a song."
    },
    "es": {
      "title": "Piano online que te dice los acordes – Gratis | Open Music Tools",
      "desc": "Un piano online gratis que te dice el nombre del acorde que tocas. Sonido de piano real, con el dedo o el ratón. Funciona en el navegador; nada se sube.",
      "about": "Un piano online gratis: toca las teclas en la pantalla y te muestra el nombre del acorde o la nota que tocas. Útil para aprender acordes y comprobar las notas de una canción."
    },
    "it": {
      "title": "Pianoforte online che riconosce gli accordi – Gratis | Open Music Tools",
      "desc": "Un pianoforte online gratuito che ti dice il nome dell’accordo che suoni. Suono di pianoforte vero, con il dito o il mouse. Funziona nel browser; niente viene caricato.",
      "about": "Un pianoforte online gratuito: suona i tasti sullo schermo e ti mostra il nome dell’accordo o della nota che suoni. Utile per imparare gli accordi e controllare le note di una canzone."
    }
  },
  "ear-trainer": {
    "en": {
      "title": "Ear Trainer – Free Ear Training for Intervals and Chords | Open Music Tools",
      "desc": "Free online ear training: learn to recognise intervals, chords and scale degrees with short lessons and a streak game. For beginners, singers and musicians. Runs in your browser.",
      "about": "A free ear trainer for beginners and musicians: short lessons and a game teach you to hear intervals, major and minor chords and scale degrees, with letter names or solfège (do re mi)."
    },
    "es": {
      "title": "Entrenamiento auditivo gratis: intervalos y acordes | Open Music Tools",
      "desc": "Entrenamiento auditivo online y gratis: aprende a reconocer intervalos, acordes y grados de la escala con lecciones cortas y un juego de rachas. Para principiantes, cantantes y músicos.",
      "about": "Un entrenador auditivo gratis para principiantes y músicos: lecciones cortas y un juego te enseñan a oír intervalos, acordes mayores y menores y grados de la escala, con letras o con do re mi."
    },
    "it": {
      "title": "Ear training gratis: intervalli e accordi | Open Music Tools",
      "desc": "Ear training online e gratuito: impara a riconoscere intervalli, accordi e gradi della scala con lezioni brevi e un gioco a serie. Per principianti, cantanti e musicisti. Funziona nel browser.",
      "about": "Un ear trainer gratuito per principianti e musicisti: lezioni brevi e un gioco ti insegnano a sentire intervalli, accordi maggiori e minori e gradi della scala, con le lettere o con do re mi."
    }
  },
  "intervle": {
    "en": {
      "title": "Intervle – Daily Ear Training Puzzle Game | Open Music Tools",
      "desc": "Intervle is a free daily music puzzle: every day, guess one interval, one note and one chord by ear, and keep your streak. A new ear training game each day, in your browser.",
      "about": "Intervle is a free daily ear training game: every day there are three new puzzles, an interval, a note and a chord to guess by ear. Share your result and keep your streak going."
    },
    "es": {
      "title": "Intervle – Juego diario de oído musical | Open Music Tools",
      "desc": "Intervle es un juego musical diario y gratis: cada día adivina de oído un intervalo, una nota y un acorde, y mantén tu racha. Un nuevo reto de entrenamiento auditivo cada día.",
      "about": "Intervle es un juego diario y gratis para entrenar el oído: cada día hay tres retos nuevos, un intervalo, una nota y un acorde que adivinar de oído. Comparte tu resultado y mantén tu racha."
    },
    "it": {
      "title": "Intervle – Gioco quotidiano per l’orecchio musicale | Open Music Tools",
      "desc": "Intervle è un gioco musicale quotidiano e gratuito: ogni giorno indovina a orecchio un intervallo, una nota e un accordo, e mantieni la tua serie. Una nuova sfida di ear training ogni giorno.",
      "about": "Intervle è un gioco quotidiano e gratuito per allenare l’orecchio: ogni giorno ci sono tre nuove sfide, un intervallo, una nota e un accordo da indovinare a orecchio. Condividi il risultato e mantieni la serie."
    }
  },
  "jam-machine": {
    "en": {
      "title": "Jam Machine – Free Backing Tracks and Chord Progressions | Open Music Tools",
      "desc": "Jam Machine: a free backing band to play and sing over. Pick a style and a key, get chord progressions with drums and bass, and change the chords yourself. Runs in your browser.",
      "about": "Jam Machine is a free online backing track maker: choose a style and a key and it plays chord progressions with drums and bass, so you can practise, improvise, sing or write songs over them."
    },
    "es": {
      "title": "Jam Machine – Pistas de acompañamiento y progresiones gratis | Open Music Tools",
      "desc": "Jam Machine: una banda de acompañamiento gratis para tocar y cantar encima. Elige un estilo y una tonalidad, con batería y bajo, y cambia los acordes a tu gusto. En el navegador.",
      "about": "Jam Machine crea pistas de acompañamiento gratis y online: elige un estilo y una tonalidad y toca progresiones de acordes con batería y bajo, para practicar, improvisar, cantar o componer encima."
    },
    "it": {
      "title": "Jam Machine – Basi musicali e giri di accordi gratis | Open Music Tools",
      "desc": "Jam Machine: una band di accompagnamento gratuita su cui suonare e cantare. Scegli uno stile e una tonalità, con batteria e basso, e cambia gli accordi come vuoi. Nel browser.",
      "about": "Jam Machine crea basi musicali gratuite e online: scegli uno stile e una tonalità e suona giri di accordi con batteria e basso, per esercitarti, improvvisare, cantare o scrivere canzoni."
    }
  },
  "metronome": {
    "en": {
      "title": "Online Metronome – Free, with Tap Tempo | Open Music Tools",
      "desc": "A free online metronome with tap tempo, accents, beats per bar and in-between clicks (subdivisions). Works on phone and computer, offline too. No ads, nothing uploaded.",
      "about": "A free online metronome for practising music: set the BPM or tap the tempo, choose the beats in a bar and accents, and add in-between clicks for eighth notes or triplets."
    },
    "es": {
      "title": "Metrónomo online – Gratis, con tap tempo | Open Music Tools",
      "desc": "Un metrónomo online gratis con tap tempo, acentos, tiempos por compás y clics intermedios (subdivisiones). En el móvil y el ordenador, también sin conexión. Sin anuncios, nada se sube.",
      "about": "Un metrónomo online gratis para practicar: elige los BPM o marca el tempo con un toque, los tiempos del compás y los acentos, y añade clics intermedios para corcheas o tresillos."
    },
    "it": {
      "title": "Metronomo online – Gratis, con tap tempo | Open Music Tools",
      "desc": "Un metronomo online gratuito con tap tempo, accenti, battiti per battuta e clic intermedi (suddivisioni). Su telefono e computer, anche offline. Niente pubblicità, niente viene caricato.",
      "about": "Un metronomo online gratuito per esercitarti: scegli i BPM o batti il tempo con un tocco, i movimenti della battuta e gli accenti, e aggiungi clic intermedi per crome o terzine."
    }
  },
  "vocal-tuner": {
    "en": {
      "title": "Vocal Tuner – Check if You Sing in Tune, Free | Open Music Tools",
      "desc": "A free online vocal tuner: sing a note into your microphone and see right away if it is too low, too high or in tune. Made by a vocal coach. Nothing is recorded or uploaded.",
      "about": "A free online vocal tuner made by vocal coach Drephie: sing into your microphone and see the note you sing and whether you are flat, sharp or in tune. Your voice never leaves your device."
    },
    "es": {
      "title": "Afinador de voz – Comprueba si cantas afinado, gratis | Open Music Tools",
      "desc": "Un afinador de voz online y gratis: canta una nota al micrófono y mira al momento si está baja, alta o afinada. Hecho por una profesora de canto. Nada se graba ni se sube.",
      "about": "Un afinador de voz online y gratis, hecho por la profesora de canto Drephie: canta al micrófono y mira la nota que cantas y si estás bajo, alto o afinado. Tu voz nunca sale de tu dispositivo."
    },
    "it": {
      "title": "Accordatore per voce – Scopri se sei intonato, gratis | Open Music Tools",
      "desc": "Un accordatore per voce online e gratuito: canta una nota nel microfono e vedi subito se è calante, crescente o intonata. Creato da una vocal coach. Niente viene registrato o caricato.",
      "about": "Un accordatore per voce online e gratuito, creato dalla vocal coach Drephie: canta nel microfono e vedi la nota che canti e se sei calante, crescente o intonato. La tua voce non lascia mai il dispositivo."
    }
  },
  "instrument-tuner": {
    "en": {
      "title": "Online Tuner for Guitar, Bass, Ukulele, Violin and Cello | Open Music Tools",
      "desc": "A free online tuner for guitar, bass, ukulele, violin, viola and cello: play a string and see which way to turn the peg. Uses your microphone; nothing is recorded or uploaded.",
      "about": "A free online instrument tuner: play a string of your guitar, bass, ukulele, violin, viola or cello into the microphone and it shows the string, whether it is too low or too high, and which way to turn the peg."
    },
    "es": {
      "title": "Afinador online de guitarra, bajo, ukelele, violín y chelo | Open Music Tools",
      "desc": "Un afinador online y gratis para guitarra, bajo, ukelele, violín, viola y violonchelo: toca una cuerda y mira hacia dónde girar la clavija. Usa el micrófono; nada se graba ni se sube.",
      "about": "Un afinador de instrumentos online y gratis: toca una cuerda de tu guitarra, bajo, ukelele, violín, viola o violonchelo cerca del micrófono y te muestra la cuerda, si está baja o alta y hacia dónde girar la clavija."
    },
    "it": {
      "title": "Accordatore online per chitarra, basso, ukulele, violino | Open Music Tools",
      "desc": "Un accordatore online gratuito per chitarra, basso, ukulele, violino, viola e violoncello: suona una corda e vedi da che parte girare la chiavetta. Usa il microfono; niente viene registrato o caricato.",
      "about": "Un accordatore online gratuito: suona una corda della chitarra, del basso, dell’ukulele, del violino, della viola o del violoncello vicino al microfono e ti mostra la corda, se è calante o crescente e da che parte girare la chiavetta."
    }
  },
  "pitch-detector": {
    "en": {
      "title": "Pitch Detector – See the Notes You Sing, Live | Open Music Tools",
      "desc": "A free online pitch detector for singers: sing and watch the line your pitch draws over time, with the note names and piano keys to hear any note. Nothing is recorded or uploaded.",
      "about": "A free online pitch detector and pitch monitor: sing or play into the microphone and see your pitch as a moving line over the notes, to check vibrato, slides and whether you hold a note in tune."
    },
    "es": {
      "title": "Detector de tono – Mira las notas que cantas en directo | Open Music Tools",
      "desc": "Un detector de tono online y gratis para cantantes: canta y mira la línea que dibuja tu tono en el tiempo, con los nombres de las notas y un teclado para oír cualquier nota. Nada se graba.",
      "about": "Un detector de tono online y gratis: canta o toca al micrófono y mira tu tono como una línea que se mueve sobre las notas, para comprobar el vibrato, los deslizamientos y si mantienes una nota afinada."
    },
    "it": {
      "title": "Rilevatore di intonazione – Vedi le note che canti dal vivo | Open Music Tools",
      "desc": "Un rilevatore di intonazione online e gratuito per cantanti: canta e guarda la linea che disegna la tua voce nel tempo, con i nomi delle note e una tastiera per sentire ogni nota. Niente viene registrato.",
      "about": "Un rilevatore di intonazione online e gratuito: canta o suona nel microfono e vedi la tua intonazione come una linea che si muove sulle note, per controllare il vibrato, i glissati e se tieni una nota intonata."
    }
  },
  "pitch-training": {
    "en": {
      "title": "Pitch Training – Singing Exercises to Sing in Tune | Open Music Tools",
      "desc": "Free online singing exercises by vocal coach Drephie: the piano plays a vocal warm-up over a beat, you sing it back, and you see which notes you sang in tune. Nothing is recorded.",
      "about": "Free vocal warm-ups and singing exercises by vocal coach Drephie: listen to the piano, sing each exercise back, and see note by note where you were in tune, to train your pitch and sing better."
    },
    "es": {
      "title": "Pitch Training – Ejercicios para cantar afinado | Open Music Tools",
      "desc": "Ejercicios de canto online y gratis de la profesora de canto Drephie: el piano toca un calentamiento vocal sobre un ritmo, tú lo cantas y ves qué notas cantaste afinadas. Nada se graba.",
      "about": "Calentamientos vocales y ejercicios de canto gratis de la profesora de canto Drephie: escucha el piano, canta cada ejercicio y mira nota a nota dónde estabas afinado, para entrenar la afinación y cantar mejor."
    },
    "it": {
      "title": "Pitch Training – Esercizi per cantare intonati | Open Music Tools",
      "desc": "Esercizi di canto online e gratuiti della vocal coach Drephie: il pianoforte suona un vocalizzo su una base, tu lo ricanti e vedi quali note hai cantato intonate. Niente viene registrato.",
      "about": "Vocalizzi ed esercizi di canto gratuiti della vocal coach Drephie: ascolta il pianoforte, ricanta ogni esercizio e guarda nota per nota dove eri intonato, per allenare l’intonazione e cantare meglio."
    }
  },
  "privacy": {
    "en": {
      "title": "Privacy and cookies – Open Music Tools",
      "desc": "What Open Music Tools stores and which other sites your browser contacts: no cookies, no tracking, nothing uploaded."
    },
    "es": {
      "title": "Privacidad y cookies – Open Music Tools",
      "desc": "Qué guarda Open Music Tools y con qué otros sitios se conecta tu navegador: sin cookies, sin rastreo, nada se sube."
    },
    "it": {
      "title": "Privacy e cookie – Open Music Tools",
      "desc": "Cosa salva Open Music Tools e con quali altri siti si collega il tuo browser: niente cookie, niente tracciamento, niente viene caricato."
    }
  },
  "terms": {
    "en": {
      "title": "Terms of use – Open Music Tools",
      "desc": "The terms for using the free Open Music Tools."
    },
    "es": {
      "title": "Condiciones de uso – Open Music Tools",
      "desc": "Las condiciones para usar las herramientas gratuitas de Open Music Tools."
    },
    "it": {
      "title": "Condizioni d’uso – Open Music Tools",
      "desc": "Le condizioni per usare gli strumenti gratuiti di Open Music Tools."
    }
  }
};

const SITE = 'https://openmusictools.org';

function pageKey() {
  const first = location.pathname.split('/').filter(Boolean)[0] || '';
  return first === 'index.html' ? '' : first;
}

function setContent(selector, value) {
  const el = document.querySelector(selector);
  if (el && value) el.setAttribute('content', value);
}

export function applySeo(lang, urlLang) {
  const key = pageKey();
  const page = SEO[key];
  if (!page) return;
  const s = page[lang] || page.en;
  document.title = s.title;
  setContent('meta[name="description"]', s.desc);
  setContent('meta[property="og:title"]', s.title);
  setContent('meta[property="og:description"]', s.desc);
  const about = document.getElementById('seo-about');
  if (about && s.about) about.textContent = s.about;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  const asked = urlLang && urlLang !== 'en' ? `?lang=${urlLang}` : '';
  canonical.href = `${SITE}/${key ? key + '/' : ''}${asked}`;
}
