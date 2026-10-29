/* shared/ui/accidentals.js: sharp and flat signs drawn, not typed. The
 * themes' fonts have no ♯ or ♭ of their own, so where a note name is big (the
 * tuners) the sign is a small inline SVG that takes the text colour.
 *
 *   accidentalHtml(name)  'F#' / 'Mib' -> the name with its trailing # or b as
 *                         <svg class="acc">; other names unchanged. Size it
 *                         with CSS (e.g. .note .acc { width: 0.36em; height: 0.58em });
 *                         page.css gives .acc its stroke and colour.
 *   prettyName(name)      'F#' -> 'F♯', 'Mib' -> 'Mi♭' (plain text: screen
 *                         readers, titles)
 *
 * Names come from shared/theory.js (ASCII '#' and 'b' after the letter or
 * syllable; letters are capitals, so a final lowercase b is always a flat).
 */
const ACC_SVG = {
  '#': '<svg class="acc" viewBox="0 0 10 16" aria-hidden="true"><path d="M3.6 1.5v13.5M6.6 0.8v13.5" stroke-width="1.7"/><path d="M1 6.4 9 4.6M1 11.2 9 9.4" stroke-width="2.6"/></svg>',
  b: '<svg class="acc" viewBox="0 0 10 16" aria-hidden="true"><path d="M2.6 0.5v14.5c3.2-1.3 6-3.6 5.7-5.7-.3-2-3-2-5.7.2" stroke-width="2.2"/></svg>',
};

export const accidentalHtml = (name) => name.replace(/([#b])$/, (acc) => ACC_SVG[acc]);
export const prettyName = (name) => name.replace(/#$/, '♯').replace(/b$/, '♭');
