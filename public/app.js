import { getDatabase, ref, onValue, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import { auth } from '/auth.js';

// Firebase Services
const db = getDatabase();
const firestore = getFirestore();
const messaging = getMessaging();

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      messaging.useServiceWorker(registration);
      console.log('Service Worker registrado:', registration);
    })
    .catch((error) => {
      console.error('Erro ao registrar Service Worker:', error);
    });
}

// Notifications
function requestNotificationPermission() {
  Notification.requestPermission()
    .then((permission) => {
      if (permission === 'granted') {
        console.log('Permissão de notificações concedida');
        return getToken(messaging, { vapidKey: 'BKnyjZ4OaEOqoOBovd2bu4f-SwrN6WDW6lkSwkd4BQj8RCY5xxQtWFnBSTRWgOksECGYLbVSl-bpJB-pq3yzkkk' });
      }
      throw new Error('Permissão de notificações negada');
    })
    .then((token) => {
      document.getElementById('notificationStatus').textContent = 'Notificações ativas';
      console.log('Token de notificação:', token);
    })
    .catch((error) => {
      console.error('Erro ao configurar notificações:', error);
      document.getElementById('notificationStatus').textContent = 'Notificações desativadas';
    });
}

// Admin Panel
function initializeAdminPanel(userId) {
  const problemsRef = ref(db, 'problems');
  const problemsGrid = document.getElementById('problemsGrid');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

  if (!problemsGrid) {
    console.error('Grid de problemas não encontrado!');
    return;
  }

  onValue(problemsRef, async (snapshot) => {
    console.log('Snapshot recebido:', snapshot.exists());
    const problems = snapshot.val();
    problemsGrid.innerHTML = '';

    if (!problems) {
      console.warn('Nenhum problema encontrado no banco');
      problemsGrid.innerHTML = '<p class="text-center col-span-full text-gray-600">Nenhum problema encontrado</p>';
      return;
    }

    let filteredProblems = Object.entries(problems).filter(([_, problem]) => {
      console.log('Verificando problema:', problem);
      return problem.responsibleId === userId;
    });

    console.log('Problemas filtrados:', filteredProblems);

    if (filteredProblems.length === 0) {
      console.warn('Nenhum problema encontrado para responsibleId:', userId);
      problemsGrid.innerHTML = '<p class="text-center col-span-full text-gray-600">Nenhum problema atribuído a você</p>';
    }

    // Render Problems
    for (const [problemId, problem] of filteredProblems) {
      try {
        const responsibleName = await getResponsibleName(problem.responsibleId);
        const createdAt = problem.createdAt ? new Date(problem.createdAt).toLocaleString('pt-BR') : 'Sem data';
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-1';
        card.innerHTML = `
          <h3 class="text-xl font-semibold text-gray-800 mb-3">${problem.title || 'Sem título'}</h3>
          <p class="text-gray-600 mb-2"><strong>Descrição:</strong> ${problem.description || 'Sem descrição'}</p>
          <p class="text-gray-600 mb-2"><strong>Município:</strong> ${problem.municipality || 'Sem município'}</p>
          <p class="text-gray-600 mb-2"><strong>Bairro:</strong> ${problem.neighborhood || 'Sem bairro'}</p>
          <p class="text-gray-600 mb-2"><strong>Categoria:</strong> ${problem.category || 'Sem categoria'}</p>
          <p class="text-gray-600 mb-2"><strong>Urgência:</strong> <span class="${problem.urgency === 'Alta' ? 'text-red-500' : problem.urgency === 'Média' ? 'text-yellow-500' : 'text-green-500'}">${problem.urgency || 'Sem urgência'}</span></p>
          <p class="text-gray-600 mb-2"><strong>Responsável:</strong> ${responsibleName}</p>
          <p class="text-gray-600 mb-2"><strong>Status:</strong> ${problem.status || 'Sem status'}</p>
          <p class="text-gray-600 mb-2"><strong>Sugestão:</strong> ${problem.suggestion || 'Sem sugestão'}</p>
          <p class="text-gray-600 mb-4"><strong>Criado em:</strong> ${createdAt}</p>
          <div class="mb-4">
            ${problem.imageUrl ? `<a href="${problem.imageUrl}" target="_blank"><img src="${problem.imageUrl}" alt="Imagem do problema" class="w-32 h-32 object-cover rounded-lg"></a>` : '<p class="text-gray-500">Sem imagem</p>'}
          </div>
          <select onchange="updateStatus('${problemId}', this.value)" class="border p-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Aguardando" ${problem.status === 'Aguardando' ? 'selected' : ''}>Aguardando</option>
            <option value="Em Andamento" ${problem.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
            <option value="Resolvido" ${problem.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
          </select>
        `;
        problemsGrid.appendChild(card);
      } catch (error) {
        console.error('Erro ao renderizar problema:', problemId, error);
      }
    }

    // Search and Filter
    function applyFilters() {
      const searchText = searchInput.value.toLowerCase();
      const status = statusFilter.value;
      const cards = problemsGrid.children;

      for (const card of cards) {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const statusText = card.querySelector('select').value;
        const matchesSearch = title.includes(searchText);
        const matchesStatus = !status || statusText === status;
        card.style.display = matchesSearch && matchesStatus ? 'block' : 'none';
      }
    }

    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
  }, (error) => {
    console.error('Erro ao ler problemas:', error);
    problemsGrid.innerHTML = '<p class="text-center col-span-full text-red-500">Erro ao carregar problemas</p>';
  });

  // Notifications for New Problems
  onValue(ref(db, 'problems'), (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const problem = childSnapshot.val();
      if (problem.responsibleId !== userId) return;
      if (Notification.permission === 'granted') {
        new Notification('Novo Problema', {
          body: `${problem.title || 'Sem título'} - ${problem.description || 'Sem descrição'}`,
          icon: '/assets/icons/Icon-192.png'
        });
      }
    });
  }, { onlyOnce: false }, (error) => {
    console.error('Erro ao configurar notificações:', error);
  });
}

// Responsible Name
async function getResponsibleName(responsibleId) {
  if (!responsibleId) {
    console.warn('responsibleId não fornecido');
    return 'Sem responsável';
  }
  try {
    const docRef = doc(firestore, 'usuarios', responsibleId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.warn('Usuário não encontrado:', responsibleId);
      return 'Responsável não encontrado';
    }
    return docSnap.data().nome || 'Nome não disponível';
  } catch (error) {
    console.error('Erro ao buscar responsável:', responsibleId, error);
    return 'Erro ao carregar responsável';
  }
}

// Update Status
function updateStatus(problemId, newStatus) {
  update(ref(db, `problems/${problemId}`), { status: newStatus })
    .then(() => {
      console.log('Status atualizado:', problemId, newStatus);
      alert('Status atualizado!');
    })
    .catch((error) => {
      console.error('Erro ao atualizar status:', problemId, error);
      alert('Erro ao atualizar status: ' + error.message);
    });
}

// Initialize
auth.onAuthStateChanged(async (user) => {
  if (user && window.location.pathname === '/index.html') {
    console.log('Inicializando painel para usuário:', user.uid);
    try {
      const userDoc = await getDoc(doc(firestore, 'usuarios', user.uid));
      if (userDoc.exists() && userDoc.data().isResponsible) {
        initializeAdminPanel(user.uid);
        requestNotificationPermission();
      } else {
        console.warn('Usuário não é responsável:', user.uid);
        await auth.signOut();
        window.location.href = '/login.html';
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      await auth.signOut();
      window.location.href = '/login.html';
    }
  }
});