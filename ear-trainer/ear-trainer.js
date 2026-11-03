/* ear-trainer/ear-trainer.js: the Ear Trainer (spec: specs/ear-trainer.md).
 * Questions come from ./questions.js and the piano from shared/sound.js; this
 * file is the screen: tabs, lesson path, questions, the streak game, free
 * practice, settings, windows and keyboard shortcuts.
 */
import { startAudio, createRack } from '../shared/sound.js';
import { nameNotes, midiToFreq } from '../shared/theory.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import {
  EXERCISES, ANSWERS, LESSONS, PLAYS, DEGREE_RANGES, LESSON_GOAL, LIVES,
  starsFor, lessonOpen, gameStage, makeQuestion, compareEvents, eventsLength,
} from './questions.js';
import { EAR_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'ear-trainer.settings.v1';
const ANSWER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const TAB_KEYS = { intervals: 'tabIntervals', chords: 'tabChords', degrees: 'tabDegrees' };
const ASK_KEYS = { intervals: 'askIntervals', chords: 'askChords', degrees: 'askDegrees' };
const PLAY_KEYS = { up: 'playUp', down: 'playDown', together: 'playTogether', mixed: 'playMixed', octave: 'rangeOctave', wide: 'rangeWide' };

// On iPhone, play even when the silent switch is on (Safari 16.4+; ignored elsewhere).
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

// --- SETTINGS (in this browser only: progress, best scores, choices; never people's work) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const int = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : def; };
  const stars = obj(s.stars), best = obj(s.best), practice = obj(s.practice);
  const starList = (ex) => LESSONS[ex].map((_, i) => int((Array.isArray(stars[ex]) ? stars[ex] : [])[i], 0, 3, 0));
  const picked = (ex, def) => {
    const saved = obj(practice[ex]).answers;
    const list = Array.isArray(saved) ? ANSWERS[ex].filter((a) => saved.includes(a)) : [];
    return list.length >= 2 ? list : def;
  };
  const choice = (ex, field, list, def) => (list.includes(obj(practice[ex])[field]) ? obj(practice[ex])[field] : def);
  return {
    tab: EXERCISES.includes(s.tab) ? s.tab : 'intervals',
    stars: Object.fromEntries(EXERCISES.map((ex) => [ex, starList(ex)])),
    best: Object.fromEntries(EXERCISES.map((ex) => [ex, int(best[ex], 0, 99999, 0)])),
    practice: {
      intervals: { answers: picked('intervals', [2, 3, 4, 5, 7, 12]), play: choice('intervals', 'play', PLAYS.intervals, 'up') },
      chords: { answers: picked('chords', ['maj', 'min']), play: choice('chords', 'play', PLAYS.chords, 'together') },
      degrees: { answers: picked('degrees', [1, 3, 5]), range: choice('degrees', 'range', DEGREE_RANGES, 'octave') },
    },
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
  };
}
const settings = readSettings();
// Theme and language are one choice for the whole hub; what this tool saved before is passed on.
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
const save = () => saveSettings(SETTINGS_KEY, settings);
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, EAR_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const tf = (key, vars) => fill(t(key), vars);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ACC_RE = /(^|\/)(Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#+|b+)?/g;
const pretty = (name) => name.replace(ACC_RE, (_, pre, l, acc = '') => pre + l + acc.replace(/#/g, '♯').replace(/b/g, '♭'));
const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const starsHtml = (n) => [0, 1, 2].map((i) => icon('star', i < n ? 'star on' : 'star')).join('');

// What an answer is called: "Major 3rd", "Minor", "5".
function answerName(ex, a) {
  if (ex === 'intervals') return cap(t('iv' + a));
  if (ex === 'chords') return t('c_' + a);
  return String(a);
}
function answerDetail(ex, a) {
  if (ex === 'intervals') return a === 1 ? t('halfStep1') : tf('halfSteps', { n: a });
  if (ex === 'chords') return t('w_' + a);
  return t('d' + a);
}
// "Major 3rd, perfect 4th or perfect 5th" (Spanish says "u" before an o- sound).
function joinOr(names) {
  if (names.length < 2) return names.join('');
  const last = names[names.length - 1];
  const or = settings.lang === 'es' && /^h?o/i.test(last) ? 'u' : t('or');
  return `${names.slice(0, -1).join(', ')} ${or} ${last}`;
}
function lessonTitle(ex, i) {
  const l = LESSONS[ex][i];
  if (l.title) return t(l.title);
  return cap(joinOr(l.answers.map((a) => (ex === 'intervals' ? t('iv' + a) : ex === 'chords' ? t('c_' + a).toLowerCase() : String(a)))));
}

const homeEl = $('home'), quizEl = $('quiz'), doneEl = $('done');
const tabs = [...document.querySelectorAll('.tab')];
const homePanel = $('home-panel'), pathEl = $('path');
const lessonNum = $('lesson-num'), lessonTitleEl = $('lesson-title'), startBtn = $('start-btn');
const bestLabel = $('best-label');
const progressEl = $('progress'), barFill = $('bar-fill'), barText = $('bar-text');
const livesEl = $('lives'), scoreEl = $('score'), scoreNum = $('score-num'), tallyEl = $('tally');
const promptEl = $('prompt'), hearBtn = $('hear-btn'), loadingEl = $('loading'), answersEl = $('answers');
const fbMain = $('fb-main'), fbDetail = $('fb-detail'), fbNotes = $('fb-notes');
const compareBtn = $('compare-btn'), nextBtn = $('next-btn');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), practiceModal = $('practice-modal'), supportModal = $('support-modal');
const themeSelect = $('theme-select'), langSelect = $('lang-select'), namesSeg = $('names-seg');

// --- SOUND: the grand piano only. Notes go on the Transport, so a replay can cancel what is still to come. ---
let rack = null, rackLoading = null, soundEnd = 0, endTimer = null, pending = null;
function loadRack() {
  if (!rackLoading) {
    rackLoading = createRack()
      .then((r) => { rack = r; loadingEl.hidden = true; })
      .catch(() => { rackLoading = null; loadingEl.textContent = t('loadFailed'); loadingEl.hidden = false; });
  }
  return rackLoading;
}
// Browsers allow sound only after a tap (for a finger: its lift), a click or a key.
const unlockAudio = () => { if (Tone.context.state !== 'running') startAudio(); };
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, true));

