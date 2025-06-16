import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
  console.log('Firebase inicializado com sucesso');
} catch (error) {
  console.error('Erro ao inicializar Firebase:', error);
}

const auth = getAuth();
const firestore = getFirestore();
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
        emailOrPhone: user.email || '', // Compatibilidade com regras antigas
        isResponsible: true, // Definir como responsável por padrão (ajuste conforme necessário)
        municipality: "Belas", // Valor padrão; ajuste conforme necessário
        nome: user.displayName || "Usuário Sem Nome",
        data_criacao: new Date().getTime()
      });
      console.log('Documento do usuário criado:', user.uid);
    } else {
      // Atualizar campos ausentes, se necessário
      const existingData = userDoc.data();
      if (!existingData.emailOrPhone || !existingData.municipality) {
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
      console.log('Dados do usuário:', userData);
      return userData.isResponsible === true; // municipality não é mais obrigatório
    }
    console.warn('Documento do usuário não existe:', uid);
    return false;
  } catch (error) {
    console.error('Erro ao verificar usuário responsável:', error);
    return false;
  }
}

// Elements (Login Page)
const loginButton = document.getElementById('loginButton');
const googleLoginButton = document.getElementById('googleLoginButton');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

// Elements (Main Page)
const logoutButton = document.getElementById('logoutButton');

// Login with Email/Password
if (loginButton) {
  loginButton.addEventListener('click', async () => {
    console.log('Botão de login com email clicado');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      loginError.textContent = 'Preencha email e senha.';
      loginError.classList.remove('hidden');
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Login OK (email):', user.email, 'UID:', user.uid);
      await createOrUpdateUserDoc(user); // Criar ou atualizar documento
      const isResponsible = await isUserResponsible(user.uid);
      if (!isResponsible) {
        await signOut(auth);
        loginError.textContent = 'Acesso negado: Apenas responsáveis podem acessar.';
        loginError.classList.remove('hidden');
        return;
      }
      window.location.href = '/index.html';
    } catch (error) {
      console.error('Erro de login (email):', error.code, error.message);
      loginError.textContent = `Erro: ${error.message}`;
      loginError.classList.remove('hidden');
    }
  });
}

// Login with Google
if (googleLoginButton) {
  googleLoginButton.addEventListener('click', async () => {
    console.log('Botão de login com Google clicado');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log('Login OK (Google):', user.email, 'UID:', user.uid);
      await createOrUpdateUserDoc(user); // Criar ou atualizar documento
      const isResponsible = await isUserResponsible(user.uid);
      if (!isResponsible) {
        await signOut(auth);
        loginError.textContent = 'Acesso negado: Apenas responsáveis podem acessar.';
        loginError.classList.remove('hidden');
        return;
      }
      window.location.href = '/index.html';
    } catch (error) {
      console.error('Erro de login (Google):', error.code, error.message);
      loginError.textContent = `Erro: ${error.message}`;
      loginError.classList.remove('hidden');
    }
  });
}

// Logout
if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
      console.log('Logout realizado com sucesso');
      window.location.href = '/login.html';
    }).catch((error) => {
      console.error('Erro ao sair:', error);
      alert('Erro ao sair: ' + error.message);
    });
  });
}

// Protect Routes
onAuthStateChanged(auth, async (user) => {
  console.log('Estado de auth:', user ? `Logado (UID: ${user.uid}, Email: ${user.email})` : 'Deslogado');
  const isLoginPage = window.location.pathname === '/login.html';
  if (!user && !isLoginPage) {
    console.log('Nenhum usuário autenticado. Redirecionando para login.');
    window.location.href = '/login.html';
  } else if (user) {
    const isResponsible = await isUserResponsible(user.uid);
    if (!isResponsible) {
      console.warn('Usuário não é responsável. Deslogando:', user.uid);
      await signOut(auth);
      window.location.href = '/login.html';
    } else if (isLoginPage) {
      console.log('Usuário responsável na página de login. Redirecionando para index.');
      window.location.href = '/index.html';
    }
  }
});

export { auth };