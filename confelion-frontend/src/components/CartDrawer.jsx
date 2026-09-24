import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  Check, 
  ArrowRight, 
  ShieldCheck, 
  CreditCard, 
  Banknote, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  Lock,
  Truck,
  Download
} from 'lucide-react';
import GoogleLogo from './GoogleLogo';
import { fetchAPI, checkDelhiveryPincode } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { getCachedCart, saveCartToCache } from '../lib/cartManager';
import { generateOrderInvoicePDF } from '../lib/invoiceGenerator';
import { optimizeImageUrl, PLACEHOLDER_IMAGE } from '../utils/imageOptimizer';
import { getSavedShippingAddress, saveCustomerShippingAddress } from '../lib/customerAddress';

export default function CartDrawer() {
  const navigate = useNavigate();
  const { user, isAdmin, updateUser, signInWithGoogle } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [currentStep, setCurrentStep] = useState('cart'); // 'cart' | 'checkout' | 'success'
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);

  // Settings from store
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
    loadCart();
    loadSettings();

    const handleOpen = () => {
      loadCart();
      loadSettings();
      setCurrentStep('cart');
      setIsOpen(true);
    };

    const handleCartUpdate = () => loadCart();
    const handleSettingsUpdate = (e) => {
      if (e.detail) {
        setSettings(prev => ({ ...prev, ...e.detail }));
      } else {
        loadSettings();
      }
    };

    window.addEventListener('open-cart-drawer', handleOpen);
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('settings-updated', handleSettingsUpdate);
    window.addEventListener('storage', handleCartUpdate);

    return () => {
      window.removeEventListener('open-cart-drawer', handleOpen);
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
  const totalCount = items.reduce((sum, item) => sum + (item.qty || 1), 0);

  // Financial calculations
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
        note: `Advance ₹${advanceAmount} confirmed online. Balance ₹${remainingBalance} payable upon delivery.` 
      };
    } else if (selectedPayment === 'cod') {
      paymentMethodName = 'Cash on Delivery';
      paymentDetails = { 
        type: 'cod', 
        cod_fee: codFee, 
        amount_due: finalTotal,
        note: `Full payment of ₹${finalTotal} (including ₹${codFee} COD handling) payable at delivery.` 
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
      setLastPlacedOrder(res.order);
      // Automatically save address to profile and cache for next checkout
      await saveCustomerShippingAddress(user, formData, updateUser);
      saveCart([]); // clear bag
      setCurrentStep('success');
    }
  };

  // Handle Order Placement
  const handlePlaceOrder = async (e) => {
    if (e) e.preventDefault();
    if (items.length === 0) return;

    if (!user) {
      alert('Please sign in to complete your order.');
      setIsOpen(false);
      navigate('/login?redirect=/cart');
      return;
    }

    if (!formData.name.trim() || !formData.email.trim() || !formData.address.trim()) {
      alert('Please fill in your name, email, and shipping address.');
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
              await fetchAPI('/api/payment/verify', {
                method: 'POST',
                body: JSON.stringify({
                  ...response,
                  user_id: user?.id || null
                })
              }).catch((vErr) => console.warn('Payment verification note:', vErr));

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
            color: '#000000'
          },
          modal: {
            ondismiss: function () {
              setPlacingOrder(false);
            }
          }
        };

        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.on('payment.failed', function (resp) {
          console.error('Payment failed:', resp.error);
          alert(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
          setPlacingOrder(false);
        });
        razorpayInstance.open();
      }
    } catch (err) {
      console.error(err);
      alert('Error placing order: ' + (err.message || 'Please try again.'));
      setPlacingOrder(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-fade-in">
      <div 
        className="w-full max-w-lg bg-black border-l border-white/15 h-full flex flex-col text-white shadow-2xl animate-slide-in-right relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep === 'checkout' && (
              <button
                onClick={() => setCurrentStep('cart')}
                className="mr-1 text-zinc-400 hover:text-white p-1"
                title="Back to Bag"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">
              {currentStep === 'cart' && `YOUR BAG (${totalCount})`}
              {currentStep === 'checkout' && 'EXPRESS CHECKOUT'}
              {currentStep === 'success' && 'ORDER CONFIRMED'}
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* STEP 1: CART ITEMS VIEW                                           */}
        {/* ================================================================= */}
        {currentStep === 'cart' && (
          <>
            {/* Free Shipping & Luxury Packaging Tier Meter */}
            <div className="bg-zinc-950 p-3.5 border-b border-white/10 text-xs">
              {subtotal >= 3000 ? (
                <div className="flex items-center gap-2 text-white font-medium">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>VIP Perks Unlocked: <strong>FREE Delhivery Express</strong> + <strong>Signature Rigid Gift Box</strong>!</span>
                </div>
              ) : subtotal >= 999 ? (
                <div>
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" /> FREE Delhivery Express Unlocked
                    </span>
                    <span className="text-[11px] text-zinc-400 font-medium">Add ₹{3000 - subtotal} for Rigid Box</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 mt-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-white h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((subtotal / 3000) * 100))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-zinc-300">
                    Add <strong>₹{999 - subtotal}</strong> more for <strong>FREE Delhivery Express Shipping</strong>.
                  </p>
                  <div className="w-full bg-zinc-800 h-1.5 mt-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((subtotal / 999) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {items.length === 0 ? (
                <div className="py-16 text-center text-zinc-500">
                  <p className="text-sm font-semibold uppercase tracking-wider">Your bag is empty</p>
                  <p className="text-xs mt-1 text-zinc-600">Explore the latest all-black collection.</p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="mt-5 px-6 py-2.5 text-xs font-bold uppercase tracking-widest border border-white/30 text-white hover:bg-white hover:text-black transition-colors"
                  >
                    BROWSE COLLECTION
                  </button>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={`${item.handle}-${item.size}-${idx}`} className="flex gap-3.5 pb-4 border-b border-white/10">
                    <Link to={`/product/${item.handle}`} onClick={() => setIsOpen(false)}>
                      <img
                        src={optimizeImageUrl(item.image, { width: 160, height: 200, format: 'webp' })}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                        className="w-16 h-20 object-cover bg-zinc-950 border border-white/10 shrink-0"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/product/${item.handle}`} onClick={() => setIsOpen(false)}>
                          <h4 className="text-xs font-bold text-white truncate hover:text-zinc-300 uppercase">
                            {item.title}
                          </h4>
                        </Link>
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-zinc-500 hover:text-white p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-1 text-[11px] text-zinc-400">
                        Size: <span className="font-semibold text-white">{item.size}</span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        {/* Qty controller */}
                        <div className="flex items-center border border-white/20">
                          <button
                            onClick={() => updateQty(idx, -1)}
                            className="px-2 py-1 text-zinc-300 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold font-mono">{item.qty || 1}</span>
                          <button
                            onClick={() => updateQty(idx, 1)}
                            className="px-2 py-1 text-zinc-300 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-xs font-bold font-mono text-white">
                          ₹{((Number(item.price) || 0) * (item.qty || 1)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Actions */}
            {items.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-white/15 bg-black space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                  <span className="text-zinc-400 uppercase tracking-wider">Subtotal</span>
                  <span className="text-base font-black text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Taxes included. Free express delivery on prepaid drops.
                </p>

                {!user && (
                  <div className="p-2.5 bg-zinc-950 border border-white/20 text-xs flex items-center justify-between gap-2">
                    <span className="text-zinc-300 text-[11px]">Sign in required to checkout</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/login?redirect=/cart');
                      }}
                      className="px-2.5 py-1 bg-white text-black font-bold text-[10px] uppercase tracking-wider hover:bg-zinc-200 shrink-0"
                    >
                      Login
                    </button>
                  </div>
                )}

                {/* Checkout trigger */}
                <button
                  onClick={() => {
                    if (!user) {
                      setIsOpen(false);
                      navigate('/login?redirect=/cart');
                    } else {
                      setCurrentStep('checkout');
                    }
                  }}
                  className="w-full py-3.5 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <span>{user ? 'PROCEED TO CHECKOUT' : 'SIGN IN TO CHECKOUT'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ================================================================= */}
        {/* STEP 2: CHECKOUT & PAYMENT SELECTION                              */}
        {/* ================================================================= */}
        {currentStep === 'checkout' && (
          !user ? (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-5">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-white">LOGIN REQUIRED</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Sign in with your Google or Email account to complete your order. Your bag contents are safely saved.
                </p>
              </div>
              <div className="w-full space-y-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await signInWithGoogle();
                  }}
                  className="w-full py-3 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <GoogleLogo className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/login?redirect=/cart');
                  }}
                  className="w-full py-3 bg-black border border-white/30 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Sign in with Email
                </button>
                <div className="pt-2 flex items-center justify-center gap-3 text-xs text-zinc-400">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/signup?redirect=/cart');
                    }}
                    className="underline hover:text-white"
                  >
                    Create Account
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('cart')}
                    className="underline hover:text-white"
                  >
                    Back to Bag
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <form onSubmit={handlePlaceOrder} className="flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              
              {/* Shipping Information */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    1. Shipping Destination
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> SSL Secured
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      required
                      placeholder="Full Name *"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      required
                      placeholder="Email Address *"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <input
                      type="tel"
                      required
                      placeholder="Phone Number *"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="text"
                      required
                      placeholder="Street Address / Flat / Landmark *"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      placeholder="City *"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="PIN Code *"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white font-mono"
                    />
                  </div>

                  {delhiveryStatus && (
                    <div className="col-span-1 sm:col-span-2 pt-1 animate-fade-in">
                      {delhiveryStatus.serviceable ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5">
                          <Truck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          <span><strong>Delhivery Express</strong>: {delhiveryStatus.estimated_delivery_text}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
                          {delhiveryStatus.error || 'PIN Code not serviceable'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods (Online, Partial, COD) */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  2. Select Payment Structure
                </span>

                <div className="space-y-2.5">
                  {/* OPTION 1: Full Online Payment */}
                  <label
                    onClick={() => setSelectedPayment('online')}
                    className={`block p-3.5 border cursor-pointer transition-all ${
                      selectedPayment === 'online'
                        ? 'bg-zinc-900 border-white text-white'
                        : 'bg-zinc-950 border-white/20 text-zinc-400 hover:border-white/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
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
                            <span>UPI · NetBanking · Zero fees</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-white shrink-0">
                        ₹{subtotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </label>

                  {/* OPTION 2: Partial Payment (Advance Deposit) */}
                  {settings.partial_payment_enabled && (
                    <label
                      onClick={() => setSelectedPayment('partial')}
                      className={`block p-3.5 border cursor-pointer transition-all ${
                        selectedPayment === 'partial'
                          ? 'bg-zinc-900 border-white text-white'
                          : 'bg-zinc-950 border-white/20 text-zinc-400 hover:border-white/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedPayment === 'partial' ? 'border-white bg-white' : 'border-zinc-500'
                          }`}>
                            {selectedPayment === 'partial' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                              <span>Partial Payment</span>
                              <span className="px-1.5 py-0.2 bg-white/15 text-zinc-300 border border-white/20 text-[9px] font-black uppercase">
                                PAY ₹{advanceAmount} NOW
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Pay ₹{advanceAmount} advance online to confirm drop · Pay balance ₹{subtotal - advanceAmount} upon delivery.
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-xs text-white">₹{advanceAmount} due</div>
                          <div className="text-[10px] text-zinc-500">₹{subtotal - advanceAmount} at door</div>
                        </div>
                      </div>
                    </label>
                  )}

                  {/* OPTION 3: Cash on Delivery (COD) */}
                  {settings.cod_enabled ? (
                    <label
                      onClick={() => setSelectedPayment('cod')}
                      className={`block p-3.5 border cursor-pointer transition-all ${
                        selectedPayment === 'cod'
                          ? 'bg-zinc-900 border-white text-white'
                          : 'bg-zinc-950 border-white/20 text-zinc-400 hover:border-white/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
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
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Pay ₹{finalTotal.toLocaleString('en-IN')} cash/UPI directly upon courier arrival.
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
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

              {/* Price Breakdown */}
              <div className="p-3.5 bg-zinc-950 border border-white/10 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Bag Subtotal</span>
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
                    <span>Advance Deposit Due Now</span>
                    <span className="font-mono font-bold">₹{advanceAmount}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                  <span className="font-bold uppercase text-white">Total Order Value</span>
                  <span className="text-base font-black text-white font-mono">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Checkout Button */}
            <div className="p-4 sm:p-5 border-t border-white/15 bg-black">
              <button
                type="submit"
                disabled={placingOrder}
                className="w-full py-4 text-xs font-bold uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-2xl"
              >
                {placingOrder ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
                    <span>CONFIRMING SILHOUETTE DROP...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {selectedPayment === 'partial' ? `PAY ₹${advanceAmount} & CONFIRM DROP` : 'CONFIRM & PLACE ORDER'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
          )
        )}

        {/* ================================================================= */}
        {/* STEP 3: ORDER SUCCESS / CONFIRMATION                              */}
        {/* ================================================================= */}
        {currentStep === 'success' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                Silhouettes Reserved
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mt-1">
                ORDER CONFIRMED
              </h3>
              <p className="text-xs font-mono text-zinc-400 mt-1">
                Reference: <strong className="text-white">{lastPlacedOrder?.id}</strong>
              </p>
            </div>

            {/* Order Brief Box */}
            <div className="w-full p-4 bg-zinc-950 border border-white/15 text-left text-xs space-y-2">
              <div className="text-zinc-400">
                Patron: <span className="text-white font-bold">{lastPlacedOrder?.customer_name}</span>
              </div>
              <div className="text-zinc-400">
                Destination: <span className="text-white">{lastPlacedOrder?.shipping_address}</span>
              </div>
              <div className="text-zinc-400">
                Payment Structure: <strong className="text-white">{lastPlacedOrder?.payment_method}</strong>
              </div>
              {lastPlacedOrder?.payment_details?.type === 'partial' && (
                <div className="p-2 bg-sky-950/40 border border-sky-500/30 text-sky-300 text-[11px]">
                  • Advance Deposit Paid: ₹{lastPlacedOrder?.payment_details?.advance_paid} (Online)<br />
                  • Remaining Balance Due on Delivery: ₹{lastPlacedOrder?.payment_details?.remaining_balance}
                </div>
              )}
              {lastPlacedOrder?.payment_details?.type === 'cod' && (
                <div className="p-2 bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px]">
                  • Pay full amount ₹{lastPlacedOrder?.total} cash/UPI upon courier arrival.
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex justify-between text-xs font-bold text-white">
                <span>Total Amount</span>
                <span className="font-mono text-base">₹{Number(lastPlacedOrder?.total).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="w-full pt-2 space-y-2">
              <button
                onClick={() => generateOrderInvoicePDF(lastPlacedOrder)}
                className="w-full py-3 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Download Invoice (PDF)</span>
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/account');
                }}
                className="w-full py-2.5 border border-white/30 text-white hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Track in Account Dashboard</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/admin');
                  }}
                  className="w-full py-2.5 bg-zinc-900 border border-white/20 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                >
                  View in Admin Console
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setCurrentStep('cart');
                }}
                className="w-full py-2 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
