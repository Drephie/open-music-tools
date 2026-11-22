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
import { prettyChord as pretty } from '../shared/ui/accidentals.js';
import { EAR_STRINGS } from './strings.js';
import * as C from './course.js';

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
    course: readCourse(obj(s.course), obj, int),
  };
}
// The course (Beta). Stars are kept by lesson id, so the course can change while in Beta.
function readCourse(c, obj, int) {
  const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const st = obj(c.stars), streak = obj(c.streak), goal = obj(c.goal);
  const validMix = (m) => m && EXERCISES.includes(m.ex) && ANSWERS[m.ex].includes(m.a) && ANSWERS[m.ex].includes(m.b) && m.a !== m.b;
  return {
    on: c.on === true,
    stars: c.stars && typeof c.stars === 'object' ? C.LESSONS.map((l) => int(st[l.id], 0, 3, 0)) : null,   // null: not moved over yet
    streak: { last: day(streak.last), count: int(streak.count, 0, 99999, 0), rest: day(streak.rest) },
    goal: { day: day(goal.day), done: int(goal.done, 0, 999, 0) },
    goalSize: C.GOALS.includes(c.goalSize) ? c.goalSize : 2,
    chime: c.chime !== false,
    mistakes: (Array.isArray(c.mistakes) ? c.mistakes : []).filter(validMix).slice(0, 30)
      .map((m) => ({ ex: m.ex, a: m.a, b: m.b, play: typeof m.play === 'string' ? m.play : null, range: typeof m.range === 'string' ? m.range : null,
        mode: m.mode === 'minor' ? 'minor' : m.ex === 'degrees' ? 'major' : null, ok: int(m.ok, 0, 1, 0) })),
    view: c.view === 'practice' ? 'practice' : 'course',
  };
}
const settings = readSettings();
// Theme and language are one choice for the whole hub; what this tool saved before is passed on.
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
// The first time the course opens, the stars of the first version's lessons move over.
if (!settings.course.stars) settings.course.stars = C.migrateStars(settings.stars);
const save = () => saveSettings(SETTINGS_KEY, {
  ...settings,
  course: { ...settings.course, stars: Object.fromEntries(C.LESSONS.map((l, i) => [l.id, settings.course.stars[i]]).filter(([, v]) => v)) },
});
const courseOn = () => settings.course.on;
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, EAR_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t, tf } = i18n;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
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

const homeEl = $('home'), quizEl = $('quiz'), doneEl = $('done'), courseEl = $('course'), learnEl = $('learn'), modeTabs = $('mode-tabs');
const tabs = [...document.querySelectorAll('.tab[data-ex]')];   // the three exercises (not Course | Practice)
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
    !!s && ((tag === 'yours' && b.answer === s.yours) || (tag === 'right' && b.answer === s.q.answer)
      || ((tag === 'first' || tag === 'second') && b.answer === tag))));
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
  const screens = [homeEl, quizEl, doneEl, courseEl, learnEl, modeTabs];
  const hadFocus = active && active !== document.body && screens.some((el) => el.contains(active));
  homeEl.hidden = name !== 'home';
  quizEl.hidden = name !== 'quiz';
  doneEl.hidden = name !== 'done';
  courseEl.hidden = name !== 'course';
  learnEl.hidden = name !== 'learn';
  modeTabs.hidden = !courseOn() || (name !== 'home' && name !== 'course');
  homePanel.hidden = courseOn();   // with the course on, the lesson lists give way to it
  document.body.dataset.screen = name;
  document.body.dataset.course = courseOn() ? 'on' : 'off';
  // Keyboard and screen-reader users land on the new screen, not on a hidden button.
  if (hadFocus && !active.checkVisibility?.()) {
    if (name === 'quiz') hearBtn.focus();
    else if (name === 'learn') $('learn-go').focus();
    else if (name === 'home' || name === 'course') (courseOn() ? modeTabs : homeEl).querySelector('.tab[aria-selected="true"]')?.focus();
  }
}
// The lessons screen: the course or practice (course on), or the first version's tabs.
function showHome() {
  if (courseOn() && settings.course.view === 'course') { showScreen('course'); renderCourse(); }
  else { showScreen('home'); renderHome(); }
  renderModeTabs();
}
function goHome() {
  stopSound();
  const s = session;
  if (s && s.mode === 'game' && s.score > settings.best[s.ex]) { settings.best[s.ex] = s.score; save(); }
  session = null;
  showHome();
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
  if (s.mode === 'course') return { answers: s.q.choices };
  if (s.mode === 'lesson') return LESSONS[s.ex][s.lesson];
  if (s.mode === 'game') return gameStage(s.ex, s.score);
  return settings.practice[s.ex];
}

