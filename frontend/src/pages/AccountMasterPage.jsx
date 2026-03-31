import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Save, Trash2, Pencil } from 'lucide-react';
import api from '../api';
import ListPageControls from '../components/ListPageControls';

const UNDER_GROUP_OPTIONS = [
  'Assets', 'Liabilities', 'Income', 'Expense', 'Fixed Assets', 'Current Assets',
  'Loan And Advances', 'Non Trading Expenses', 'Trading Expenses', 'Stock',
  'Non Trading Income', 'Trading Income', 'Current Liabilities', 'Provision And Loan',
  'Reserves And Surplus', 'Cash And Bank Balance', 'Sundry Debtors', 'Loan Given',
  'OFFICE STAFF', 'Bad Debt And Depriciation', 'Financial Expense', 'Marketing Expense',
  'Office Expense', 'Purchase Overheads', 'Interest Earning', 'Sales And Comission',
  'Brokers', 'Sundry Creditors', 'Loan Taken', 'Propritors Capital', 'Bank Balance',
  'Cash Balance', 'Local Customer', 'Outside Customer', 'Local Supplier',
  'Outside Supplier', 'Secured Taken Loan', 'Unsecured Taken Loan', 'Commission',
];

const INIT_FORM = {
  entry_type: 'Account',
  account_group_name: '',
  account_name: '',
  short_name: '',
  under_group_name: '',
  account_type: '',
  currency: 'INR',
  inr_base_rate: 85,
  usd_base_rate: 1,
  opening_balance: 0.0,
  balance_type: 'Debit',
  interest_pct: '',
  discount_pct: '',
  credit_limit: '',
  due_days: '',
  grace_period: '',
  term: '',
  term_pct: '',
  term_per: '',
  markup: '',
  local_language_name: '',
  local_language_contact_person: '',
  local_language_address: '',
  website_user: '',
  address1: '',
  address2: '',
  address3: '',
  zipcode: '',
  city: '',
  state: '',
  country: '',
  area: '',
  mobile: '',
  office_phone: '',
  home_phone: '',
  fax: '',
  qqid: '',
  email: '',
  website: '',
  skype: '',
  broker_per: '',
  through: '',
  contact_person: '',
  agent: '',
  reference_party_name1: '',
  reference_party_name2: '',
  reference_phone1: '',
  reference_phone2: '',
  reference_comments1: '',
  reference_comments2: '',
  bank_account_no: '',
  bank_account_detail: '',
  bank_routing: '',
  bank_swift_code: '',
  pan_no: '',
  gst_no: '',
  tin_number: '',
  cin_no: '',
  gr_no: '',
  cst_no: '',
  remarks: '',
  compliance: false,
  active: true,
  email_inventory: false,
  shipping_name: '',
  shipping_address1: '',
  shipping_zipcode: '',
  shipping_city: '',
  shipping_state: '',
  shipping_country: '',
  shipping_area: '',
  shipping_phone: '',
  shipping_fax: '',
  allow_zero_opening_balance: false,
};

