import { useEffect, useRef, useState } from 'react';

/**
 * Format a raw digit-string with Indian-style comma grouping.
 * "1234567.89" → "12,34,567.89"
 * Works on partial input (e.g. "1234." stays "1,234.")
 */
function applyCommas(raw) {
  if (!raw || raw === '-') return raw;
  const isNeg = raw.startsWith('-');
  const digits = isNeg ? raw.slice(1) : raw;
  const [intPart, ...decParts] = digits.split('.');
  const decSuffix = decParts.length > 0 ? '.' + decParts.join('') : '';

  let intFormatted;
  if (intPart.length <= 3) {
    intFormatted = intPart;
  } else {
    // Indian grouping: rightmost 3 digits, then groups of 2
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    intFormatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  return (isNeg ? '-' : '') + intFormatted + decSuffix;
}

/**
 * A numeric text input that formats with commas as you type (Indian locale).
 * The cursor stays at the correct position even as commas are inserted/removed.
 *
 * Props:
 *   value      - numeric value (number | '')
 *   onChange   - (name, value) => void  [value is number or '' while typing]
 *   name       - field name passed back to onChange
 *   className  - input className
 *   onFocus / onBlur - optional passthrough handlers
 */
export default function NumericInput({ value, onChange, name, className, onFocus, onBlur }) {
  const inputRef = useRef(null);
  const [display, setDisplay] = useState('');

  // Sync external value changes (e.g. calculated fields reset, edit-mode load)
  // Only update display if input is not focused
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    const n = Number(value);
    setDisplay(value === '' || value === 0 ? '' : applyCommas(String(n)));
  }, [value]);

  const handleChange = (e) => {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const rawInput = input.value;

    // Count commas before cursor in what the user typed
    const commasBefore = (rawInput.slice(0, cursorPos).match(/,/g) || []).length;
    // Raw cursor = cursor position in digits-only string
    const rawCursor = cursorPos - commasBefore;

    // Strip all commas → validate
    const stripped = rawInput.replace(/,/g, '');
    if (stripped !== '' && !/^-?\d*\.?\d*$/.test(stripped)) return; // reject invalid chars

    // Re-format
    const formatted = applyCommas(stripped);
    setDisplay(formatted);

    // Map rawCursor back into the formatted string
    let newCursorPos = formatted.length;
    let rawCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (rawCount === rawCursor) {
        newCursorPos = i;
        break;
      }
      if (formatted[i] !== ',') rawCount++;
    }

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });

    // Push numeric value up to parent
    const num = parseFloat(stripped);
    onChange(name, stripped === '' ? '' : (isNaN(num) ? '' : num));
  };

  const handleFocus = (e) => {
    // Clear display if value is 0 so user doesn't have to delete it
    if (Number(value) === 0) {
      setDisplay('');
      onChange(name, '');
    }
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    const stripped = display.replace(/,/g, '');
    const num = parseFloat(stripped);
    if (stripped === '' || isNaN(num)) {
      setDisplay('');
      onChange(name, 0);
    } else {
      setDisplay(applyCommas(stripped));
      onChange(name, num);
    }
    onBlur?.(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
}
