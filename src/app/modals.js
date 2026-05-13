import { habits } from '../modules/habits.js';

/** @type {null | ((value: number | null) => void)} */
let quantityLogResolve = null;

let quantityLogModal = null;
let quantityLogInput = null;
let quantityLogTitle = null;
let quantityLogDesc = null;
let quantityLogLabel = null;

/**
 * @param {object} el
 * @param {HTMLElement | null} el.quantityLogModal
 * @param {HTMLInputElement | null} el.quantityLogInput
 * @param {HTMLElement | null} el.quantityLogTitle
 * @param {HTMLElement | null} el.quantityLogDesc
 * @param {HTMLElement | null} el.quantityLogLabel
 */
export function configureModals(el) {
  quantityLogModal = el.quantityLogModal;
  quantityLogInput = el.quantityLogInput;
  quantityLogTitle = el.quantityLogTitle;
  quantityLogDesc = el.quantityLogDesc;
  quantityLogLabel = el.quantityLogLabel;
}

export function openModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeModal(modal) {
  if (!modal) {
    return;
  }
  if (modal.id === 'quantity-log-modal' && quantityLogResolve) {
    const done = quantityLogResolve;
    quantityLogResolve = null;
    done(null);
  }
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * After validated numeric input from quantity log save.
 * @param {number} parsed
 */
export function completeQuantityLogWithValue(parsed) {
  const done = quantityLogResolve;
  quantityLogResolve = null;
  if (quantityLogModal) {
    quantityLogModal.classList.remove('active');
  }
  document.body.style.overflow = '';
  if (done) {
    done(parsed);
  }
}

/**
 * @param {object} habit
 * @param {number} currentValue
 * @param {Record<string, string>} t
 * @returns {Promise<number | null>}
 */
export function openQuantityLogModal(habit, currentValue, t) {
  return new Promise((resolve) => {
    quantityLogResolve = resolve;
    if (quantityLogTitle) {
      quantityLogTitle.textContent = habit.treeName || habit.name;
    }
    if (quantityLogDesc) {
      const goal = habits.quantityTarget(habit);
      const bits = [`${t.goal}: ${goal}`];
      if (habit.unit) {
        bits.push(String(habit.unit));
      }
      if (t.quantityLogSubtitle) {
        bits.push(t.quantityLogSubtitle);
      }
      quantityLogDesc.textContent = bits.join(' — ');
    }
    if (quantityLogLabel) {
      quantityLogLabel.textContent = t.quantityLogLabel || t.quantityLogPrompt || 'Total for today';
    }
    if (quantityLogInput) {
      quantityLogInput.value = String(currentValue);
      openModal(quantityLogModal);
      setTimeout(() => {
        quantityLogInput.focus();
        quantityLogInput.select();
      }, 50);
    } else {
      quantityLogResolve = null;
      resolve(null);
    }
  });
}
