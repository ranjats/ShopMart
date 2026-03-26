import React, { useState, useEffect } from 'react';
import { Phone, User, Clock, Package } from 'lucide-react';

const OrderCard = ({ order, onUpdateStatus }) => {
  const [billAmount, setBillAmount] = useState(order.bill_amount || '');

  useEffect(() => {
    setBillAmount(order.bill_amount || '');
  }, [order.bill_amount]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-gray-500">#{order.order_id}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
              {order.status.toUpperCase()}
            </span>
          </div>
          <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
            <User size={18} className="text-gray-400" />
            {order.customer_name || 'Unknown Customer'}
          </h3>
        </div>
        <div className="text-right text-sm text-gray-500 flex items-center gap-1">
          <Clock size={14} />
          {formatDate(order.created_at)}
        </div>
      </div>

      <div className="flex items-center gap-2 text-gray-600 mb-4 text-sm">
        <Phone size={16} />
        <a href={`tel:${order.customer_phone.split('@')[0].split(':')[0]}`} className="hover:text-blue-600">
          {order.customer_phone.split('@')[0].split(':')[0]}
        </a>
      </div>

      <div className="bg-gray-50 p-3 rounded-md mb-4">
        <div className="flex items-start gap-2">
          <Package size={16} className="text-gray-400 mt-1" />
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.items}</p>
        </div>
        {order.bill_amount > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 font-medium text-gray-900">
            Bill Amount: ₹{order.bill_amount}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-gray-100">
        {order.status === 'pending' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'preparing')}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 transition"
          >
            Start Preparing
          </button>
        )}
        {order.status === 'preparing' && (
          <div className="flex flex-col gap-2">
            <input
              type="number"
              placeholder="Enter Bill Amount (₹)"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <button
              onClick={() => onUpdateStatus(order.id, 'ready', parseFloat(billAmount) || 0)}
              className="w-full bg-green-600 text-white py-2 rounded text-sm font-medium hover:bg-green-700 transition"
            >
              Mark Ready & Send Bill
            </button>
          </div>
        )}
        {order.status === 'ready' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'completed')}
            className="w-full bg-gray-600 text-white py-2 rounded text-sm font-medium hover:bg-gray-700 transition"
          >
            Complete
          </button>
        )}
        {order.status === 'completed' && (
          <span className="w-full text-center text-gray-400 text-sm py-2">Order Completed</span>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
