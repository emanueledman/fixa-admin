import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Elements
const loginModal = document.getElementById('loginModal');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');

// Show login modal on page load
document.addEventListener('DOMContentLoaded', () => {
  loginModal.classList.remove('hidden');
});

// Login
loginButton.addEventListener('click', () => {
  console.log('Botão de login clicado');
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    loginError.textContent = 'Por favor, preencha email e senha.';
    loginError.classList.remove('hidden');
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      console.log('Login bem-sucedido:', userCredential.user.email);
      loginModal.classList.add('hidden');
      sidebar.classList.remove('hidden');
      mainContent.classList.remove('hidden');
      loginError.classList.add('hidden');
    })
    .catch((error) => {
      console.error('Erro de login:', error.code, error.message);
      loginError.textContent = `Erro de login: ${error.message}`;
      loginError.classList.remove('hidden');
    });
});

// Logout
logoutButton.addEventListener('click', () => {
  signOut(auth).then(() => {
    sidebar.classList.add('hidden');
    mainContent.classList.add('hidden');
    loginModal.classList.remove('hidden');
    document.getElementById('notificationStatus').textContent = '';
  }).catch((error) => {
    alert('Erro ao sair: ' + error.message);
  });
});

export { auth };