function nextQuestion() {
  const s = session;
  if (s.mode === 'course') {
    const q = s.run.next(s.q);
    if (!q) return finishCourse();
    s.q = q;
    s.ex = q.ex || null;
    s.answered = false;
    s.yours = null;
    s.entered = [];
    s.fresh = [];
    renderQuiz();
    playEvents(q.events);
    return;
  }
  const opts = currentOptions();
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
  promptEl.textContent = s.mode === 'course' ? coursePrompt(s.q) : t(ASK_KEYS[s.ex]);
  const answers = s.answered ? [...answersEl.children].map((b) => b.answer) : opts.answers;
  const n = answers.length;
  const look = s.mode === 'course' ? courseLook(s.q) : s.ex;
  answersEl.dataset.ex = look;
  const row = look === 'degrees' || look === 'numbers';
  answersEl.style.setProperty('--cols', row ? n : n <= 3 ? n : n === 4 ? 2 : 3);
  answersEl.style.setProperty('--cols-wide', row ? n : n <= 4 ? n : n <= 6 ? 3 : 4);
  answersEl.innerHTML = '';
  answers.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'answer' + (s.fresh.includes(a) ? ' fresh' : '');
    b.answer = a;
    b.innerHTML = `<span class="answer-key computer-only" aria-hidden="true">${ANSWER_KEYS[i] || ''}</span><span class="answer-mark" aria-hidden="true"></span><span class="answer-name">${s.mode === 'course' ? choiceName(s.q, a) : answerName(s.ex, a)}</span>`;
    b.addEventListener('click', (e) => answer(a, e.detail === 0));
    answersEl.appendChild(b);
  });
  renderTop();
  renderFeedback();
}

function renderTop() {
  const s = session;
  progressEl.hidden = s.mode !== 'lesson' && s.mode !== 'course';
  livesEl.hidden = scoreEl.hidden = s.mode !== 'game';
  tallyEl.hidden = s.mode !== 'practice';
  if (s.mode === 'course') {
    const r = s.run, n = r.total, at = Math.min(r.asked, n);
    barFill.style.width = `${(100 * at) / n}%`;
    barText.textContent = r.asked >= n && !C.isRight(s.q, s.yours) ? '↺' : `${at} / ${n}`;
    progressEl.setAttribute('aria-label', tf('courseProgressAria', { r: at, g: n }));
  } else if (s.mode === 'lesson') {
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
  if (s.mode === 'course') return renderCourseFeedback();
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
  if (s.mode === 'course') return courseAnswer(a, byKey);
  s.answered = true;
  s.yours = a;
  const ok = a === s.q.answer;
  if (s.mode === 'lesson') { if (ok) s.right++; else s.mistakes++; }
  else if (s.mode === 'game') { if (ok) s.score++; else s.lives--; }
  else { s.asked++; if (ok) s.right++; if (s.asked % C.LESSON_LENGTH === 0) countForGoal(); }
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
  if (s.mode === 'course') { nextQuestion(); if (byKey && session && !session.result) hearBtn.focus(); return; }
  if (s.mode === 'lesson' && s.right >= LESSON_GOAL) return finishLesson();
  if (s.mode === 'game' && s.lives <= 0) return finishGame();
  nextQuestion();
  if (byKey) hearBtn.focus();
}

hearBtn.addEventListener('click', () => { if (session) playEvents(session.q.events); });
compareBtn.addEventListener('click', () => {
  const s = session;
  if (!s || !s.answered) return;
  if (s.mode === 'course') playEvents(courseCompare(s.q, s.yours));
  else playEvents(compareEvents(s.q, s.yours));
});
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
  countForGoal();
  s.result = { kind: 'game', score: s.score, newBest };
  showDone();
}
function showDone() {
  stopSound();
  showScreen('done');
  renderDone();
  const r = session.result;
  if (r.kind === 'lesson' || r.newBest) burst();   // the course celebrates with its stars alone
  $('done-main').focus({ preventScroll: true });
}
function renderDone() {
  const s = session, r = s.result;
  $('done-stats').hidden = r.kind !== 'course';
  if (r.kind === 'course') return renderCourseDone();
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
  if (s.result.kind === 'course') return s.review ? startReview() : openLesson(s.result.next);
  if (s.result.kind === 'lesson') startLesson(s.lesson + 1);
  else startGame();
});
$('done-again').addEventListener('click', () => (session.mode === 'course' ? startCourseLesson(session.lesson) : startLesson(session.lesson)));
$('done-back').addEventListener('click', goHome);

