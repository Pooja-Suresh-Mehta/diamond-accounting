import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { Gem, Weight, DollarSign, Building2, PackageCheck, Send, ShoppingCart } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const cards = stats ? [
    { label: 'Total Stones', value: stats.total_stones.toLocaleString(), icon: Gem, color: 'bg-blue-500' },
    { label: 'Total Carats', value: stats.total_carats.toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: Weight, color: 'bg-purple-500' },
    { label: 'Total Value', value: `$${stats.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-green-500' },
    { label: 'On Hand', value: stats.on_hand.toLocaleString(), icon: PackageCheck, color: 'bg-cyan-500' },
    { label: 'On Memo', value: stats.on_memo.toLocaleString(), icon: Send, color: 'bg-orange-500' },
    { label: 'Sold', value: stats.sold.toLocaleString(), icon: ShoppingCart, color: 'bg-rose-500' },
    { label: 'Offices', value: stats.offices.toLocaleString(), icon: Building2, color: 'bg-indigo-500' },
  ] : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome back, {user?.full_name || user?.username}!
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s your inventory overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition">
            <div className={`${card.color} p-3 rounded-xl text-white`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-800">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
