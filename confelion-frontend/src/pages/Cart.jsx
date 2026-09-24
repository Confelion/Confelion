import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  CreditCard, 
  Banknote, 
  Clock, 
  AlertCircle, 
  Lock,
  Truck,
  Download
} from 'lucide-react';
import GoogleLogo from '../components/GoogleLogo';
import { fetchAPI, checkDelhiveryPincode } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { getCachedCart, saveCartToCache } from '../lib/cartManager';
import { generateOrderInvoicePDF } from '../lib/invoiceGenerator';
import { optimizeImageUrl, PLACEHOLDER_IMAGE } from '../utils/imageOptimizer';
import { getSavedShippingAddress, saveCustomerShippingAddress } from '../lib/customerAddress';

export default function Cart() {
  const navigate = useNavigate();
  const { user, isAdmin, updateUser, signInWithGoogle } = useAuth();
  const [items, setItems] = useState([]);
  const [step, setStep] = useState('cart'); // 'cart' | 'checkout' | 'success'
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  // Settings
  const [settings, setSettings] = useState({
    cod_enabled: true,
    cod_fee: 99,
    partial_payment_enabled: true,
    partial_advance_amount: 300,
    luxury_box_threshold: 3000
  });

  // Selected payment method: 'online' | 'partial' | 'cod'
  const [selectedPayment, setSelectedPayment] = useState('online');

  // Customer Checkout Form - dynamically initialized from user or saved cache
  const [formData, setFormData] = useState(() => getSavedShippingAddress(user));

  useEffect(() => {
    if (user) {
      const saved = getSavedShippingAddress(user);
      setFormData(prev => ({
        name: prev.name || saved.name || user.name || '',
        email: user.email || prev.email || saved.email || '',
        phone: prev.phone || saved.phone || user.phone || '',
        address: prev.address || saved.address || user.address || '',
        city: prev.city || saved.city || user.city || '',
        pincode: prev.pincode || saved.pincode || user.pincode || ''
      }));
    }
  }, [user]);

  const [delhiveryStatus, setDelhiveryStatus] = useState(null);

  useEffect(() => {
    const pin = (formData.pincode || '').trim();
    if (pin.length === 6) {
      checkDelhiveryPincode(pin).then(res => {
        setDelhiveryStatus(res);
        if (res && res.city && !formData.city) {
          setFormData(prev => ({ ...prev, city: res.city }));
        }
      }).catch(() => {});
    } else {
      setDelhiveryStatus(null);
    }
  }, [formData.pincode]);

  const loadCart = () => {
    setItems(getCachedCart());
  };

  const loadSettings = async () => {
    try {
      const sett = await fetchAPI('/api/settings');
      if (sett) {
        setSettings({
          cod_enabled: sett.cod_enabled ?? true,
          cod_fee: Number(sett.cod_fee) || 99,
          partial_payment_enabled: sett.partial_payment_enabled ?? true,
          partial_advance_amount: Number(sett.partial_advance_amount) || 300,
          luxury_box_threshold: Number(sett.luxury_box_threshold) || 3000
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    loadCart();
    loadSettings();

    const handleCartUpdate = () => loadCart();
    const handleSettingsUpdate = (e) => {
      if (e.detail) {
        setSettings(prev => ({ ...prev, ...e.detail }));
      } else {
        loadSettings();
      }
    };

    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('settings-updated', handleSettingsUpdate);
    window.addEventListener('storage', handleCartUpdate);

    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('settings-updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleCartUpdate);
    };
  }, []);

  const saveCart = (newItems) => {
    saveCartToCache(newItems, true);
    setItems(newItems);
  };

  const updateQty = (index, delta) => {
    const updated = [...items];
    const newQty = (updated[index].qty || 1) + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].qty = newQty;
    }
    saveCart(updated);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    saveCart(updated);
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.qty || 1), 0);
  const threshold = settings.luxury_box_threshold || 3000;
  const progress = Math.min(100, Math.round((subtotal / threshold) * 100));

  const codFee = settings.cod_enabled && selectedPayment === 'cod' ? (settings.cod_fee || 99) : 0;
  const advanceAmount = Math.min(subtotal, settings.partial_advance_amount || 300);
  const finalTotal = subtotal + codFee;
  const remainingBalance = Math.max(0, finalTotal - advanceAmount);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const submitOrderToServer = async (paymentResponse = null) => {
    let paymentMethodName = 'Full Online Payment';
    let paymentDetails = {
      type: 'online',
      advance_paid: finalTotal,
      remaining_balance: 0,
      payment_id: paymentResponse?.razorpay_payment_id || null,
      razorpay_order_id: paymentResponse?.razorpay_order_id || null
    };

    if (selectedPayment === 'partial') {
      paymentMethodName = 'Partial Payment';
      paymentDetails = { 
        type: 'partial', 
        advance_paid: advanceAmount, 
        remaining_balance: remainingBalance,
        payment_id: paymentResponse?.razorpay_payment_id || null,
        razorpay_order_id: paymentResponse?.razorpay_order_id || null,
        note: `Advance ₹${advanceAmount} confirmed online. Balance ₹${remainingBalance} due upon delivery.` 
      };
    } else if (selectedPayment === 'cod') {
      paymentMethodName = 'Cash on Delivery';
      paymentDetails = { 
        type: 'cod', 
        cod_fee: codFee, 
        amount_due: finalTotal,
        note: `Full payment of ₹${finalTotal} (including ₹${codFee} COD fee) due at delivery.` 
      };
    }

    if (selectedPayment !== 'cod' && !paymentResponse?.razorpay_payment_id) {
      throw new Error('Payment was not completed. Order placement aborted.');
    }

    const res = await fetchAPI('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        customer_name: formData.name.trim(),
        email: user.email || formData.email.trim(),
        phone: formData.phone.trim(),
        shipping_address: `${formData.address.trim()}, ${formData.city.trim()} - ${formData.pincode.trim()}`,
        city: formData.city.trim(),
        pincode: formData.pincode.trim(),
        items: items,
        subtotal: subtotal,
        cod_fee: codFee,
        total: finalTotal,
        payment_method: paymentMethodName,
        payment_details: paymentDetails,
        payment_id: paymentResponse?.razorpay_payment_id || null
      })
    });

    if (res && res.order) {
      setLastOrder(res.order);
      // Automatically save address to profile and cache for next checkout
      await saveCustomerShippingAddress(user, formData, updateUser);
      saveCart([]);
      setStep('success');
    }
  };

  // Handle order placement
  const handlePlaceOrder = async (e) => {
    if (e) e.preventDefault();
    if (items.length === 0) return;

    if (!user) {
      alert('Please sign in to complete your purchase.');
      navigate('/login?redirect=/cart');
      return;
    }

    if (!formData.name.trim() || !formData.email.trim() || !formData.address.trim()) {
      alert('Please enter your name, email, and delivery address.');
      return;
    }

    setPlacingOrder(true);

    try {
      if (selectedPayment === 'cod') {
        await submitOrderToServer();
      } else {
        // Online or Partial Payment via Razorpay
        const amountToPay = selectedPayment === 'partial' ? advanceAmount : finalTotal;
        const loaded = await loadRazorpayScript();
        
        if (!loaded) {
          alert('Could not load payment gateway. Please check your connection or choose Cash on Delivery.');
          setPlacingOrder(false);
          return;
        }

        let rzpOrder = null;
        try {
          rzpOrder = await fetchAPI('/api/payment/order', {
            method: 'POST',
            body: JSON.stringify({
              amount: amountToPay,
              currency: 'INR',
              receipt: `rcpt_${Date.now()}`
            })
          });
        } catch (apiErr) {
          console.error('Payment order endpoint error:', apiErr);
        }

        if (!rzpOrder || !rzpOrder.id || !window.Razorpay) {
          alert('Payment could not be initialized with the gateway. Please try again or select Cash on Delivery.');
          setPlacingOrder(false);
          return;
        }

        const options = {
          key: rzpOrder.key || 'rzp_test_RHmiNQk77x5FMw',
          amount: rzpOrder.amount,
          currency: rzpOrder.currency || 'INR',
          name: 'CONFELION',
          description: selectedPayment === 'partial' ? 'Advance Order Booking' : 'Order Checkout',
          image: '/images/confelion-icon.png',
          order_id: rzpOrder.id.startsWith('order_') ? rzpOrder.id : undefined,
          handler: async function (response) {
            try {
              if (!response || !response.razorpay_payment_id) {
                alert('Payment could not be verified. Order was not placed.');
                setPlacingOrder(false);
                return;
              }
              // Verify payment signature
              await fetchAPI('/api/payment/verify', {
                method: 'POST',
                body: JSON.stringify({
                  ...response,
                  user_id: user?.id || null
                })
              }).catch((vErr) => {
                console.warn('Payment verification note:', vErr);
              });

              await submitOrderToServer(response);
            } catch (pErr) {
              console.error(pErr);
              alert('Error finalizing order: ' + (pErr.message || 'Please contact support.'));
            } finally {
              setPlacingOrder(false);
            }
          },
          prefill: {
            name: formData.name.trim(),
            email: user.email || formData.email.trim(),
            contact: formData.phone.trim(),
          },
          theme: {
            color: '#000000',
          },
          modal: {
            ondismiss: function () {
              setPlacingOrder(false);
              alert('Payment cancelled. Order was not placed.');
            }
          }
        };

        const rzpInstance = new window.Razorpay(options);
        rzpInstance.on('payment.failed', function (resp) {
          setPlacingOrder(false);
          alert('Payment Failed: ' + (resp.error?.description || 'Transaction unsuccessful. Order was not placed.'));
        });
        rzpInstance.open();
        return;
      }
    } catch (err) {
      console.error(err);
      alert('Error placing order: ' + (err.message || 'Please try again'));
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="w-full bg-black text-white min-h-[80vh] py-8 sm:py-14 selection:bg-white selection:text-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-6">
          {step === 'cart' && `SHOPPING BAG (${items.reduce((s, i) => s + (i.qty || 1), 0)})`}
          {step === 'checkout' && 'CHECKOUT & PAYMENT'}
          {step === 'success' && 'ORDER CONFIRMATION'}
        </h1>

        {/* Free Shipping & Luxury Packaging Tier Meter */}
        {step !== 'success' && (
          <div className="bg-zinc-950 p-4 border border-white/10 mb-6 text-xs">
            {subtotal >= threshold ? (
              <div className="flex items-center gap-2 text-white font-medium">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>VIP Perks Unlocked: <strong>FREE Delhivery Express</strong> + <strong>Signature Rigid Magnetic Box</strong>!</span>
              </div>
            ) : subtotal >= 999 ? (
              <div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Check className="w-3.5 h-3.5" /> FREE Delhivery Express Unlocked
                  </span>
                  <span className="text-[11px] text-zinc-400 font-medium">Add ₹{threshold - subtotal} for Signature Box</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 mt-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-white h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((subtotal / threshold) * 100))}%` }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-zinc-300">
                  Add <strong>₹{999 - subtotal}</strong> more for <strong>FREE Delhivery Express Shipping</strong>.
                </p>
                <div className="w-full bg-zinc-800 h-1.5 mt-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((subtotal / 999) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: CART ITEMS */}
        {step === 'cart' && (
          items.length === 0 ? (
            <div className="py-16 text-center border border-white/10 bg-zinc-950 p-8">
              <p className="text-base font-bold uppercase tracking-wider text-zinc-300">Your bag is currently empty</p>
              <p className="text-xs text-zinc-500 mt-1">Discover our latest monochrome drops.</p>
              <Link
                to="/products"
                className="mt-6 inline-block px-8 py-3 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200 transition-colors"
              >
                EXPLORE COLLECTION
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Items list */}
              <div className="lg:col-span-2 space-y-4">
                {items.map((item, idx) => (
                  <div key={`${item.handle}-${item.size}-${idx}`} className="flex gap-4 p-4 bg-zinc-950 border border-white/10">
                    <Link to={`/product/${item.handle}`}>
                      <img
                        src={optimizeImageUrl(item.image, { width: 200, height: 260, format: 'webp' })}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                        className="w-20 h-26 object-cover bg-black border border-white/10 shrink-0"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/product/${item.handle}`}>
                          <h3 className="text-sm font-bold text-white hover:text-zinc-300 uppercase">
                            {item.title}
                          </h3>
                        </Link>
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-zinc-500 hover:text-white p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-1 text-xs text-zinc-400">
                        Size: <span className="font-bold text-white">{item.size}</span>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center border border-white/20">
                          <button
                            onClick={() => updateQty(idx, -1)}
                            className="px-2.5 py-1 text-zinc-300 hover:text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-mono font-bold">{item.qty || 1}</span>
                          <button
                            onClick={() => updateQty(idx, 1)}
                            className="px-2.5 py-1 text-zinc-300 hover:text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-sm font-black font-mono text-white">
                          ₹{((Number(item.price) || 0) * (item.qty || 1)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary Box */}
              <div className="p-6 bg-zinc-950 border border-white/10 h-fit space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/10 pb-3">
                  Order Summary
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Express Shipping</span>
                    <span className="font-mono text-emerald-400 font-bold uppercase">FREE</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase text-white">Estimated Total</span>
                  <span className="text-xl font-black font-mono text-white">
                    ₹{subtotal.toLocaleString('en-IN')}
                  </span>
                </div>

                {!user && (
                  <div className="p-3 bg-zinc-900/90 border border-white/20 text-xs flex items-center justify-between gap-2">
                    <span className="text-zinc-300 text-[11px]">Sign in required to checkout</span>
                    <button
                      type="button"
                      onClick={() => navigate('/login?redirect=/cart')}
                      className="px-2.5 py-1 bg-white text-black font-bold text-[10px] uppercase tracking-wider hover:bg-zinc-200 shrink-0"
                    >
                      Login
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!user) {
                      navigate('/login?redirect=/cart');
                    } else {
                      setStep('checkout');
                    }
                  }}
                  className="w-full py-3.5 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-2xl"
                >
                  <span>{user ? 'PROCEED TO CHECKOUT' : 'SIGN IN TO CHECKOUT'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        )}

        {/* STEP 2: CHECKOUT WITH 3 PAYMENT OPTIONS */}
        {step === 'checkout' && (
          !user ? (
            <div className="py-16 text-center border border-white/15 bg-zinc-950 p-8 max-w-lg mx-auto space-y-6">
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wider text-white">LOGIN REQUIRED TO PURCHASE</h2>
                <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">
                  Confelion drops require an authenticated patron account for shipment tracking and order security. Your bag items remain preserved.
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await signInWithGoogle();
                  }}
                  className="w-full py-3.5 px-4 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <GoogleLogo className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login?redirect=/cart')}
                  className="w-full py-3.5 px-4 bg-black border border-white/30 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Sign in with Email & Password
                </button>
                <div className="pt-2 flex items-center justify-center gap-4 text-xs text-zinc-400">
                  <Link to="/signup?redirect=/cart" className="underline hover:text-white">
                    Register New Account
                  </Link>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    className="hover:text-white underline"
                  >
                    Return to Bag
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              {/* Shipping Address */}
              <div className="p-6 bg-zinc-950 border border-white/15 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Shipping & Delivery Details
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> SSL Secured
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-white/20 text-xs text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-white/20 text-xs text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-white/20 text-xs text-white focus:outline-none focus:border-white font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Street Address *</label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-white/20 text-xs text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-white/20 text-xs text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">PIN Code *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 bg-black border border-white/20 text-xs text-white focus:outline-none focus:border-white font-mono"
                    />
                  </div>

                  {delhiveryStatus && (
                    <div className="col-span-1 sm:col-span-2 pt-1 animate-fade-in">
                      {delhiveryStatus.serviceable ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                          <Truck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          <span><strong>Delhivery Express</strong>: {delhiveryStatus.estimated_delivery_text} ({delhiveryStatus.zone || 'Express Route'})</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2">
                          {delhiveryStatus.error || 'PIN Code not serviceable currently.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="p-6 bg-zinc-950 border border-white/15 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/10 pb-3">
                  Payment Method
                </h3>

                <div className="space-y-3">
                  {/* Full Online */}
                  <label
                    onClick={() => setSelectedPayment('online')}
                    className={`block p-4 border cursor-pointer transition-all ${
                      selectedPayment === 'online'
                        ? 'bg-black border-white text-white'
                        : 'bg-black/60 border-white/20 text-zinc-400 hover:border-white/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedPayment === 'online' ? 'border-white bg-white' : 'border-zinc-500'
                        }`}>
                          {selectedPayment === 'online' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                            <span>Full Online Payment</span>
                            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase">
                              RECOMMENDED
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 text-white text-[10px] font-semibold border border-white/20">
                              <GoogleLogo className="w-3 h-3" /> GPay
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 text-white text-[10px] font-semibold border border-white/20">
                              <CreditCard className="w-3 h-3 text-zinc-300" /> Cards
                            </span>
                            <span>UPI · NetBanking · Instant verification</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                  </label>

                  {/* Partial Payment */}
                  {settings.partial_payment_enabled && (
                    <label
                      onClick={() => setSelectedPayment('partial')}
                      className={`block p-4 border cursor-pointer transition-all ${
                        selectedPayment === 'partial'
                          ? 'bg-black border-white text-white'
                          : 'bg-black/60 border-white/20 text-zinc-400 hover:border-white/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedPayment === 'partial' ? 'border-white bg-white' : 'border-zinc-500'
                          }`}>
                            {selectedPayment === 'partial' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                              <span>Partial Payment</span>
                              <span className="px-1.5 py-0.2 bg-white/15 text-zinc-300 border border-white/20 text-[9px] font-black uppercase">
                                ADVANCE DEPOSIT
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1">
                              Pay ₹{advanceAmount} advance online · Pay ₹{subtotal - advanceAmount} balance upon delivery.
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-xs text-white">₹{advanceAmount} due</div>
                          <div className="text-[10px] text-zinc-500">₹{subtotal - advanceAmount} at door</div>
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Cash on Delivery */}
                  {settings.cod_enabled ? (
                    <label
                      onClick={() => setSelectedPayment('cod')}
                      className={`block p-4 border cursor-pointer transition-all ${
                        selectedPayment === 'cod'
                          ? 'bg-black border-white text-white'
                          : 'bg-black/60 border-white/20 text-zinc-400 hover:border-white/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedPayment === 'cod' ? 'border-white bg-white' : 'border-zinc-500'
                          }`}>
                            {selectedPayment === 'cod' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                              <span>Cash on Delivery (COD)</span>
                              <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-400 border border-amber-400/30 text-[9px] font-black uppercase">
                                +₹{settings.cod_fee || 99} FEE
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1">
                              Pay ₹{finalTotal.toLocaleString('en-IN')} cash or UPI directly upon doorstep delivery.
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-xs text-white">₹{finalTotal.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-amber-400">+₹{settings.cod_fee || 99} fee</div>
                        </div>
                      </div>
                    </label>
                  ) : (
                    <div className="p-3 bg-zinc-950 border border-white/10 opacity-50 flex items-center gap-2 text-xs text-zinc-500">
                      <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>Cash on Delivery is currently disabled by store administration.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Summary Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 bg-zinc-950 border border-white/15 space-y-4 sticky top-24">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/10 pb-3">
                  Summary & Line Items ({items.length})
                </h3>

                <div className="divide-y divide-white/10 max-h-48 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white uppercase">{item.title}</div>
                        <div className="text-[10px] text-zinc-400">Size: {item.size} · Qty: {item.qty}</div>
                      </div>
                      <span className="font-mono font-bold text-white">
                        ₹{(item.price * item.qty).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Express Shipping</span>
                    <span className="font-mono text-emerald-400 font-bold uppercase">FREE</span>
                  </div>
                  {selectedPayment === 'cod' && (
                    <div className="flex justify-between text-amber-400">
                      <span>COD Handling Fee</span>
                      <span className="font-mono font-bold">+₹{codFee}</span>
                    </div>
                  )}
                  {selectedPayment === 'partial' && (
                    <div className="flex justify-between text-sky-400">
                      <span>Advance Due Today</span>
                      <span className="font-mono font-bold">₹{advanceAmount}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase text-white">Total Payable</span>
                  <span className="text-xl font-black font-mono text-white">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={placingOrder}
                  className="w-full py-4 text-xs font-bold uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-2xl"
                >
                  {placingOrder ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
                      <span>CONFIRMING DROP...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>{selectedPayment === 'partial' ? `PAY ₹${advanceAmount} & CONFIRM` : 'CONFIRM ORDER'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="w-full py-2 border border-white/20 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider"
                >
                  Modify Bag Items
                </button>
              </div>
            </div>
          </form>
          )
        )}

        {/* STEP 3: ORDER SUCCESS */}
        {step === 'success' && (
          <div className="py-16 text-center border border-white/10 bg-zinc-950 p-8 max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center mx-auto mb-2">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Silhouettes Reserved
            </span>
            <h2 className="text-2xl font-black uppercase tracking-wide">ORDER SUCCESSFUL!</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Reference: <strong className="text-white font-mono">{lastOrder?.id}</strong>
            </p>

            <div className="p-4 bg-black border border-white/15 text-left text-xs space-y-2 mt-4">
              <div>Patron: <strong className="text-white">{lastOrder?.customer_name}</strong></div>
              <div>Destination: <span className="text-white">{lastOrder?.shipping_address}</span></div>
              <div>Payment: <strong className="text-white">{lastOrder?.payment_method}</strong></div>
              {lastOrder?.payment_details?.type === 'partial' && (
                <div className="p-2.5 bg-sky-950/40 border border-sky-500/30 text-sky-300 text-[11px] leading-relaxed">
                  • <strong>Advance Paid:</strong> ₹{lastOrder?.payment_details?.advance_paid} confirmed online.<br />
                  • <strong>Remaining Balance:</strong> ₹{lastOrder?.payment_details?.remaining_balance} payable to Delhivery courier executive via Cash or UPI QR at doorstep.
                </div>
              )}
              {lastOrder?.payment_details?.type === 'cod' && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                  • <strong>Doorstep Cash/UPI:</strong> Pay ₹{Number(lastOrder?.total).toLocaleString('en-IN')} upon package handover.
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-white">
                <span>Total Amount:</span>
                <span className="font-mono text-base">₹{Number(lastOrder?.total).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Delhivery Express Dispatch Banner */}
            <div className="p-4 bg-zinc-900 border border-emerald-500/30 flex items-start gap-3 text-left">
              <Truck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-bold uppercase text-white flex flex-wrap items-center justify-between gap-2">
                  <span>Delhivery Express Logistics</span>
                  <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-300 font-mono font-medium">
                    {lastOrder?.awb_number ? `AWB #${lastOrder.awb_number}` : 'AWB: Generated Upon Dispatch'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Queued for packaging & quality inspection at Confelion Poonchh Hub (284304). Official vector PDF invoice available below.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => generateOrderInvoicePDF(lastOrder)}
                className="px-6 py-3 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Download Invoice (PDF)</span>
              </button>
              <button
                onClick={() => navigate('/account')}
                className="px-6 py-3 text-xs font-bold uppercase tracking-widest border border-white/30 text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Track Package</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-6 py-3 text-xs font-bold uppercase tracking-widest border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 transition-colors"
                >
                  Admin Console
                </button>
              )}
            </div>
            <div>
              <button
                onClick={() => {
                  setStep('cart');
                  navigate('/products');
                }}
                className="text-xs text-zinc-500 hover:text-white uppercase tracking-wider transition-colors pt-2 inline-block"
              >
                ← Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