function stopSound() {
  pending = null;
  Tone.Transport.cancel(0);
  Tone.Draw.cancel(0);
  if (rack) rack.instruments.piano.releaseAll(Tone.now());
  clearTimeout(endTimer);
  soundEnd = 0;
  showSounding(null);
}
function playEvents(events) {
  unlockAudio();   // Tone.start() runs at once, inside the tap
  if (!rack) {
    pending = events;
    if (!rackLoading) loadingEl.textContent = t('loading');
    loadingEl.hidden = false;
    loadRack().then(() => { if (rack && pending === events) playEvents(events); });
    return;
  }
  stopSound();
  const piano = rack.instruments.piano;
  if (Tone.Transport.state !== 'started') Tone.Transport.start();
  const start = Tone.Transport.seconds + 0.1;
  for (const e of events) {
    const freqs = e.notes.map(midiToFreq);
    Tone.Transport.schedule((time) => {
      piano.triggerAttackRelease(freqs, e.dur, time);
      Tone.Draw.schedule(() => showSounding(e.tag || 'question'), time);
    }, start + e.at);
  }
  const length = 0.1 + eventsLength(events);
  soundEnd = Tone.now() + length;
  hearBtn.classList.add('playing');
  endTimer = setTimeout(() => showSounding(null), length * 1000);
}
// Lights the Hear button while the question sounds, and in Compare the
// button of the answer that is sounding.
function showSounding(tag) {
  hearBtn.classList.toggle('playing', tag !== null);
  const s = session;
  [...answersEl.children].forEach((b) => b.classList.toggle('sounding',
    !!s && ((tag === 'yours' && b.answer === s.yours) || (tag === 'right' && b.answer === s.q.answer))));
}
const isPlaying = () => Tone.now() < soundEnd;

