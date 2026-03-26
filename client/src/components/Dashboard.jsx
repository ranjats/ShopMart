import React, { useState, useEffect } from 'react';
import { LogOut, RefreshCw, LayoutGrid, List, Smartphone } from 'lucide-react';
import OrderCard from './OrderCard';
import Stats from './Stats';
import Inventory from './Inventory';

const Dashboard = ({ onLogout }) => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('orders'); // 'orders' or 'inventory'
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qr: null });
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/stats')
      ]);
      
      const ordersData = await ordersRes.json();
      const statsData = await statsRes.json();
      
      if (ordersData.error) {
        setError(ordersData.error);
      }
      
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setStats(statsData && !statsData.error ? statsData : {});
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchWaStatus();
    const interval = setInterval(() => {
      fetchData();
      fetchWaStatus();
    }, 5000); // Poll every 5s for QR updates
    return () => clearInterval(interval);
  }, []);

  const handleStatusUpdate = async (id, newStatus, billAmount = null) => {
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, bill_amount: billAmount })
      });
      fetchData(); // Refresh immediately
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <LayoutGrid size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Shop Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView(view === 'orders' ? 'inventory' : 'orders')}
              className="text-gray-600 hover:text-blue-600 font-medium"
            >
              {view === 'orders' ? 'Manage Inventory' : 'View Orders'}
            </button>
            <button 
              onClick={fetchData} 
              className="p-2 text-gray-500 hover:text-blue-600 transition rounded-full hover:bg-gray-100"
              title="Refresh"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* WhatsApp Status Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${waStatus.status === 'connected' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                    <Smartphone size={24} />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">WhatsApp Bot Status</h3>
                    <p className="text-sm text-gray-500 capitalize">
                        {waStatus.status === 'connected' ? '✅ Connected' : 
                         waStatus.status === 'connecting' ? '🟡 Connecting / Scan QR' : '🔴 Disconnected'}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                {waStatus.status === 'disconnected' && (
                    <button
                        onClick={async () => {
                            try {
                                await fetch('/api/whatsapp/restart', { method: 'POST' });
                                fetchWaStatus();
                            } catch (e) {
                                console.error('Failed to restart bot', e);
                            }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
                    >
                        Restart Bot
                    </button>
                )}
                {waStatus.status !== 'connected' && waStatus.qr && (
                    <div className="flex flex-col items-center">
                        <p className="text-xs text-gray-500 mb-1">Scan to Connect</p>
                        <img src={waStatus.qr} alt="WhatsApp QR Code" className="w-32 h-32 border border-gray-200 rounded-lg" />
                    </div>
                )}
            </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {view === 'orders' ? (
          <>
            <Stats stats={stats} />

            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-gray-800">Recent Orders</h2>
              
              <div className="flex bg-white rounded-lg shadow-sm p-1 border border-gray-200">
                {['all', 'pending', 'preparing', 'ready', 'completed'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${
                      filter === f 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {loading && orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500">No orders found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrders.map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onUpdateStatus={handleStatusUpdate} 
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <Inventory />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
