/**
 * Global keyboard shortcuts for Cultiva desktop / web shell.
 * @param {object} h
 * @param {() => void} h.openAddModal
 * @param {() => void} h.openSettings
 * @param {() => void} h.focusSearch
 * @param {() => void} h.completeHighlighted
 * @param {() => void} h.logQuantityHighlighted
 * @param {() => void} h.closeTopModal
 */
export function initHotkeys(h) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      h.closeTopModal();
      return;
    }

    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      h.openAddModal();
      return;
    }
    if (mod && e.key === ',') {
      e.preventDefault();
      h.openSettings();
      return;
    }
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      h.focusSearch();
      return;
    }
    if (typing) {
      return;
    }
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      h.completeHighlighted();
      return;
    }
    if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      h.logQuantityHighlighted();
    }
  });
}