// --- LESSONS SCREEN ---
const selected = {};   // the circle chosen in each tab (not remembered)
const nextLesson = (ex) => { const i = settings.stars[ex].findIndex((s) => !s); return i === -1 ? LESSONS[ex].length - 1 : i; };
EXERCISES.forEach((ex) => { selected[ex] = nextLesson(ex); });

function renderHome() {
  const ex = settings.tab;
  tabs.forEach((b) => {
    const on = b.dataset.ex === ex;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  homePanel.setAttribute('aria-labelledby', 'tab-' + ex);
  const stars = settings.stars[ex], next = nextLesson(ex);
  pathEl.innerHTML = '';
  pathEl.classList.toggle('few', LESSONS[ex].length <= 8);
  LESSONS[ex].forEach((_, i) => {
    const open = lessonOpen(stars, i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'step' + (stars[i] ? ' done' : '') + (open ? '' : ' locked') + (i === next && !stars[i] ? ' next' : '');
    b.setAttribute('aria-pressed', String(i === selected[ex]));
    b.setAttribute('aria-label', !open ? tf('lessonLocked', { n: i + 1 })
      : stars[i] ? tf('lessonStars', { n: i + 1, s: stars[i] }) : tf('lessonNext', { n: i + 1 }));
    b.innerHTML = `<span class="step-circle">${open ? i + 1 : icon('lock')}</span><span class="step-stars">${stars[i] ? starsHtml(stars[i]) : ''}</span>`;
    b.addEventListener('click', () => { selected[ex] = i; renderHome(); pathEl.children[i].focus(); });
    pathEl.appendChild(b);
  });
  const i = selected[ex], open = lessonOpen(stars, i);
  lessonNum.textContent = tf('lessonN', { n: i + 1 }) + ':';
  lessonTitleEl.textContent = lessonTitle(ex, i);
  startBtn.disabled = !open;
  startBtn.innerHTML = (open ? '' : icon('lock', 'btn-icon')) + t('start');
  bestLabel.textContent = tf('best', { n: settings.best[ex] });
}

function selectTab(ex, focus = false) {
  settings.tab = ex;
  save();
  renderHome();
  if (focus) tabs.find((b) => b.dataset.ex === ex).focus();
}
tabs.forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.ex)));
// Arrow keys move between the tabs (the usual tab-list keys).
$('home').querySelector('.tabs').addEventListener('keydown', (e) => {
  const i = EXERCISES.indexOf(settings.tab);
  const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: EXERCISES.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  selectTab(EXERCISES[(to + EXERCISES.length) % EXERCISES.length], true);
});

// --- SCREENS ---
function showScreen(name) {
  const active = document.activeElement;
  const hadFocus = active && active !== document.body && (homeEl.contains(active) || quizEl.contains(active) || doneEl.contains(active));
  homeEl.hidden = name !== 'home';
  quizEl.hidden = name !== 'quiz';
  doneEl.hidden = name !== 'done';
  document.body.dataset.screen = name;
  // Keyboard and screen-reader users land on the new screen, not on a hidden button.
  if (hadFocus && !active.checkVisibility?.()) {
    if (name === 'quiz') hearBtn.focus();
    else if (name === 'home') document.querySelector('.tab[aria-selected="true"]')?.focus();
  }
}
function goHome() {
  stopSound();
  const s = session;
  if (s && s.mode === 'game' && s.score > settings.best[s.ex]) { settings.best[s.ex] = s.score; save(); }
  session = null;
  showScreen('home');
  renderHome();
}

// --- QUESTIONS ---
// session: { mode: 'lesson' | 'game' | 'practice', ex, lesson, right, mistakes,
//   score, lives, asked, known (game: answers already in), fresh (game: just
//   added), q, answered, yours, result (the end screen) }
let session = null;

