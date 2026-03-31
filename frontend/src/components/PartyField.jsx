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
      onAddNew={() => window.open('/account-master/add?account_type=Customer', '_blank')}
    />
  );
}

export function BrokerField({ name = 'broker', label = 'Broker', value, onChange, options }) {
  return (
    <FormField
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      onAddNew={() => window.open('/account-master/add?account_type=Broker', '_blank')}
    />
  );
}
