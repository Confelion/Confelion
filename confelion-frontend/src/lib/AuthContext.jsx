import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fetchAPI } from './api'
import { 
  auth, 
  googleProvider, 
  saveUserProfileToFirestore, 
  getUserProfileFromFirestore 
} from './firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth'
import { linkCartToCustomer } from './cartManager'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || ''
  })
  const [loading, setLoading] = useState(true)

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken()
          setToken(idToken)
          localStorage.setItem('token', idToken)
          const isAdminUser = 
            fbUser.email === 'confelion@gmail.com' || 
            fbUser.email === 'admin.confelion@gmail.com' || 
            fbUser.email === 'admin@confelion.com'

          // Immediately hydrate user so UI loads in 0ms
          const initialUser = {
            id: fbUser.uid,
            name: fbUser.displayName || (isAdminUser ? 'Admin Confelion' : 'Confelion Patron'),
            email: fbUser.email,
            photoURL: fbUser.photoURL || '',
            role: isAdminUser ? 'admin' : 'customer',
            phone: '',
            city: '',
            address: '',
            pincode: '',
            status: 'Active Member',
            joined_date: new Date().toISOString().split('T')[0]
          }

          // Merge any previously saved local profile fields
          try {
            const cached = JSON.parse(localStorage.getItem('user') || 'null')
            if (cached && (cached.id === fbUser.uid || cached.email === fbUser.email)) {
              if (cached.name) initialUser.name = cached.name
              if (cached.phone) initialUser.phone = cached.phone
              if (cached.city) initialUser.city = cached.city
              if (cached.address) initialUser.address = cached.address
              if (cached.pincode) initialUser.pincode = cached.pincode
              if (cached.role) initialUser.role = cached.role
            }
          } catch {}

          setUser(initialUser)
          localStorage.setItem('user', JSON.stringify(initialUser))
          setLoading(false)

          // Background enrichment from Firestore without blocking UI
          getUserProfileFromFirestore(fbUser.uid).then((firestoreData) => {
            if (firestoreData) {
              const enrichedUser = {
                ...initialUser,
                name: fbUser.displayName || firestoreData.name || initialUser.name,
                photoURL: fbUser.photoURL || firestoreData.photoURL || initialUser.photoURL,
                role: isAdminUser ? 'admin' : (firestoreData.role || initialUser.role),
                phone: firestoreData.phone || initialUser.phone,
                city: firestoreData.city || initialUser.city,
                address: firestoreData.address || initialUser.address,
                pincode: firestoreData.pincode || initialUser.pincode,
                status: firestoreData.status || initialUser.status,
                joined_date: firestoreData.joined_date || initialUser.joined_date
              }
              setUser(enrichedUser)
              localStorage.setItem('user', JSON.stringify(enrichedUser))
            }
          }).catch(() => {})

          // Background tasks
          saveUserProfileToFirestore(fbUser.uid, initialUser).catch(() => {})
          linkCartToCustomer(fbUser.uid).catch(() => {})
        } catch (err) {
          console.warn('Error hydrating Firebase user profile:', err)
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    // 1. Try Firebase Authentication
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const fbUser = userCredential.user
      const idToken = await fbUser.getIdToken()

      const isAdminUser = 
        fbUser.email === 'confelion@gmail.com' || 
        fbUser.email === 'admin.confelion@gmail.com' || 
        fbUser.email === 'admin@confelion.com'
      const clientUser = {
        id: fbUser.uid,
        name: fbUser.displayName || (isAdminUser ? 'Admin Confelion' : 'Confelion Member'),
        email: fbUser.email,
        role: isAdminUser ? 'admin' : 'customer',
        phone: '',
        city: '',
        address: '',
        pincode: '',
        status: 'Active Member',
        joined_date: new Date().toISOString().split('T')[0]
      }

      try {
        const cached = JSON.parse(localStorage.getItem('user') || 'null')
        if (cached && (cached.id === fbUser.uid || cached.email === fbUser.email)) {
          if (cached.name) clientUser.name = cached.name
          if (cached.phone) clientUser.phone = cached.phone
          if (cached.city) clientUser.city = cached.city
          if (cached.address) clientUser.address = cached.address
          if (cached.pincode) clientUser.pincode = cached.pincode
        }
      } catch {}

      setToken(idToken)
      setUser(clientUser)
      localStorage.setItem('token', idToken)
      localStorage.setItem('user', JSON.stringify(clientUser))

      // Background enrichment
      getUserProfileFromFirestore(fbUser.uid).then((firestoreData) => {
        if (firestoreData) {
          setUser(prev => ({ ...prev, ...firestoreData }))
        }
      }).catch(() => {})
      linkCartToCustomer(clientUser.id).catch(() => {})

      return { data: { user: clientUser, token: idToken }, error: null }
    } catch (fbErr) {
      console.warn('Firebase signIn attempt note:', fbErr.code || fbErr.message)
      
      // 2. Seamless fallback to local/demo server authentication
      try {
        const res = await fetchAPI('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        })

        if (res && res.token && res.user) {
          setToken(res.token)
          setUser(res.user)
          localStorage.setItem('token', res.token)
          localStorage.setItem('user', JSON.stringify(res.user))
          linkCartToCustomer(res.user.id).catch(() => {})
          return { data: { user: res.user, token: res.token }, error: null }
        }

        if (res.error) {
          return { data: null, error: { message: res.error } }
        }
      } catch (apiErr) {
        // Return clear error message
        let msg = fbErr.message || 'Login failed'
        if (fbErr.code === 'auth/invalid-credential' || fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/wrong-password') {
          msg = 'Invalid email or password. Please verify credentials or sign up.'
        } else if (fbErr.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password sign-in is not yet enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.'
        }
        return { data: null, error: { message: msg } }
      }

      return { data: null, error: { message: fbErr.message || 'Login failed' } }
    }
  }

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const fbUser = result.user
      const idToken = await fbUser.getIdToken()

      const isAdminUser = 
        fbUser.email === 'confelion@gmail.com' || 
        fbUser.email === 'admin.confelion@gmail.com' || 
        fbUser.email === 'admin@confelion.com'
      const clientUser = {
        id: fbUser.uid,
        name: fbUser.displayName || (isAdminUser ? 'Admin Confelion' : 'Confelion Patron'),
        email: fbUser.email,
        photoURL: fbUser.photoURL || '',
        role: isAdminUser ? 'admin' : 'customer',
        phone: '',
        city: '',
        address: '',
        pincode: '',
        status: 'Active Member',
        joined_date: new Date().toISOString().split('T')[0]
      }

      // Merge any existing stored details (phone, addresses, etc.)
      try {
        const cached = JSON.parse(localStorage.getItem('user') || 'null')
        if (cached && (cached.id === fbUser.uid || cached.email === fbUser.email)) {
          if (cached.phone) clientUser.phone = cached.phone
          if (cached.city) clientUser.city = cached.city
          if (cached.address) clientUser.address = cached.address
          if (cached.pincode) clientUser.pincode = cached.pincode
        }
      } catch {}

      setToken(idToken)
      setUser(clientUser)
      localStorage.setItem('token', idToken)
      localStorage.setItem('user', JSON.stringify(clientUser))

      // Run background cloud sync non-blockingly so login returns in <1s!
      getUserProfileFromFirestore(fbUser.uid).then((firestoreData) => {
        if (firestoreData) {
          setUser(prev => ({
            ...prev,
            ...firestoreData,
            name: fbUser.displayName || firestoreData.name || prev.name,
            photoURL: fbUser.photoURL || firestoreData.photoURL || prev.photoURL
          }))
        }
      }).catch(() => {})

      saveUserProfileToFirestore(fbUser.uid, clientUser).catch(() => {})
      linkCartToCustomer(clientUser.id).catch(() => {})

      return { data: { user: clientUser, token: idToken }, error: null }
    } catch (err) {
      console.error('Google Sign-In error:', err)
      let msg = err.message || 'Google sign-in could not be completed'
      if (err.code === 'auth/unauthorized-domain') {
        msg = 'Your domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains). Add localhost to continue.'
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Google Sign-In is not enabled in Firebase Console (Authentication > Sign-in method).'
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window was closed before completion.'
      }
      return { data: null, error: { message: msg } }
    }
  }

  const signUp = async (email, password, name) => {
    // 1. Try Firebase Authentication
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const fbUser = userCredential.user

      if (name) {
        await updateProfile(fbUser, { displayName: name }).catch(() => {})
      }

      const idToken = await fbUser.getIdToken()
      const isAdminUser = 
        email === 'confelion@gmail.com' || 
        email === 'admin.confelion@gmail.com' || 
        email === 'admin@confelion.com'
      const clientUser = {
        id: fbUser.uid,
        name: name || 'Confelion Patron',
        email: fbUser.email,
        role: isAdminUser ? 'admin' : 'customer',
        phone: '',
        city: '',
        address: '',
        pincode: '',
        status: 'Active Member',
        joined_date: new Date().toISOString().split('T')[0]
      }

      setToken(idToken)
      setUser(clientUser)
      localStorage.setItem('token', idToken)
      localStorage.setItem('user', JSON.stringify(clientUser))

      // Persist to Firestore
      saveUserProfileToFirestore(fbUser.uid, clientUser).catch(() => {})

      // Link guest cached cart to newly created customer account
      linkCartToCustomer(clientUser.id).catch(() => {})
      saveUserProfileToFirestore(fbUser.uid, clientUser).catch(() => {})

      // Link guest cached cart to newly created customer account
      linkCartToCustomer(clientUser.id).catch(() => {})

      return { data: { user: clientUser, token: idToken }, error: null }
    } catch (fbErr) {
      console.warn('Firebase signUp attempt note:', fbErr.code || fbErr.message)

      // Fallback to local / API signup if Firebase is offline or operation not enabled
      try {
        const res = await fetchAPI('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        })

        if (res && res.token && res.user) {
          setToken(res.token)
          setUser(res.user)
          localStorage.setItem('token', res.token)
          localStorage.setItem('user', JSON.stringify(res.user))
          linkCartToCustomer(res.user.id).catch(() => {})
          return { data: { user: res.user, token: res.token }, error: null }
        }

        if (res.error) {
          return { data: null, error: { message: res.error } }
        }
      } catch (apiErr) {
        let msg = fbErr.message || 'Signup failed'
        if (fbErr.code === 'auth/email-already-in-use') {
          msg = 'An account with this email already exists. Please sign in.'
        } else if (fbErr.code === 'auth/weak-password') {
          msg = 'Password should be at least 6 characters.'
        } else if (fbErr.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password sign-up is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.'
        }
        return { data: null, error: { message: msg } }
      }

      return { data: null, error: { message: fbErr.message || 'Signup failed' } }
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (e) {
      console.warn('Firebase signOut error:', e)
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken('')
    setUser(null)
  }

  const updateUser = async (updatedFields) => {
    const merged = { ...user, ...updatedFields }
    setUser(merged)
    localStorage.setItem('user', JSON.stringify(merged))

    if (user?.id) {
      saveUserProfileToFirestore(user.id, merged).catch(() => {})
    }

    try {
      await fetchAPI('/api/customer/profile', {
        method: 'PUT',
        body: JSON.stringify(updatedFields)
      })
    } catch {}

    return { data: merged, error: null }
  }

  const resetPassword = async (email) => {
    if (!email) return { error: { message: 'Please enter your email address' } }
    try {
      await sendPasswordResetEmail(auth, email)
      return { success: true, error: null }
    } catch (err) {
      console.warn('Password reset note:', err.code, err.message)
      let msg = 'Could not send reset link. Please check the email and try again.'
      if (err.code === 'auth/user-not-found') {
        msg = 'No registered account found with this email address.'
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please provide a valid email format.'
      }
      return { success: false, error: { message: msg } }
    }
  }

  const signInWithOtp = async (email, otp) => {
    try {
      const res = await fetchAPI('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      });
      if (res && res.token && res.user) {
        setToken(res.token);
        setUser(res.user);
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        linkCartToCustomer(res.user.id).catch(() => {});
        return { data: { user: res.user, token: res.token }, error: null };
      }
      return { data: null, error: { message: res?.error || 'Invalid OTP code' } };
    } catch (err) {
      return { data: null, error: { message: err.message || 'OTP verification failed' } };
    }
  };

  const isAdmin = user?.role === 'admin'
  const isCustomer = !!user && user.role !== 'admin'

  const value = { 
    user, 
    token, 
    loading, 
    signIn, 
    signInWithGoogle, 
    signInWithOtp,
    signUp, 
    signOut, 
    resetPassword,
    updateUser, 
    isAdmin, 
    isCustomer 
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return {
      user: null,
      token: '',
      loading: false,
      isAdmin: false,
      isCustomer: false,
      signIn: async () => ({ error: { message: 'AuthContext not found' } }),
      signInWithGoogle: async () => ({ error: { message: 'AuthContext not found' } }),
      signUp: async () => ({ error: { message: 'AuthContext not found' } }),
      signOut: async () => {},
      resetPassword: async () => ({ error: { message: 'AuthContext not found' } }),
      updateUser: async () => ({})
    }
  }
  return context
}