const numericFields = new Set([
  'inr_base_rate', 'usd_base_rate', 'opening_balance', 'interest_pct', 'discount_pct', 'credit_limit', 'due_days', 'grace_period',
  'term_pct', 'term_per', 'markup', 'broker_per',
]);
const optionalNumericFields = [
  'interest_pct', 'discount_pct', 'credit_limit', 'due_days', 'grace_period',
  'term_pct', 'term_per', 'markup', 'broker_per',
];
const textAreas = new Set(['local_language_address', 'reference_comments1', 'reference_comments2', 'bank_account_detail', 'remarks', 'shipping_address1']);
const tabs = ['Account Details', 'KYC Details', 'Financial Details', 'Shipping Details'];
const phoneFields = ['mobile', 'office_phone', 'home_phone', 'reference_phone1', 'reference_phone2', 'shipping_phone'];
const PHONE_CODE_REGEX = /^\+\d{1,3}$/;
const PHONE_NUMBER_REGEX = /^\d{6,15}$/;
const DIAL_CODE_OPTIONS = [
  { value: '+1', label: 'USA/Canada (+1)' }, { value: '+7', label: 'Russia/Kazakhstan (+7)' }, { value: '+20', label: 'Egypt (+20)' },
  { value: '+27', label: 'South Africa (+27)' }, { value: '+30', label: 'Greece (+30)' }, { value: '+31', label: 'Netherlands (+31)' },
  { value: '+32', label: 'Belgium (+32)' }, { value: '+33', label: 'France (+33)' }, { value: '+34', label: 'Spain (+34)' },
  { value: '+36', label: 'Hungary (+36)' }, { value: '+39', label: 'Italy (+39)' }, { value: '+40', label: 'Romania (+40)' },
  { value: '+41', label: 'Switzerland (+41)' }, { value: '+43', label: 'Austria (+43)' }, { value: '+44', label: 'UK (+44)' },
  { value: '+45', label: 'Denmark (+45)' }, { value: '+46', label: 'Sweden (+46)' }, { value: '+47', label: 'Norway (+47)' },
  { value: '+48', label: 'Poland (+48)' }, { value: '+49', label: 'Germany (+49)' }, { value: '+51', label: 'Peru (+51)' },
  { value: '+52', label: 'Mexico (+52)' }, { value: '+53', label: 'Cuba (+53)' }, { value: '+54', label: 'Argentina (+54)' },
  { value: '+55', label: 'Brazil (+55)' }, { value: '+56', label: 'Chile (+56)' }, { value: '+57', label: 'Colombia (+57)' },
  { value: '+58', label: 'Venezuela (+58)' }, { value: '+60', label: 'Malaysia (+60)' }, { value: '+61', label: 'Australia (+61)' },
  { value: '+62', label: 'Indonesia (+62)' }, { value: '+63', label: 'Philippines (+63)' }, { value: '+64', label: 'New Zealand (+64)' },
  { value: '+65', label: 'Singapore (+65)' }, { value: '+66', label: 'Thailand (+66)' }, { value: '+81', label: 'Japan (+81)' },
  { value: '+82', label: 'South Korea (+82)' }, { value: '+84', label: 'Vietnam (+84)' }, { value: '+86', label: 'China (+86)' },
  { value: '+90', label: 'Turkey (+90)' }, { value: '+91', label: 'India (+91)' }, { value: '+92', label: 'Pakistan (+92)' },
  { value: '+93', label: 'Afghanistan (+93)' }, { value: '+94', label: 'Sri Lanka (+94)' }, { value: '+95', label: 'Myanmar (+95)' },
  { value: '+98', label: 'Iran (+98)' }, { value: '+211', label: 'South Sudan (+211)' }, { value: '+212', label: 'Morocco (+212)' },
  { value: '+213', label: 'Algeria (+213)' }, { value: '+216', label: 'Tunisia (+216)' }, { value: '+218', label: 'Libya (+218)' },
  { value: '+220', label: 'Gambia (+220)' }, { value: '+221', label: 'Senegal (+221)' }, { value: '+223', label: 'Mali (+223)' },
  { value: '+224', label: 'Guinea (+224)' }, { value: '+225', label: "Côte d'Ivoire (+225)" }, { value: '+226', label: 'Burkina Faso (+226)' },
  { value: '+227', label: 'Niger (+227)' }, { value: '+228', label: 'Togo (+228)' }, { value: '+229', label: 'Benin (+229)' },
  { value: '+230', label: 'Mauritius (+230)' }, { value: '+231', label: 'Liberia (+231)' }, { value: '+232', label: 'Sierra Leone (+232)' },
  { value: '+233', label: 'Ghana (+233)' }, { value: '+234', label: 'Nigeria (+234)' }, { value: '+235', label: 'Chad (+235)' },
  { value: '+236', label: 'Central African Republic (+236)' }, { value: '+237', label: 'Cameroon (+237)' }, { value: '+238', label: 'Cape Verde (+238)' },
  { value: '+239', label: 'Sao Tome and Principe (+239)' }, { value: '+240', label: 'Equatorial Guinea (+240)' }, { value: '+241', label: 'Gabon (+241)' },
  { value: '+242', label: 'Congo (+242)' }, { value: '+243', label: 'DR Congo (+243)' }, { value: '+244', label: 'Angola (+244)' },
  { value: '+248', label: 'Seychelles (+248)' }, { value: '+249', label: 'Sudan (+249)' }, { value: '+250', label: 'Rwanda (+250)' },
  { value: '+251', label: 'Ethiopia (+251)' }, { value: '+252', label: 'Somalia (+252)' }, { value: '+253', label: 'Djibouti (+253)' },
  { value: '+254', label: 'Kenya (+254)' }, { value: '+255', label: 'Tanzania (+255)' }, { value: '+256', label: 'Uganda (+256)' },
  { value: '+257', label: 'Burundi (+257)' }, { value: '+258', label: 'Mozambique (+258)' }, { value: '+260', label: 'Zambia (+260)' },
  { value: '+261', label: 'Madagascar (+261)' }, { value: '+262', label: 'Reunion/Mayotte (+262)' }, { value: '+263', label: 'Zimbabwe (+263)' },
  { value: '+264', label: 'Namibia (+264)' }, { value: '+265', label: 'Malawi (+265)' }, { value: '+266', label: 'Lesotho (+266)' },
  { value: '+267', label: 'Botswana (+267)' }, { value: '+268', label: 'Eswatini (+268)' }, { value: '+269', label: 'Comoros (+269)' },
  { value: '+353', label: 'Ireland (+353)' }, { value: '+355', label: 'Albania (+355)' }, { value: '+356', label: 'Malta (+356)' },
  { value: '+357', label: 'Cyprus (+357)' }, { value: '+358', label: 'Finland (+358)' }, { value: '+359', label: 'Bulgaria (+359)' },
  { value: '+370', label: 'Lithuania (+370)' }, { value: '+371', label: 'Latvia (+371)' }, { value: '+372', label: 'Estonia (+372)' },
  { value: '+373', label: 'Moldova (+373)' }, { value: '+374', label: 'Armenia (+374)' }, { value: '+375', label: 'Belarus (+375)' },
  { value: '+376', label: 'Andorra (+376)' }, { value: '+377', label: 'Monaco (+377)' }, { value: '+378', label: 'San Marino (+378)' },
  { value: '+380', label: 'Ukraine (+380)' }, { value: '+381', label: 'Serbia (+381)' }, { value: '+382', label: 'Montenegro (+382)' },
  { value: '+385', label: 'Croatia (+385)' }, { value: '+386', label: 'Slovenia (+386)' }, { value: '+387', label: 'Bosnia and Herzegovina (+387)' },
  { value: '+389', label: 'North Macedonia (+389)' }, { value: '+420', label: 'Czech Republic (+420)' }, { value: '+421', label: 'Slovakia (+421)' },
  { value: '+852', label: 'Hong Kong (+852)' }, { value: '+853', label: 'Macau (+853)' }, { value: '+855', label: 'Cambodia (+855)' },
  { value: '+856', label: 'Laos (+856)' }, { value: '+880', label: 'Bangladesh (+880)' }, { value: '+886', label: 'Taiwan (+886)' },
  { value: '+961', label: 'Lebanon (+961)' }, { value: '+962', label: 'Jordan (+962)' }, { value: '+963', label: 'Syria (+963)' },
  { value: '+964', label: 'Iraq (+964)' }, { value: '+965', label: 'Kuwait (+965)' }, { value: '+966', label: 'Saudi Arabia (+966)' },
  { value: '+967', label: 'Yemen (+967)' }, { value: '+968', label: 'Oman (+968)' }, { value: '+970', label: 'Palestine (+970)' },
  { value: '+971', label: 'UAE (+971)' }, { value: '+972', label: 'Israel (+972)' }, { value: '+973', label: 'Bahrain (+973)' },
  { value: '+974', label: 'Qatar (+974)' }, { value: '+975', label: 'Bhutan (+975)' }, { value: '+976', label: 'Mongolia (+976)' },
  { value: '+977', label: 'Nepal (+977)' }, { value: '+992', label: 'Tajikistan (+992)' }, { value: '+993', label: 'Turkmenistan (+993)' },
  { value: '+994', label: 'Azerbaijan (+994)' }, { value: '+995', label: 'Georgia (+995)' }, { value: '+996', label: 'Kyrgyzstan (+996)' },
  { value: '+998', label: 'Uzbekistan (+998)' },
];

