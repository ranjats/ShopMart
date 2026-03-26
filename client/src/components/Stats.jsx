import React from 'react';
import { Package, Clock, CheckCircle, ShoppingBag } from 'lucide-react';

const Stats = ({ stats }) => {
  const cards = [
    {
      title: 'Total Orders',
      value: stats.total || 0,
      icon: ShoppingBag,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Pending',
      value: stats.pending || 0,
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      title: 'Completed',
      value: stats.completed || 0,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: "Today's Orders",
      value: stats.today || 0,
      icon: Package,
      color: 'bg-blue-100 text-blue-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map((card, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">{card.title}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
            </div>
            <div className={`p-3 rounded-full ${card.color}`}>
              <card.icon size={24} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Stats;
