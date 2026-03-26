import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Save } from 'lucide-react';

const QuantityInput = ({ product, onUpdate }) => {
  const [val, setVal] = useState(product.quantity || 0);
  
  useEffect(() => {
    setVal(product.quantity || 0);
  }, [product.quantity]);

  const handleBlur = () => {
    const numVal = parseInt(val, 10);
    if (!isNaN(numVal) && numVal !== product.quantity) {
      onUpdate(product, numVal);
    }
  };

  return (
    <input 
      type="number" 
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
      min="0"
    />
  );
};

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', price: '', quantity: '' });
  const [error, setError] = useState(null);

  const fetchProducts = async () => {
    setError(null);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      }
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch products', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, quantity: parseInt(newProduct.quantity) || 0 })
      });
      setNewProduct({ name: '', price: '', quantity: '' });
      fetchProducts();
    } catch (error) {
      console.error('Failed to add product', error);
    }
  };

  const handleDelete = async (id) => {
    // In a real app, use a custom modal here instead of window.confirm
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (error) {
      console.error('Failed to delete product', error);
    }
  };

  const updateQuantity = async (product, newQuantity) => {
    try {
      await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, quantity: newQuantity })
      });
      fetchProducts();
    } catch (error) {
      console.error('Failed to update stock', error);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-6">Inventory Management</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Add Product Form */}
      <form onSubmit={handleAddProduct} className="flex flex-wrap gap-4 mb-8 items-end bg-gray-50 p-4 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
          <input
            type="text"
            value={newProduct.name}
            onChange={e => setNewProduct({...newProduct, name: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g. Rice, Sugar"
            required
          />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
          <input
            type="number"
            value={newProduct.price}
            onChange={e => setNewProduct({...newProduct, price: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="0"
          />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            value={newProduct.quantity}
            onChange={e => setNewProduct({...newProduct, quantity: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="0"
            min="0"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={18} /> Add
        </button>
      </form>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search items..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
        />
      </div>

      {/* List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map(product => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{product.price}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <QuantityInput product={product} onUpdate={updateQuantity} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      product.in_stock 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.in_stock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inventory;
