// signIn.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged, getRedirectResult, GoogleAuthProvider, signInWithRedirect } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Initialize Firebase app with your config object directly here or import from another file
const firebaseConfig = {
  apiKey: "AIzaSyC8N2DrZddIjadKk6iKJyAYDJfAvaMz8fc",
  authDomain: "together-70afc.firebaseapp.com",
  projectId: "together-70afc",
  storageBucket: "together-70afc.appspot.com",
  messagingSenderId: "903769378174",
  appId: "1:903769378174:web:f693fc7570746954feb72f",
  measurementId: "G-89JEF3BJ8S"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Call getRedirectResult when the app loads
getRedirectResult(auth)
  .then((result) => {
    // This gives you a Google Access Token. You can use it to access Google APIs.
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;

    // The signed-in user info.
    const user = result.user;
    console.log('User after redirect:', user);
  }).catch((error) => {
    // Handle Errors here.
    const errorCode = error.code;
    const errorMessage = error.message;
    // The email of the user's account used.
    const email = error.email;
    // The AuthCredential type that was used.
    const credential = GoogleAuthProvider.credentialFromError(error);
    // ...
    console.error('Error after redirect:', error);
  });

// Set an authentication state observer and get user data
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in
    console.log('User is signed in:', user);

    // Check if user exists in Firestore
    const userRef = doc(db, "users", user.uid); // Reference to a doc in 'users' collection with user's UID
    const docSnap = await getDoc(userRef);

    // If user doesn't exist in Firestore, add them
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        // Add other relevant user information you want to store
        createdAt: new Date(), // Timestamp for when the user is added to Firestore
      });
      console.log('User added to Firestore:', user.displayName);
    } else {
      console.log('User already exists in Firestore:', user.displayName);
    }

    window.location.href = 'rooms.html'; // redirect to rooms page if signed in
  } else {
    // User is signed out
    console.log('No user is signed in.');
    // Redirect to sign-in page or show sign-in button
  }
});

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  signInWithRedirect(auth, provider);
}

window.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('googleSignInButton').addEventListener('click', signInWithGoogle);
});