// A short burst of sparkles in the theme's colors.
function burst(count = 22) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('burst');
  box.innerHTML = '';
  const colors = ['var(--color-star)', 'var(--color-left)', 'var(--color-right)'];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.3, d = 70 + Math.random() * (count > 22 ? 150 : 90);
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

// --- THE COURSE (Beta; spec: specs/ear-trainer-course.md) ---
const ROMAN = { 1: 'I', 4: 'IV', 5: 'V', 6: 'vi' };
const today = () => C.dayKey(new Date());
const sectionOf = (i) => C.SECTIONS[C.LESSONS[i].section];
const unitOf = (i) => (C.LESSONS[i].unit >= 0 ? sectionOf(i).units[C.LESSONS[i].unit] : null);

function renderModeTabs() {
  [...modeTabs.children].forEach((b) => {
    const on = b.dataset.mode === settings.course.view;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}
function selectView(view, focus = false) {
  if (view === 'course' && settings.course.view !== 'course') scrollToNext = true;
  settings.course.view = view;
  save();
  showHome();
  if (focus) modeTabs.querySelector(`[data-mode="${view}"]`).focus();
}
[...modeTabs.children].forEach((b) => b.addEventListener('click', () => selectView(b.dataset.mode)));
modeTabs.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  selectView(settings.course.view === 'course' ? 'practice' : 'course', true);
});

// The day: one more lesson's worth for the streak and the goal.
function countForGoal() {
  if (!courseOn()) return;
  const d = today();
  settings.course.streak = C.recordDay(settings.course.streak, d);
  settings.course.goal = C.addToGoal(settings.course.goal, d);
  save();
}

