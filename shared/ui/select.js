/* shared/ui/select.js: accessible custom dropdowns (combobox + listbox).
 *
 * Markup: a native <select> inside <div class="custom-select">, ideally in a
 * .control-group with a <label> (used as the accessible name):
 *   <div class="control-group"><label>Key</label>
 *     <div class="custom-select"><select id="key">...</select></div></div>
 * The native select stays the source of truth: read select.value and listen
 * for its 'change' event as usual.
 *
 *   setupCustomSelects()          (re)builds every .custom-select on the page;
 *                                 call it again after changing options or labels
 *   buildCustomSelect(container)  (re)builds one
 *   closeAllSelect(except)        closes every open list except `except`
 *
 * Keyboard: arrows, Home/End, Enter/Space, Escape, Tab. Disabled options are
 * skipped. Importing this module adds one document click listener that closes
 * open lists. Styles: shared/ui/select.css.
 *
 * A list opens below its trigger, or above it (class "select-up") when there
 * is more room there, and is shortened to fit the screen, so it never needs the
 * page scrolled. Highlighting an option scrolls only the list. A list inside a
 * scrolling container is cut off by it: give such a container overflow: visible.
 */
export function closeAllSelect(except) {
  document.querySelectorAll('.custom-select').forEach(cs => {
    if (cs === except) return;
    const list = cs.querySelector('.select-items');
    const trig = cs.querySelector('.select-selected');
    if (list) list.classList.add('select-hide');
    if (trig) { trig.classList.remove('select-arrow-active'); trig.setAttribute('aria-expanded', 'false'); trig.removeAttribute('aria-activedescendant'); }
  });
}
document.addEventListener('click', () => closeAllSelect(null));

export function buildCustomSelect(container) {
  const sel = container.querySelector('select');
  if (!sel) return;
  container.querySelectorAll('.select-selected, .select-items').forEach(n => n.remove());

  const labelEl = container.closest('.control-group')?.querySelector('label');
  const listId = 'listbox-' + sel.id;
  const trigger = document.createElement('div');
  trigger.className = 'select-selected';
  trigger.tabIndex = 0;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', listId);
  if (labelEl) trigger.setAttribute('aria-label', labelEl.textContent);

  const list = document.createElement('div');
  list.className = 'select-items select-hide';
  list.id = listId;
  list.setAttribute('role', 'listbox');

  const optionEls = [];
  let highlight = Math.max(0, sel.selectedIndex);

  const syncTriggerText = () => {
    const opt = sel.options[Math.max(0, sel.selectedIndex)];
    trigger.textContent = opt ? opt.textContent : '';
  };
  const isOpen = () => !list.classList.contains('select-hide');
  // Below the trigger, or above when there is more room there; never taller than the room.
  const placeList = () => {
    list.classList.remove('select-up');
    list.style.maxHeight = '';
    const r = trigger.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
    const need = Math.min(list.scrollHeight, parseFloat(getComputedStyle(list).maxHeight) || Infinity);
    const up = need > below && above > below;
    list.classList.toggle('select-up', up);
    const room = up ? above : below;
    if (need > room) list.style.maxHeight = Math.max(96, Math.floor(room)) + 'px';
  };
  const open = () => {
    closeAllSelect(container);
    list.classList.remove('select-hide');
    placeList();
    trigger.classList.add('select-arrow-active');
    trigger.setAttribute('aria-expanded', 'true');
    highlight = Math.max(0, sel.selectedIndex);
    updateHighlight();
  };
  const close = () => {
    list.classList.add('select-hide');
    trigger.classList.remove('select-arrow-active');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
  };
  const updateHighlight = () => {
    optionEls.forEach((o, i) => o.classList.toggle('option-highlight', i === highlight));
    const o = optionEls[highlight];
    if (!o) return;
    trigger.setAttribute('aria-activedescendant', o.id);
    // Scroll the list only (scrollIntoView would also scroll the page or a window).
    if (o.offsetTop < list.scrollTop) list.scrollTop = o.offsetTop;
    else if (o.offsetTop + o.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = o.offsetTop + o.offsetHeight - list.clientHeight;
  };
  // Match by value (via selectedIndex), never by innerHTML.
  const commit = (i) => {
    if (!sel.options[i] || sel.options[i].disabled) return;
    if (sel.selectedIndex !== i) {
      sel.selectedIndex = i;
      optionEls.forEach((o, j) => { o.classList.toggle('same-as-selected', j === i); o.setAttribute('aria-selected', String(j === i)); });
      syncTriggerText();
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  const move = (delta) => {
    let i = highlight;
    for (let guard = 0; guard < sel.options.length; guard++) {
      i = (i + delta + sel.options.length) % sel.options.length;
      if (!sel.options[i].disabled) { highlight = i; break; }
    }
    updateHighlight();
  };

  [...sel.options].forEach((opt, i) => {
    const o = document.createElement('div');
    o.id = listId + '-opt-' + i;
    o.setAttribute('role', 'option');
    o.dataset.value = opt.value;
    o.textContent = opt.textContent;
    o.setAttribute('aria-selected', String(i === sel.selectedIndex));
    if (i === sel.selectedIndex) o.classList.add('same-as-selected');
    if (opt.disabled) { o.setAttribute('aria-disabled', 'true'); o.classList.add('option-disabled'); }
    o.addEventListener('click', (e) => { e.stopPropagation(); if (opt.disabled) return; commit(i); close(); trigger.focus(); });
    list.appendChild(o);
    optionEls.push(o);
  });
  syncTriggerText();

  trigger.addEventListener('click', (e) => { e.stopPropagation(); isOpen() ? close() : open(); });
  trigger.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); isOpen() ? move(1) : open(); break;
      case 'ArrowUp': e.preventDefault(); isOpen() ? move(-1) : open(); break;
      case 'Enter': case ' ': e.preventDefault(); if (isOpen()) { commit(highlight); close(); } else open(); break;
      case 'Home': if (isOpen()) { e.preventDefault(); highlight = -1; move(1); } break;
      case 'End': if (isOpen()) { e.preventDefault(); highlight = 0; move(-1); } break;
      case 'Escape': if (isOpen()) { e.preventDefault(); e.stopPropagation(); close(); } break;
      case 'Tab': if (isOpen()) close(); break;
    }
  });

  container.appendChild(trigger);
  container.appendChild(list);
}
export function setupCustomSelects() {
  document.querySelectorAll('.custom-select').forEach(buildCustomSelect);
}
