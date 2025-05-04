export function translate(key) {
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
    return translations[document.documentElement.lang || 'pt-BR'][key] || key;
  }
  
  export function formatDate(timestamp) {
    if (!timestamp) return 'Sem data';
    const date = new Date(timestamp);
    return date.toLocaleString(document.documentElement.lang || 'pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
  
  export function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    setTimeout(() => toast.remove(), 5000);
  }