// The course path: a band per section, three lessons per unit winding left and right, a trophy per checkpoint.
const pathEl2 = $('course-path');
let scrollToNext = true;
function renderCourse() {
  const c = settings.course, d = today();
  const streak = C.streakNow(c.streak, d), done = C.goalToday(c.goal, d);
  $('streak-num').textContent = streak;
  $('streak').setAttribute('aria-label', tf('streakAria', { n: streak }));
  $('streak').classList.toggle('cold', !c.streak.last || c.streak.last !== d);
  $('goal-text').textContent = done >= c.goalSize ? t('goalDone') : `${done} / ${c.goalSize}`;
  $('goal-ticks').innerHTML = goalTicks(done, c.goalSize);
  $('goal').setAttribute('aria-label', tf('goalAria', { n: done, g: c.goalSize }));
  const reviewBtn = $('review-btn');
  reviewBtn.hidden = c.mistakes.length < C.REVIEW_MIN;
  $('review-text').textContent = tf('reviewN', { n: c.mistakes.length });

  const stars = c.stars, next = C.nextLessonIn(stars);
  // Drawn like a score: a rehearsal letter for each section, a short staff for
  // each unit with its three lessons as three rising notes, the lesson names
  // under them like lyrics; the checkpoint is a whole note before the final bar line.
  const note = (l, i, h) => {
    const sec = C.SECTIONS[l.section];
    const open = C.lessonOpenIn(stars, i), isNext = i === next && !stars[i];
    const cls = ['note', stars[i] ? 'done' : '', open ? '' : 'locked', isNext ? 'next' : '', l.type === 'check' ? 'whole' : ''].join(' ');
    const name = l.type === 'check' ? t('checkpoint') : t('type_' + l.type);
    const full = l.type === 'check' ? `${name}: ${t('s_' + sec.id)}` : `${t('u_' + sec.units[l.unit].id)}: ${name}`;
    const label = !open ? tf('nodeLocked', { name: full }) : stars[i] ? tf('nodeStars', { name: full, s: stars[i] }) : full;
    return `<button type="button" class="${cls}" data-i="${i}" style="--h:${h}" aria-label="${label}"${open ? '' : ' aria-disabled="true"'}>`
      + `<span class="note-stars">${stars[i] ? starsHtml(stars[i]) : ''}</span><span class="note-head"></span>`
      + `<span class="lyric">${l.type === 'check' ? '' : name}</span></button>`;
  };
  const html = [];
  C.SECTIONS.forEach((sec, si) => {
    html.push(`<section class="sec"><h2 class="sec-head"><span class="sec-mark" aria-hidden="true">${String.fromCharCode(65 + si)}</span>`
      + `<span class="sec-name"><span class="visually-hidden">${tf('sectionN', { n: si + 1 })}: </span>${t('s_' + sec.id)}</span></h2>`);
    sec.units.forEach((u, ui) => {
      const ls = C.LESSONS.filter((l) => l.section === si && l.unit === ui && l.type !== 'check');
      html.push(`<div class="unit"><p class="unit-name">${t('u_' + u.id)}</p><div class="staff">${ls.map((l, k) => note(l, l.index, k)).join('')}</div></div>`);
    });
    const ck = C.LESSONS.find((l) => l.section === si && l.type === 'check');
    if (ck) html.push(`<div class="unit check"><p class="unit-name">${t('checkpoint')}</p><div class="staff end">${note(ck, ck.index, 1)}</div></div>`);
    html.push('</section>');
  });
  pathEl2.innerHTML = html.join('');
  // The one main action: the next lesson, at the bottom of the screen.
  const nextBtn2 = $('course-next');
  nextBtn2.hidden = next === null || next === undefined || next >= C.LESSONS.length;
  if (!nextBtn2.hidden) {
    const l = C.LESSONS[next], sec = C.SECTIONS[l.section];
    const what = l.type === 'check' ? `${t('checkpoint')} · ${t('s_' + sec.id)}` : `${t('u_' + sec.units[l.unit].id)} · ${t('type_' + l.type)}`;
    nextBtn2.innerHTML = `<span class="next-go">${icon('play')}${t(stars.some((s) => s) ? 'continue' : 'start')}</span><span class="next-what">${what}</span>`;
  }
  if (scrollToNext && !courseEl.hidden) {
    scrollToNext = false;
    const el = pathEl2.querySelector('.note.next') || pathEl2.querySelector(`[data-i="${next}"]`);
    // After the browser has put back the old scroll position (on a reload).
    requestAnimationFrame(() => requestAnimationFrame(() => el?.scrollIntoView({ block: 'center' })));
  }
}
pathEl2.addEventListener('click', (e) => {
  const b = e.target.closest('.note');
  if (!b) return;
  const i = Number(b.dataset.i);
  if (!C.lessonOpenIn(settings.course.stars, i)) { pop(b, 'shake'); return; }
  openLesson(i);
});
$('review-btn').addEventListener('click', startReview);
$('course-next').addEventListener('click', () => openLesson(C.nextLessonIn(settings.course.stars)));
// The daily goal as small marks, one for each lesson of the goal.
function goalTicks(done, size) {
  return Array.from({ length: size }, (_, i) => `<span class="tick${i < done ? ' on' : ''}"></span>`).join('');
}

