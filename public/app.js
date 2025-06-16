import { getDatabase, ref, onValue, update, onChildAdded } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import { auth } from '/auth.js';
import { translate, formatDate, showToast } from '/utils.js';

// Firebase Services
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
    notificationsDisabled: 'Notificações desativadas',
    titleRequired: 'Título e descrição são obrigatórios!'
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
    notificationsDisabled: 'Notifications disabled',
    titleRequired: 'Title and description are required!'
  }
};

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      messaging.useServiceWorker(registration);
      console.log('Service Worker registrado:', registration);
    })
    .catch((error) => {
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
        console.log('Permissão de notificações concedida');
        const token = await getToken(messaging, { vapidKey: 'BKnyjZ4OaEOqoOBovd2bu4f-SwrN6WDW6lkSwkd4BQj8RCY5xxQtWFnBSTRWgOksECGYLbVSl-bpJB-pq3yzkkk' });
        document.getElementById('notificationStatus').textContent = translate('notificationsActive');
        console.log('Token de notificação:', token);
        return;
      }
      throw new Error('Permissão de notificações negada');
    } catch (error) {
      console.error(`Tentativa ${attempt} falhou:`, error);
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        document.getElementById('notificationStatus').textContent = translate('notificationsDisabled');
        showToast('Notificações desativadas', 'warning');
      }
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
  editModal = document.getElementById('editModal');

  if (!problemsGrid) {
    console.error('Grid de problemas não encontrado!');
    showToast('Erro na inicialização do painel', 'danger');
    return;
  }

  // Load Problems
  onValue(problemsRef, (snapshot) => {
    console.log('Snapshot recebido:', snapshot.exists());
    const problems = snapshot.val();
    allProblems = [];

    if (!problems) {
      console.warn('Nenhum problema encontrado no banco');
      problemsGrid.innerHTML = `<div class="col-12"><p class="text-center text-muted">${translate('noProblems')}</p></div>`;
      renderPagination();
      updateDashboard();
      return;
    }

    allProblems = Object.entries(problems).filter(([_, problem]) => {
      console.log('Verificando problema:', { id: problem.responsibleId, expected: userId });
      return problem.responsibleId === userId;
    }).map(([id, problem]) => ({ id, ...problem }));

    console.log('Problemas filtrados:', allProblems);

    if (allProblems.length === 0) {
      console.warn('Nenhum problema encontrado para responsibleId:', userId);
      problemsGrid.innerHTML = `<div class="col-12"><p class="text-center text-muted">${translate('noProblemsAssigned')}</p></div>`;
    }

    renderProblems();
    updateDashboard();
  }, (error) => {
    console.error('Erro ao ler problemas:', error);
    problemsGrid.innerHTML = `<div class="col-12"><p class="text-center text-danger">${translate('errorLoading')}</p></div>`;
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
      try {
        const createdAt = problem.createdAt ? formatDate(problem.createdAt) : 'Sem data';
        const urgencyClass = problem.urgency === 'Alta' ? 'text-danger' : problem.urgency === 'Média' ? 'text-warning' : 'text-success';
        const card = document.createElement('div');
        card.className = 'col';
        card.innerHTML = `
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">${problem.title || 'Sem título'}</h5>
              <p class="card-text"><strong>Descrição:</strong> ${problem.description || 'Sem descrição'}</p>
              <p class="card-text"><strong>Município:</strong> ${problem.municipality || 'Sem município'}</p>
              <p class="card-text"><strong>Bairro:</strong> ${problem.neighborhood || 'Sem bairro'}</p>
              <p class="card-text"><strong>Categoria:</strong> ${problem.category || 'Sem categoria'}</p>
              <p class="card-text"><strong>Urgência:</strong> <span class="${urgencyClass}">${problem.urgency || 'Sem urgência'}</span></p>
              <p class="card-text"><strong>Status:</strong> ${problem.status || 'Sem status'}</p>
              <p class="card-text"><strong>Sugestão:</strong> ${problem.suggestion || 'Sem sugestão'}</p>
              <p class="card-text"><strong>Criado em:</strong> ${createdAt}</p>
              ${problem.imageUrl ? `<a href="${problem.imageUrl}" target="_blank"><img src="${problem.imageUrl}" alt="Imagem do problema" class="img-fluid rounded mb-3" style="max-height: 150px;"></a>` : '<p class="text-muted">Sem imagem</p>'}
            </div>
            <div class="card-footer bg-transparent border-0">
              <div class="d-flex gap-2">
                <select class="form-select" onchange="updateStatus('${problem.id}', this.value)">
                  <option value="Aguardando" ${problem.status === 'Aguardando' ? 'selected' : ''}>Aguardando</option>
                  <option value="Em Andamento" ${problem.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                  <option value="Resolvido" ${problem.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                </select>
                <button class="btn btn-warning" onclick="openEditModal('${problem.id}', '${problem.title || ''}', '${problem.description || ''}', '${problem.status || ''}', '${problem.urgency || ''}', '${problem.suggestion || ''}', '${problem.imageUrl || ''}')">
                  <i class="bi bi-pencil"></i> Editar
                </button>
              </div>
            </div>
          </div>
        `;
        problemsGrid.appendChild(card);
      } catch (error) {
        console.error('Erro ao renderizar problema:', problem.id, error);
      }
    }

    renderPagination();
  }

  // Filter Problems
  function filterProblems() {
    const searchText = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const urgency = urgencyFilter.value;

    return allProblems.filter(problem => {
      const matchesSearch = problem.title?.toLowerCase().includes(searchText) || problem.description?.toLowerCase().includes(searchText);
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
        <a class="page-link" href="#" data-page="${currentPage - 1}">Anterior</a>
      </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
      pagination.innerHTML += `
        <li class="page-item ${currentPage === i ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `;
    }

    pagination.innerHTML += `
      <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage + 1}">Próximo</a>
      </li>
    `;

    pagination.querySelectorAll('a[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt(e.target.dataset.page);
        if (page && page !== currentPage) {
          currentPage = page;
          renderProblems();
        }
      });
    });
  }

  // Update Dashboard
  function updateDashboard() {
    const pendingCount = allProblems.filter(p => p.status === 'Aguardando').length;
    const resolvedCount = allProblems.filter(p => p.status === 'Resolvido').length;
    const highUrgencyCount = allProblems.filter(p => p.urgency === 'Alta').length;

    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('resolvedCount').textContent = resolvedCount;
    document.getElementById('highUrgencyCount').textContent = highUrgencyCount;

    updateCharts();
  }

  // Update Charts
  function updateCharts() {
    const stats = {
      byStatus: { Aguardando: 0, 'Em Andamento': 0, Resolvido: 0 },
      byUrgency: { Baixa: 0, Média: 0, Alta: 0 }
    };

    allProblems.forEach(problem => {
      stats.byStatus[problem.status] = (stats.byStatus[problem.status] || 0) + 1;
      stats.byUrgency[problem.urgency] = (stats.byUrgency[problem.urgency] || 0) + 1;
    });

    const isDarkMode = document.body.dataset.theme === 'dark';
    const chartColors = {
      status: ['#ffc107', '#007bff', '#28a745'],
      urgency: ['#28a745', '#ffc107', '#dc3545'],
      background: isDarkMode ? '#374151' : '#ffffff',
      text: isDarkMode ? '#f3f4f6' : '#1f2937'
    };

    // Status Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(stats.byStatus),
        datasets: [{
          data: Object.values(stats.byStatus),
          backgroundColor: chartColors.status,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: chartColors.text, font: { size: 14 } } },
          title: { display: true, text: translate('statusDistribution') || 'Distribuição por Status', color: chartColors.text, font: { size: 16 } }
        }
      }
    });

    // Urgency Chart
    const urgencyCtx = document.getElementById('urgencyChart').getContext('2d');
    new Chart(urgencyCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(stats.byUrgency),
        datasets: [{
          label: translate('problems') || 'Problemas',
          data: Object.values(stats.byUrgency),
          backgroundColor: chartColors.urgency,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { color: chartColors.text, font: { size: 12 } } },
          x: { ticks: { color: chartColors.text, font: { size: 12 } } }
        },
        plugins: {
          legend: { display: false },
          title: { display: true, text: translate('urgencyDistribution') || 'Distribuição por Urgência', color: chartColors.text, font: { size: 16 } }
        }
      }
    });
  }

  // Event Listeners
  searchInput.addEventListener('input', () => {
    currentPage = 1;
    renderProblems();
  });

  statusFilter.addEventListener('change', () => {
    currentPage = 1;
    renderProblems();
  });

  urgencyFilter.addEventListener('change', () => {
    currentPage = 1;
    renderProblems();
  });

  clearFilters.addEventListener('click', () => {
    searchInput.value = '';
    statusFilter.value = '';
    urgencyFilter.value = '';
    currentPage = 1;
    renderProblems();
  });

  // Section Toggle
  sectionLinks.forEach(link => {
    link.addEventListener('click', (e) => {
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
    link.addEventListener('click', (e) => {
      e.preventDefault();
      currentLang = link.dataset.lang;
      updateLanguage();
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
      console.log('Status atualizado:', problemId, newStatus);
      showToast(translate('statusUpdated'), 'success');
    } catch (error) {
      console.error('Erro ao atualizar status:', problemId, error);
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
    editModal.classList.remove('hidden');
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
      showToast(translate('titleRequired'), 'warning');
      return;
    }

    try {
      await update(ref(db, `problems/${problemId}`), updates);
      console.log('Problema atualizado:', problemId);
      showToast(translate('problemUpdated'), 'success');
      editModal.classList.add('hidden');
    } catch (error) {
      console.error('Erro ao atualizar problema:', error);
      showToast(`${translate('errorUpdate')} ${error.message}`, 'danger');
    }
  });

  document.getElementById('closeModal').addEventListener('click', () => editModal.classList.add('hidden'));
  document.getElementById('cancelEdit').addEventListener('click', () => editModal.classList.add('hidden'));

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

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.responsibleId !== userId) return;
        stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
        stats.byUrgency[data.urgency] = (stats.byUrgency[data.urgency] || 0) + 1;
      });

      // Status Chart
      const statusCtx = document.getElementById('statusChartReports').getContext('2d');
      new Chart(statusCtx, {
        type: 'pie',
        data: {
          labels: Object.keys(stats.byStatus),
          datasets: [{
            data: Object.values(stats.byStatus),
            backgroundColor: ['#ffc107', '#007bff', '#28a745']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' } }
        }
      });

      // Urgency Chart
      const urgencyCtx = document.getElementById('urgencyChartReports').getContext('2d');
      new Chart(urgencyCtx, {
        type: 'bar',
        data: {
          labels: Object.keys(stats.byUrgency),
          datasets: [{
            label: 'Problemas',
            data: Object.values(stats.byUrgency),
            backgroundColor: ['#28a745', '#ffc107', '#dc3545']
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      showToast(translate('errorReports'), 'danger');
    }
  }

  // Notifications for New Problems
  onChildAdded(ref(db, 'problems'), (snapshot) => {
    const problem = snapshot.val();
    if (problem.responsibleId !== userId || Notification.permission !== 'granted') return;
    new Notification(translate('newProblem') || 'Novo Problema', {
      body: `${problem.title || 'Sem título'} - ${problem.description || 'Sem descrição'}`,
      icon: '/assets/icons/Icon-192.png'
    });
  });

  // Language Update
  function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = translate(element.dataset.i18n);
    });
  }

  document.getElementById('reportPeriod').addEventListener('change', (e) => {
    loadReports(parseInt(e.target.value));
  });

  // Keyboard Navigation
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
      editModal.classList.add('hidden');
      document.getElementById('closeModal').focus();
    }
  });
}

// Initialize
auth.onAuthStateChanged(async (user) => {
  if (user && window.location.pathname === '/index.html') {
    console.log('Inicializando painel para usuário:', user.uid, 'Email:', user.email);
    try {
      const userDoc = await getDoc(doc(firestore, 'usuarios', user.uid));
      console.log('Documento do usuário:', {
        exists: userDoc.exists(),
        data: userDoc.data()
      });
      if (userDoc.exists() && userDoc.data().isResponsible) {
        console.log('Usuário é responsável. Inicializando painel...');
        initializeAdminPanel(user.uid);
        requestNotificationPermission();
      } else {
        console.warn('Usuário não é responsável ou documento não existe:', user.uid);
        await signOut(auth);
        window.location.href = '/login.html';
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      await signOut(auth);
      window.location.href = '/login.html';
    }
  } else {
    console.log('Nenhum usuário autenticado ou página incorreta:', user, window.location.pathname);
    window.location.href = '/login.html';
  }
});