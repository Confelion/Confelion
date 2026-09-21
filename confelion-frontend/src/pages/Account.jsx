import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  MapPin, 
  User, 
  ShieldCheck, 
  LogOut, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Edit2, 
  ShoppingBag, 
  ArrowRight, 
  IndianRupee, 
  AlertCircle,
  CreditCard,
  Banknote,
  Search,
  Check,
  X,
  ChevronRight,
  ArrowLeft,
  FileText,
  Download,
  Copy
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { fetchAPI, getStoredOrders, trackDelhiveryAwb, checkDelhiveryPincode } from '../lib/api';
import { fetchFirestoreOrders } from '../lib/firebase';
import { getSavedShippingAddress, saveCustomerShippingAddress } from '../lib/customerAddress';
import { generateOrderInvoicePDF } from '../lib/invoiceGenerator';

export default function Account() {
  const navigate = useNavigate();
  const { user, signOut, updateUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'addresses' | 'profile'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState('all');
  const [trackingModalOrder, setTrackingModalOrder] = useState(null);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    preferred_size: 'L',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Addresses State
  const [addresses, setAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressIdx, setEditingAddressIdx] = useState(null);
  const [addressForm, setAddressForm] = useState({
    tag: 'Home',
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    is_default: false
  });

  const [liveTrackingData, setLiveTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [copiedAwb, setCopiedAwb] = useState(false);

  const handleCopyAwb = (awbText) => {
    if (!awbText) return;
    navigator.clipboard?.writeText?.(awbText);
    setCopiedAwb(true);
    setTimeout(() => setCopiedAwb(false), 2000);
  };

  useEffect(() => {
    if (!trackingModalOrder || !trackingModalOrder.awb_number) {
      setLiveTrackingData(null);
      setTrackingLoading(false);
      return;
    }
    const awb = trackingModalOrder.awb_number;
    setTrackingLoading(true);
    trackDelhiveryAwb(awb)
      .then(res => setLiveTrackingData(res))
      .catch(() => {})
      .finally(() => setTrackingLoading(false));
  }, [trackingModalOrder]);

  const loadCustomerData = async () => {
    setLoading(true);
    const currentUser = user || (() => {
      try {
        return JSON.parse(localStorage.getItem('user') || 'null');
      } catch {
        return null;
      }
    })();

    if (!currentUser) {
      setLoading(false);
      return;
    }

    const savedShipping = getSavedShippingAddress(currentUser);

    setProfileForm({
      name: currentUser.name || savedShipping.name || '',
      phone: currentUser.phone || savedShipping.phone || '',
      email: currentUser.email || savedShipping.email || '',
      city: currentUser.city || savedShipping.city || '',
      address: currentUser.address || savedShipping.address || '',
      preferred_size: currentUser.preferred_size || 'L',
    });

    let initialAddresses = currentUser.addresses || [];
    if (initialAddresses.length === 0 && (currentUser.address || savedShipping.address)) {
      initialAddresses = [
        {
          tag: 'Default Delivery Address',
          name: currentUser.name || savedShipping.name || 'Valued Patron',
          phone: currentUser.phone || savedShipping.phone || '',
          address: currentUser.address || savedShipping.address,
          city: currentUser.city || savedShipping.city || '',
          state: currentUser.state || '',
          pincode: currentUser.pincode || savedShipping.pincode || '',
          is_default: true
        }
      ];
    }
    setAddresses(initialAddresses);

    // Strict Customer Order Segregation: Only show orders for this user
    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const userId = currentUser.id;

    const allOrders = getStoredOrders();
    let userOrders = allOrders.filter(o => {
      const matchEmail = userEmail && o.email && o.email.toLowerCase().trim() === userEmail;
      const matchId = userId && o.user_id && o.user_id === userId;
      return matchEmail || matchId;
    });

    setOrders(userOrders);
    setLoading(false);

    // Non-blocking background sync with Firestore for this customer
    fetchFirestoreOrders(userEmail, userId)
      .then((firestoreOrders) => {
        if (Array.isArray(firestoreOrders) && firestoreOrders.length > 0) {
          const orderMap = new Map();
          firestoreOrders.forEach(o => orderMap.set(o.id, o));
          userOrders.forEach(o => orderMap.set(o.id, { ...orderMap.get(o.id), ...o }));
          const merged = Array.from(orderMap.values()).sort((a, b) => 
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
          );
          setOrders(merged);
        }
      })
      .catch((err) => {
        console.warn('Could not sync Firestore orders in account:', err);
      });
  };

  useEffect(() => {
    loadCustomerData();

    const handleOrdersUpdated = () => loadCustomerData();
    window.addEventListener('orders-updated', handleOrdersUpdated);
    window.addEventListener('storage', handleOrdersUpdated);

    return () => {
      window.removeEventListener('orders-updated', handleOrdersUpdated);
      window.removeEventListener('storage', handleOrdersUpdated);
    };
  }, [user]);

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out of your customer account?')) {
      await signOut();
      navigate('/');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');

    await updateUser(profileForm);
    setProfileSaving(false);
    setProfileMsg('Profile and sizing preferences updated successfully.');
    setTimeout(() => setProfileMsg(''), 4000);
  };

  const handleSaveAddress = (e) => {
    e.preventDefault();
    let updated;
    if (editingAddressIdx !== null) {
      updated = [...addresses];
      updated[editingAddressIdx] = addressForm;
    } else {
      updated = [...addresses, addressForm];
    }

    if (addressForm.is_default) {
      updated = updated.map((addr, idx) => ({
        ...addr,
        is_default: idx === (editingAddressIdx !== null ? editingAddressIdx : updated.length - 1)
      }));
    }

    setAddresses(updated);
    const updatePayload = { addresses: updated };
    if (addressForm.is_default || updated.length === 1) {
      updatePayload.name = addressForm.name || user?.name;
      updatePayload.phone = addressForm.phone;
      updatePayload.address = addressForm.address;
      updatePayload.city = addressForm.city;
      updatePayload.pincode = addressForm.pincode;
      saveCustomerShippingAddress(user, addressForm).catch(() => {});
    }
    updateUser(updatePayload);
    setShowAddressModal(false);
    setEditingAddressIdx(null);
  };

  const handleDeleteAddress = (idx) => {
    if (window.confirm('Delete this delivery address?')) {
      const updated = addresses.filter((_, i) => i !== idx);
      setAddresses(updated);
      updateUser({ addresses: updated });
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    if (orderFilter === 'delivered') return o.status?.toLowerCase() === 'delivered';
    if (orderFilter === 'in_transit') return o.status?.toLowerCase() === 'in transit';
    if (orderFilter === 'processing') return o.status?.toLowerCase() === 'processing' || o.status?.toLowerCase() === 'confirmed';
    return true;
  });

  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const activeShipments = orders.filter(o => o.status?.toLowerCase() === 'in transit' || o.status?.toLowerCase() === 'processing').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span className="text-sm font-medium text-zinc-600">Loading your account...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f1f2f4] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white border border-[#e1e3e5] rounded-xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
            <User className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#202223] mb-2">Customer Account</h2>
          <p className="text-sm text-[#6d7175] mb-6">
            Sign in to view your orders, shipment status, and saved addresses.
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="block w-full py-2.5 px-4 bg-[#1a1a1a] hover:bg-[#303030] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              Sign In to Account
            </Link>
            <Link
              to="/signup"
              className="block w-full py-2.5 px-4 bg-white hover:bg-zinc-50 text-[#202223] text-sm font-semibold border border-[#d2d5d8] rounded-lg transition-colors"
            >
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f2f4] text-[#202223] font-sans antialiased">
      {/* Shopify-Style Top Brand Nav Bar */}
      <header className="bg-white border-b border-[#e1e3e5] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <img src="/images/confelion-icon.png" alt="Confelion" className="w-8 h-8 object-contain bg-black rounded p-0.5" />
              <span className="text-base font-black tracking-widest text-black">CONFELION</span>
              <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                Customer Account
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/"
              className="text-[#6d7175] hover:text-[#202223] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Store</span>
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Admin Console</span>
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="text-[#6d7175] hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Customer Header Card */}
        <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 sm:p-8 shadow-xs mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            {/* Left: Avatar & Patron Details */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900 text-white font-bold text-xl flex items-center justify-center shadow-xs shrink-0">
                {(user.name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#202223]">
                    {user.name || 'Valued Customer'}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {user.status || 'VIP Member'}
                  </span>
                </div>
                <p className="text-sm text-[#6d7175] mt-0.5">
                  {user.email} · Customer ID #{user.id || 'CUST-01'}
                </p>
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex items-center gap-3">
              <Link
                to="/products"
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#303030] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Shop New Drops</span>
              </Link>
            </div>
          </div>

          {/* KPI Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#e1e3e5]">
            <div className="p-4 bg-[#f9fafb] rounded-lg border border-[#e5e7eb]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6d7175]">Total Orders</span>
              <div className="text-2xl font-bold text-[#202223] mt-1">{orders.length}</div>
            </div>
            <div className="p-4 bg-[#f9fafb] rounded-lg border border-[#e5e7eb]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6d7175]">Total Spent</span>
              <div className="text-2xl font-bold text-[#202223] mt-1">₹{totalSpent.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-4 bg-[#f9fafb] rounded-lg border border-[#e5e7eb]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6d7175]">In Transit</span>
              <div className="text-2xl font-bold text-[#202223] mt-1 flex items-center gap-2">
                <span>{activeShipments}</span>
                {activeShipments > 0 && <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />}
              </div>
            </div>
            <div className="p-4 bg-[#f9fafb] rounded-lg border border-[#e5e7eb]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6d7175]">Default Destination</span>
              <div className="text-sm font-bold text-[#202223] mt-2 truncate">
                {user.city || 'Mumbai, Maharashtra'}
              </div>
            </div>
          </div>
        </div>

        {/* Polaris Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-[#e1e3e5] pb-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-white text-[#202223] shadow-xs border border-[#e1e3e5]'
                : 'text-[#6d7175] hover:text-[#202223] hover:bg-white/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Orders ({orders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('addresses')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'addresses'
                ? 'bg-white text-[#202223] shadow-xs border border-[#e1e3e5]'
                : 'text-[#6d7175] hover:text-[#202223] hover:bg-white/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Delivery Addresses ({addresses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-white text-[#202223] shadow-xs border border-[#e1e3e5]'
                : 'text-[#6d7175] hover:text-[#202223] hover:bg-white/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Sizing</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: ORDERS */}
        {/* =================================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-[#e1e3e5] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#6d7175] uppercase">Filter:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'delivered', label: 'Delivered' },
                  { id: 'in_transit', label: 'In Transit' },
                  { id: 'processing', label: 'Processing' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setOrderFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      orderFilter === f.id
                        ? 'bg-[#1a1a1a] text-white shadow-xs'
                        : 'bg-[#f4f6f8] text-[#4a4a4a] hover:bg-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-xs font-medium text-[#6d7175]">
                Showing {filteredOrders.length} of {orders.length} orders
              </span>
            </div>

            {/* Orders Cards */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-12 text-center shadow-xs">
                <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#202223]">No orders found</h3>
                <p className="text-sm text-[#6d7175] mt-1 mb-6">
                  {orders.length === 0 
                    ? "You haven't placed any orders yet. Discover our latest collection."
                    : "No orders match the selected filter."}
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#303030] text-white text-sm font-semibold rounded-lg shadow-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Start Shopping</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const isDelivered = order.status?.toLowerCase() === 'delivered';
                  const isInTransit = order.status?.toLowerCase() === 'in transit';
                  const isProcessing = !isDelivered && !isInTransit;

                  return (
                    <div
                      key={order.id}
                      className="bg-white border border-[#e1e3e5] rounded-xl shadow-xs overflow-hidden hover:border-[#c9cccf] transition-all"
                    >
                      {/* Order Card Header */}
                      <div className="bg-[#f9fafb] border-b border-[#e1e3e5] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-bold text-[#202223] font-mono">
                            {order.id}
                          </span>
                          <span className="text-zinc-300">·</span>
                          <span className="text-sm text-[#6d7175]">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            }) : 'Recent Order'}
                          </span>
                          <span className="text-zinc-300">·</span>

                          {/* Shopify Status Pill with Dot */}
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : isInTransit
                              ? 'bg-sky-50 text-sky-800 border border-sky-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isDelivered ? 'bg-emerald-500' : isInTransit ? 'bg-sky-500' : 'bg-amber-500'
                            }`} />
                            {order.status || 'Processing'}
                          </span>

                          <span className="text-zinc-300">·</span>
                          {order.awb_number ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
                              <Truck className="w-3 h-3 text-zinc-500" />
                              <span>AWB #{order.awb_number}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Awaiting Dispatch</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => setTrackingModalOrder(order)}
                            className="px-3 py-1.5 bg-white border border-[#d2d5d8] hover:bg-zinc-50 text-[#202223] text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                          >
                            <Truck className="w-3.5 h-3.5 text-zinc-600" />
                            <span>Track Package</span>
                          </button>
                        </div>
                      </div>

                      {/* Polaris Step Tracker */}
                      <div className="px-6 py-4 bg-white border-b border-[#f0f0f0]">
                        <div className="grid grid-cols-4 gap-2 text-center relative max-w-2xl mx-auto">
                          <div className="absolute top-3.5 left-1/8 right-1/8 h-0.5 bg-zinc-200 -z-0" />

                          {/* Step 1 */}
                          <div className="flex flex-col items-center relative z-10">
                            <div className="w-7 h-7 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-xs font-bold mb-1 shadow-xs">
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <span className="text-xs font-bold text-[#202223]">Confirmed</span>
                            <span className="text-[10px] text-[#6d7175]">Order Placed</span>
                          </div>

                          {/* Step 2 */}
                          <div className="flex flex-col items-center relative z-10">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 shadow-xs ${
                              isInTransit || isDelivered
                                ? 'bg-[#1a1a1a] text-white'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              {isInTransit || isDelivered ? <Check className="w-4 h-4 stroke-[2.5]" /> : '2'}
                            </div>
                            <span className={`text-xs font-bold ${isInTransit || isDelivered ? 'text-[#202223]' : 'text-amber-900'}`}>
                              {isInTransit || isDelivered ? 'Inspected' : 'Preparing'}
                            </span>
                            <span className="text-[10px] text-[#6d7175]">Poonchh Hub</span>
                          </div>

                          {/* Step 3 */}
                          <div className="flex flex-col items-center relative z-10">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 shadow-xs ${
                              isInTransit || isDelivered
                                ? 'bg-[#1a1a1a] text-white'
                                : 'bg-white text-zinc-400 border border-zinc-300'
                            }`}>
                              {isInTransit || isDelivered ? <Check className="w-4 h-4 stroke-[2.5]" /> : '3'}
                            </div>
                            <span className={`text-xs font-bold ${isInTransit || isDelivered ? 'text-[#202223]' : 'text-zinc-400'}`}>
                              Dispatched
                            </span>
                            <span className="text-[10px] text-[#6d7175]">
                              {order.carrier || 'Delhivery Express'}
                            </span>
                          </div>

                          {/* Step 4 */}
                          <div className="flex flex-col items-center relative z-10">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 shadow-xs ${
                              isDelivered
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-zinc-400 border border-zinc-300'
                            }`}>
                              {isDelivered ? <Check className="w-4 h-4 stroke-[2.5]" /> : '4'}
                            </div>
                            <span className={`text-xs font-bold ${isDelivered ? 'text-emerald-700' : 'text-zinc-400'}`}>
                              Delivered
                            </span>
                            <span className="text-[10px] text-[#6d7175]">Doorstep</span>
                          </div>
                        </div>
                      </div>

                      {/* Items Roster */}
                      <div className="px-6 py-4 divide-y divide-[#f0f0f0]">
                        {(order.items || []).map((item, idx) => (
                          <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                              <div className="w-14 h-16 rounded-lg bg-zinc-100 border border-[#e1e3e5] overflow-hidden shrink-0 flex items-center justify-center">
                                {item.image_url ? (
                                  <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-6 h-6 text-zinc-400" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-[#202223] leading-snug">{item.title}</h4>
                                <div className="text-xs text-[#6d7175] mt-0.5">
                                  Size: <strong className="text-zinc-800">{item.size || 'M'}</strong> · Qty: {item.qty || 1}
                                </div>
                              </div>
                            </div>
                            <div className="font-bold font-mono text-sm text-[#202223] text-right">
                              ₹{Number(item.price || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Delivery & Financial Summary Footing */}
                      <div className="p-6 bg-zinc-50/70 border-t border-[#f0f0f0] grid sm:grid-cols-3 gap-6 text-xs">
                        <div>
                          <span className="font-semibold text-[#6d7175] uppercase block mb-1">Shipping Destination</span>
                          <p className="text-[#202223] leading-relaxed">
                            <strong className="block text-zinc-900">{order.customer_name}</strong>
                            {order.shipping_address || 'Customer Residence'}<br />
                            {order.city ? `${order.city}` : ''} {order.pincode ? `· PIN: ${order.pincode}` : ''}<br />
                            Phone: {order.phone || '+91 98765 43210'}
                          </p>
                          <div className="mt-2 text-[11px] text-zinc-500 flex items-center gap-1.5 font-medium">
                            <Truck className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Courier: <strong>Delhivery Express</strong></span>
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold text-[#6d7175] uppercase block mb-1">Payment Information</span>
                          <div className="flex items-center gap-1.5 font-bold text-[#202223] mb-1">
                            {order.payment_method?.includes('COD') ? (
                              <Banknote className="w-4 h-4 text-amber-600" />
                            ) : (
                              <CreditCard className="w-4 h-4 text-emerald-600" />
                            )}
                            <span>{order.payment_method || 'Full Online Payment'}</span>
                          </div>
                          {order.payment_details?.type === 'partial' ? (
                            <div className="text-[#6d7175] space-y-1">
                              <p>
                                Advance Paid: ₹{order.payment_details.advance_paid || 300} (Online)<br />
                                Balance Due: <strong className="text-zinc-900 font-mono">₹{order.payment_details.remaining_balance || (order.total - 300)}</strong>
                              </p>
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-medium">
                                <span>Pay remaining balance to Delhivery executive via Cash or UPI QR</span>
                              </div>
                            </div>
                          ) : order.payment_details?.type === 'cod' ? (
                            <div className="text-[#6d7175] space-y-1">
                              <p>
                                COD Fee: +₹{order.cod_fee || 99}<br />
                                Total Due on Delivery: <strong className="text-zinc-900 font-mono">₹{order.total}</strong>
                              </p>
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-medium">
                                <span>Pay at doorstep to Delhivery courier partner</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-emerald-700 font-medium">100% Fully Prepaid Online · Priority Dispatch</p>
                          )}
                        </div>

                        <div className="sm:text-right flex flex-col justify-between">
                          <div>
                            <span className="font-semibold text-[#6d7175] uppercase block mb-0.5">Order Total</span>
                            <div className="text-xl font-bold text-[#202223] font-mono">
                              ₹{Number(order.total || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap sm:justify-end gap-2">
                            <button
                              onClick={() => generateOrderInvoicePDF(order)}
                              className="px-3 py-1.5 bg-white border border-[#d2d5d8] hover:bg-zinc-50 hover:border-black text-[#202223] text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                              title="Download official PDF invoice"
                            >
                              <Download className="w-3.5 h-3.5 text-zinc-700" />
                              <span>Download Invoice</span>
                            </button>
                            <Link
                              to="/products"
                              className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#303030] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                            >
                              Buy Again
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: ADDRESSES */}
        {/* =================================================================== */}
        {activeTab === 'addresses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white border border-[#e1e3e5] rounded-xl p-4 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-[#202223]">Saved Addresses</h3>
                <p className="text-xs text-[#6d7175]">Manage delivery destinations for seamless 1-click checkout.</p>
              </div>
              <button
                onClick={() => {
                  setEditingAddressIdx(null);
                  setAddressForm({
                    tag: 'Home',
                    name: user.name || '',
                    phone: user.phone || '',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                    is_default: addresses.length === 0
                  });
                  setShowAddressModal(true);
                }}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#303030] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Address</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr, idx) => (
                <div
                  key={idx}
                  className={`bg-white border rounded-xl p-5 shadow-xs transition-all ${
                    addr.is_default ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-[#e1e3e5]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                      {addr.tag || 'Address'}
                    </span>
                    {addr.is_default && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-[#202223]">{addr.name}</h4>
                  <p className="text-xs text-[#6d7175] mt-1 leading-relaxed">
                    {addr.address}<br />
                    {addr.city}, {addr.state} {addr.pincode}<br />
                    Phone: {addr.phone}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#f0f0f0] flex items-center justify-between text-xs">
                    {!addr.is_default ? (
                      <button
                        onClick={() => {
                          const updated = addresses.map((a, i) => ({ ...a, is_default: i === idx }));
                          setAddresses(updated);
                          updateUser({ addresses: updated });
                        }}
                        className="text-zinc-600 hover:text-black font-semibold"
                      >
                        Set as default
                      </button>
                    ) : (
                      <span className="text-zinc-400 font-medium">Primary destination</span>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setEditingAddressIdx(idx);
                          setAddressForm(addr);
                          setShowAddressModal(true);
                        }}
                        className="text-zinc-600 hover:text-black flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      {addresses.length > 1 && (
                        <button
                          onClick={() => handleDeleteAddress(idx)}
                          className="text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: PROFILE & SIZING */}
        {/* =================================================================== */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 sm:p-8 shadow-xs max-w-2xl">
            <h3 className="text-base font-bold text-[#202223] pb-3 border-b border-[#e1e3e5]">
              Customer Profile & Preferences
            </h3>

            {profileMsg && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{profileMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6d7175] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black focus:ring-1 focus:ring-black font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6d7175] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-zinc-100 border border-[#d2d5d8] rounded-lg text-sm text-[#6d7175] cursor-not-allowed font-mono"
                  />
                  <span className="text-[11px] text-[#6d7175] mt-1 block">Account login ID</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6d7175] mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black focus:ring-1 focus:ring-black font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6d7175] mb-1.5">
                  Default Delivery Street Address
                </label>
                <textarea
                  rows={2}
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder="Street, Building, Flat / Villa No."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black focus:ring-1 focus:ring-black font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6d7175] mb-1.5">
                  City & State
                </label>
                <input
                  type="text"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                  placeholder="Mumbai, Maharashtra"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black focus:ring-1 focus:ring-black font-medium"
                />
              </div>

              {/* Sizing Preference */}
              <div className="pt-4 border-t border-[#e1e3e5]">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6d7175] mb-2">
                  Preferred Clothing Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setProfileForm({ ...profileForm, preferred_size: sz })}
                      className={`w-11 h-11 text-xs font-bold rounded-lg transition-all ${
                        profileForm.preferred_size === sz
                          ? 'bg-[#1a1a1a] text-white shadow-xs'
                          : 'bg-zinc-100 text-[#4a4a4a] hover:bg-zinc-200 border border-[#d2d5d8]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[#6d7175] mt-1.5 block">
                  Automatically pre-selects your size when browsing drops.
                </span>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-6 py-2.5 bg-[#1a1a1a] hover:bg-[#303030] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* SHIPMENT TRACKING MODAL (DELHIVERY ONE) */}
      {/* =================================================================== */}
      {trackingModalOrder && (() => {
        const hasAwb = !!(trackingModalOrder.awb_number && String(trackingModalOrder.awb_number).trim());
        const awb = trackingModalOrder.awb_number || '';
        const trackingUrl = 'https://www.delhivery.com/';
        const isDelivered = trackingModalOrder.status?.toLowerCase() === 'delivered';
        const isInTransit = trackingModalOrder.status?.toLowerCase() === 'in transit' || trackingModalOrder.status?.toLowerCase() === 'shipped';

        // Authentic timeline: if has real AWB, use live scans; if no scans yet, show manifested; if no AWB, show preparation
        let timeline = [];
        if (hasAwb) {
          if (liveTrackingData?.timeline && liveTrackingData.timeline.length > 0) {
            timeline = liveTrackingData.timeline;
          } else {
            timeline = [
              {
                timestamp: trackingModalOrder.created_at ? new Date(trackingModalOrder.created_at).toLocaleString('en-IN') : 'Recent',
                status: 'Shipment Manifested & Softdata Uploaded',
                remarks: 'Delhivery waybill generated at Confelion Fulfillment Center (Poonchh Hub 284304)'
              },
              {
                timestamp: 'Pending Pickup',
                status: 'Awaiting Delhivery Courier Pickup',
                remarks: 'Package staged at Confelion dock for Delhivery logistics vehicle'
              }
            ];
          }
        } else {
          timeline = [
            {
              timestamp: trackingModalOrder.created_at ? new Date(trackingModalOrder.created_at).toLocaleString('en-IN') : 'Confirmed',
              status: 'Order Confirmed & Placed',
              remarks: 'Payment verified and order queued for artisan inspection',
              completed: true
            },
            {
              timestamp: 'In Progress',
              status: 'Quality Inspection & Packaging',
              remarks: 'Confelion Fulfillment Facility · Poonchh Hub (UP - 284304)',
              active: true
            },
            {
              timestamp: 'Scheduled',
              status: 'Handover to Delhivery Express Courier',
              remarks: 'AWB Waybill will be assigned upon dispatch',
              pending: true
            },
            {
              timestamp: 'Upcoming',
              status: 'Doorstep Delivery',
              remarks: trackingModalOrder.shipping_address || 'Customer Delivery Address',
              pending: true
            }
          ];
        }

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xl relative animate-scale-up">
              <button
                onClick={() => setTrackingModalOrder(null)}
                className="absolute top-4 right-4 text-[#6d7175] hover:text-[#202223]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-between gap-2 mb-1 pr-6">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-zinc-900" />
                  <h3 className="text-base font-bold text-[#202223]">
                    {hasAwb ? 'Delhivery Express Live Tracking' : 'Delhivery Express Fulfillment'}
                  </h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isDelivered 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : isInTransit 
                    ? 'bg-sky-50 text-sky-800 border-sky-200' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {hasAwb ? (liveTrackingData?.delivery_status || trackingModalOrder.status || 'In Transit') : 'Preparing for Dispatch'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6d7175] pt-1">
                <span>Order: <strong className="text-zinc-800 font-mono">{trackingModalOrder.id}</strong></span>
                <span>·</span>
                {hasAwb ? (
                  <span className="inline-flex items-center gap-1 font-mono text-zinc-800">
                    AWB: <strong>{awb}</strong>
                    <button
                      onClick={() => handleCopyAwb(awb)}
                      className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-black transition-colors"
                      title="Copy AWB number"
                    >
                      {copiedAwb ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>AWB: Assigned upon courier dispatch</span>
                  </span>
                )}
              </div>

              {/* Transit Quick Route Strip */}
              <div className="mt-3 p-3 bg-zinc-50 border border-[#e1e3e5] rounded-lg grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Origin Facility</span>
                  <div className="font-semibold text-zinc-800 truncate">Poonchh Hub (UP - 284304)</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Destination Hub</span>
                  <div className="font-semibold text-zinc-800 truncate">{trackingModalOrder.city || 'India'}</div>
                </div>
              </div>

              {trackingLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Connecting to Delhivery One API...</span>
                </div>
              ) : (
                <div className="mt-4 space-y-4 border-l-2 border-zinc-300 pl-4 ml-2 max-h-[300px] overflow-y-auto">
                  {timeline.map((step, idx) => {
                    const isStepActive = step.active || (!hasAwb && idx === 1);
                    const isStepCompleted = step.completed || (hasAwb && idx < timeline.length - 1) || (!hasAwb && idx === 0);
                    const dotColor = isStepCompleted 
                      ? 'bg-zinc-900 ring-zinc-200' 
                      : isStepActive 
                      ? 'bg-amber-500 ring-amber-100 animate-pulse' 
                      : 'bg-zinc-300 ring-zinc-100';

                    return (
                      <div key={idx} className="relative">
                        <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ${dotColor} ring-4`} />
                        <div className="text-xs font-bold text-[#202223]">{step.status}</div>
                        <div className="text-[11px] text-[#6d7175] mt-0.5">{step.remarks}</div>
                        {step.timestamp && (
                          <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">{step.timestamp}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-[#e1e3e5] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium rounded-lg transition-colors"
                  >
                    <span>Delhivery Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => generateOrderInvoicePDF(trackingModalOrder)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#d2d5d8] hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Invoice PDF</span>
                  </button>
                </div>

                <button
                  onClick={() => setTrackingModalOrder(null)}
                  className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#303030] text-white font-semibold rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* ADD / EDIT ADDRESS MODAL */}
      {/* =================================================================== */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xl relative">
            <button
              onClick={() => setShowAddressModal(false)}
              className="absolute top-4 right-4 text-[#6d7175] hover:text-[#202223]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-[#202223] mb-4">
              {editingAddressIdx !== null ? 'Edit Address' : 'Add New Address'}
            </h3>

            <form onSubmit={handleSaveAddress} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                  Tag / Label
                </label>
                <input
                  type="text"
                  placeholder="Home, Office, Studio..."
                  value={addressForm.tag}
                  onChange={(e) => setAddressForm({ ...addressForm, tag: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={addressForm.name}
                  onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                  Street Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Flat, Apartment, Road name"
                  value={addressForm.address}
                  onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">City</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">State</label>
                  <input
                    type="text"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">Pincode</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={addressForm.pincode}
                    onChange={(e) => {
                      const pin = e.target.value.replace(/\D/g, '');
                      setAddressForm(prev => ({ ...prev, pincode: pin }));
                      if (pin.length === 6) {
                        checkDelhiveryPincode(pin).then(res => {
                          if (res && res.city) {
                            setAddressForm(prev => ({
                              ...prev,
                              pincode: pin,
                              city: res.city || prev.city,
                              state: res.state || prev.state
                            }));
                          }
                        }).catch(() => {});
                      }
                    }}
                    placeholder="6 digits"
                    className="w-full px-2.5 py-2 bg-white border border-[#d2d5d8] rounded-lg text-xs font-mono text-[#202223] focus:outline-none focus:border-black"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                  className="accent-black rounded"
                />
                <span className="text-xs text-[#202223]">Make this my default delivery address</span>
              </label>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2 border border-[#d2d5d8] text-xs font-semibold text-[#6d7175] hover:bg-zinc-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1a1a1a] hover:bg-[#303030] text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