// A unit's first lesson and a checkpoint start with their Learn card.
function openLesson(i) {
  if (i === null || i === undefined || i >= C.LESSONS.length) return goHome();
  const l = C.LESSONS[i];
  if (l.type === 'meet' || l.type === 'check') {
    stopSound();
    session = { mode: 'learn', lesson: i };
    showScreen('learn');
    renderLearn();
    return;
  }
  startCourseLesson(i);
}
function demoName(label) {
  if (label.key) return t(label.key);
  const [kind, a] = label.ref;
  return kind === 'iv' ? cap(t('iv' + a)) : kind === 'c' ? t('c_' + a) : tf('stepN', { n: a });
}
function renderLearn() {
  const i = session.lesson, l = C.LESSONS[i], sec = sectionOf(i), u = unitOf(i);
  $('learn-kicker').innerHTML = `<span class="sec-mark" aria-hidden="true">${String.fromCharCode(65 + l.section)}</span>`
    + `<span><span class="visually-hidden">${tf('sectionN', { n: l.section + 1 })}: </span>${t('s_' + sec.id)}</span>`;
  $('learn-title').textContent = u ? t('u_' + u.id) : t('checkpoint');
  const skip = l.type === 'check' && !C.LESSONS.every((x) => x.section !== l.section || x === l || settings.course.stars[x.index] > 0);
  $('learn-text').textContent = u ? t('u_' + u.id + '_t') : t(skip ? 'checkSkipText' : 'checkText');
  const demos = $('learn-demos');
  demos.innerHTML = '';
  (u ? u.learn.demos : []).forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn demo-btn';
    b.innerHTML = `${icon('play')}<span>${demoName(d.label)}</span>`;
    b.addEventListener('click', () => playEvents(d.events));
    demos.appendChild(b);
  });
  $('learn-go').textContent = t(u ? 'gotIt' : 'start');
}
$('learn-go').addEventListener('click', () => startCourseLesson(session.lesson));
$('learn-back').addEventListener('click', goHome);

function startCourseLesson(i) {
  stopSound();
  session = { mode: 'course', lesson: i, run: C.createRun(C.LESSONS[i]), q: null, ex: null, answered: false, yours: null, entered: [], combo: 0, fresh: [] };
  showScreen('quiz');
  nextQuestion();
}
function startReview() {
  const pools = C.reviewPools(settings.course.mistakes);
  if (!pools) return goHome();
  stopSound();
  session = { mode: 'course', review: true, lesson: null, run: C.createRun(pools), q: null, ex: null, answered: false, yours: null, entered: [], combo: 0, fresh: [] };
  showScreen('quiz');
  nextQuestion();
}

