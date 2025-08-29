import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'


const firebaseConfig = {
  apiKey: 'AIzaSyDYE3-DIuNj0tl1Pa7bQNebhaJ0nbNNS1Y',
  authDomain: 'hurseproject.firebaseapp.com',
  projectId: 'hurseproject',
  storageBucket: 'hurseproject.firebasestorage.app',
  messagingSenderId: '111083763435',
  appId: '1:111083763435:web:123d79dd6c14dd3b56f0ae',
  measurementId: 'G-PY8E237TRN',
};



const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)


export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)