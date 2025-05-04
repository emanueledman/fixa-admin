import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVtY6ML3j-qrIsAprIJPB5xFFCbcf4UQw",
  authDomain: "facilita-479b3.firebaseapp.com",
  databaseURL: "https://facilita-479b3-default-rtdb.firebaseio.com",
  projectId: "facilita-479b3",
  storageBucket: "facilita-479b3.firebasestorage.app",
  messagingSenderId: "385676676886",
  appId: "1:385676676886:web:hpv5p5d4onvvosgglv5lf4337bv2bojc"
};

// Initialize Firebase
try {
  const app = initializeApp(firebaseConfig);
  console.log('Firebase inicializado');
} catch (error) {
  console.error('Erro ao inicializar Firebase:', error);
}

const auth = getAuth();

// Elements (Login Page)
const loginButton = document.getElementById('loginButton');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

// Elements (Main Page)
const logoutButton = document.getElementById('logoutButton');

// Login
if (loginButton) {
  loginButton.addEventListener('click', () => {
    console.log('Botão de login clicado');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      loginError.textContent = 'Preencha email e senha.';
      loginError.classList.remove('hidden');
      return;
    }

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log('Login OK:', userCredential.user.email);
        window.location.href = '/index.html';
      })
      .catch((error) => {
        console.error('Erro de login:', error.code, error.message);
        loginError.textContent = `Erro: ${error.message}`;
        loginError.classList.remove('hidden');
      });
  });
}

// Logout
if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = '/login.html';
    }).catch((error) => {
      alert('Erro ao sair: ' + error.message);
    });
  });
}

// Protect Routes
onAuthStateChanged(auth, (user) => {
  console.log('Estado de auth:', user ? 'Logado' : 'Deslogado');
  const isLoginPage = window.location.pathname === '/login.html';
  if (!user && !isLoginPage) {
    window.location.href = '/login.html';
  } else if (user && isLoginPage) {
    window.location.href = '/index.html';
  }
});

export { auth };