const PROMPTS = { hl: 'askHL', sd: 'askSD', step: 'askStep', keymode: 'askKey', melody: 'askMelody', prog: 'askProg' };
function coursePrompt(q) {
  if (q.kind === 'which') return t(ASK_KEYS[q.ex]);
  if (q.kind === 'pick') return tf('askPick', { name: answerName(q.ex, q.target).toLowerCase() });
  return t(PROMPTS[q.kind]);
}
// How the answer buttons look: numbers in a row for steps and chord numbers.
const courseLook = (q) => (q.kind === 'which' ? q.ex : q.kind === 'melody' ? 'degrees' : q.kind === 'prog' ? 'numbers' : 'words');
function choiceName(q, a) {
  if (q.kind === 'which') return answerName(q.ex, a);
  if (q.kind === 'melody') return String(a);
  if (q.kind === 'prog') return ROMAN[a];
  return t('ch_' + a);
}
function courseDetail(q) {
  if (q.kind === 'which') return `<strong>${answerName(q.ex, q.answer)}</strong>: ${answerDetail(q.ex, q.answer)}`;
  if (q.kind === 'pick') return tf(q.answer === 'first' ? 'pickFirst' : 'pickSecond', { name: `<strong>${answerName(q.ex, q.target).toLowerCase()}</strong>`, other: answerName(q.ex, q.other).toLowerCase() });
  if (q.kind === 'melody') return `<strong>${q.answer.join(' → ')}</strong>`;
  if (q.kind === 'prog') return `<strong>${q.pattern.map((n) => ROMAN[n]).join(' → ')}</strong>: ${t('progWords')}`;
  return `<strong>${t('ch_' + q.answer)}</strong>: ${t('x_' + q.answer)}`;
}
function courseNotes(q) {
  if (q.kind === 'which') return notesText(q);
  if (q.kind === 'hl' || q.kind === 'sd' || q.kind === 'step') {
    return nameNotes(q.notes, solfege()).notes.map((n) => pretty(n.name) + n.octave).join(' → ');
  }
  return '';
}
function renderCourseFeedback() {
  const s = session, q = s.q;
  const ok = s.answered && C.isRight(q, q.kind === 'melody' ? s.entered : s.yours);
  [...answersEl.children].forEach((b) => {
    const isAnswer = q.kind === 'melody' ? false : b.answer === q.answer;
    const good = s.answered && isAnswer, bad = s.answered && q.kind !== 'melody' && b.answer === s.yours && !isAnswer;
    b.classList.toggle('good', good);
    b.classList.toggle('bad', bad);
    b.classList.toggle('after', s.answered);
    b.setAttribute('aria-disabled', String(s.answered));
    b.querySelector('.answer-mark').innerHTML = good ? icon('check') : bad ? icon('cross') : '';
  });
  fbMain.className = 'fb-main' + (s.answered ? (ok ? ' good' : ' bad') : '');
  if (!s.answered) {
    // A melody fills in as the steps are tapped.
    fbMain.innerHTML = q.kind === 'melody' ? q.answer.map((_, i) => `<span class="slot">${s.entered[i] ?? '_'}</span>`).join('') : '';
    fbDetail.innerHTML = q.kind === 'melody' && s.entered.length ? `<button type="button" class="undo-btn" id="undo-btn">${icon('review')}${t('undo')}</button>` : '';
    fbNotes.textContent = '';
  } else {
    fbMain.innerHTML = icon(ok ? 'check' : 'cross', 'fb-icon') + t(ok ? 'right' : 'wrong')
      + (ok && s.combo >= 3 && [3, 5, 8].includes(s.combo) ? ` <span class="combo">${tf('combo', { n: s.combo })}</span>` : '');
    fbDetail.innerHTML = courseDetail(q) + (q.kind === 'melody' && !ok ? ` (${t('yours')}: ${s.entered.join(' → ')})` : '');
    fbNotes.textContent = courseNotes(q);
  }
  compareBtn.hidden = !s.answered || ok || !(q.kind === 'which' || q.kind === 'melody' || q.kind === 'prog' || q.kind === 'keymode');
  nextBtn.hidden = !s.answered;
}
// Melodies: take back the last step tapped (Backspace does the same).
fbDetail.addEventListener('click', (e) => {
  const s = session;
  if (!e.target.closest('#undo-btn') || !s || s.mode !== 'course' || s.answered || !s.entered.length) return;
  s.entered.pop();
  renderCourseFeedback();
  if (s.entered.length) $('undo-btn').focus(); else answersEl.children[0]?.focus();
});
function courseAnswer(a, byKey) {
  const s = session, q = s.q;
  if (q.kind === 'melody') {
    s.entered.push(a);
    const btn = [...answersEl.children].find((b) => b.answer === a);
    pop(btn, 'pop');
    if (s.entered.length < q.answer.length) { renderCourseFeedback(); return; }
  }
  s.answered = true;
  s.yours = q.kind === 'melody' ? s.entered.slice() : a;
  const ok = C.isRight(q, s.yours);
  s.run.answer(q, ok);
  s.combo = ok ? s.combo + 1 : 0;
  if (!ok) settings.course.mistakes = C.noteMistake(settings.course.mistakes, q, s.yours);
  else if (s.review) settings.course.mistakes = C.noteReviewRight(settings.course.mistakes, q);
  save();
  renderTop();
  renderCourseFeedback();
  if (q.kind !== 'melody') pop([...answersEl.children].find((b) => b.answer === a), ok ? 'pop' : 'shake');
  if (ok) pop(progressEl, 'pop');
  chime(ok);
  if (byKey) nextBtn.focus();
}
// Compare: what you answered, then the right one.
function courseCompare(q, yours) {
  if (q.kind === 'which') return compareEvents(q, yours);
  let mine;
  if (q.kind === 'melody') {
    const steps = C.scaleSteps(q.mode);
    const notes = (n) => n.map((d, i) => ({ at: 1.0 + i * 0.7, notes: [q.root + steps[d - 1]], dur: 0.65 }));
    const home = { at: 0, notes: C.homeChord(q.root, q.mode), dur: 0.8 };
    mine = [home, ...notes(yours)];
    const right = [home, ...notes(q.answer)];
    const gap = eventsLength(mine) + 0.5;
    return [...mine.map((e) => ({ ...e, tag: 'yours' })), ...right.map((e) => ({ ...e, at: e.at + gap, tag: 'right' }))];
  }
  if (q.kind === 'prog') {
    const pat = [...q.pattern.slice(0, -1), yours];
    mine = pat.map((n, i) => ({ at: i * 0.85, notes: C.progChord(q.root, n), dur: 0.8 }));
  } else {   // keymode
    mine = C.cadence(q.root, yours);
  }
  const gap = eventsLength(mine) + 0.5;
  return [...mine.map((e) => ({ ...e, tag: 'yours' })), ...q.events.map((e) => ({ ...e, at: e.at + gap, tag: 'right' }))];
}
// A soft chime after a right answer, a low soft tap after a wrong one (Settings can turn them off).
function chime(ok) {
  if (!settings.course.chime || !rack) return;
  const inst = rack.instruments.harp, now = Tone.now() + 0.05;
  if (ok) {
    inst.triggerAttackRelease(midiToFreq(88), 0.25, now, 0.25);
    inst.triggerAttackRelease(midiToFreq(95), 0.4, now + 0.09, 0.22);
  } else {
    rack.instruments.epiano.triggerAttackRelease(midiToFreq(45), 0.25, now, 0.22);
  }
}

