const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => Number(toNumber(value).toFixed(2));

export const INIT_LINE_ITEM = {
  lot_number: '',
  item_name: '',
  shape: '',
  color: '',
  clarity: '',
  size: '',
  sieve: '',
  issue_carats: 0,
  reje_pct: 0,
  rejection: 0,
  selected_carat: 0,
  pcs: 0,
  rate: 0,
  usd_rate: 0,
  less1_sign: '-',
  less1: 0,
  less2_sign: '-',
  less2: 0,
  less3_sign: '+',
  less3: 0,
  amount: 0,
};

export const applyLotAutoFields = (item, lot) => ({
  ...item,
  lot_number: lot?.lot_no || '',
  item_name: lot?.item_name || '',
  shape: lot?.shape || '',
  color: lot?.color || '',
  clarity: lot?.clarity || '',
  size: lot?.size || '',
  sieve: lot?.sieve || '',
  issue_carats: toNumber(item?.issue_carats || lot?.opening_weight_carats || 0),
  selected_carat: toNumber(item?.selected_carat || lot?.opening_weight_carats || 0),
  pcs: toNumber(item?.pcs || lot?.opening_pcs || 0),
});

export const convertRateToUsd = (rate, currency, inrRate, aedRate) => {
  const r = toNumber(rate);
  if (currency === 'INR') return toNumber(aedRate) > 0 ? r / toNumber(aedRate) : 0;
  if (currency === 'AED') return toNumber(aedRate) > 0 ? r / toNumber(aedRate) : 0;
  return r;
};

export const getCurrencyDefaults = (currency) => {
  if (currency === 'INR') return { inr_rate: 1, usd_rate: 85 };
  if (currency === 'AED') return { inr_rate: 25, usd_rate: 3.67 };
  return { inr_rate: 85, usd_rate: 1 };
};

export const normalizeLineItem = (item, { currency, inrRate, aedRate, sourceField } = {}) => {
  const issue = toNumber(item.issue_carats);
  let rejection = toNumber(item.rejection);
  let rejePct = toNumber(item.reje_pct);
  let selected = toNumber(item.selected_carat);

  if (sourceField === 'rejection') {
    rejePct = issue > 0 ? (rejection / issue) * 100 : 0;
    selected = issue - rejection;
  } else if (sourceField === 'reje_pct') {
    rejection = (issue * rejePct) / 100;
    selected = issue - rejection;
  } else if (sourceField === 'selected_carat') {
    selected = Math.min(Math.max(selected, 0), issue);
    rejection = issue - selected;
    rejePct = issue > 0 ? (rejection / issue) * 100 : 0;
  } else if (issue > 0) {
    if (rejection > 0 && rejePct === 0) rejePct = (rejection / issue) * 100;
    else if (rejePct > 0 && rejection === 0) rejection = (issue * rejePct) / 100;
    else if (selected > 0) rejection = issue - selected;
    selected = issue - rejection;
  }

  rejection = Math.min(Math.max(rejection, 0), issue);
  selected = Math.max(issue - rejection, 0);
  const rate = toNumber(item.rate);
  const less1 = toNumber(item.less1);
  const less2 = toNumber(item.less2);
  const less3 = toNumber(item.less3);
  const less1Sign = item.less1_sign === '+' ? '+' : '-';
  const less2Sign = item.less2_sign === '+' ? '+' : '-';
  const less3Sign = item.less3_sign === '-' ? '-' : '+';

  const base = selected * rate;
  const less1Amt = (base * less1) / 100;
  const less2Amt = (base * less2) / 100;
  const less3Amt = (base * less3) / 100;
  const amount =
    base +
    (less1Sign === '+' ? less1Amt : -less1Amt) +
    (less2Sign === '+' ? less2Amt : -less2Amt) +
    (less3Sign === '+' ? less3Amt : -less3Amt);

  return {
    ...item,
    less1_sign: less1Sign,
    less2_sign: less2Sign,
    less3_sign: less3Sign,
    issue_carats: round2(issue),
    rejection: round2(rejection),
    reje_pct: round2(rejePct),
    selected_carat: round2(selected),
    rate: round2(rate),
    usd_rate: round2(convertRateToUsd(rate, currency, inrRate, aedRate)),
    less1: round2(less1),
    less2: round2(less2),
    less3: round2(less3),
    amount: round2(amount),
  };
};

export const calculateTotals = (form) => {
  const totalCarats = (form.items || []).reduce((sum, item) => sum + toNumber(item.selected_carat || item.issue_carats), 0);
  const netAmount = (form.items || []).reduce((sum, item) => sum + toNumber(item.amount), 0);
  const cgstAmount = (netAmount * toNumber(form.cgst_pct)) / 100;
  const sgstAmount = (netAmount * toNumber(form.sgst_pct)) / 100;
  const igstAmount = (netAmount * toNumber(form.igst_pct)) / 100;
  const vatAmount = (netAmount * toNumber(form.vat_pct)) / 100;
  const finalAmount = netAmount + cgstAmount + sgstAmount + igstAmount + vatAmount;
  const inrFinal = finalAmount * toNumber(form.inr_rate || 0);
  const usdFinal =
    form.currency === 'USD'
      ? finalAmount
      : (toNumber(form.usd_rate) > 0 ? finalAmount / toNumber(form.usd_rate) : 0);

  return {
    total_carats: round2(totalCarats),
    net_amount: round2(netAmount),
    m_currency_net_amount: 0,
    plus_minus_amount: 0,
    cgst_amount: round2(cgstAmount),
    sgst_amount: round2(sgstAmount),
    igst_amount: round2(igstAmount),
    vat_amount: round2(vatAmount),
    inr_final_amount: round2(inrFinal),
    usd_final_amount: round2(usdFinal),
    transaction_final_amount: round2(usdFinal),
  };
};