function begin(mode, extra = {}) {
  const ex = settings.tab;
  session = { mode, ex, right: 0, mistakes: 0, asked: 0, score: 0, lives: LIVES, q: null, answered: false, yours: null, fresh: [], ...extra };
  if (mode === 'game') session.known = gameStage(ex, 0).answers;
  showScreen('quiz');
  nextQuestion();
}
const startLesson = (i) => begin('lesson', { lesson: i });
const startGame = () => begin('game');
const startPractice = () => begin('practice');

function currentOptions() {
  const s = session;
  if (s.mode === 'lesson') return LESSONS[s.ex][s.lesson];
  if (s.mode === 'game') return gameStage(s.ex, s.score);
  return settings.practice[s.ex];
}

function nextQuestion() {
  const s = session, opts = currentOptions();
  s.fresh = s.mode === 'game' ? opts.answers.filter((a) => !s.known.includes(a)) : [];
  if (s.mode === 'game') s.known = opts.answers;
  s.q = makeQuestion(s.ex, opts, { prev: s.q });
  s.answered = false;
  s.yours = null;
  renderQuiz();
  playEvents(s.q.events);
}

function renderQuiz() {
  const s = session, opts = currentOptions();
  promptEl.textContent = t(ASK_KEYS[s.ex]);
  const answers = s.answered ? [...answersEl.children].map((b) => b.answer) : opts.answers;
  const n = answers.length;
  answersEl.dataset.ex = s.ex;
  answersEl.style.setProperty('--cols', s.ex === 'degrees' ? n : n <= 3 ? n : n === 4 ? 2 : 3);
  answersEl.style.setProperty('--cols-wide', s.ex === 'degrees' ? n : n <= 4 ? n : n <= 6 ? 3 : 4);
  answersEl.innerHTML = '';
  answers.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'answer' + (s.fresh.includes(a) ? ' fresh' : '');
    b.answer = a;
    b.innerHTML = `<span class="answer-key computer-only" aria-hidden="true">${ANSWER_KEYS[i] || ''}</span><span class="answer-mark" aria-hidden="true"></span><span class="answer-name">${answerName(s.ex, a)}</span>`;
    b.addEventListener('click', (e) => answer(a, e.detail === 0));
    answersEl.appendChild(b);
  });
  renderTop();
  renderFeedback();
}

function renderTop() {
  const s = session;
  progressEl.hidden = s.mode !== 'lesson';
  livesEl.hidden = scoreEl.hidden = s.mode !== 'game';
  tallyEl.hidden = s.mode !== 'practice';
  if (s.mode === 'lesson') {
    barFill.style.width = `${(100 * Math.min(s.right, LESSON_GOAL)) / LESSON_GOAL}%`;
    barText.textContent = `${s.right} / ${LESSON_GOAL}`;
    progressEl.setAttribute('aria-label', tf('progressAria', { r: s.right, g: LESSON_GOAL }));
  } else if (s.mode === 'game') {
    livesEl.innerHTML = Array.from({ length: LIVES }, (_, i) => icon('heart', i < s.lives ? 'heart' : 'heart lost')).join('');
    livesEl.setAttribute('aria-label', tf('livesAria', { n: s.lives }));
    scoreNum.textContent = s.score;
    scoreEl.setAttribute('aria-label', tf('scoreAria', { n: s.score }));
  } else {
    tallyEl.textContent = tf('tally', { r: s.right, n: s.asked });
  }
}

function notesText(q) {
  if (q.ex === 'degrees') return '';
  const named = nameNotes(q.notes, solfege());
  const names = named.notes.map((n) => pretty(n.name) + (q.ex === 'intervals' ? n.octave : ''));
  if (q.ex === 'chords') return names.join(' · ');
  if (q.play === 'together') return names.join(' + ');
  return (q.play === 'down' ? names.reverse() : names).join(' → ');
}