function finishCourse() {
  const s = session, d = today(), c = settings.course;
  const firstRight = s.run.firstRight, got = C.starsForRun(firstRight, s.run.total);
  let saved = true, big = false, skipped = false;
  if (!s.review) {
    const i = s.lesson, l = C.LESSONS[i];
    const sectionDone = C.LESSONS.every((x) => x.section !== l.section || x === l || c.stars[x.index] > 0);
    if (l.type === 'check' && !sectionDone) {
      // Skipping ahead needs 7 of 8 at the first try.
      if (firstRight >= C.CHECK_PASS) { c.stars = C.checkpointSkip(c.stars, i, got); skipped = true; }
      else saved = false;
    } else {
      c.stars[i] = Math.max(c.stars[i], got);
    }
    big = l.type === 'mix' || l.type === 'check';
  }
  if (saved) countForGoal();
  save();
  scrollToNext = true;
  s.result = { kind: 'course', stars: got, firstRight, total: s.run.total, saved, big, skipped, next: s.review ? null : C.nextLessonIn(c.stars),
    streak: C.streakNow(c.streak, d), goal: C.goalToday(c.goal, d) };
  showDone();
}
function renderCourseDone() {
  const s = session, r = s.result, c = settings.course;
  const starsEl = $('done-stars');
  $('done-score').hidden = true;
  starsEl.hidden = !r.saved;
  starsEl.innerHTML = starsHtml(r.stars);
  starsEl.setAttribute('aria-label', tf('starsAria', { s: r.stars }));
  const l = s.review ? null : C.LESSONS[s.lesson];
  $('done-title').textContent = s.review ? t('reviewDone') : !r.saved ? t('checkNotYet') : r.skipped ? t('skipDone')
    : l.type === 'check' ? t('sectionDone') : l.type === 'mix' ? t('unitDone') : t('lessonDone');
  $('done-text').textContent = !r.saved ? tf('checkNeed', { r: r.firstRight, n: r.total }) : tf('firstTry', { r: r.firstRight, n: r.total });
  $('done-streak').innerHTML = `${icon('flame', 'flame')}<span>${tf('dayN', { n: r.streak })}</span>`;
  $('done-goal').innerHTML = `<span class="goal-ticks" aria-hidden="true">${goalTicks(r.goal, c.goalSize)}</span><span>${r.goal >= c.goalSize ? t('goalReached') : tf('goalOf', { n: r.goal, g: c.goalSize })}</span>`;
  const main = $('done-main'), again = $('done-again');
  const more = s.review ? C.reviewPools(c.mistakes) : r.next !== null && r.next !== s.lesson;
  main.hidden = !more;
  main.textContent = t(s.review ? 'reviewMore' : 'continue');
  again.hidden = !!s.review;
  again.textContent = t('again');
}

