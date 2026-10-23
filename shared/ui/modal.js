/* shared/ui/modal.js: dialogs with focus trap, Escape and focus return.
 *
 * Modals are elements hidden with style="display:none" and shown as flex,
 * with role="dialog" aria-modal="true". Only one is open at a time.
 *
 *   const modals = createModalManager({ modals, fallback, onHidden, escapeAction })
 *     modals        the managed elements
 *     fallback()    a dialog to treat as current when none is open (e.g. a
 *                   welcome screen shown with other code), or null
 *     onHidden(wasOpen)    after hideAll(), with the modals that were open
 *     escapeAction(modal)  what Escape does: 'hide' (default), 'ignore', or a
 *                          function to call instead
 *   modals.open(modal, opener)   hides the others, shows this one, focuses its
 *                                first control (close buttons last); focus
 *                                returns to `opener` when it is hidden
 *   modals.hideAll(returnFocus = true)
 *   modals.current()             the open modal, else fallback(), else null
 *   modals.focusablesIn(el)
 *
 * Creating a manager adds one document keydown listener (Escape, and Tab kept
 * inside the current dialog). Close buttons conventionally have class "close-btn".
 */

export const focusablesIn = (el) => [...el.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')]
  .filter(n => !n.disabled && n.offsetParent !== null);

export function createModalManager({ modals, fallback = () => null, onHidden = null, escapeAction = () => 'hide' }) {
  let openModalEl = null;
  let modalOpener = null;

  function open(modal, opener) {
    hideAll(false);
    modal.style.display = 'flex';
    openModalEl = modal;
    modalOpener = opener || null;
    const f = focusablesIn(modal);
    (f.find(n => !n.classList.contains('close-btn')) || f[0] || modal).focus();
  }
  function hideAll(returnFocus = true) {
    const wasOpen = modals.filter(m => m.style.display === 'flex');
    modals.forEach(m => m.style.display = 'none');
    if (onHidden) onHidden(wasOpen);
    if (returnFocus && modalOpener && document.contains(modalOpener)) modalOpener.focus();
    openModalEl = null;
    modalOpener = null;
  }
  function current() {
    return openModalEl || fallback() || null;
  }
  document.addEventListener('keydown', (e) => {
    const modal = current();
    if (!modal) return;
    if (e.key === 'Escape') {
      const action = escapeAction(modal);
      if (action === 'ignore') return;
      e.preventDefault();
      if (typeof action === 'function') action();
      else hideAll();
      return;
    }
    if (e.key === 'Tab') {
      const f = focusablesIn(modal);
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });
  return { open, hideAll, current, focusablesIn };
}
