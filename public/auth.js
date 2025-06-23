// auth.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'; // Importação adicionada
import { getMessaging } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js'; // Importação adicionada

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

// Initialize Firebase App and Services
let app, auth, firestore, db, messaging;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  firestore = getFirestore(app);
  db = getDatabase(app);
  messaging = getMessaging(app);
  console.log('Firebase inicializado com sucesso em auth.js');
} catch (error) {
  console.error('Erro ao inicializar Firebase em auth.js:', error);
}

const googleProvider = new GoogleAuthProvider();

// Create or update user document
async function createOrUpdateUserDoc(user) {
  try {
    const userDocRef = doc(firestore, 'usuarios', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // Criar novo documento
      await setDoc(userDocRef, {
        email: user.email,
        emailOrPhone: user.email || '',
        isResponsible: true, // Definir como responsável por padrão (ajuste conforme necessário)
        municipality: "Belas", // Valor padrão; ajuste conforme necessário
        nome: user.displayName || "Usuário Sem Nome",
        data_criacao: new Date().getTime()
      });
      console.log('Documento do usuário criado:', user.uid);
    } else {
      // Atualizampos ausentes, se necessário
      const existingData = userDoc.data();
      // Nota: As regras de verificação podem ser mais complexas aqui. Ex: verificar se isResponsible já é false
      if (existingData.isResponsible === false) {
          // Se o usuário não é responsável, não altere o status ou restrinja o acesso.
          // Este é um ponto importante para a lógica de permissão.
          console.warn(`Usuário ${user.uid} não é responsável. Mantendo status.`);
      } else {
          await setDoc(userDocRef, {
            ...existingData,
            emailOrPhone: existingData.emailOrPhone || user.email || '',
            municipality: existingData.municipality || "Belas"
          }, { merge: true });
          console.log('Documento do usuário atualizado:', user.uid);
      }
    }
  } catch (error) {
    console.error('Erro ao criar/atualizar documento do usuário:', error);
  }
}

// Check if user is responsible
async function isUserResponsible(uid) {
  try {
    const userDoc = await getDoc(doc(firestore, 'usuarios', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('Dados do usuário (isUserResponsible):', userData);
      return userData.isResponsible === true;
    }
    console.warn('Documento do usuário não existe para verificação de responsabilidade:', uid);
    return false;
  } catch (error) {
    console.error('Erro ao verificar usuário responsável:', error);
    return false;
  }
}

// Elements (Login Page) - These elements are typically found in login.html
const loginButton = document.getElementById('loginButton');
const googleLoginButton = document.getElementById('googleLoginButton');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

// Login with Email/Password (only if elements exist, i.e., on login.html)
if (loginButton) {
  loginButton.addEventListener('click', async () => {
    console.log('Botão de login com email clicado');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      if (loginError) {
        loginError.textContent = 'Preencha email e senha.';
        loginError.classList.remove('hidden');
      }
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Login OK (email):', user.email, 'UID:', user.uid);
      await createOrUpdateUserDoc(user); // Criar ou atualizar documento (se necessário, para novos logins)
      const responsible = await isUserResponsible(user.uid);
      if (!responsible) {
        await signOut(auth); // Força logout se não for responsável
        if (loginError) {
          loginError.textContent = 'Acesso negado: Apenas responsáveis podem acessar este painel.';
          loginError.classList.remove('hidden');
        }
        return;
      }
      window.location.href = '/index.html'; // Redireciona se for responsável
    } catch (error) {
      console.error('Erro de login (email):', error.code, error.message);
      if (loginError) {
        loginError.textContent = `Erro: ${error.message}`;
        loginError.classList.remove('hidden');
      }
    }
  });
}

// Login with Google (only if elements exist, i.e., on login.html)
if (googleLoginButton) {
  googleLoginButton.addEventListener('click', async () => {
    console.log('Botão de login com Google clicado');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log('Login OK (Google):', user.email, 'UID:', user.uid);
      await createOrUpdateUserDoc(user); // Criar ou atualizar documento
      const responsible = await isUserResponsible(user.uid);
      if (!responsible) {
        await signOut(auth); // Força logout se não for responsável
        if (loginError) {
          loginError.textContent = 'Acesso negado: Apenas responsáveis podem acessar este painel.';
          loginError.classList.remove('hidden');
        }
        return;
      }
      window.location.href = '/index.html'; // Redireciona se for responsável
    } catch (error) {
      console.error('Erro de login (Google):', error.code, error.message);
      if (loginError) {
        loginError.textContent = `Erro: ${error.message}`;
        loginError.classList.remove('hidden');
      }
    }
  });
}

// Callback to initialize the admin panel (to be set by index.html)
let adminPanelInitializerCallback = null;
export function setAdminPanelInitializer(callback) {
    adminPanelInitializerCallback = callback;
}

// Global Auth State Observer (for route protection and panel initialization)
onAuthStateChanged(auth, async (user) => {
  console.log('Estado de auth em auth.js (Global):', user ? `Logado (UID: ${user.uid}, Email: ${user.email})` : 'Deslogado');
  const isLoginPage = window.location.pathname === '/login.html';
  const isIndexPage = window.location.pathname === '/index.html';

  if (!user) { // No user is logged in
    if (!isLoginPage) {
      console.log('Nenhum usuário autenticado. Redirecionando para login.');
      window.location.href = '/login.html';
    }
  } else { // A user is logged in
    const responsible = await isUserResponsible(user.uid);
    if (!responsible) {
      console.warn('Usuário não é responsável. Deslogando:', user.uid);
      await signOut(auth); // Force logout for non-responsible users
      if (!isLoginPage) { // Redirect to login only if not already there
        window.location.href = '/login.html';
      }
    } else { // User is authenticated AND responsible
      if (isLoginPage) {
        console.log('Usuário responsável na página de login. Redirecionando para index.');
        window.location.href = '/index.html';
      } else if (isIndexPage && adminPanelInitializerCallback) {
        console.log('Usuário responsável no index.html. Chamando inicializador do painel admin.');
        adminPanelInitializerCallback(user.uid); // Call the initializer from index.html
      }
    }
  }
});

// Export Firebase services and functions for use in other modules
export { auth, db, firestore, messaging, signOut, createOrUpdateUserDoc, isUserResponsible };