function renderFeedback() {
  const s = session, q = s.q;
  [...answersEl.children].forEach((b) => {
    b.classList.toggle('good', s.answered && b.answer === q.answer);
    b.classList.toggle('bad', s.answered && b.answer === s.yours && s.yours !== q.answer);
    b.classList.toggle('after', s.answered);
    b.setAttribute('aria-disabled', String(s.answered));
    const good = s.answered && b.answer === q.answer, bad = s.answered && b.answer === s.yours && !good;
    b.querySelector('.answer-mark').innerHTML = good ? icon('check') : bad ? icon('cross') : '';
  });
  const ok = s.yours === q.answer;
  fbMain.className = 'fb-main' + (s.answered ? (ok ? ' good' : ' bad') : '');
  if (!s.answered) {
    fbMain.innerHTML = s.fresh.length ? icon('star', 'fb-icon') + tf('newAnswer', { name: s.fresh.map((a) => answerName(s.ex, a)).join(', ') }) : '';
    fbDetail.textContent = fbNotes.textContent = '';
  } else {
    fbMain.innerHTML = icon(ok ? 'check' : 'cross', 'fb-icon') + t(ok ? 'right' : 'wrong');
    fbDetail.innerHTML = `<strong>${answerName(s.ex, q.answer)}</strong>: ${answerDetail(s.ex, q.answer)}`;
    fbNotes.textContent = notesText(q);
  }
  compareBtn.hidden = !s.answered || ok;
  nextBtn.hidden = !s.answered;
}

function answer(a, byKey) {
  const s = session;
  if (!s || s.answered) return;
  s.answered = true;
  s.yours = a;
  const ok = a === s.q.answer;
  if (s.mode === 'lesson') { if (ok) s.right++; else s.mistakes++; }
  else if (s.mode === 'game') { if (ok) s.score++; else s.lives--; }
  else { s.asked++; if (ok) s.right++; }
  renderTop();
  renderFeedback();
  const btn = [...answersEl.children].find((b) => b.answer === a);
  pop(btn, ok ? 'pop' : 'shake');
  if (s.mode === 'lesson' && ok) pop(progressEl, 'pop');
  if (s.mode === 'game') pop(ok ? scoreEl : livesEl, ok ? 'pop' : 'shake');
  // The game plays the right one after a mistake (its button is lit green).
  if (s.mode === 'game' && !ok) playEvents(s.q.events);
  if (byKey) nextBtn.focus();
}
function pop(el, cls) {
  el.classList.remove('pop', 'shake');
  void el.offsetWidth;   // restart the animation
  el.classList.add(cls);
}

function next(byKey = false) {
  const s = session;
  if (!s || !s.answered || s.result) return;
  if (s.mode === 'lesson' && s.right >= LESSON_GOAL) return finishLesson();
  if (s.mode === 'game' && s.lives <= 0) return finishGame();
  nextQuestion();
  if (byKey) hearBtn.focus();
}

hearBtn.addEventListener('click', () => { if (session) playEvents(session.q.events); });
compareBtn.addEventListener('click', () => { if (session && session.answered) playEvents(compareEvents(session.q, session.yours)); });
nextBtn.addEventListener('click', (e) => next(e.detail === 0));
$('back-btn').addEventListener('click', goHome);

