importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

try {
  const firebaseConfig = {
  apiKey: "AIzaSyDVtY6ML3j-qrIsAprIJPB5xFFCbcf4UQw",
  authDomain: "facilita-479b3.firebaseapp.com",
  databaseURL: "https://facilita-479b3-default-rtdb.firebaseio.com",
  projectId: "facilita-479b3",
  storageBucket: "facilita-479b3.firebasestorage.app",
  messagingSenderId: "385676676886",
  appId: "1:385676676886:web:hpv5p5d4onvvosgglv5lf4337bv2bojc"
};

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    console.log('Mensagem em segundo plano recebida:', payload);
    const notificationTitle = payload.notification?.title || 'Notificação FixABairro';
    const notificationOptions = {
      body: payload.notification?.body || 'Nova atualização disponível.',
      icon: '/assets/icons/Icon-192.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (error) {
  console.error('Erro ao inicializar Service Worker:', error);
}