import { useState, useEffect } from 'react';

// Converts yyyy-mm-dd → dd-mm-yyyy for display
function isoToDisplay(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Converts dd-mm-yyyy → yyyy-mm-dd for storage
function displayToISO(disp) {
  if (!disp) return '';
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(disp.trim());
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function DateInput({ value, onChange, className, disabled, readOnly, placeholder }) {
  const [disp, setDisp] = useState(() => isoToDisplay(value || ''));

  useEffect(() => {
    setDisp(isoToDisplay(value || ''));
  }, [value]);

  function handleChange(e) {
    const raw = e.target.value;
    setDisp(raw);
    const iso = displayToISO(raw);
    if (iso) onChange(iso);
    else if (!raw) onChange('');
  }

  function handleBlur() {
    const iso = displayToISO(disp);
    if (iso) {
      setDisp(isoToDisplay(iso));
      onChange(iso);
    } else if (!disp.trim()) {
      setDisp('');
      onChange('');
    }
  }

  return (
    <input
      type="text"
      value={disp}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder || 'dd-mm-yyyy'}
    />
  );
}