const yesNoFields = ['compliance', 'active', 'email_inventory'];

function getApiErrorMessage(error, fallback = 'Operation failed') {
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first?.msg) return String(first.msg);
    return fallback;
  }
  if (typeof detail === 'object' && detail.msg) return String(detail.msg);
  return fallback;
}

function BaseField({ name, label, value, onChange, options = [], error = '', onBlur }) {
  const common = `w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 outline-none ${error ? 'border-red-500' : 'border-gray-300'}`;
  if (options.length > 0) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        <select value={value || ''} onChange={(e) => onChange(name, e.target.value)} onBlur={() => onBlur?.(name)} className={common}>
          <option value="">Select...</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (name === 'entry_type' || name === 'balance_type') {
    const values = name === 'entry_type' ? ['Account', 'Group'] : ['Debit', 'Credit'];
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        <div className="flex gap-4">
          {values.map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input type="radio" checked={value === v} onChange={() => onChange(name, v)} />
              <span>{v}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (textAreas.has(name)) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        <textarea value={value || ''} onChange={(e) => onChange(name, e.target.value)} onBlur={() => onBlur?.(name)} rows={2} className={common} />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  const type = name === 'email' ? 'email' : numericFields.has(name) ? 'number' : 'text';
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(name, e.target.value)} onBlur={() => onBlur?.(name)} className={common} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function parsePhone(value) {
  const raw = (value || '').trim();
  if (!raw) return { code: '+91', number: '' };
  const match = raw.match(/^(\+\d{1,3})\s*(.*)$/);
  if (match) return { code: match[1], number: match[2] || '' };
  return { code: '+91', number: raw };
}

function combinePhone(code, number) {
  const c = (code || '').trim();
  const n = (number || '').trim();
  if (!n) return '';
  return `${c || '+91'} ${n}`.trim();
}

function PhoneField({ name, label, value, onChange, error }) {
  const parts = parsePhone(value);
  const selectedCode = DIAL_CODE_OPTIONS.some((o) => o.value === parts.code) ? parts.code : '+91';
  const common = 'px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none';

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="flex gap-2">
        <select value={selectedCode} onChange={(e) => onChange(name, combinePhone(e.target.value, parts.number))} className={`w-44 ${common}`}>
          {DIAL_CODE_OPTIONS.map((opt) => <option key={`${opt.value}-${opt.label}`} value={opt.value}>{opt.label}</option>)}
        </select>
        <input
          type="text"
          value={parts.number}
          onChange={(e) => onChange(name, combinePhone(parts.code, e.target.value))}
          placeholder="Phone number"
          className={`flex-1 ${common}`}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SearchableBaseSelect({ name, value, options, onChange, onBlur, error, label }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const common = `w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 outline-none ${error ? 'border-red-500' : 'border-gray-300'}`;

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => { setQuery(value || ''); }, [value]);
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const select = (val) => { onChange(name, val); setQuery(val); setOpen(false); };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div ref={wrapperRef} className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(name, ''); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { setTimeout(() => setOpen(false), 150); onBlur?.(name); }}
          className={common}
          placeholder="Search..."
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
            {filtered.map((o) => (
              <li key={o} onMouseDown={() => select(o)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${o === value ? 'font-semibold text-blue-700' : ''}`}>
                {o}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function AccountMasterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isAddMode = location.pathname.endsWith('/add');
  const isEditMode = location.pathname.includes('/edit/');
  const isFormMode = isAddMode || isEditMode;

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [rowLimit, setRowLimit] = useState(100);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState(INIT_FORM);
  const [options, setOptions] = useState({
    groups: [], account_types: [], currencies: ['INR', 'USD', 'AED'], currency_rates: {}, brokers: [], cities: [], states: [], countries: [],
  });

  const loadOptions = async () => {
    const res = await api.get('/account-master/options');
    setOptions(res.data);
  };

  const loadRows = async () => {
    const res = await api.get('/account-master', { params: { search } });
    setRows(Array.isArray(res.data) ? res.data : []);
    setPage(1);
  };

  const loadEditRow = async () => {
    if (!id) return;
    const res = await api.get(`/account-master/${id}`);
    setForm({ ...INIT_FORM, ...res.data });
  };

  useEffect(() => {
    loadOptions().catch(() => toast.error('Failed to load dropdowns'));
  }, []);

  useEffect(() => {
    if (!isFormMode) {
      loadRows().catch(() => toast.error('Failed to load account list'));
    }
  }, [search, isFormMode]);

  useEffect(() => {
    if (isEditMode) {
      loadEditRow().catch(() => toast.error('Failed to load account'));
    } else if (isAddMode) {
      const params = new URLSearchParams(location.search);
      const presetType = params.get('account_type');
      setForm({ ...INIT_FORM, ...(presetType ? { account_type: presetType } : {}) });
    }
  }, [isEditMode, isAddMode, id]);

  useEffect(() => {
    if (!isFormMode) return;
    const name = (form.account_group_name || '').trim();
    if (!name) {
      setNameError('');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheckingName(true);
      try {
        const res = await api.get('/account-master', { params: { search: name } });
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const exists = list.some((r) =>
          (r.account_group_name || '').trim().toLowerCase() === name.toLowerCase() && (!isEditMode || r.id !== id)
        );
        setNameError(exists ? 'Account/Group Name already exists' : '');
      } catch {
        if (!cancelled) setNameError('');
      } finally {
        if (!cancelled) setCheckingName(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.account_group_name, isFormMode, isEditMode, id]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * rowLimit;
    return rows.slice(start, start + rowLimit);
  }, [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const phoneErrors = useMemo(() => {
    const errs = {};
    for (const field of phoneFields) {
      const val = form[field];
      if (!val) continue;
      const { code, number } = parsePhone(val);
      if (!PHONE_CODE_REGEX.test(code)) {
        errs[field] = 'Country code must be like +91';
      } else if (number && !PHONE_NUMBER_REGEX.test(number)) {
        errs[field] = 'Phone number must be 6-15 digits';
      }
    }
    return errs;
  }, [form]);

  const setValue = (name, value) => {
    let nextValue = value;
    if (numericFields.has(name)) nextValue = value === '' ? '' : Number(value);
    setForm((prev) => {
      const updated = { ...prev, [name]: nextValue };
      if (name === 'currency') {
        const defaults = options.currency_rates?.[value];
        if (defaults) {
          updated.inr_base_rate = defaults.inr_base_rate;
          updated.usd_base_rate = defaults.usd_base_rate;
        }
      }
      return updated;
    });
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleBlur = (name) => {
    if (name === 'opening_balance' && form.opening_balance !== '' && form.opening_balance !== null) {
      const n = Number(form.opening_balance);
      if (!Number.isNaN(n)) setValue('opening_balance', n);
    }
  };

  const validate = () => {
    if (!form.account_group_name.trim()) return 'Account/Group Name is required';
    if (nameError) return nameError;
    if (!form.under_group_name.trim()) return 'Under Group is required';
    if (!form.account_type.trim()) return 'Account Type is required';
    if (form.opening_balance === '' || form.opening_balance === null || form.opening_balance === undefined) setValue('opening_balance', 0);
    const phoneError = Object.values(phoneErrors)[0];
    if (phoneError) return phoneError;
    return '';
  };

  const save = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setSaving(true);
    try {
      setFieldErrors({});
      const payload = { ...form, account_name: form.account_group_name, opening_balance: Number(form.opening_balance) };
      for (const field of optionalNumericFields) {
        if (payload[field] === '') payload[field] = null;
      }
      if (isEditMode) await api.put(`/account-master/${id}`, payload);
      else await api.post('/account-master', payload);
      toast.success(isEditMode ? 'Updated' : 'Created');
      setActiveTab(0);
      navigate('/account-master', { replace: true });
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (Array.isArray(detail)) {
        const mapped = {};
        for (const item of detail) {
          const fname = Array.isArray(item?.loc) ? item.loc[1] : null;
          if (fname && !mapped[fname]) mapped[fname] = item?.msg || 'Invalid value';
        }
        setFieldErrors(mapped);
      }
      toast.error(getApiErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (rowId) => {
    if (!confirm('Delete this account/group?')) return;
    try {
      await api.delete(`/account-master/${rowId}`);
      toast.success('Deleted');
      await loadRows();
    } catch {
      toast.error('Delete failed');
    }
  };

  const exportExcel = async () => {
    const res = await api.get('/account-master/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'account_master.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const accountDetailsFields = [
    ['short_name', 'Short Name'], ['interest_pct', 'Interest %'], ['discount_pct', 'Discount %'],
    ['credit_limit', 'Credit Limit'], ['due_days', 'Due Days'], ['grace_period', 'Grace Period'], ['term', 'Term'],
    ['term_pct', 'Term %'], ['term_per', 'Term Per'], ['markup', 'Markup'], ['local_language_name', 'Local Language Name'],
    ['local_language_contact_person', 'Local Language Contact Person'], ['local_language_address', 'Local Language Address'], ['website_user', 'Website User'],
  ];
  const kycFields = [
    ['address1', 'Address 1'], ['address2', 'Address 2'], ['address3', 'Address 3'], ['zipcode', 'Zipcode'],
    ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['area', 'Area'], ['mobile', 'Mobile'],
    ['office_phone', 'Office Phone'], ['home_phone', 'Home Phone'], ['fax', 'Fax'], ['qqid', 'QQID'], ['email', 'Email'],
    ['website', 'Website'], ['skype', 'Skype'], ['through', 'Broker'], ['broker_per', 'Broker Per'], ['contact_person', 'Contact Person'],
    ['agent', 'Agent'], ['reference_party_name1', 'Reference Party Name 1'], ['reference_party_name2', 'Reference Party Name 2'],
    ['reference_phone1', 'Reference Phone 1'], ['reference_phone2', 'Reference Phone 2'], ['reference_comments1', 'Reference Comments 1'],
    ['reference_comments2', 'Reference Comments 2'],
  ];
  const financialFields = [
    ['bank_account_no', 'Bank Account No'], ['bank_account_detail', 'Bank Account Detail'], ['bank_routing', 'Bank Routing'],
    ['bank_swift_code', 'Bank Swift Code'], ['pan_no', 'PAN No'], ['gst_no', 'GST No'], ['tin_number', 'TIN Number'],
    ['cin_no', 'CIN NO'], ['gr_no', 'GR NO'], ['cst_no', 'CST NO'], ['remarks', 'Remarks'],
  ];
  const shippingFields = [
    ['shipping_name', 'Shipping Name'], ['shipping_address1', 'Shipping Address 1'], ['shipping_zipcode', 'Zipcode'],
    ['shipping_city', 'City'], ['shipping_state', 'State'], ['shipping_country', 'Country'], ['shipping_area', 'Area'],
    ['shipping_phone', 'Shipping Phone'], ['shipping_fax', 'Shipping Fax'],
  ];

  const renderFields = (fields) => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {fields.map(([name, label]) => {
        if (phoneFields.includes(name)) return <PhoneField key={name} name={name} label={label} value={form[name]} onChange={setValue} error={phoneErrors[name] || fieldErrors[name]} />;
        if (name === 'city' || name === 'shipping_city') return <BaseField key={name} name={name} label={label} value={form[name]} onChange={setValue} onBlur={handleBlur} options={options.cities} error={fieldErrors[name]} />;
        if (name === 'state' || name === 'shipping_state') return <BaseField key={name} name={name} label={label} value={form[name]} onChange={setValue} onBlur={handleBlur} options={options.states} error={fieldErrors[name]} />;
        if (name === 'country' || name === 'shipping_country') return <BaseField key={name} name={name} label={label} value={form[name]} onChange={setValue} onBlur={handleBlur} options={options.countries} error={fieldErrors[name]} />;
        if (name === 'through') return <BaseField key={name} name={name} label={label} value={form[name]} onChange={setValue} onBlur={handleBlur} options={options.brokers} error={fieldErrors[name]} />;
        return <BaseField key={name} name={name} label={label} value={form[name]} onChange={setValue} onBlur={handleBlur} error={fieldErrors[name]} />;
      })}
    </div>
  );

  if (!isFormMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Account Group Master</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={() => navigate('/account-master/add')} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Account/Group
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls
            search={search}
            onSearchChange={setSearch}
            rowLimit={rowLimit}
            onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageOptions={[100, 500, 1000, 1500]}
          />

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Edit</th>
                  <th className="text-left px-3 py-2">Delete</th>
                  <th className="text-left px-3 py-2">NAME</th>
                  <th className="text-left px-3 py-2">UNDER GROUP</th>
                  <th className="text-left px-3 py-2">TYPE</th>
                  <th className="text-left px-3 py-2">CURR</th>
                  <th className="text-left px-3 py-2">DR/CR</th>
                  <th className="text-right px-3 py-2">OBAL</th>
                  <th className="text-left px-3 py-2">COUNTRY</th>
                  <th className="text-left px-3 py-2">Created At</th>
                  <th className="text-left px-3 py-2">Created By</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <button onClick={() => navigate(`/account-master/edit/${r.id}`)} className="p-1.5 rounded hover:bg-gray-100 text-blue-600"><Pencil className="w-4 h-4" /></button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeRow(r.id)} className="p-1.5 rounded hover:bg-gray-100 text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </td>
                    <td className="px-3 py-2">{r.account_group_name}</td>
                    <td className="px-3 py-2">{r.under_group_name}</td>
                    <td className="px-3 py-2">{r.account_type}</td>
                    <td className="px-3 py-2">{r.currency}</td>
                    <td className="px-3 py-2">{r.balance_type === 'Credit' ? 'C' : 'D'}</td>
                    <td className="px-3 py-2 text-right">{Number(r.opening_balance).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.country || ''}</td>
                    <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                    <td className="px-3 py-2">{r.created_by_name || ''}</td>
                  </tr>
                ))}
                {pagedRows.length === 0 && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={11}>No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Account/Group' : 'Add Account/Group'}</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/account-master')} className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">Back to List</button>
          <button onClick={save} disabled={saving || checkingName || !!nameError} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-200 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <BaseField name="entry_type" label="Entry Type" value={form.entry_type} onChange={setValue} />
          <div className="col-span-2">
            <BaseField
              name="account_group_name"
              label={`Account/Group Name *${checkingName ? ' (checking...)' : ''}`}
              value={form.account_group_name}
              onChange={setValue}
              error={nameError}
              onBlur={handleBlur}
            />
          </div>
          <SearchableBaseSelect name="under_group_name" label="Under Group *" value={form.under_group_name} options={UNDER_GROUP_OPTIONS} onChange={setValue} onBlur={handleBlur} error={fieldErrors.under_group_name} />
          <BaseField name="account_type" label="Account Type *" value={form.account_type} onChange={setValue} onBlur={handleBlur} options={options.account_types} error={fieldErrors.account_type} />
          <BaseField name="currency" label="Currency" value={form.currency} onChange={setValue} onBlur={handleBlur} options={options.currencies} error={fieldErrors.currency} />
          <BaseField name="country" label="Country" value={form.country} onChange={setValue} onBlur={handleBlur} options={options.countries} error={fieldErrors.country} />
          <BaseField name="inr_base_rate" label="INR BaseRate" value={form.inr_base_rate} onChange={setValue} onBlur={handleBlur} error={fieldErrors.inr_base_rate} />
          <BaseField name="usd_base_rate" label="USD BaseRate" value={form.usd_base_rate} onChange={setValue} onBlur={handleBlur} error={fieldErrors.usd_base_rate} />
          <BaseField name="opening_balance" label="Opening Balance *" value={form.opening_balance} onChange={setValue} onBlur={handleBlur} error={fieldErrors.opening_balance} />
          <BaseField name="balance_type" label="Balance Type" value={form.balance_type} onChange={setValue} onBlur={handleBlur} error={fieldErrors.balance_type} />
        </div>

        <div className="flex border-b border-gray-200">
          {tabs.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} className={`px-5 py-3 text-sm font-medium border-b-2 ${activeTab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {activeTab === 0 && renderFields(accountDetailsFields)}
          {activeTab === 1 && renderFields(kycFields)}
          {activeTab === 2 && (
            <div className="space-y-4">
              {renderFields(financialFields)}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {yesNoFields.map((f) => (
                  <div key={f} className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{f.replace('_', ' ')}</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form[f] === true} onChange={() => setValue(f, true)} /> Yes</label>
                      <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form[f] === false} onChange={() => setValue(f, false)} /> No</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 3 && renderFields(shippingFields)}
        </div>

        <div className="px-5 pb-5 flex justify-between">
          <button disabled={activeTab === 0} onClick={() => setActiveTab((t) => Math.max(0, t - 1))} className="px-3 py-2 text-sm rounded border border-gray-300 disabled:opacity-50">Previous</button>
          <button disabled={activeTab === tabs.length - 1} onClick={() => setActiveTab((t) => Math.min(tabs.length - 1, t + 1))} className="px-3 py-2 text-sm rounded border border-gray-300 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
