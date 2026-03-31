import FormField from './FormField';

export default function PartyField({ name = 'party', label = 'Party', value, onChange, options }) {
  return (
    <FormField
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      onAddNew={() => window.open('/account-master/add', '_blank')}
    />
  );
}
