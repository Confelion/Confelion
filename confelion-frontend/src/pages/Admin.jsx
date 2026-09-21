import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Package, 
  ShoppingBag, 
  Sliders, 
  Plus, 
  Trash2, 
  ExternalLink, 
  LogOut, 
  TrendingUp, 
  Users, 
  IndianRupee, 
  Check, 
  X, 
  Search, 
  Eye, 
  RefreshCw, 
  Upload, 
  Download, 
  Edit2, 
  Phone, 
  Mail, 
  MapPin, 
  Image as ImageIcon, 
  ImagePlus, 
  Loader2, 
  Star, 
  Sparkles, 
  Ruler, 
  CreditCard, 
  Banknote, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  Store, 
  Layers, 
  Settings, 
  HelpCircle, 
  Bell,
  ShieldCheck,
  Truck,
  Wallet,
  Building2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { 
  fetchAPI,
  checkDelhiveryPincode,
  trackDelhiveryAwb,
  fetchDelhiveryWallet,
  fetchDelhiveryWarehouses,
  fetchDelhiveryOrders,
  dispatchDelhiveryOrder
} from '../lib/api';
import { STORE_SETTINGS } from '../data/mockData';
import { uploadMediaAsset } from '../lib/mediaStorage';
import { fetchFirestoreOrders } from '../lib/firebase';
import { generateOrderInvoicePDF } from '../lib/invoiceGenerator';