// --- END OF A LESSON OR A GAME ---
function finishLesson() {
  const s = session, ex = s.ex, i = s.lesson;
  const stars = starsFor(s.mistakes);
  const opened = i + 1 < LESSONS[ex].length && !lessonOpen(settings.stars[ex], i + 1);
  settings.stars[ex][i] = Math.max(settings.stars[ex][i], stars);
  save();
  selected[ex] = nextLesson(ex);
  s.result = { kind: 'lesson', stars, mistakes: s.mistakes, opened, last: i + 1 >= LESSONS[ex].length };
  showDone();
}
function finishGame() {
  const s = session, ex = s.ex;
  const newBest = s.score > settings.best[ex];
  if (newBest) { settings.best[ex] = s.score; save(); }
  s.result = { kind: 'game', score: s.score, newBest };
  showDone();
}
function showDone() {
  stopSound();
  showScreen('done');
  renderDone();
  if (session.result.kind === 'lesson' || session.result.newBest) burst();
  $('done-main').focus({ preventScroll: true });
}
function renderDone() {
  const s = session, r = s.result;
  const starsEl = $('done-stars'), scoreBox = $('done-score');
  const main = $('done-main'), again = $('done-again');
  starsEl.hidden = r.kind !== 'lesson';
  scoreBox.hidden = r.kind !== 'game';
  if (r.kind === 'lesson') {
    starsEl.innerHTML = starsHtml(r.stars);
    starsEl.setAttribute('aria-label', tf('starsAria', { s: r.stars }));
    $('done-title').textContent = tf('doneTitle', { n: s.lesson + 1 });
    const mistakes = r.mistakes === 0 ? t('mistakes0') : r.mistakes === 1 ? t('mistakes1') : tf('mistakesN', { m: r.mistakes });
    $('done-text').textContent = `${mistakes} ${r.last ? t('allDone') : r.opened ? tf('nextOpen', { n: s.lesson + 2 }) : ''}`.trim();
    main.hidden = r.last;
    main.textContent = t('nextLesson');
    again.hidden = false;
    again.textContent = t('again');
  } else {
    $('done-score-num').textContent = r.score;
    scoreBox.setAttribute('aria-label', tf('gameScore', { n: r.score }));
    $('done-title').textContent = t('gameOver');
    $('done-text').textContent = `${tf('gameScore', { n: r.score })}. ${r.newBest ? t('newBest') : tf('bestIs', { n: settings.best[s.ex] })}`;
    main.hidden = false;
    main.textContent = t('playAgain');
    again.hidden = true;
  }
}
$('done-main').addEventListener('click', () => {
  const s = session;
  if (s.result.kind === 'lesson') startLesson(s.lesson + 1);
  else startGame();
});
$('done-again').addEventListener('click', () => startLesson(session.lesson));
$('done-back').addEventListener('click', goHome);

// A short burst of sparkles in the theme's colors.
function burst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('burst');
  box.innerHTML = '';
  const colors = ['var(--color-star)', 'var(--color-left)', 'var(--color-right)'];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.3, d = 70 + Math.random() * 90;
    const sp = document.createElement('span');
    sp.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    sp.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    sp.style.setProperty('--c', colors[i % 3]);
    sp.style.animationDelay = `${Math.random() * 0.15}s`;
    box.appendChild(sp);
  }
  setTimeout(() => { box.innerHTML = ''; }, 1500);
}

startBtn.addEventListener('click', () => startLesson(selected[settings.tab]));
$('game-btn').addEventListener('click', startGame);

// --- FREE PRACTICE WINDOW ---
const pickEl = $('pick'), pickHint = $('pick-hint'), playSeg = $('play-seg'), practiceStart = $('practice-start');
function renderPractice() {
  const ex = settings.tab, p = settings.practice[ex];
  $('practice-title').textContent = tf('practiceTitle', { name: t(TAB_KEYS[ex]) });
  pickEl.dataset.ex = ex;
  pickEl.innerHTML = '';
  ANSWERS[ex].forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = answerName(ex, a);
    b.setAttribute('aria-pressed', String(p.answers.includes(a)));
    b.addEventListener('click', () => {
      p.answers = p.answers.includes(a) ? p.answers.filter((x) => x !== a) : ANSWERS[ex].filter((x) => x === a || p.answers.includes(x));
      save();
      b.setAttribute('aria-pressed', String(p.answers.includes(a)));
      showPickState();
    });
    pickEl.appendChild(b);
  });
  const field = ex === 'degrees' ? 'range' : 'play';
  const options = ex === 'degrees' ? DEGREE_RANGES : PLAYS[ex];
  $('play-label').textContent = t(ex === 'degrees' ? 'rangeLabel' : 'howItPlays');
  playSeg.innerHTML = '';
  options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t(ex === 'chords' && o === 'up' ? 'playOneByOne' : PLAY_KEYS[o]);
    b.setAttribute('aria-pressed', String(p[field] === o));
    b.addEventListener('click', () => {
      p[field] = o;
      save();
      [...playSeg.children].forEach((c, j) => c.setAttribute('aria-pressed', String(options[j] === o)));
    });
    playSeg.appendChild(b);
  });
  showPickState();
}
function showPickState() {
  const enough = settings.practice[settings.tab].answers.length >= 2;
  pickHint.classList.toggle('warn', !enough);
  practiceStart.disabled = !enough;
}
$('practice-btn').addEventListener('click', (e) => { renderPractice(); modals.open(practiceModal, e.currentTarget); });
practiceStart.addEventListener('click', () => {
  if (settings.practice[settings.tab].answers.length < 2) return;
  modals.hideAll(false);
  startPractice();
});

