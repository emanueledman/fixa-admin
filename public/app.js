import { getDatabase, ref, onValue, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import { auth } from '/auth.js';

// Initialize Firebase Services
const db = getDatabase();
const firestore = getFirestore();
const messaging = getMessaging();

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      messaging.useServiceWorker(registration);
      console.log('Service Worker registrado com sucesso:', registration);
    })
    .catch((error) => {
      console.error('Erro ao registrar Service Worker:', error);
    });
}

// Request Notification Permission
function requestNotificationPermission() {
  messaging.requestPermission()
    .then(() => {
      console.log('Permissão concedida para notificações');
      return getToken(messaging, { vapidKey: 'SUA_VAPID_KEY' }); // Replace with your VAPID key
    })
    .then((token) => {
      document.getElementById('notificationStatus').textContent = 'Notificações ativas';
      console.log('Token:', token);
    })
    .catch((error) => {
      console.error('Erro ao solicitar permissão:', error);
    });
}

// Initialize Admin Panel
function initializeAdminPanel() {
  const problemsRef = ref(db, 'problems');
  const problemsGrid = document.getElementById('problemsGrid');

  onValue(problemsRef, async (snapshot) => {
    const problems = snapshot.val();
    problemsGrid.innerHTML = '';

    if (!problems) {
      problemsGrid.innerHTML = '<p class="text-center col-span-full text-gray-600">Nenhum problema encontrado</p>';
      return;
    }

    for (const [problemId, problem] of Object.entries(problems)) {
      const responsibleName = await getResponsibleName(problem.responsibleId);
      const createdAt = problem.createdAt ? new Date(problem.createdAt).toLocaleString('pt-BR') : 'Sem data';
      const card = document.createElement('div');
      card.className = 'bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition';
      card.innerHTML = `
        <h3 class="text-xl font-semibold text-gray-800 mb-2">${problem.title || 'Sem título'}</h3>
        <p class="text-gray-600 mb-2"><strong>Descrição:</strong> ${problem.description || 'Sem descrição'}</p>
        <p class="text-gray-600 mb-2"><strong>Município:</strong> ${problem.municipality || 'Sem município'}</p>
        <p class="text-gray-600 mb-2"><strong>Bairro:</strong> ${problem.neighborhood || 'Sem bairro'}</p>
        <p class="text-gray-600 mb-2"><strong>Categoria:</strong> ${problem.category || 'Sem categoria'}</p>
        <p class="text-gray-600 mb-2"><strong>Urgência:</strong> ${problem.urgency || 'Sem urgência'}</p>
        <p class="text-gray-600 mb-2"><strong>Responsável:</strong> ${responsibleName}</p>
        <p class="text-gray-600 mb-2"><strong>Status:</strong> ${problem.status || 'Sem status'}</p>
        <p class="text-gray-600 mb-4"><strong>Criado em:</strong> ${createdAt}</p>
        <div class="mb-4">
          ${problem.imageUrl ? `<a href="${problem.imageUrl}" target="_blank"><img src="${problem.imageUrl}" alt="Imagem do problema" class="w-32 h-32 object-cover rounded"></a>` : '<p>Sem imagem</p>'}
        </div>
        <select onchange="updateStatus('${problemId}', this.value)" class="border p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="Aguardando" ${problem.status === 'Aguardando' ? 'selected' : ''}>Aguardando</option>
          <option value="Em Andamento" ${problem.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
          <option value="Resolvido" ${problem.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
        </select>
      `;
      problemsGrid.appendChild(card);
    }
  });

  // Real-time Notification for New Problems
  onValue(ref(db, 'problems'), (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const problem = childSnapshot.val();
      if (Notification.permission === 'granted') {
        new Notification('Novo Problema Reportado', {
          body: `${problem.title} - ${problem.description}`,
          icon: '/assets/icons/Icon-192.png'
        });
      }
    });
  }, { onlyOnce: false });
}

// Get Responsible Name
async function getResponsibleName(responsibleId) {
  if (!responsibleId) return 'Sem responsável';
  try {
    const docRef = doc(firestore, 'usuarios', responsibleId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().nome || 'Nome não disponível' : 'Responsável não encontrado';
  } catch (error) {
    console.error('Erro ao buscar responsável:', error);
    return 'Erro ao carregar responsável';
  }
}

// Update Problem Status
function updateStatus(problemId, newStatus) {
  update(ref(db, `problems/${problemId}`), { status: newStatus })
    .then(() => alert('Status atualizado com sucesso!'))
    .catch((error) => alert('Erro ao atualizar status: ' + error.message));
}

// Initialize when user is authenticated
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    initializeAdminPanel();
    requestNotificationPermission();
  }
});