// Settings: the Beta switch, the daily goal, the chime.
function renderCourseSettings() {
  [...$('beta-seg').children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.on === '1') === courseOn())));
  $('course-settings').hidden = !courseOn();
  const goalSeg = $('goal-seg');
  if (!goalSeg.children.length) {
    C.GOALS.forEach((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = g;
      b.dataset.goal = g;
      b.addEventListener('click', () => { settings.course.goalSize = g; save(); renderCourseSettings(); renderCourse(); });
      goalSeg.appendChild(b);
    });
  }
  [...goalSeg.children].forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.goal) === settings.course.goalSize)));
  [...$('chime-seg').children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.on === '1') === settings.course.chime)));
}
[...$('beta-seg').children].forEach((b) => b.addEventListener('click', () => {
  settings.course.on = b.dataset.on === '1';
  if (settings.course.on) { settings.course.view = 'course'; scrollToNext = true; }
  save();
  renderCourseSettings();
  if (!session) showHome();
}));
[...$('chime-seg').children].forEach((b) => b.addEventListener('click', () => {
  settings.course.chime = b.dataset.on === '1';
  save();
  renderCourseSettings();
  if (settings.course.chime) chime(true);
}));

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
// In use while a question is on screen: the window may come when a lesson or game ends.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => isPlaying() || document.body.dataset.screen === 'quiz' || document.body.dataset.screen === 'learn' });
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
  Object.assign(settings.course, { stars: C.LESSONS.map(() => 0), streak: { last: null, count: 0, rest: null }, goal: { day: null, done: 0 }, mistakes: [] });
  save();
  $('reset-ask').hidden = true;
  $('reset-done').hidden = false;
  $('reset-btn').focus();
  if (!session) showHome();
});

function applyLanguage() {
  i18n.apply();
  renderHome();
  renderCourse();
  renderModeTabs();
  renderCourseSettings();
  if (session && document.body.dataset.screen === 'learn') renderLearn();
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
  if (e.key === 'Escape' && screen !== 'home' && screen !== 'course') { e.preventDefault(); goHome(); return; }
  if (e.key === 'Backspace' && screen === 'quiz' && session && session.mode === 'course' && !session.answered && session.entered.length) {
    e.preventDefault(); session.entered.pop(); renderCourseFeedback(); return;
  }
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
applyLanguage();
showHome();
loadRack();   // the piano samples start loading now, so the first question is ready
registerHubWorker('../');
