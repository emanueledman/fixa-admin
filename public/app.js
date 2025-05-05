import { getDatabase, ref, onValue, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// Firebase Services
const auth = getAuth();
const db = getDatabase();
const firestore = getFirestore();
const messaging = getMessaging();

// Configuration
const ITEMS_PER_PAGE = 6;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

// State
let currentPage = 1;
let allProblems = [];
let currentLang = 'pt-BR';
let editModal = null;

// Translations
const translations = {
  'pt-BR': {
    noProblems: 'Nenhum problema encontrado',
    noProblemsAssigned: 'Nenhum problema atribuído a você',
    errorLoading: 'Erro ao carregar problemas',
    errorReports: 'Erro ao carregar relatórios',
    statusUpdated: 'Status atualizado!',
    problemUpdated: 'Problema atualizado com sucesso!',
    errorUpdate: 'Erro ao atualizar: ',
    notificationsActive: 'Notificações ativas',
    notificationsDisabled: 'Notificações desativadas'
  },
  'en-US': {
    noProblems: 'No problems found',
    noProblemsAssigned: 'No problems assigned to you',
    errorLoading: 'Error loading problems',
    errorReports: 'Error loading reports',
    statusUpdated: 'Status updated!',
    problemUpdated: 'Problem updated successfully!',
    errorUpdate: 'Error updating: ',
    notificationsActive: 'Notifications active',
    notificationsDisabled: 'Notifications disabled'
  }
};

// Utility Functions
function translate(key) {
  return translations[currentLang][key] || key;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Sem data';
  const date = new Date(timestamp);
  return date.toLocaleString(currentLang, { dateStyle: 'medium', timeStyle: 'short' });
}

function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type === 'danger' ? 'danger' : type === 'success' ? 'success' : 'warning'} border-0`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  document.body.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
  setTimeout(() => toast.remove(), 3000);
}

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(registration => {
      messaging.useServiceWorker(registration);
      console.log('Service Worker registrado');
    })
    .catch(error => {
      console.error('Erro ao registrar Service Worker:', error);
      showToast('Erro ao configurar notificações', 'danger');
    });
}

// Notifications
async function requestNotificationPermission() {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { vapidKey: 'BKnyjZ4OaEOqoOBovd2bu4f-SwrN6WDW6lkSwkd4BQj8RCY5xxQtWFnBSTRWgOksECGYLbVSl-bpJB-pq3yzkkk' });
        document.getElementById('notificationStatus').textContent = translate('notificationsActive');
        return;
      }
      throw new Error('Permissão negada');
    } catch (error) {
      if (attempt === RETRY_ATTEMPTS) {
        document.getElementById('notificationStatus').textContent = translate('notificationsDisabled');
        showToast('Notificações desativadas', 'warning');
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

// Admin Panel
function initializeAdminPanel(userId) {
  const problemsRef = ref(db, 'problems');
  const problemsGrid = document.getElementById('problemsGrid');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const urgencyFilter = document.getElementById('urgencyFilter');
  const clearFilters = document.getElementById('clearFilters');
  const sectionLinks = document.querySelectorAll('.nav-link[data-section]');
  const sections = document.querySelectorAll('.section');
  const langLinks = document.querySelectorAll('[data-lang]');
  editModal = new bootstrap.Modal(document.getElementById('editModal'));

  // Initialize AOS
  AOS.init({ duration: 800, easing: 'ease-in-out', once: true });

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // Load Problems
  onValue(problemsRef, snapshot => {
    allProblems = [];
    if (!snapshot.exists()) {
      problemsGrid.innerHTML = `<div class="col-12"><p class="text-center text-muted">${translate('noProblems')}</p></div>`;
      renderPagination();
      return;
    }

    allProblems = Object.entries(snapshot.val())
      .filter(([_, problem]) => problem.responsibleId === userId)
      .map(([id, problem]) => ({ id, ...problem }));

    if (!allProblems.length) {
      problemsGrid.innerHTML = `<div class="col-12"><p class="text-center text-muted">${translate('noProblemsAssigned')}</p></div>`;
    }

    renderProblems();
  }, error => {
    problemsGrid.innerHTML = `<div class="col-12"><p class="error-message">${translate('errorLoading')}</p></div>`;
    showToast('Erro ao carregar dados', 'danger');
  });

  // Render Problems
  function renderProblems() {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const filteredProblems = filterProblems();
    const paginatedProblems = filteredProblems.slice(start, end);
    problemsGrid.innerHTML = '';

    for (const problem of paginatedProblems) {
      const createdAt = formatDate(problem.createdAt);
      const urgencyClass = problem.urgency === 'Alta' ? 'text-danger' : problem.urgency === 'Média' ? 'text-warning' : 'text-success';
      const card = `
        <div class="col-md-4 col-sm-6" data-aos="fade-up" data-aos-delay="100">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">${problem.title || 'Sem título'}</h5>
              <p><strong>Descrição:</strong> ${problem.description || 'Sem descrição'}</p>
              <p><strong>Município:</strong> ${problem.municipality || 'Sem município'}</p>
              <p><strong>Bairro:</strong> ${problem.neighborhood || 'Sem bairro'}</p>
              <p><strong>Categoria:</strong> ${problem.category || 'Sem categoria'}</p>
              <p><strong>Urgência:</strong> <span class="${urgencyClass}">${problem.urgency || 'Sem urgência'}</span></p>
              <p><strong>Status:</strong> ${problem.status || 'Sem status'}</p>
              <p><strong>Sugestão:</strong> ${problem.suggestion || 'Sem sugestão'}</p>
              <p><strong>Criado em:</strong> ${createdAt}</p>
              ${problem.imageUrl ? `<a href="${problem.imageUrl}" target="_blank"><img src="${problem.imageUrl}" alt="Imagem do problema" class="img-fluid rounded mb-3" style="max-height: 150px;"></a>` : '<p class="text-muted">Sem imagem</p>'}
              <div class="d-flex gap-2">
                <select class="form-select" onchange="updateStatus('${problem.id}', this.value)">
                  <option value="Aguardando" ${problem.status === 'Aguardando' ? 'selected' : ''}>Aguardando</option>
                  <option value="Em Andamento" ${problem.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                  <option value="Resolvido" ${problem.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                </select>
                <button class="btn btn-warning" onclick="openEditModal('${problem.id}', '${problem.title || ''}', '${problem.description || ''}', '${problem.status || ''}', '${problem.urgency || ''}', '${problem.suggestion || ''}', '${problem.imageUrl || ''}')">
                  <i class="fas fa-edit"></i> Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      problemsGrid.innerHTML += card;
    }

    renderPagination();
  }

  // Filter Problems
  function filterProblems() {
    const searchText = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const urgency = urgencyFilter.value;

    return allProblems.filter(problem => {
      const matchesSearch = (problem.title?.toLowerCase().includes(searchText) || problem.description?.toLowerCase().includes(searchText));
      const matchesStatus = !status || problem.status === status;
      const matchesUrgency = !urgency || problem.urgency === urgency;
      return matchesSearch && matchesStatus && matchesUrgency;
    });
  }

  // Pagination
  function renderPagination() {
    const totalPages = Math.ceil(filterProblems().length / ITEMS_PER_PAGE);
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    pagination.innerHTML += `
      <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage - 1}" style="background: var(--dark-card); color: var(--light-text); border-color: rgba(255, 255, 255, 0.1);">Anterior</a>
      </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
      pagination.innerHTML += `
        <li class="page-item ${currentPage === i ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}" style="background: ${currentPage === i ? 'var(--primary-color)' : 'var(--dark-card)'}; color: var(--light-text); border-color: rgba(255, 255, 255, 0.1);">${i}</a>
        </li>
      `;
    }

    pagination.innerHTML += `
      <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage + 1}" style="background: var(--dark-card); color: var(--light-text); border-color: rgba(255, 255, 255, 0.1);">Próximo</a>
      </li>
    `;

    pagination.querySelectorAll('a[data-page]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const page = parseInt(e.target.dataset.page);
        if (page && page !== currentPage) {
          currentPage = page;
          renderProblems();
        }
      });
    });
  }

  // Event Listeners
  searchInput.addEventListener('input', () => { currentPage = 1; renderProblems(); });
  statusFilter.addEventListener('change', () => { currentPage = 1; renderProblems(); });
  urgencyFilter.addEventListener('change', () => { currentPage = 1; renderProblems(); });
  clearFilters.addEventListener('click', () => {
    searchInput.value = '';
    statusFilter.value = '';
    urgencyFilter.value = '';
    currentPage = 1;
    renderProblems();
  });

  // Section Toggle
  sectionLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      sections.forEach(s => s.classList.add('d-none'));
      document.getElementById(`${section}Section`).classList.remove('d-none');
      sectionLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      if (section === 'reports') loadReports(30);
    });
  });

  // Language Switch
  langLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      currentLang = link.dataset.lang;
      renderProblems();
      if (!document.getElementById('reportsSection').classList.contains('d-none')) {
        loadReports(parseInt(document.getElementById('reportPeriod').value));
      }
    });
  });

  // Update Status
  window.updateStatus = async (problemId, newStatus) => {
    try {
      await update(ref(db, `problems/${problemId}`), { status: newStatus });
      showToast(translate('statusUpdated'), 'success');
    } catch (error) {
      showToast(`${translate('errorUpdate')} ${error.message}`, 'danger');
    }
  };

  // Edit Modal
  window.openEditModal = (problemId, title, description, status, urgency, suggestion, imageUrl) => {
    document.getElementById('editTitle').value = title;
    document.getElementById('editDescription').value = description;
    document.getElementById('editStatus').value = status;
    document.getElementById('editUrgency').value = urgency;
    document.getElementById('editSuggestion').value = suggestion;
    document.getElementById('editImage').value = imageUrl;
    const preview = document.getElementById('imagePreview');
    if (imageUrl) {
      preview.src = imageUrl;
      preview.classList.remove('d-none');
    } else {
      preview.classList.add('d-none');
    }
    document.getElementById('saveEdit').dataset.problemId = problemId;
    editModal.show();
  };

  document.getElementById('saveEdit').addEventListener('click', async () => {
    const problemId = document.getElementById('saveEdit').dataset.problemId;
    const updates = {
      title: document.getElementById('editTitle').value.trim(),
      description: document.getElementById('editDescription').value.trim(),
      status: document.getElementById('editStatus').value,
      urgency: document.getElementById('editUrgency').value,
      suggestion: document.getElementById('editSuggestion').value.trim()
    };

    if (!updates.title || !updates.description) {
      showToast('Título e descrição são obrigatórios!', 'warning');
      return;
    }

    try {
      await update(ref(db, `problems/${problemId}`), updates);
      showToast(translate('problemUpdated'), 'success');
      editModal.hide();
    } catch (error) {
      showToast(`${translate('errorUpdate')} ${error.message}`, 'danger');
    }
  });

  // Reports
  async function loadReports(periodDays) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      const q = query(collection(firestore, 'relatorios_problemas'), where('createdAt', '>=', startDate.getTime()));
      const querySnapshot = await getDocs(q);
      const stats = {
        byStatus: { Aguardando: 0, 'Em Andamento': 0, Resolvido: 0 },
        byUrgency: { Baixa: 0, Média: 0, Alta: 0 }
      };

      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.responsibleId !== userId) return;
        stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
        stats.byUrgency[data.urgency] = (stats.byUrgency[data.urgency] || 0) + 1;
      });

      new Chart(document.getElementById('statusChart').getContext('2d'), {
        type: 'pie',
        data: {
          labels: Object.keys(stats.byStatus),
          datasets: [{ data: Object.values(stats.byStatus), backgroundColor: ['#f59e0b', '#10b981', '#0ea5e9'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#f3f4f6' } } } }
      });

      new Chart(document.getElementById('urgencyChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(stats.byUrgency),
          datasets: [{ label: 'Problemas', data: Object.values(stats.byUrgency), backgroundColor: '#ef4444' }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { color: '#f3f4f6' } }, x: { ticks: { color: '#f3f4f6' } } } }
      });
    } catch (error) {
      showToast(translate('errorReports'), 'danger');
    }
  }

  // Notifications for New Problems
  onValue(ref(db, 'problems'), snapshot => {
    snapshot.forEach(childSnapshot => {
      const problem = childSnapshot.val();
      if (problem.responsibleId !== userId || Notification.permission !== 'granted') return;
      new Notification('Novo Problema', {
        body: `${problem.title || 'Sem título'} - ${problem.description || 'Sem descrição'}`,
        icon: '/assets/icons/Icon-192.png'
      });
    });
  }, { onlyOnce: false });

  // Initialize
  auth.onAuthStateChanged(async user => {
    if (user && window.location.pathname === '/index.html') {
      try {
        const userDoc = await getDoc(doc(firestore, 'usuarios', user.uid));
        if (userDoc.exists() && userDoc.data().isResponsible) {
          initializeAdminPanel(user.uid);
          requestNotificationPermission();
        } else {
          await auth.signOut();
          window.location.href = '/login.html';
        }
      } catch (error) {
        await auth.signOut();
        window.location.href = '/login.html';
      }
    }
  });

  // Logout
  document.getElementById('logoutButton').addEventListener('click', async e => {
    e.preventDefault();
    try {
      await auth.signOut();
      window.location.href = '/login.html';
    } catch (error) {
      showToast('Erro ao fazer logout', 'danger');
    }
  });
}