import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({ id: firebaseUser.uid, ...userData });
          
          // Update online status
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            online: true,
            lastSeen: serverTimestamp()
          });
        } else {
          // This should only happen if registration failed to create the doc
          setUser({ id: firebaseUser.uid, email: firebaseUser.email });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (username: string, email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Create user profile in Firestore
    const userData = {
      uid: firebaseUser.uid,
      username,
      email,
      avatar: '',
      online: true,
      lastSeen: serverTimestamp()
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    setUser({ id: firebaseUser.uid, ...userData });
  };

  const logout = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.id), {
        online: false,
        lastSeen: serverTimestamp()
      });
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