// --- SETTINGS, ABOUT AND PATREON WINDOWS ---
const modals = createModalManager({
  modals: [settingsModal, aboutModal, practiceModal, supportModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
  onHidden: () => { $('reset-ask').hidden = true; },
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
// After 30 s untouched, coming back opens the Patreon window (at most every 40 min).
// A question playing counts as use.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: isPlaying });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
themeSelect.addEventListener('change', () => { settings.theme = themeSelect.value; applyTheme(settings.theme); save(); saveLook({ theme: settings.theme }); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; save(); saveLook({ lang: settings.lang }); applyLanguage(); });
// Chosen on the home page or in another tool, in another tab or before coming Back here.
watchLook((look) => {
  if (look.theme !== settings.theme) { settings.theme = themeSelect.value = look.theme; applyTheme(look.theme); setupCustomSelects(); }
  if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); }
});

function renderNames() {
  [...namesSeg.children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.names === 'solfege') === solfege())));
}
[...namesSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.solfege = b.dataset.names === 'solfege';
  save();
  renderNames();
  if (session && session.answered) renderFeedback();
}));

$('reset-btn').addEventListener('click', () => { $('reset-ask').hidden = false; $('reset-done').hidden = true; $('reset-no').focus(); });
$('reset-no').addEventListener('click', () => { $('reset-ask').hidden = true; $('reset-btn').focus(); });
$('reset-yes').addEventListener('click', () => {
  EXERCISES.forEach((ex) => { settings.stars[ex] = LESSONS[ex].map(() => 0); settings.best[ex] = 0; selected[ex] = 0; });
  save();
  $('reset-ask').hidden = true;
  $('reset-done').hidden = false;
  $('reset-btn').focus();
  if (!session) renderHome();
});

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  renderHome();
  renderNames();
  if (session && document.body.dataset.screen === 'quiz') renderQuiz();
  if (session && document.body.dataset.screen === 'done') renderDone();
  if (!loadingEl.hidden) loadingEl.textContent = t(rackLoading ? 'loading' : 'loadFailed');
  if (modals.current() === practiceModal) renderPractice();
  setupCustomSelects();   // labels and option texts changed
}

// --- KEYBOARD: Space hear again, 1–9 0 - = answer, Enter next, Escape back ---
let spaceHandled = false;
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el && el.closest && el.closest('.custom-select')) return;
  const screen = document.body.dataset.screen;
  if (e.key === 'Escape' && screen !== 'home') { e.preventDefault(); goHome(); return; }
  if (screen !== 'quiz' || !session) return;
  if (e.key === ' ') {
    e.preventDefault();   // Space replays everywhere; Enter still presses a focused button
    spaceHandled = true;
    if (!e.repeat) playEvents(session.q.events);
    return;
  }
  if (e.key === 'Enter') {
    const onButton = el && el.tagName === 'BUTTON' && !(el.classList.contains('answer') && session.answered);
    if (!onButton && session.answered) { e.preventDefault(); next(true); }
    return;
  }
  const i = ANSWER_KEYS.indexOf(e.key);
  const btn = i >= 0 ? answersEl.children[i] : null;
  if (btn && !e.repeat) { e.preventDefault(); answer(btn.answer, true); }
});
document.addEventListener('keyup', (e) => {
  if (e.key === ' ' && spaceHandled) { e.preventDefault(); spaceHandled = false; }
});

// --- START ---
applyTheme(settings.theme);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
showScreen('home');
applyLanguage();
loadRack();   // the piano samples start loading now, so the first question is ready
registerHubWorker('../');