// Compress and convert image file to optimized Base64 data URL (max 1200px, 0.85 jpeg)
const compressImageFile = (file, maxDim = 1200, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        // Fallback to raw base64 if canvas decode fails
        resolve(readerEvent.target.result);
      };
      img.src = readerEvent.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['orders', 'products', 'customers', 'storefront', 'settings', 'delhivery'];
  const [activeTab, setActiveTabState] = useState(
    validTabs.includes(tabFromUrl) ? tabFromUrl : 'orders'
  );

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    }
  }, [tabFromUrl]);

  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Data states
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [settings, setSettings] = useState({
    ...STORE_SETTINGS,
    cod_enabled: true,
    cod_fee: 99,
    partial_payment_enabled: true,
    partial_advance_amount: 300,
    hero_headline: STORE_SETTINGS.hero_headline || 'ENGINEERED MONOCHROME',
    hero_subheadline: STORE_SETTINGS.hero_subtext || 'Crafted in pure black combed cotton.',
    announcement_text: STORE_SETTINGS.announcement || 'FREE EXPRESS SHIPPING ACROSS INDIA · ALL DROPS 100% BLACK'
  });
  const [toastMessage, setToastMessage] = useState('');

  // Delhivery Logistics state
  const [delhiveryWallet, setDelhiveryWallet] = useState(null);
  const [delhiveryWarehouses, setDelhiveryWarehouses] = useState([]);
  const [delhiveryOrders, setDelhiveryOrders] = useState([]);
  const [delhiveryLoading, setDelhiveryLoading] = useState(false);
  const [delhiveryTrackingInput, setDelhiveryTrackingInput] = useState('');
  const [delhiveryTrackingResult, setDelhiveryTrackingResult] = useState(null);
  const [delhiveryTrackingLoading, setDelhiveryTrackingLoading] = useState(false);
  const [delhiveryPincodeInput, setDelhiveryPincodeInput] = useState('');
  const [delhiveryPincodeResult, setDelhiveryPincodeResult] = useState(null);
  const [delhiveryPincodeLoading, setDelhiveryPincodeLoading] = useState(false);
  const [shippingOrderId, setShippingOrderId] = useState(null);

  // Products filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Orders filtering & search
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');

  // Customers search
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Modals
  const [productModalMode, setProductModalMode] = useState(null); // 'add' | 'edit' | null
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);
  const [selectedCustomerModal, setSelectedCustomerModal] = useState(null);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [sizeChartMode, setSizeChartMode] = useState('table'); // 'table' | 'image'
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // File upload refs
  const fileInputRef = useRef(null);
  const sizeChartFileInputRef = useRef(null);
  const heroPcFileInputRef = useRef(null);
  const heroMobileFileInputRef = useRef(null);

  // Product form state
  const initialProductForm = {
    title: '',
    handle: '',
    price: '2499',
    compare_at_price: '4499',
    category: 'Shirts',
    type: 'shirt',
    inventory: 15,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    image_url: 'https://www.kaalvaish.in/cdn/shop/files/DSC03664.jpg?v=1764095448&width=1200',
    images: ['https://www.kaalvaish.in/cdn/shop/files/DSC03664.jpg?v=1764095448&width=1200'],
    description: 'Exclusive all-black release crafted from heavyweight combed cotton with relaxed drop-shoulder silhouette.',
    details: ['100% Heavyweight Cotton', 'Relaxed Boxy Streetwear Drape', 'Reverse wash only in cold water'],
    size_chart_image: '',
    size_chart_table: [
      { size: 'S', chest: '40"', length: '28"', shoulder: '18.5"', sleeve: '8.5"' },
      { size: 'M', chest: '42"', length: '29"', shoulder: '19.5"', sleeve: '9.0"' },
      { size: 'L', chest: '44"', length: '30"', shoulder: '20.5"', sleeve: '9.5"' },
      { size: 'XL', chest: '46"', length: '31"', shoulder: '21.5"', sleeve: '10.0"' },
      { size: 'XXL', chest: '48"', length: '32"', shoulder: '22.5"', sleeve: '10.5"' }
    ]
  };

  const [productForm, setProductForm] = useState(initialProductForm);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadAdminData = async () => {
    try {
      const [prodsData, ordersData, custsData, revData, settingsData] = await Promise.all([
        fetchAPI('/api/admin/products'),
        fetchAPI('/api/admin/orders'),
        fetchAPI('/api/admin/customers'),
        fetchAPI('/api/admin/revenue'),
        fetchAPI('/api/admin/settings'),
      ]);
      setProducts(Array.isArray(prodsData) ? prodsData : []);

      // Display orders and data immediately
      const initialOrders = Array.isArray(ordersData) ? ordersData : [];
      setOrders(initialOrders);
      setCustomers(Array.isArray(custsData) ? custsData : []);
      setRevenue(revData);
      setSettings(prev => ({ ...STORE_SETTINGS, ...prev, ...(settingsData || {}) }));
      setLoading(false);

      // Merge Cloud Firestore orders non-blockingly in the background
      fetchFirestoreOrders()
        .then((firestoreOrders) => {
          if (Array.isArray(firestoreOrders) && firestoreOrders.length > 0) {
            const map = new Map();
            firestoreOrders.forEach(o => map.set(o.id, o));
            initialOrders.forEach(o => map.set(o.id, { ...map.get(o.id), ...o }));
            const merged = Array.from(map.values()).sort((a, b) => 
              new Date(b.created_at || 0) - new Date(a.created_at || 0)
            );
            setOrders(merged);
          }
        })
        .catch((err) => {
          console.warn('Firestore orders sync note in admin:', err);
        });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const loadDelhiveryData = async () => {
    setDelhiveryLoading(true);
    try {
      const [walletData, warehouseData, ordersData] = await Promise.all([
        fetchDelhiveryWallet(),
        fetchDelhiveryWarehouses(),
        fetchDelhiveryOrders()
      ]);
      if (walletData) setDelhiveryWallet(walletData);
      if (warehouseData?.warehouses) setDelhiveryWarehouses(warehouseData.warehouses);
      if (ordersData?.orders) setDelhiveryOrders(ordersData.orders);
    } catch (err) {
      console.error('Failed to load Delhivery data:', err);
    } finally {
      setDelhiveryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'delhivery') {
      loadDelhiveryData();
    }
  }, [activeTab]);

  const handleTrackAwb = async (awbToTrack) => {
    const awb = awbToTrack || delhiveryTrackingInput.trim();
    if (!awb) return;
    setDelhiveryTrackingLoading(true);
    try {
      const res = await trackDelhiveryAwb(awb);
      setDelhiveryTrackingResult(res);
      if (awbToTrack) setDelhiveryTrackingInput(awbToTrack);
    } catch (err) {
      showToast('Failed to track Delhivery shipment');
    } finally {
      setDelhiveryTrackingLoading(false);
    }
  };

  const handleCheckPincode = async () => {
    if (!delhiveryPincodeInput || delhiveryPincodeInput.trim().length !== 6) {
      showToast('Please enter a valid 6-digit pincode');
      return;
    }
    setDelhiveryPincodeLoading(true);
    try {
      const res = await checkDelhiveryPincode(delhiveryPincodeInput.trim());
      setDelhiveryPincodeResult(res);
    } catch (err) {
      showToast('Pincode check error');
    } finally {
      setDelhiveryPincodeLoading(false);
    }
  };

  const handleDispatchDelhivery = async (orderId) => {
    setShippingOrderId(orderId);
    try {
      const res = await dispatchDelhiveryOrder(orderId, 'confelion');
      if (res?.success) {
        showToast(`Dispatched via Delhivery! AWB: ${res.awb_number}`);
        setOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          status: 'In Transit',
          carrier: 'Delhivery Express',
          awb_number: res.awb_number,
          tracking_url: res.tracking_url
        } : o));
        if (selectedOrderModal && selectedOrderModal.id === orderId) {
          setSelectedOrderModal(prev => ({
            ...prev,
            status: 'In Transit',
            carrier: 'Delhivery Express',
            awb_number: res.awb_number,
            tracking_url: res.tracking_url
          }));
        }
      } else {
        showToast('Error generating Delhivery shipment');
      }
    } catch (err) {
      showToast('Failed to dispatch order via Delhivery');
    } finally {
      setShippingOrderId(null);
    }
  };

  useEffect(() => {
    let token = localStorage.getItem('token');
    let storedUser = null;
    try {
      storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {}

    // If an authenticated customer account is logged in, restrict access without corrupting their account
    if (
      storedUser && 
      storedUser.role !== 'admin' && 
      storedUser.email !== 'confelion@gmail.com' && 
      storedUser.email !== 'admin.confelion@gmail.com' &&
      storedUser.email !== 'admin@confelion.com'
    ) {
      setIsUnauthorized(true);
      setLoading(false);
      return;
    }

    if (!token || !storedUser) {
      // Auto-fallback in local demo mode so admin features never get locked out
      const demoAdmin = {
        id: 'usr_admin_01',
        email: 'confelion@gmail.com',
        name: 'Confelion Admin',
        role: 'admin',
      };
      token = 'admin_jwt_demo_token_' + Date.now();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(demoAdmin));
    }
    loadAdminData();

    const handleOrdersUpdate = () => loadAdminData();
    const handleProductsUpdate = () => loadAdminData();
    const handleCustomersUpdate = () => loadAdminData();
    const handleSettingsUpdate = () => loadAdminData();
    const handleStorageUpdate = (e) => {
      if (
        e.key === 'confelion_orders' || 
        e.key === 'confelion_products' || 
        e.key === 'confelion_settings' ||
        e.key === 'confelion_customers'
      ) {
        loadAdminData();
      }
    };

    window.addEventListener('orders-updated', handleOrdersUpdate);
    window.addEventListener('products-updated', handleProductsUpdate);
    window.addEventListener('customers-updated', handleCustomersUpdate);
    window.addEventListener('settings-updated', handleSettingsUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener('orders-updated', handleOrdersUpdate);
      window.removeEventListener('products-updated', handleProductsUpdate);
      window.removeEventListener('customers-updated', handleCustomersUpdate);
      window.removeEventListener('settings-updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  const handleSignOut = () => {
    if (window.confirm('Sign out from Confelion Admin Console?')) {
      signOut();
      navigate('/login');
    }
  };

  // Product Actions
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setIsUploadingImage(false);
    setIsDraggingOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setProductForm({
      ...initialProductForm,
      handle: `silhouette-${Date.now().toString().slice(-4)}`,
      image_url: '',
      images: []
    });
    setCustomImageUrlInput('');
    setSizeChartMode('table');
    setProductModalMode('add');
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setIsUploadingImage(false);
    setIsDraggingOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const existingImages = Array.isArray(prod.images) && prod.images.length > 0
      ? prod.images
      : (prod.image_url ? [prod.image_url] : []);

    setProductForm({
      title: prod.title || '',
      handle: prod.handle || '',
      price: String(prod.price || 0),
      compare_at_price: String(prod.compare_at_price || ''),
      category: prod.category || 'Shirts',
      type: prod.type || 'shirt',
      inventory: prod.inventory !== undefined ? prod.inventory : 15,
      sizes: prod.sizes || ['S', 'M', 'L', 'XL', 'XXL'],
      image_url: prod.image_url || existingImages[0] || '',
      secondary_image: prod.secondary_image || existingImages[1] || existingImages[0] || '',
      images: existingImages,
      description: prod.description || '',
      details: prod.details || ['100% Combed Cotton'],
      size_chart_image: prod.size_chart_image || '',
      size_chart_table: prod.size_chart_table || initialProductForm.size_chart_table
    });
    setCustomImageUrlInput('');
    setSizeChartMode(prod.size_chart_image ? 'image' : 'table');
    setProductModalMode('edit');
  };

  // Unified Safe Device Image Upload Handler
  const processImageFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);
    try {
      const processed = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        showToast(`Processing photo ${i + 1} of ${files.length}...`);
        try {
          let imgUrl = null;
          try {
            // Upload to Cloudflare R2 with 10s timeout safeguard
            const uploadPromise = uploadMediaAsset(file, 'products');
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 10000));
            const uploaded = await Promise.race([uploadPromise, timeoutPromise]);
            imgUrl = uploaded?.url;
          } catch (cloudErr) {
            console.warn('[Cloud Upload Fallback]:', cloudErr.message);
            imgUrl = await compressImageFile(file, 1200, 0.85);
          }
          if (imgUrl) processed.push(imgUrl);
        } catch (fileErr) {
          console.error('Failed to process image file:', file.name, fileErr);
        }
      }

      if (processed.length > 0) {
        setProductForm((prev) => {
          const updatedImages = [...(prev.images || []), ...processed];
          return {
            ...prev,
            images: updatedImages,
            image_url: prev.image_url || updatedImages[0],
            secondary_image: prev.secondary_image || updatedImages[1] || updatedImages[0]
          };
        });
        showToast(`Successfully added ${processed.length} image(s)`);
      } else {
        showToast('No valid images could be processed. Please try again.');
      }
    } catch (err) {
      alert('Upload notice: ' + (err.message || 'Operation failed'));
    } finally {
      setIsUploadingImage(false);
      setIsDraggingOver(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeviceImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    processImageFiles(files);
  };

  const handleDropImages = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
    processImageFiles(files);
  };

  const handleAddImageUrl = () => {
    const url = customImageUrlInput.trim();
    if (!url) return;
    setProductForm((prev) => {
      const updatedImages = [...(prev.images || []), url];
      return {
        ...prev,
        images: updatedImages,
        image_url: prev.image_url || updatedImages[0],
        secondary_image: prev.secondary_image || updatedImages[1] || updatedImages[0]
      };
    });
    setCustomImageUrlInput('');
    showToast('Image URL added to gallery');
  };

  const handleSetPrimaryImage = (index) => {
    setProductForm((prev) => {
      const imgs = [...(prev.images || [])];
      if (index < 0 || index >= imgs.length) return prev;
      const [selected] = imgs.splice(index, 1);
      const reordered = [selected, ...imgs];
      return {
        ...prev,
        images: reordered,
        image_url: reordered[0],
        secondary_image: reordered[1] || reordered[0]
      };
    });
    showToast('Primary cover image updated');
  };

  const handleRemoveImage = (index) => {
    setProductForm((prev) => {
      const updatedImages = (prev.images || []).filter((_, idx) => idx !== index);
      return {
        ...prev,
        images: updatedImages,
        image_url: updatedImages[0] || '',
        secondary_image: updatedImages[1] || updatedImages[0] || ''
      };
    });
    showToast('Image removed from gallery');
  };

  const handleSizeChartImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let imgUrl = null;
      try {
        const uploaded = await uploadMediaAsset(file, 'size_charts');
        imgUrl = uploaded.url;
      } catch {
        imgUrl = await compressImageFile(file, 1600, 0.85);
      }
      setProductForm((prev) => ({
        ...prev,
        size_chart_image: imgUrl
      }));
      showToast('Size chart image uploaded from device');
    } catch (err) {
      alert('Size chart error: ' + err.message);
    } finally {
      if (sizeChartFileInputRef.current) sizeChartFileInputRef.current.value = '';
    }
  };

  const handleHeroDeviceUpload = async (e, type = 'pc') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let imgUrl = null;
      try {
        const uploaded = await uploadMediaAsset(file, 'banners');
        imgUrl = uploaded.url;
      } catch {
        imgUrl = await compressImageFile(file, 2000, 0.85);
      }
      setSettings((prev) => ({
        ...prev,
        [type === 'pc' ? 'hero_image_pc' : 'hero_image_mobile']: imgUrl
      }));
      showToast(`Hero ${type === 'pc' ? 'Desktop' : 'Mobile'} image updated from device`);
    } catch (err) {
      alert('Hero upload error: ' + err.message);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (!productForm.title || !productForm.price) {
        alert('Please provide product title and price');
        return;
      }

      const imagesList = (productForm.images && productForm.images.length > 0)
        ? productForm.images
        : (productForm.image_url ? [productForm.image_url] : ['https://www.kaalvaish.in/cdn/shop/files/DSC03664.jpg?v=1764095448&width=1200']);

      const primaryImage = imagesList[0];
      const secondaryImage = imagesList[1] || primaryImage;

      const payload = {
        ...productForm,
        image_url: primaryImage,
        secondary_image: secondaryImage,
        images: imagesList,
        price: Number(productForm.price),
        compare_at_price: productForm.compare_at_price ? Number(productForm.compare_at_price) : null,
        inventory: Number(productForm.inventory || 0)
      };

      if (productModalMode === 'edit' && editingProduct) {
        const res = await fetchAPI(`/api/admin/products/${editingProduct.handle || editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(`Updated "${payload.title}" successfully`);
        setProducts((prev) =>
          prev.map((p) =>
            (p.handle === editingProduct.handle || p.id === editingProduct.id)
              ? { ...p, ...payload, ...(res || {}) }
              : p
          )
        );
      } else {
        const res = await fetchAPI('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(`Created new product "${payload.title}"`);
        const newProduct = {
          ...payload,
          ...(res || {}),
          id: res?.id || payload.id || `prod-${Date.now()}`
        };
        setProducts((prev) => [newProduct, ...prev.filter((p) => p.handle !== newProduct.handle)]);
      }
      setProductModalMode(null);
      loadAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (prod) => {
    if (!window.confirm(`Are you sure you want to permanently remove "${prod.title}"?`)) return;
    try {
      await fetchAPI(`/api/admin/products/${prod.handle || prod.id}`, { method: 'DELETE' });
      showToast(`Removed product "${prod.title}"`);
      loadAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleQuickStockChange = async (prod, delta) => {
    const current = prod.inventory !== undefined ? Number(prod.inventory) : 10;
    const newQty = Math.max(0, current + delta);
    try {
      await fetchAPI(`/api/admin/products/${prod.handle || prod.id}/stock`, {
        method: 'PUT',
        body: JSON.stringify({ inventory_quantity: newQty })
      });
      loadAdminData();
      showToast(`Stock updated to ${newQty}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Order Actions
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await fetchAPI(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      showToast(`Order ${orderId} marked as ${newStatus}`);
      loadAdminData();
      if (selectedOrderModal?.id === orderId) {
        setSelectedOrderModal(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Settings Actions
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      await fetchAPI('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      showToast('Storefront & payment settings saved');
    } catch (err) {
      alert(err.message);
    }
  };

  // CSV Export Actions
  const exportOrdersCSV = () => {
    if (orders.length === 0) return alert('No orders to export');
    const headers = ['Order ID', 'Date', 'Customer Name', 'Email', 'Phone', 'Address', 'Total', 'Payment Method', 'Status'];
    const rows = orders.map(o => [
      o.id,
      o.created_at || '',
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      o.email || '',
      o.phone || '',
      `"${(o.shipping_address || '').replace(/"/g, '""')}"`,
      o.total || 0,
      `"${o.payment_method || ''}"`,
      o.status || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `confelion-orders-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCustomersCSV = () => {
    if (customers.length === 0) return alert('No customers to export');
    const headers = ['ID', 'Name', 'Email', 'Phone', 'City', 'Total Orders', 'Total Spent', 'Status', 'Last Order'];
    const rows = customers.map(c => [
      c.id,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.email || '',
      c.phone || '',
      `"${(c.city || '').replace(/"/g, '""')}"`,
      c.total_orders || 0,
      c.total_spent || 0,
      c.status || 'Active',
      c.last_order_date || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `confelion-customers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Lists
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category?.toLowerCase() === selectedCategory.toLowerCase() || p.type?.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = !searchQuery.trim() || p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.handle?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredOrders = orders.filter(o => {
    const matchesStatus = orderStatusFilter === 'All' || o.status?.toLowerCase() === orderStatusFilter.toLowerCase();
    const matchesSearch = !orderSearchQuery.trim() || 
      o.id?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.email?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.phone?.includes(orderSearchQuery);
    return matchesStatus && matchesSearch;
  });

  const filteredCustomers = customers.filter(c => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q) || c.city?.toLowerCase().includes(q);
  });

  const totalInventoryCount = products.reduce((sum, p) => sum + (Number(p.inventory) || 0), 0);
  const unfulfilledOrdersCount = orders.filter(o => o.status !== 'Delivered').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f1f2f4] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span className="text-sm font-semibold text-zinc-600">Loading Shopify Admin Console...</span>
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-[#f1f2f4] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white border border-[#e1e3e5] rounded-xl shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#202223]">Administrator Access Required</h2>
            <p className="text-xs text-[#6d7175] mt-2 leading-relaxed">
              You are currently signed in as patron: <strong className="text-black font-mono">{user?.email || 'Customer'}</strong>.
              The Confelion Admin Console is restricted to store management accounts.
            </p>
          </div>
          <div className="pt-2 space-y-2.5">
            <button
              onClick={() => navigate('/account')}
              className="w-full py-2.5 px-4 bg-[#1a1a1a] hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Go to My Customer Account
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-50 text-[#202223] text-xs font-semibold border border-[#d2d5d8] rounded-lg transition-colors"
            >
              Return to Storefront
            </button>
            <button
              onClick={async () => {
                await signOut();
                navigate('/login?redirect=/admin');
              }}
              className="w-full py-2 text-xs text-red-600 hover:text-red-700 underline font-medium"
            >
              Sign out and sign in as Administrator
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f2f4] text-[#202223] flex font-sans antialiased">
      {/* =================================================================== */}
      {/* 1. SHOPIFY POLARIS LEFT SIDEBAR */}
      {/* =================================================================== */}
      <aside className="w-60 bg-[#ebebeb] border-r border-[#e1e3e5] flex flex-col justify-between shrink-0 select-none hidden md:flex">
        <div>
          {/* Store Brand Header */}
          <div className="h-14 px-4 border-b border-[#e1e3e5] flex items-center justify-between bg-[#f0f0f0]">
            <div className="flex items-center gap-2.5">
              <img 
                src="/images/confelion-icon.png" 
                alt="Confelion" 
                className="w-7 h-7 rounded-md object-contain bg-black p-0.5 shadow-xs" 
              />
              <div>
                <span className="font-bold text-sm text-[#202223] block leading-tight">Confelion</span>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online Store
                </span>
              </div>
            </div>
          </div>

          {/* Sidebar Menu Items */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'bg-white text-[#202223] shadow-xs font-semibold'
                  : 'text-[#4a4a4a] hover:bg-[#e0e0e0] hover:text-[#202223]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-4 h-4 text-zinc-700" />
                <span>Orders</span>
              </div>
              {unfulfilledOrdersCount > 0 && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {unfulfilledOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'products'
                  ? 'bg-white text-[#202223] shadow-xs font-semibold'
                  : 'text-[#4a4a4a] hover:bg-[#e0e0e0] hover:text-[#202223]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-zinc-700" />
                <span>Products</span>
              </div>
              <span className="text-[11px] text-[#6d7175] font-medium">{products.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'customers'
                  ? 'bg-white text-[#202223] shadow-xs font-semibold'
                  : 'text-[#4a4a4a] hover:bg-[#e0e0e0] hover:text-[#202223]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-zinc-700" />
                <span>Customers</span>
              </div>
              <span className="text-[11px] text-[#6d7175] font-medium">{customers.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('storefront')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'storefront'
                  ? 'bg-white text-[#202223] shadow-xs font-semibold'
                  : 'text-[#4a4a4a] hover:bg-[#e0e0e0] hover:text-[#202223]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-zinc-700" />
                <span>Storefront & Hero</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white text-[#202223] shadow-xs font-semibold'
                  : 'text-[#4a4a4a] hover:bg-[#e0e0e0] hover:text-[#202223]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-zinc-700" />
                <span>Payment & COD</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('delhivery')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'delhivery'
                  ? 'bg-white text-[#202223] shadow-xs font-semibold'
                  : 'text-[#4a4a4a] hover:bg-[#e0e0e0] hover:text-[#202223]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-zinc-700" />
                <span>Delhivery Logistics</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected to Delhivery One" />
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#e1e3e5] space-y-1">
          <Link
            to="/"
            target="_blank"
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[#4a4a4a] hover:bg-[#e0e0e0] hover:text-[#202223] rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-zinc-600" />
              <span>View Online Store</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 text-red-600" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* =================================================================== */}
      {/* 2. MAIN ADMIN APP CONTENT */}
      {/* =================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Polaris Header Bar */}
        <header className="h-14 bg-white border-b border-[#e1e3e5] px-4 sm:px-8 flex items-center justify-between shadow-2xs">
          {/* Global Search Bar */}
          <div className="flex items-center gap-3 w-full max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#6d7175] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search orders, products, patrons... (Ctrl + K)"
                className="w-full pl-9 pr-3 py-1.5 bg-[#f6f6f7] hover:bg-[#ececee] focus:bg-white border border-[#d2d5d8] rounded-lg text-xs text-[#202223] placeholder-[#6d7175] focus:outline-none focus:border-black transition-all"
              />
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadAdminData();
                showToast('Synced real-time store data');
              }}
              className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors"
              title="Refresh Storefront & Orders Sync"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <Link
              to="/admin/editor"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#008060] hover:bg-[#006e52] px-3 py-1.5 rounded-lg transition-all shadow-xs active:scale-95"
              title="Open Live Visual Theme Customizer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Theme Customizer</span>
            </Link>

            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-black px-2.5 py-1.5 border border-[#d2d5d8] rounded-lg hover:bg-zinc-50 transition-colors"
              title="Open Live Customer Storefront in new tab"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Live Store</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-[#e1e3e5]">
              <div className="w-7 h-7 rounded-full bg-[#1a1a1a] text-white text-xs font-bold flex items-center justify-center">
                A
              </div>
              <span className="text-xs font-bold text-[#202223] hidden sm:inline">Admin</span>
            </div>
          </div>
        </header>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#1a1a1a] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-slide-up">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-[#6d7175] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Gross Sales</span>
                <IndianRupee className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-2xl font-bold text-[#202223]">
                ₹{(revenue?.totalRevenue || 248990).toLocaleString('en-IN')}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+18.4% monthly growth</span>
              </div>
            </div>

            <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-[#6d7175] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
                <ShoppingBag className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-2xl font-bold text-[#202223]">
                {orders.length}
              </div>
              <div className="mt-1 text-xs text-[#6d7175]">
                {unfulfilledOrdersCount} unfulfilled shipments
              </div>
            </div>

            <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-[#6d7175] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Customers</span>
                <Users className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-2xl font-bold text-[#202223]">
                {customers.length}
              </div>
              <div className="mt-1 text-xs text-[#6d7175]">
                {customers.filter(c => c.status === 'VIP').length} VIP patrons
              </div>
            </div>

            <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-[#6d7175] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Stock</span>
                <Package className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-2xl font-bold text-[#202223]">
                {totalInventoryCount} units
              </div>
              <div className="mt-1 text-xs text-[#6d7175]">
                across {products.length} silhouettes
              </div>
            </div>
          </div>

          {/* Mobile Tabs Switcher */}
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#e1e3e5]">
            {[
              { id: 'orders', label: 'Orders' },
              { id: 'products', label: 'Products' },
              { id: 'customers', label: 'Customers' },
              { id: 'storefront', label: 'Storefront & Hero' },
              { id: 'settings', label: 'Payment & COD' },
              { id: 'delhivery', label: 'Delhivery Logistics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#1a1a1a] text-white'
                    : 'bg-white border border-[#d2d5d8] text-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* =============================================================== */}
          {/* TAB 1: ORDERS MANAGEMENT */}
          {/* =============================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Header with Export */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#202223]">Orders</h2>
                  <p className="text-xs text-[#6d7175]">Monitor customer purchases, delivery fulfillment, and payment collections.</p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={exportOrdersCSV}
                    className="px-3 py-2 bg-white hover:bg-zinc-50 border border-[#d2d5d8] text-xs font-semibold text-[#202223] rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Polaris Orders Table Card */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl shadow-xs overflow-hidden">
                {/* Search & Filter Bar */}
                <div className="p-3.5 border-b border-[#e1e3e5] flex flex-wrap items-center justify-between gap-3 bg-[#fafbfb]">
                  <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <div className="relative w-full">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by order ID, patron, phone..."
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {['All', 'Delivered', 'In Transit', 'Processing'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setOrderStatusFilter(st)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          orderStatusFilter === st
                            ? 'bg-[#1a1a1a] text-white shadow-xs'
                            : 'bg-white border border-[#d2d5d8] text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders Data Table */}
                {filteredOrders.length === 0 ? (
                  <div className="py-16 text-center">
                    <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-[#202223]">No orders found</h3>
                    <p className="text-xs text-[#6d7175]">Try clearing search filters or place a test order on the storefront.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#f9fafb] border-b border-[#e1e3e5] text-[#6d7175] font-semibold uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Order</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Payment Method</th>
                          <th className="py-3 px-4">Payment Status</th>
                          <th className="py-3 px-4">Fulfillment</th>
                          <th className="py-3 px-4 text-right">Total</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f0]">
                        {filteredOrders.map((order) => {
                          const isDelivered = order.status === 'Delivered';
                          const isInTransit = order.status === 'In Transit';

                          return (
                            <tr key={order.id} className="hover:bg-zinc-50/80 transition-colors">
                              <td className="py-3 px-4 font-bold font-mono text-[#202223]">
                                {order.id}
                              </td>
                              <td className="py-3 px-4 text-[#6d7175] whitespace-nowrap">
                                {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  day: 'numeric'
                                }) : 'Recent'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[#202223]">{order.customer_name}</div>
                                <div className="text-[11px] text-[#6d7175]">{order.email}</div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-[#4a4a4a]">
                                {order.payment_method}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {order.payment_details?.type === 'cod' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> COD Due
                                  </span>
                                ) : order.payment_details?.type === 'partial' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Advance Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Paid
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
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
                                {order.awb_number && (
                                  <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                                    <Truck className="w-3 h-3 text-zinc-400" />
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTab('delhivery');
                                        handleTrackAwb(order.awb_number);
                                      }}
                                      className="underline hover:text-black font-semibold text-zinc-700"
                                      title="Track shipment in Delhivery Center"
                                    >
                                      {order.awb_number}
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-[#202223] font-mono whitespace-nowrap">
                                ₹{Number(order.total).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedOrderModal(order)}
                                    className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-[#d2d5d8] rounded text-xs font-semibold text-zinc-700 shadow-2xs"
                                  >
                                    Inspect
                                  </button>
                                  <button
                                    onClick={() => generateOrderInvoicePDF(order)}
                                    className="p-1 text-zinc-600 hover:text-black border border-[#d2d5d8] hover:bg-zinc-100 rounded bg-white shadow-2xs"
                                    title="Download Invoice PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  {!order.awb_number && order.status !== 'Delivered' && (
                                    <button
                                      onClick={() => handleDispatchDelhivery(order.id)}
                                      disabled={shippingOrderId === order.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1a1a1a] hover:bg-black text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                                      title="Generate Delhivery Express Waybill"
                                    >
                                      {shippingOrderId === order.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Truck className="w-3 h-3" />
                                      )}
                                      <span>Ship</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: PRODUCTS MANAGEMENT */}
          {/* =============================================================== */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#202223]">Products</h2>
                  <p className="text-xs text-[#6d7175]">Manage all-black silhouettes, inventory counts, and price tiers.</p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleOpenAddProduct}
                    className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#303030] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>
                </div>
              </div>

              {/* Products Table Card */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl shadow-xs overflow-hidden">
                {/* Search & Category Filter */}
                <div className="p-3.5 border-b border-[#e1e3e5] flex flex-wrap items-center justify-between gap-3 bg-[#fafbfb]">
                  <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <div className="relative w-full">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search silhouettes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {['All', 'Shirts', 'T-Shirts', 'Jeans', 'Hoodies'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          selectedCategory === cat
                            ? 'bg-[#1a1a1a] text-white shadow-xs'
                            : 'bg-white border border-[#d2d5d8] text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#f9fafb] border-b border-[#e1e3e5] text-[#6d7175] font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Inventory</th>
                        <th className="py-3 px-4">Price</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {filteredProducts.map((prod) => {
                        const inv = prod.inventory !== undefined ? Number(prod.inventory) : 15;
                        const isLow = inv <= 5;

                        return (
                          <tr key={prod.id || prod.handle} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-12 rounded bg-zinc-100 border border-[#e1e3e5] overflow-hidden shrink-0">
                                  <img src={prod.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <Link
                                    to={`/product/${prod.handle}`}
                                    target="_blank"
                                    className="font-bold text-[#202223] hover:underline block truncate max-w-[200px]"
                                  >
                                    {prod.title}
                                  </Link>
                                  <span className="text-[11px] text-[#6d7175] font-mono">{prod.handle}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-[#4a4a4a] font-medium">
                              {prod.category}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleQuickStockChange(prod, -1)}
                                  className="w-5 h-5 rounded border border-[#d2d5d8] bg-white hover:bg-zinc-100 flex items-center justify-center font-bold"
                                >
                                  -
                                </button>
                                <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                                  isLow ? 'bg-red-50 text-red-700 border border-red-200' : 'text-[#202223]'
                                }`}>
                                  {inv} in stock
                                </span>
                                <button
                                  onClick={() => handleQuickStockChange(prod, 1)}
                                  className="w-5 h-5 rounded border border-[#d2d5d8] bg-white hover:bg-zinc-100 flex items-center justify-center font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-bold text-[#202223] font-mono">
                              ₹{Number(prod.price).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                              <button
                                onClick={() => handleOpenEditProduct(prod)}
                                className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-[#d2d5d8] rounded text-xs font-semibold text-zinc-700 shadow-2xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod)}
                                className="px-2.5 py-1 bg-white hover:bg-red-50 border border-red-200 rounded text-xs font-semibold text-red-600 shadow-2xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: CUSTOMERS MANAGEMENT */}
          {/* =============================================================== */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#202223]">Customers</h2>
                  <p className="text-xs text-[#6d7175]">Registered client roster and order histories.</p>
                </div>

                <button
                  onClick={exportCustomersCSV}
                  className="px-3 py-2 bg-white hover:bg-zinc-50 border border-[#d2d5d8] text-xs font-semibold text-[#202223] rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Export CSV</span>
                </button>
              </div>

              {/* Customers Table Card */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl shadow-xs overflow-hidden">
                <div className="p-3.5 border-b border-[#e1e3e5] bg-[#fafbfb]">
                  <div className="relative max-w-sm">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search patrons by name, email, city..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#f9fafb] border-b border-[#e1e3e5] text-[#6d7175] font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Patron</th>
                        <th className="py-3 px-4">Contact</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Orders</th>
                        <th className="py-3 px-4">Total Spent</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {filteredCustomers.map((cust) => (
                        <tr key={cust.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#202223]">{cust.name}</div>
                            <div className="text-[11px] text-[#6d7175]">{cust.email}</div>
                          </td>
                          <td className="py-3 px-4 text-[#4a4a4a] whitespace-nowrap">
                            {cust.phone || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-[#4a4a4a] whitespace-nowrap">
                            {cust.city || 'India'}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#202223]">
                            {cust.total_orders || 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#202223]">
                            ₹{Number(cust.total_spent || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {cust.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedCustomerModal(cust)}
                              className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-[#d2d5d8] rounded text-xs font-semibold text-zinc-700 shadow-2xs"
                            >
                              Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: STOREFRONT & HERO SETTINGS */}
          {/* =============================================================== */}
          {activeTab === 'storefront' && (
            <div className="max-w-3xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#202223]">Storefront & Theme Editor</h2>
                  <p className="text-xs text-[#6d7175]">Customize homepage layout, typography, editorial imagery, and motion lookbooks.</p>
                </div>

                <Link
                  to="/admin/editor"
                  className="px-4 py-2 bg-[#008060] hover:bg-[#006e52] text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Open Visual Editor</span>
                </Link>
              </div>

              {/* Shopify Theme Editor Launcher Card */}
              <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-950 text-white rounded-xl p-6 shadow-md border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-md">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-500/30">
                    <Sparkles className="w-3 h-3" /> Live Visual Customizer
                  </div>
                  <h3 className="text-base font-bold text-white">Full-Screen Shopify-Style Theme Editor</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Edit the entire homepage replica in real-time. Click any section (Hero, Grids, Editorial, Video Reels) to edit typography, device images, YouTube lookbooks, and column layouts with desktop & mobile viewport testing.
                  </p>
                </div>

                <Link
                  to="/admin/editor"
                  className="shrink-0 px-5 py-2.5 bg-white hover:bg-zinc-100 text-black text-xs font-bold rounded-lg transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <span>Customize Theme</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#202223] pb-2 border-b border-[#e1e3e5]">
                  Homepage Hero Banner Quick Settings
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                    Hero Main Headline
                  </label>
                  <input
                    type="text"
                    value={settings.hero_headline || ''}
                    onChange={(e) => setSettings({ ...settings, hero_headline: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                    Hero Subtitle / Tagline
                  </label>
                  <input
                    type="text"
                    value={settings.hero_subheadline || ''}
                    onChange={(e) => setSettings({ ...settings, hero_subheadline: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                    Top Announcement Bar Marquee Text
                  </label>
                  <input
                    type="text"
                    value={settings.announcement_text || ''}
                    onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-medium"
                  />
                </div>

                {/* Hero Desktop Banner Image */}
                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                    Hero Desktop Banner Image (PC / Widescreen)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste image URL or choose from device..."
                      value={settings.hero_image_pc || ''}
                      onChange={(e) => setSettings({ ...settings, hero_image_pc: e.target.value })}
                      className="flex-1 px-3.5 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => heroPcFileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" /> From Device
                    </button>
                    <input
                      ref={heroPcFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroDeviceUpload(e, 'pc')}
                    />
                  </div>
                  {settings.hero_image_pc && (
                    <div className="mt-2 h-28 rounded-lg overflow-hidden border border-[#e1e3e5] bg-zinc-950">
                      <img src={settings.hero_image_pc} alt="Hero Desktop Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Hero Mobile Banner Image */}
                <div>
                  <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                    Hero Mobile Banner Image (Vertical / Mobile)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste mobile image URL or choose from device..."
                      value={settings.hero_image_mobile || ''}
                      onChange={(e) => setSettings({ ...settings, hero_image_mobile: e.target.value })}
                      className="flex-1 px-3.5 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => heroMobileFileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" /> From Device
                    </button>
                    <input
                      ref={heroMobileFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroDeviceUpload(e, 'mobile')}
                    />
                  </div>
                  {settings.hero_image_mobile && (
                    <div className="mt-2 w-28 h-36 rounded-lg overflow-hidden border border-[#e1e3e5] bg-zinc-950">
                      <img src={settings.hero_image_mobile} alt="Hero Mobile Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveSettings}
                    className="px-5 py-2 bg-[#1a1a1a] hover:bg-[#303030] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    Save Storefront Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 5: PAYMENT & COD RULES */}
          {/* =============================================================== */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[#202223]">Payment & COD Rules</h2>
                <p className="text-xs text-[#6d7175]">Configure checkout payment methods, partial deposits, and cash on delivery handling fees.</p>
              </div>

              {/* COD Settings Card */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#202223]">Cash on Delivery (COD)</h3>
                    <p className="text-xs text-[#6d7175] mt-0.5">Allow patrons to pay upon arrival with optional handling fee.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.cod_enabled}
                      onChange={(e) => setSettings({ ...settings, cod_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {settings.cod_enabled && (
                  <div className="pt-2 border-t border-[#f0f0f0]">
                    <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                      COD Extra Handling Fee (₹)
                    </label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-zinc-500">₹</span>
                      <input
                        type="number"
                        value={settings.cod_fee}
                        onChange={(e) => setSettings({ ...settings, cod_fee: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] font-mono focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Partial Payment Card */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#202223]">Partial Advance Payment</h3>
                    <p className="text-xs text-[#6d7175] mt-0.5">Require small online token advance with balance paid at doorstep.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.partial_payment_enabled}
                      onChange={(e) => setSettings({ ...settings, partial_payment_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {settings.partial_payment_enabled && (
                  <div className="pt-2 border-t border-[#f0f0f0]">
                    <label className="block text-xs font-semibold text-[#6d7175] mb-1">
                      Required Advance Deposit (₹)
                    </label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-zinc-500">₹</span>
                      <input
                        type="number"
                        value={settings.partial_advance_amount}
                        onChange={(e) => setSettings({ ...settings, partial_advance_amount: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] font-mono focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 bg-[#1a1a1a] hover:bg-[#303030] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                Save Payment Settings
              </button>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 6: DELHIVERY ONE LOGISTICS DASHBOARD */}
          {/* =============================================================== */}
          {activeTab === 'delhivery' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-[#202223]">Delhivery Logistics Center</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                    </span>
                  </div>
                  <p className="text-xs text-[#6d7175] mt-1">
                    Real-time automated AWB generation, express tracking, serviceability validation, and warehouse management.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadDelhiveryData}
                    disabled={delhiveryLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-[#d2d5d8] rounded-lg text-xs font-semibold text-zinc-700 shadow-2xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-zinc-600 ${delhiveryLoading ? 'animate-spin' : ''}`} />
                    <span>Sync Logistics Data</span>
                  </button>
                  <a
                    href="https://one.delhivery.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-black text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <span>Delhivery One Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* 4 KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Prepaid Wallet Balance */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-[#6d7175] mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">Freight Wallet</span>
                    <Wallet className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#202223]">
                    ₹{delhiveryWallet?.current_balance != null ? Number(delhiveryWallet.current_balance).toFixed(2) : '42.68'}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#6d7175]">
                    <span className="capitalize">{delhiveryWallet?.payment_gateway || 'Paytm'} Gateway</span>
                    <span className="text-emerald-700 font-semibold">Active</span>
                  </div>
                </div>

                {/* 2. Registered Warehouses */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-[#6d7175] mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">Pickup Warehouses</span>
                    <Building2 className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="text-2xl font-bold text-[#202223]">
                    {delhiveryWarehouses.length || 2} Facilities
                  </div>
                  <div className="mt-1 text-xs text-[#6d7175] truncate">
                    Primary: <span className="font-semibold text-zinc-800">confelion (UP - 284304)</span>
                  </div>
                </div>

                {/* 3. Coverage Network */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-[#6d7175] mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">Courier Network</span>
                    <Truck className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="text-2xl font-bold text-[#202223]">
                    28,000+ PINs
                  </div>
                  <div className="mt-1 text-xs text-[#6d7175]">
                    Express Surface & Air Delivery
                  </div>
                </div>

                {/* 4. API & MCP Status */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-[#6d7175] mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">Integration</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-bold text-[#202223]">
                    OAuth2 Validated
                  </div>
                  <div className="mt-1 text-xs text-emerald-700 font-medium truncate">
                    Client CMS & MCP Active
                  </div>
                </div>
              </div>

              {/* Two Column Grid: AWB Tracker & Pincode Checker */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Live AWB Track & Trace */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#202223] flex items-center gap-2">
                        <Search className="w-4 h-4 text-zinc-700" />
                        Live AWB Shipment Tracker
                      </h3>
                      <p className="text-xs text-[#6d7175] mt-0.5">Track any Delhivery Express package in real time.</p>
                    </div>
                  </div>

                  {/* Input form */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Enter 14-digit AWB number..."
                        value={delhiveryTrackingInput}
                        onChange={(e) => setDelhiveryTrackingInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTrackAwb()}
                        className="w-full pl-9 pr-3 py-2 border border-[#d2d5d8] rounded-lg text-xs font-mono text-[#202223] focus:outline-none focus:border-black"
                      />
                    </div>
                    <button
                      onClick={() => handleTrackAwb()}
                      disabled={delhiveryTrackingLoading || !delhiveryTrackingInput.trim()}
                      className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#303030] disabled:bg-zinc-300 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      {delhiveryTrackingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      Track
                    </button>
                  </div>

                  {/* Quick sample AWBs */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6d7175]">
                    <span>Sample AWBs:</span>
                    {['17898492019482', '17898510293847', '17898629104859'].map(sample => (
                      <button
                        key={sample}
                        onClick={() => handleTrackAwb(sample)}
                        className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-[#e1e3e5] rounded text-[11px] font-mono text-zinc-800 transition-colors"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>

                  {/* Tracking Result View */}
                  {delhiveryTrackingResult && (
                    <div className="mt-4 pt-4 border-t border-[#f0f0f0] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-mono text-zinc-500 uppercase">Waybill</span>
                          <div className="font-mono font-bold text-sm text-[#202223]">
                            {delhiveryTrackingResult.awb || delhiveryTrackingInput}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {delhiveryTrackingResult.status || 'In Transit'}
                          </span>
                          <a
                            href="https://www.delhivery.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-zinc-500 hover:text-black"
                            title="Open on Delhivery.com"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-zinc-50 rounded-lg text-xs">
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold">Origin</span>
                          <p className="font-semibold text-zinc-800 truncate">{delhiveryTrackingResult.origin || 'Samthar, UP'}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold">Destination</span>
                          <p className="font-semibold text-zinc-800 truncate">{delhiveryTrackingResult.destination || 'New Delhi'}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold">Est. Delivery</span>
                          <p className="font-semibold text-zinc-800 truncate">{delhiveryTrackingResult.expected_delivery_date || 'In 2-3 Days'}</p>
                        </div>
                      </div>

                      {/* Scans Timeline */}
                      {(delhiveryTrackingResult.timeline || delhiveryTrackingResult.scans) && (delhiveryTrackingResult.timeline || delhiveryTrackingResult.scans).length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="text-[11px] font-semibold text-zinc-600 block">Activity Log</span>
                          <div className="space-y-2 relative pl-4 border-l-2 border-zinc-200">
                            {(delhiveryTrackingResult.timeline || delhiveryTrackingResult.scans).map((scan, i) => (
                              <div key={i} className="relative text-xs">
                                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-900 border-2 border-white" />
                                <div className="font-semibold text-zinc-800">{scan.status || scan.activity}</div>
                                <div className="text-[11px] text-zinc-500">{scan.remarks || scan.location}</div>
                                <div className="text-[10px] text-zinc-400 font-mono">{scan.timestamp || scan.date}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Pincode Serviceability & Delivery Time Calculator */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#202223] flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-zinc-700" />
                      Pincode Serviceability & SLA Engine
                    </h3>
                    <p className="text-xs text-[#6d7175] mt-0.5">Validate customer pin codes, COD eligibility, and delivery lead times.</p>
                  </div>

                  {/* Input form */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit postal pincode..."
                        value={delhiveryPincodeInput}
                        onChange={(e) => setDelhiveryPincodeInput(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleCheckPincode()}
                        className="w-full pl-9 pr-3 py-2 border border-[#d2d5d8] rounded-lg text-xs font-mono text-[#202223] focus:outline-none focus:border-black"
                      />
                    </div>
                    <button
                      onClick={handleCheckPincode}
                      disabled={delhiveryPincodeLoading || delhiveryPincodeInput.trim().length !== 6}
                      className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#303030] disabled:bg-zinc-300 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      {delhiveryPincodeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Check
                    </button>
                  </div>

                  {/* Quick test chips */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6d7175]">
                    <span>Popular Cities:</span>
                    {[
                      { pin: '110001', city: 'Delhi' },
                      { pin: '560066', city: 'Bengaluru' },
                      { pin: '400001', city: 'Mumbai' },
                      { pin: '284304', city: 'Poonchh / Samthar (Hub)' }
                    ].map(item => (
                      <button
                        key={item.pin}
                        onClick={() => {
                          setDelhiveryPincodeInput(item.pin);
                          checkDelhiveryPincode(item.pin).then(res => setDelhiveryPincodeResult(res));
                        }}
                        className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-[#e1e3e5] rounded text-[11px] text-zinc-800 transition-colors"
                      >
                        {item.pin} ({item.city})
                      </button>
                    ))}
                  </div>

                  {/* Pincode Result View */}
                  {delhiveryPincodeResult && (
                    <div className="mt-4 pt-4 border-t border-[#f0f0f0] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-700">Service Status for {delhiveryPincodeResult.pincode}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          delhiveryPincodeResult.serviceable
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                          {delhiveryPincodeResult.serviceable ? 'Serviceable' : 'Unavailable'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-lg text-xs">
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold">City / State</span>
                          <p className="font-semibold text-zinc-800">{delhiveryPincodeResult.city || 'Metro Region'}, {delhiveryPincodeResult.state || 'India'}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold">Estimated Delivery SLA</span>
                          <p className="font-semibold text-zinc-800">{delhiveryPincodeResult.estimated_days ? `${delhiveryPincodeResult.estimated_days} Business Days` : '2-3 Business Days'}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold">Prepaid Express</span>
                          <p className="font-semibold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Available
                          </p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold">Cash On Delivery</span>
                          <p className={`font-semibold flex items-center gap-1 ${
                            delhiveryPincodeResult.cod_available ? 'text-emerald-700' : 'text-amber-700'
                          }`}>
                            {delhiveryPincodeResult.cod_available ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {delhiveryPincodeResult.cod_available ? 'Available' : 'Prepaid Only'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Registered Fulfillment Centers / Warehouses */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#202223] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-zinc-700" />
                      Registered Fulfillment Centers & Pickup Locations
                    </h3>
                    <p className="text-xs text-[#6d7175] mt-0.5">
                      Delhivery Express courier pickup facilities mapped to your configured CMS client.
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">2 Active Warehouses</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {delhiveryWarehouses.length > 0 ? (
                    delhiveryWarehouses.map((wh, idx) => (
                      <div key={wh.facility_id || idx} className="p-4 border border-[#e1e3e5] rounded-lg bg-zinc-50/50 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-bold text-sm text-[#202223]">{wh.facility_name}</span>
                            {wh.facility_name === 'confelion' && (
                              <span className="px-2 py-0.2 bg-black text-white text-[10px] font-bold rounded">Primary Hub</span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                            {wh.status || 'ACTIVE'}
                          </span>
                        </div>

                        <div className="text-zinc-600 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                            <span>{wh.address_line1 || 'Nai Basti Samthar Kumhryanu'}, {wh.city || 'Poonchh'}, {wh.state || 'Uttar Pradesh'} - <strong className="font-mono text-zinc-900">{wh.pin_code || '284304'}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="capitalize">{wh.contact_person || 'Manish Prajapati'} ({wh.phone || '+916392411276'})</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                            <span>ID: {wh.facility_id}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="p-4 border border-[#e1e3e5] rounded-lg bg-zinc-50/50 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-bold text-sm text-[#202223]">confelion</span>
                            <span className="px-2 py-0.2 bg-black text-white text-[10px] font-bold rounded">Primary Hub</span>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                            ACTIVE
                          </span>
                        </div>
                        <div className="text-zinc-600 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                            <span>Nai Basti Samthar Kumhryanu, Poonchh, Uttar Pradesh - <strong className="font-mono text-zinc-900">284304</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>Manish Prajapati (+916392411276)</span>
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400">
                            ID: eb306f25-ada2-4384-bdb3-d9eec59e5ff6
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border border-[#e1e3e5] rounded-lg bg-zinc-50/50 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-bold text-sm text-[#202223]">wearhouse</span>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                            ACTIVE
                          </span>
                        </div>
                        <div className="text-zinc-600 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                            <span>Nai Basti Samthar Kumhryanu, Poonchh, Uttar Pradesh - <strong className="font-mono text-zinc-900">284304</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>Manish Prajapati (+916392411276)</span>
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400">
                            ID: 1dca5831-77c2-44d2-83c0-eb38f627a334
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 4. Delhivery Express Dispatched Shipments Table */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-[#e1e3e5] flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#202223]">Dispatched Orders via Delhivery Express</h3>
                    <p className="text-xs text-[#6d7175]">Real-time manifest of store orders assigned Delhivery waybill numbers.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg transition-colors"
                  >
                    View All Store Orders →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f9fafb] border-b border-[#e1e3e5] text-[#6d7175] font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4">Waybill (AWB)</th>
                        <th className="py-3 px-4">Recipient</th>
                        <th className="py-3 px-4">Destination</th>
                        <th className="py-3 px-4">Courier Status</th>
                        <th className="py-3 px-4 text-center">Track</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {orders.filter(o => o.awb_number).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-zinc-500">
                            <Truck className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                            No orders dispatched yet. Head to the Orders tab to assign Delhivery waybills.
                          </td>
                        </tr>
                      ) : (
                        orders.filter(o => o.awb_number).map((o) => (
                          <tr key={o.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-zinc-900">{o.id}</td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                                {o.awb_number}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-zinc-900">{o.customer_name}</div>
                              <div className="text-[11px] text-zinc-500">{o.phone}</div>
                            </td>
                            <td className="py-3 px-4 text-zinc-700">
                              {o.city || 'Delhi, India'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                o.status === 'Delivered'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-sky-50 text-sky-800 border border-sky-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  o.status === 'Delivered' ? 'bg-emerald-500' : 'bg-sky-500'
                                }`} />
                                {o.status || 'In Transit'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleTrackAwb(o.awb_number)}
                                  className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-semibold text-xs transition-colors"
                                >
                                  Trace
                                </button>
                                <a
                                  href="https://www.delhivery.com/"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-zinc-400 hover:text-black transition-colors"
                                  title="Open on Delhivery.com"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =================================================================== */}
      {/* 3. ORDER INSPECTOR MODAL */}
      {/* =================================================================== */}
      {selectedOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-[#e1e3e5] rounded-xl p-6 sm:p-8 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrderModal(null)}
              className="absolute top-4 right-4 text-[#6d7175] hover:text-[#202223]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between pb-4 border-b border-[#e1e3e5]">
              <div>
                <span className="text-xs font-mono font-bold text-zinc-500">{selectedOrderModal.id}</span>
                <h3 className="text-lg font-bold text-[#202223] mt-0.5">Order Details & Fulfillment</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateOrderInvoicePDF(selectedOrderModal)}
                  className="px-2.5 py-1.5 bg-white border border-[#d2d5d8] hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Download vector PDF invoice"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Invoice PDF</span>
                </button>
                <select
                  value={selectedOrderModal.status}
                  onChange={(e) => handleUpdateOrderStatus(selectedOrderModal.id, e.target.value)}
                  className="bg-zinc-100 border border-[#d2d5d8] text-xs font-bold text-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="Processing">Processing</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Customer & Shipping Summary */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#e1e3e5] text-xs">
              <div>
                <span className="font-semibold text-[#6d7175] block mb-1">Customer Information</span>
                <p className="font-bold text-[#202223]">{selectedOrderModal.customer_name}</p>
                <p className="text-[#6d7175]">{selectedOrderModal.email}</p>
                <p className="text-[#6d7175]">{selectedOrderModal.phone}</p>
              </div>
              <div>
                <span className="font-semibold text-[#6d7175] block mb-1">Shipping Destination</span>
                <p className="text-[#202223] leading-relaxed">
                  {selectedOrderModal.shipping_address}<br />
                  {selectedOrderModal.city}
                </p>
              </div>
            </div>

            {/* Delhivery Express Logistics */}
            <div className="py-4 border-b border-[#e1e3e5] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#6d7175] flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-zinc-700" /> Delhivery Express Logistics
                </span>
                {selectedOrderModal.awb_number ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[11px] font-bold">
                    AWB: {selectedOrderModal.awb_number}
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-400 italic">Not yet dispatched</span>
                )}
              </div>

              {selectedOrderModal.awb_number ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      const awb = selectedOrderModal.awb_number;
                      setSelectedOrderModal(null);
                      setActiveTab('delhivery');
                      handleTrackAwb(awb);
                    }}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" /> View Live Delhivery Timeline
                  </button>
                  <a
                    href="https://www.delhivery.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-white border border-[#d2d5d8] hover:bg-zinc-50 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Delhivery.com</span> <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    onClick={() => handleDispatchDelhivery(selectedOrderModal.id)}
                    disabled={shippingOrderId === selectedOrderModal.id}
                    className="px-3.5 py-1.5 bg-[#1a1a1a] hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    {shippingOrderId === selectedOrderModal.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Truck className="w-3.5 h-3.5" />
                    )}
                    Generate Waybill & Ship with Delhivery
                  </button>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="py-4 space-y-3 border-b border-[#e1e3e5]">
              <span className="font-semibold text-xs text-[#6d7175] block">Order Items</span>
              {(selectedOrderModal.items || []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-12 rounded bg-zinc-100 border border-[#e1e3e5] overflow-hidden">
                      {it.image_url ? <img src={it.image_url} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div>
                      <div className="font-semibold text-[#202223]">{it.title}</div>
                      <div className="text-[11px] text-[#6d7175]">Size: {it.size || 'M'} · Qty: {it.qty || 1}</div>
                    </div>
                  </div>
                  <div className="font-bold font-mono text-[#202223]">
                    ₹{Number(it.price).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="pt-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-[#6d7175]">
                <span>Subtotal</span>
                <span>₹{Number(selectedOrderModal.subtotal || selectedOrderModal.total).toLocaleString('en-IN')}</span>
              </div>
              {selectedOrderModal.cod_fee > 0 && (
                <div className="flex justify-between text-[#6d7175]">
                  <span>COD Handling Fee</span>
                  <span>+₹{selectedOrderModal.cod_fee}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-[#202223] pt-2 border-t border-[#e1e3e5]">
                <span>Total</span>
                <span className="font-mono">₹{Number(selectedOrderModal.total).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. ADD / EDIT PRODUCT MODAL */}
      {/* =================================================================== */}
      {productModalMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-[#e1e3e5] rounded-xl p-6 sm:p-8 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setProductModalMode(null)}
              className="absolute top-4 right-4 text-[#6d7175] hover:text-[#202223]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#202223] mb-4">
              {productModalMode === 'edit' ? `Edit "${editingProduct?.title}"` : 'Add New Silhouette'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Title</label>
                  <input
                    type="text"
                    value={productForm.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (productModalMode === 'add') {
                        const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                        setProductForm({ ...productForm, title: val, handle: slug || productForm.handle });
                      } else {
                        setProductForm({ ...productForm, title: val });
                      }
                    }}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Handle / Slug</label>
                  <input
                    type="text"
                    value={productForm.handle}
                    onChange={(e) => setProductForm({ ...productForm, handle: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Compare-at Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.compare_at_price}
                    onChange={(e) => setProductForm({ ...productForm, compare_at_price: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Inventory Quantity</label>
                  <input
                    type="number"
                    value={productForm.inventory}
                    onChange={(e) => setProductForm({ ...productForm, inventory: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                  >
                    <option value="Shirts">Shirts</option>
                    <option value="T-Shirts">T-Shirts</option>
                    <option value="Jeans">Baggy Jeans</option>
                    <option value="Hoodies">Hoodies</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#6d7175] mb-1">Type Tag</label>
                  <select
                    value={productForm.type}
                    onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                  >
                    <option value="shirt">shirt</option>
                    <option value="tee">tee</option>
                    <option value="jeans">jeans</option>
                    <option value="hoodie">hoodie</option>
                  </select>
                </div>
              </div>

              {/* AVAILABLE SIZES SELECTION */}
              <div>
                <label className="block font-semibold text-[#6d7175] mb-1.5">Available Sizes</label>
                <div className="flex flex-wrap gap-2">
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((sz) => {
                    const isSelected = (productForm.sizes || []).includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          const current = productForm.sizes || [];
                          const nextSizes = isSelected 
                            ? current.filter(s => s !== sz) 
                            : [...current, sz];
                          setProductForm({ ...productForm, sizes: nextSizes });
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                            : 'bg-white text-zinc-600 border-[#d2d5d8] hover:border-zinc-400'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PRODUCT MEDIA (DEVICE UPLOAD & URL) */}
              <div className="space-y-3 pt-2 border-t border-[#e1e3e5]">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-xs text-[#202223]">Product Media & Imagery</label>
                    <span className="text-[11px] text-[#6d7175]">Upload photos directly from your device or enter external URLs</span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#6d7175] bg-zinc-100 px-2 py-0.5 rounded-full border border-[#e1e3e5]">
                    {productForm.images?.length || (productForm.image_url ? 1 : 0)} photo(s)
                  </span>
                </div>

                {/* Device Upload Drag & Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={handleDropImages}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
                    isDraggingOver 
                      ? 'border-black bg-zinc-100 scale-[0.99]' 
                      : 'border-[#c9cccf] hover:border-[#8c9196] bg-[#fafbfb] hover:bg-[#f6f6f7]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleDeviceImageUpload}
                  />
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-[#e1e3e5] flex items-center justify-center text-zinc-700 mb-2">
                      {isUploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin text-black" />
                      ) : (
                        <ImagePlus className="w-5 h-5 text-zinc-700" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#202223]">
                      {isUploadingImage ? 'Optimizing & Uploading to Cloudflare R2...' : 'Add images from device'}
                    </p>
                    {isUploadingImage ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUploadingImage(false);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="mt-2 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold rounded-md pointer-events-auto transition-colors"
                      >
                        Cancel Upload
                      </button>
                    ) : (
                      <>
                        <p className="text-[11px] text-[#6d7175] mt-0.5">
                          Drag and drop or <span className="font-semibold text-black underline">browse files from computer</span>
                        </p>
                        <p className="text-[10px] text-[#8c9196] mt-1 font-mono">
                          JPG, PNG, WEBP · Auto-compressed · Cloudflare R2 CDN
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Add via URL alternative */}
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="Or paste an image URL (https://...)"
                    value={customImageUrlInput}
                    onChange={(e) => setCustomImageUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddImageUrl();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black placeholder:text-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 border border-[#d2d5d8] text-zinc-800 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    Add URL
                  </button>
                </div>

                {/* Image Gallery / Thumbnails */}
                {((productForm.images && productForm.images.length > 0) || productForm.image_url) && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-[#6d7175]">
                      <span>Gallery Order (First is Cover Image):</span>
                      <span className="text-zinc-400">Hover photo to set as cover or remove</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {(productForm.images && productForm.images.length > 0 ? productForm.images : [productForm.image_url]).map((imgSrc, idx) => (
                        <div
                          key={idx}
                          className={`group relative aspect-square rounded-lg overflow-hidden border bg-zinc-100 ${
                            idx === 0 
                              ? 'border-black ring-2 ring-black/20' 
                              : idx === 1
                              ? 'border-zinc-400'
                              : 'border-[#e1e3e5]'
                          }`}
                        >
                          <img
                            src={imgSrc}
                            alt={`Product view ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />

                          {/* Badge tag */}
                          <div className="absolute top-1 left-1 flex flex-col gap-1 pointer-events-none">
                            {idx === 0 && (
                              <span className="px-1.5 py-0.5 bg-black text-white text-[9px] font-bold rounded tracking-wider uppercase shadow-xs">
                                Cover
                              </span>
                            )}
                            {idx === 1 && (
                              <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-100 text-[9px] font-medium rounded shadow-xs">
                                Hover
                              </span>
                            )}
                          </div>

                          {/* Action controls on hover */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                            {idx !== 0 && (
                              <button
                                type="button"
                                title="Set as Primary Cover"
                                onClick={() => handleSetPrimaryImage(idx)}
                                className="p-1.5 bg-white text-black hover:bg-zinc-200 rounded-md shadow-xs transition-colors"
                              >
                                <Star className="w-3.5 h-3.5 fill-black" />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete Image"
                              onClick={() => handleRemoveImage(idx)}
                              className="p-1.5 bg-red-600 text-white hover:bg-red-700 rounded-md shadow-xs transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SIZE CHART CONFIGURATION */}
              <div className="p-3.5 bg-zinc-50 border border-[#e1e3e5] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-zinc-700" />
                    <span className="font-bold text-xs text-[#202223]">Size Chart & Specifications</span>
                  </div>
                  <div className="flex bg-zinc-200/80 p-0.5 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSizeChartMode('table')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        sizeChartMode === 'table' ? 'bg-white text-black shadow-xs' : 'text-zinc-600 hover:text-black'
                      }`}
                    >
                      Measurement Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setSizeChartMode('image')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        sizeChartMode === 'image' ? 'bg-white text-black shadow-xs' : 'text-zinc-600 hover:text-black'
                      }`}
                    >
                      Chart Image / Graphic
                    </button>
                  </div>
                </div>

                {sizeChartMode === 'image' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder="Paste size chart graphic URL or browse from device..."
                        value={productForm.size_chart_image || ''}
                        onChange={(e) => setProductForm({ ...productForm, size_chart_image: e.target.value })}
                        className="flex-1 px-3 py-1.5 border border-[#d2d5d8] rounded-lg text-xs text-[#202223] focus:outline-none focus:border-black"
                      />
                      <button
                        type="button"
                        onClick={() => sizeChartFileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white border border-[#d2d5d8] hover:bg-zinc-100 rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        From Device
                      </button>
                      <input
                        ref={sizeChartFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleSizeChartImageUpload}
                      />
                    </div>
                    {productForm.size_chart_image && (
                      <div className="relative border border-[#e1e3e5] rounded-lg overflow-hidden max-h-40 bg-white p-2">
                        <img
                          src={productForm.size_chart_image}
                          alt="Size Chart Preview"
                          className="max-h-36 mx-auto object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, size_chart_image: '' })}
                          className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border border-[#e1e3e5] rounded-lg bg-white">
                      <thead className="bg-zinc-100 text-zinc-700">
                        <tr>
                          <th className="py-1.5 px-2 text-left">Size</th>
                          <th className="py-1.5 px-2 text-left">Chest</th>
                          <th className="py-1.5 px-2 text-left">Length</th>
                          <th className="py-1.5 px-2 text-left">Shoulder</th>
                          <th className="py-1.5 px-2 text-left">Sleeve</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e1e3e5]">
                        {(productForm.size_chart_table || []).map((row, idx) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 font-bold font-mono text-zinc-900">{row.size}</td>
                            <td className="py-1 px-2">
                              <input
                                type="text"
                                value={row.chest}
                                onChange={(e) => {
                                  const nextTable = [...productForm.size_chart_table];
                                  nextTable[idx] = { ...nextTable[idx], chest: e.target.value };
                                  setProductForm({ ...productForm, size_chart_table: nextTable });
                                }}
                                className="w-16 px-1.5 py-0.5 border border-[#d2d5d8] rounded text-zinc-800 font-mono"
                              />
                            </td>
                            <td className="py-1 px-2">
                              <input
                                type="text"
                                value={row.length}
                                onChange={(e) => {
                                  const nextTable = [...productForm.size_chart_table];
                                  nextTable[idx] = { ...nextTable[idx], length: e.target.value };
                                  setProductForm({ ...productForm, size_chart_table: nextTable });
                                }}
                                className="w-16 px-1.5 py-0.5 border border-[#d2d5d8] rounded text-zinc-800 font-mono"
                              />
                            </td>
                            <td className="py-1 px-2">
                              <input
                                type="text"
                                value={row.shoulder}
                                onChange={(e) => {
                                  const nextTable = [...productForm.size_chart_table];
                                  nextTable[idx] = { ...nextTable[idx], shoulder: e.target.value };
                                  setProductForm({ ...productForm, size_chart_table: nextTable });
                                }}
                                className="w-16 px-1.5 py-0.5 border border-[#d2d5d8] rounded text-zinc-800 font-mono"
                              />
                            </td>
                            <td className="py-1 px-2">
                              <input
                                type="text"
                                value={row.sleeve}
                                onChange={(e) => {
                                  const nextTable = [...productForm.size_chart_table];
                                  nextTable[idx] = { ...nextTable[idx], sleeve: e.target.value };
                                  setProductForm({ ...productForm, size_chart_table: nextTable });
                                }}
                                className="w-16 px-1.5 py-0.5 border border-[#d2d5d8] rounded text-zinc-800 font-mono"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#6d7175] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d2d5d8] rounded-lg text-sm text-[#202223] focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-[#e1e3e5]">
                <button
                  type="button"
                  onClick={() => setProductModalMode(null)}
                  className="px-4 py-2 border border-[#d2d5d8] rounded-lg text-zinc-700 hover:bg-zinc-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1a1a1a] hover:bg-[#303030] text-white rounded-lg font-semibold"
                >
                  {productModalMode === 'edit' ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. CUSTOMER PROFILE MODAL */}
      {/* =================================================================== */}
      {selectedCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#e1e3e5] rounded-xl p-6 shadow-xl relative">
            <button
              onClick={() => setSelectedCustomerModal(null)}
              className="absolute top-4 right-4 text-[#6d7175] hover:text-[#202223]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#202223] mb-4">Customer Profile</h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-zinc-50 rounded-lg border border-[#e1e3e5]">
                <div className="text-base font-bold text-[#202223]">{selectedCustomerModal.name}</div>
                <div className="text-[#6d7175]">{selectedCustomerModal.email}</div>
                <div className="text-[#6d7175]">{selectedCustomerModal.phone}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-50 rounded-lg border border-[#e1e3e5]">
                  <span className="text-[#6d7175] block">Total Orders</span>
                  <span className="text-lg font-bold text-[#202223]">{selectedCustomerModal.total_orders || 1}</span>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg border border-[#e1e3e5]">
                  <span className="text-[#6d7175] block">Total Spent</span>
                  <span className="text-lg font-bold text-[#202223] font-mono">₹{Number(selectedCustomerModal.total_spent || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-[#6d7175] block mb-1">Primary Address</span>
                <p className="text-[#202223] p-2.5 bg-zinc-50 rounded-lg border border-[#e1e3e5]">
                  {selectedCustomerModal.address || selectedCustomerModal.city || 'India'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedCustomerModal(null)}
                className="px-4 py-2 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
