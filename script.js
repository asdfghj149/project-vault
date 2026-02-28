/* ============================================================
   PROJECT VAULT - JAVASCRIPT (WITH GITHUB GIST SYNC)
   Handles all functionality: data, UI, interactions, and cloud sync
   ============================================================ */

// ============================================================
// SECTION 1: DATA MANAGEMENT
// Functions to handle localStorage and project data
// ============================================================

const STORAGE_KEYS = {
    PROJECTS: 'projectVault_projects',
    THEME: 'projectVault_theme',
    GITHUB_TOKEN: 'projectVault_githubToken',
    GIST_ID: 'projectVault_gistId',
    LAST_SYNC: 'projectVault_lastSync'
};

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getProjects() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error loading projects:', error);
        return [];
    }
}

function saveProjects(projects) {
    try {
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch (error) {
        console.error('Error saving projects:', error);
        showToast('Error saving data. Storage might be full.', 'error');
    }
}

function getProjectById(id) {
    const projects = getProjects();
    return projects.find(project => project.id === id) || null;
}

function createProject(projectData) {
    const projects = getProjects();
    const now = new Date().toISOString();
    
    const newProject = {
        id: generateId(),
        ...projectData,
        createdAt: now,
        updatedAt: now
    };
    
    projects.unshift(newProject);
    saveProjects(projects);
    
    return newProject;
}

function updateProject(id, projectData) {
    const projects = getProjects();
    const index = projects.findIndex(project => project.id === id);
    
    if (index === -1) return null;
    
    const updatedProject = {
        ...projects[index],
        ...projectData,
        updatedAt: new Date().toISOString()
    };
    
    projects[index] = updatedProject;
    saveProjects(projects);
    
    return updatedProject;
}

function deleteProject(id) {
    const projects = getProjects();
    const filteredProjects = projects.filter(project => project.id !== id);
    
    if (filteredProjects.length === projects.length) {
        return false;
    }
    
    saveProjects(filteredProjects);
    return true;
}

function deleteAllProjects() {
    saveProjects([]);
}

function getRecentProjects(limit = null) {
    const projects = getProjects();
    const sorted = projects.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    
    return limit ? sorted.slice(0, limit) : sorted;
}

function getProjectStats() {
    const projects = getProjects();
    
    return {
        total: projects.length,
        idea: projects.filter(p => p.status === 'idea').length,
        inProgress: projects.filter(p => p.status === 'in-progress').length,
        completed: projects.filter(p => p.status === 'completed').length
    };
}

function getAllTechTags() {
    const projects = getProjects();
    const allTags = projects.flatMap(p => p.techStack || []);
    return [...new Set(allTags)].sort();
}


// ============================================================
// SECTION 1B: GITHUB GIST SYNC
// Functions to sync data with GitHub Gist
// ============================================================

/**
 * Get stored GitHub token
 * @returns {string|null} Token or null
 */
function getGithubToken() {
    return localStorage.getItem(STORAGE_KEYS.GITHUB_TOKEN);
}

/**
 * Save GitHub token
 * @param {string} token - GitHub personal access token
 */
function saveGithubToken(token) {
    localStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, token);
}

/**
 * Remove GitHub token
 */
function removeGithubToken() {
    localStorage.removeItem(STORAGE_KEYS.GITHUB_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.GIST_ID);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
}

/**
 * Get stored Gist ID
 * @returns {string|null} Gist ID or null
 */
function getGistId() {
    return localStorage.getItem(STORAGE_KEYS.GIST_ID);
}

/**
 * Save Gist ID
 * @param {string} gistId - GitHub Gist ID
 */
function saveGistId(gistId) {
    localStorage.setItem(STORAGE_KEYS.GIST_ID, gistId);
}

/**
 * Update last sync timestamp
 */
function updateLastSync() {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
}

/**
 * Get last sync time
 * @returns {string|null} ISO timestamp or null
 */
function getLastSync() {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
}

/**
 * Check if GitHub sync is configured
 * @returns {boolean} True if token exists
 */
function isSyncConfigured() {
    return !!getGithubToken();
}

/**
 * Upload projects to GitHub Gist
 * @returns {Promise<boolean>} Success status
 */
async function uploadToGist() {
    const token = getGithubToken();
    
    if (!token) {
        showToast('Please set up your GitHub token first', 'warning');
        return false;
    }
    
    const projects = getProjects();
    const data = {
        syncedAt: new Date().toISOString(),
        version: '1.0',
        projects: projects
    };
    
    const content = JSON.stringify(data, null, 2);
    const gistId = getGistId();
    
    try {
        let response;
        
        if (gistId) {
            // Update existing gist
            response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'project-vault-data.json': {
                            content: content
                        }
                    }
                })
            });
        } else {
            // Create new gist
            response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: 'Project Vault - Personal Project Data',
                    public: false,
                    files: {
                        'project-vault-data.json': {
                            content: content
                        }
                    }
                })
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to sync');
        }
        
        const result = await response.json();
        
        // Save gist ID if it's a new gist
        if (!gistId) {
            saveGistId(result.id);
        }
        
        updateLastSync();
        updateSyncStatus();
        showToast('Synced to cloud successfully!', 'success');
        return true;
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast(`Sync failed: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Download projects from GitHub Gist
 * @returns {Promise<boolean>} Success status
 */
async function downloadFromGist() {
    const token = getGithubToken();
    const gistId = getGistId();
    
    if (!token) {
        showToast('Please set up your GitHub token first', 'warning');
        return false;
    }
    
    if (!gistId) {
        showToast('No cloud data found. Upload first to create it.', 'info');
        return false;
    }
    
    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch data from cloud');
        }
        
        const gist = await response.json();
        const fileContent = gist.files['project-vault-data.json'].content;
        const data = JSON.parse(fileContent);
        
        if (!data.projects || !Array.isArray(data.projects)) {
            throw new Error('Invalid data format');
        }
        
        // Ask for confirmation before overwriting
        showConfirmDialog(
            'Download from Cloud?',
            `This will replace your current data with ${data.projects.length} project(s) from the cloud. Continue?`,
            () => {
                saveProjects(data.projects);
                updateLastSync();
                updateSyncStatus();
                renderDashboard();
                renderProjectsList();
                populateTechFilter();
                showToast(`Downloaded ${data.projects.length} project(s) from cloud!`, 'success');
            }
        );
        
        return true;
        
    } catch (error) {
        console.error('Download error:', error);
        showToast(`Download failed: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Update sync status display in settings
 */
function updateSyncStatus() {
    const statusIcon = document.getElementById('syncStatusIcon');
    const statusTitle = document.getElementById('syncStatusTitle');
    const statusText = document.getElementById('syncStatusText');
    const lastSyncInfo = document.getElementById('lastSyncInfo');
    const tokenSection = document.getElementById('tokenSection');
    const syncActionsSection = document.getElementById('syncActionsSection');
    
    if (!statusIcon) return; // Not on settings page
    
    const isConfigured = isSyncConfigured();
    
    if (isConfigured) {
        statusIcon.className = 'sync-status-icon connected';
        statusIcon.innerHTML = '<i data-lucide="cloud-check"></i>';
        statusTitle.textContent = 'Connected';
        statusText.textContent = 'Your GitHub token is set up and ready';
        tokenSection.style.display = 'none';
        syncActionsSection.style.display = 'block';
        
        const lastSync = getLastSync();
        if (lastSync) {
            lastSyncInfo.textContent = formatRelativeTime(lastSync);
        } else {
            lastSyncInfo.textContent = 'Never';
        }
    } else {
        statusIcon.className = 'sync-status-icon disconnected';
        statusIcon.innerHTML = '<i data-lucide="cloud-off"></i>';
        statusTitle.textContent = 'Not Connected';
        statusText.textContent = 'Set up your GitHub token to enable cloud sync';
        tokenSection.style.display = 'block';
        syncActionsSection.style.display = 'none';
        lastSyncInfo.textContent = 'Not synced';
    }
    
    lucide.createIcons();
}


// ============================================================
// SECTION 2: DOM ELEMENT REFERENCES
// Cache DOM elements for better performance
// ============================================================

const DOM = {
    // Sidebar elements
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    navLinks: document.querySelectorAll('.nav-link'),
    themeToggle: document.getElementById('themeToggle'),
    
    // Header
    pageTitle: document.getElementById('pageTitle'),
    headerAddBtn: document.getElementById('headerAddBtn'),
    
    // Sections
    dashboardSection: document.getElementById('dashboardSection'),
    projectsSection: document.getElementById('projectsSection'),
    settingsSection: document.getElementById('settingsSection'),
    
    // Dashboard
    statTotal: document.getElementById('statTotal'),
    statIdea: document.getElementById('statIdea'),
    statInProgress: document.getElementById('statInProgress'),
    statCompleted: document.getElementById('statCompleted'),
    recentProjectsGrid: document.getElementById('recentProjectsGrid'),
    dashboardEmptyState: document.getElementById('dashboardEmptyState'),
    dashboardAddBtn: document.getElementById('dashboardAddBtn'),
    
    // Projects section
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    statusFilter: document.getElementById('statusFilter'),
    techFilter: document.getElementById('techFilter'),
    projectsGrid: document.getElementById('projectsGrid'),
    projectsEmptyState: document.getElementById('projectsEmptyState'),
    projectsAddBtn: document.getElementById('projectsAddBtn'),
    emptyAddBtn: document.getElementById('emptyAddBtn'),
    
    // Settings
    themeOptions: document.querySelectorAll('.theme-option'),
    exportBtn: document.getElementById('exportBtn'),
    copyJsonBtn: document.getElementById('copyJsonBtn'),
    exportPreview: document.getElementById('exportPreview'),
    exportTextarea: document.getElementById('exportTextarea'),
    fileDropZone: document.getElementById('fileDropZone'),
    importFileInput: document.getElementById('importFileInput'),
    importTextarea: document.getElementById('importTextarea'),
    importBtn: document.getElementById('importBtn'),
    deleteAllBtn: document.getElementById('deleteAllBtn'),
    
    // GitHub Sync (new)
    githubTokenInput: document.getElementById('githubTokenInput'),
    saveTokenBtn: document.getElementById('saveTokenBtn'),
    toggleTokenBtn: document.getElementById('toggleTokenBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    
    // Project Modal (Add/Edit)
    projectModal: document.getElementById('projectModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    projectForm: document.getElementById('projectForm'),
    projectId: document.getElementById('projectId'),
    projectName: document.getElementById('projectName'),
    projectDescription: document.getElementById('projectDescription'),
    projectTechStack: document.getElementById('projectTechStack'),
    tagsPreview: document.getElementById('tagsPreview'),
    projectGithub: document.getElementById('projectGithub'),
    projectLive: document.getElementById('projectLive'),
    projectGoogleAccount: document.getElementById('projectGoogleAccount'),
    accountsList: document.getElementById('accountsList'),
    addAccountBtn: document.getElementById('addAccountBtn'),
    apisList: document.getElementById('apisList'),
    addApiBtn: document.getElementById('addApiBtn'),
    projectCredentialNote: document.getElementById('projectCredentialNote'),
    projectNotes: document.getElementById('projectNotes'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalDeleteBtn: document.getElementById('modalDeleteBtn'),
    modalSaveBtn: document.getElementById('modalSaveBtn'),
    
    // View Modal
    viewModal: document.getElementById('viewModal'),
    viewModalTitle: document.getElementById('viewModalTitle'),
    viewModalCloseBtn: document.getElementById('viewModalCloseBtn'),
    viewModalBody: document.getElementById('viewModalBody'),
    viewModalClose2Btn: document.getElementById('viewModalClose2Btn'),
    viewEditBtn: document.getElementById('viewEditBtn'),
    viewDeleteBtn: document.getElementById('viewDeleteBtn'),
    
    // Confirm Modal
    confirmModal: document.getElementById('confirmModal'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    
    // Toast container
    toastContainer: document.getElementById('toastContainer')
};


// ============================================================
// SECTION 3: STATE MANAGEMENT
// Variables to track current app state
// ============================================================

let currentSection = 'dashboard';
let currentProjectId = null;
let confirmCallback = null;


// ============================================================
// SECTION 4: INITIALIZATION
// Setup the app when page loads
// ============================================================

function initApp() {
    lucide.createIcons();
    loadTheme();
    renderDashboard();
    renderProjectsList();
    populateTechFilter();
    setupEventListeners();
    
    console.log('Project Vault initialized successfully!');
}

document.addEventListener('DOMContentLoaded', initApp);


// ============================================================
// SECTION 5: THEME MANAGEMENT
// Dark/Light mode switching
// ============================================================

function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    
    const themeText = DOM.themeToggle.querySelector('.theme-text');
    if (themeText) {
        themeText.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
    
    DOM.themeOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}


// ============================================================
// SECTION 6: NAVIGATION
// Switching between sections
// ============================================================

function navigateTo(sectionName) {
    currentSection = sectionName;
    
    DOM.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionName);
    });
    
    const titles = {
        dashboard: 'Dashboard',
        projects: 'Projects',
        settings: 'Settings'
    };
    DOM.pageTitle.textContent = titles[sectionName] || 'Dashboard';
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    closeSidebar();
    
    if (sectionName === 'dashboard') {
        renderDashboard();
    } else if (sectionName === 'projects') {
        renderProjectsList();
        populateTechFilter();
    } else if (sectionName === 'settings') {
        updateSyncStatus();
    }
}

function openSidebar() {
    DOM.sidebar.classList.add('open');
    DOM.sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    DOM.sidebar.classList.remove('open');
    DOM.sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}


// ============================================================
// SECTION 7: RENDERING FUNCTIONS
// Create HTML content for display
// ============================================================

function renderDashboard() {
    const stats = getProjectStats();
    DOM.statTotal.textContent = stats.total;
    DOM.statIdea.textContent = stats.idea;
    DOM.statInProgress.textContent = stats.inProgress;
    DOM.statCompleted.textContent = stats.completed;
    
    const recentProjects = getRecentProjects(5);
    
    const existingCards = DOM.recentProjectsGrid.querySelectorAll('.project-card');
    existingCards.forEach(card => card.remove());
    
    if (recentProjects.length === 0) {
        DOM.dashboardEmptyState.style.display = 'flex';
    } else {
        DOM.dashboardEmptyState.style.display = 'none';
        
        recentProjects.forEach((project, index) => {
            const card = createProjectCard(project, index);
            DOM.recentProjectsGrid.insertBefore(card, DOM.dashboardEmptyState);
        });
    }
    
    lucide.createIcons();
}

function renderProjectsList() {
    let projects = getProjects();
    
    const searchTerm = DOM.searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        projects = projects.filter(project => {
            const searchableText = [
                project.name,
                project.description,
                project.notes,
                ...(project.techStack || [])
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
    }
    
    const statusFilter = DOM.statusFilter.value;
    if (statusFilter !== 'all') {
        projects = projects.filter(project => project.status === statusFilter);
    }
    
    const techFilter = DOM.techFilter.value;
    if (techFilter !== 'all') {
        projects = projects.filter(project => 
            project.techStack && project.techStack.includes(techFilter)
        );
    }
    
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    const existingCards = DOM.projectsGrid.querySelectorAll('.project-card');
    existingCards.forEach(card => card.remove());
    
    if (projects.length === 0) {
        DOM.projectsEmptyState.style.display = 'flex';
    } else {
        DOM.projectsEmptyState.style.display = 'none';
        
        projects.forEach((project, index) => {
            const card = createProjectCard(project, index);
            DOM.projectsGrid.insertBefore(card, DOM.projectsEmptyState);
        });
    }
    
    lucide.createIcons();
}

function createProjectCard(project, index) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.projectId = project.id;
    card.style.animationDelay = `${index * 0.05}s`;
    
    const statusLabels = {
        'idea': 'Idea',
        'in-progress': 'In Progress',
        'completed': 'Completed'
    };
    
    const statusIcons = {
        'idea': 'lightbulb',
        'in-progress': 'loader',
        'completed': 'check-circle'
    };
    
    const updatedDate = formatDate(project.updatedAt);
    
    const techTagsHtml = (project.techStack || [])
        .slice(0, 4)
        .map(tag => `<span class="tech-tag">${escapeHtml(tag)}</span>`)
        .join('');
    
    const moreTags = (project.techStack || []).length > 4 
        ? `<span class="tech-tag">+${project.techStack.length - 4}</span>` 
        : '';
    
    card.innerHTML = `
        <div class="project-card-header">
            <h3 class="project-name">${escapeHtml(project.name)}</h3>
            <span class="status-badge ${project.status}">
                <i data-lucide="${statusIcons[project.status]}"></i>
                ${statusLabels[project.status]}
            </span>
        </div>
        
        ${project.description ? `
            <p class="project-description">${escapeHtml(project.description)}</p>
        ` : ''}
        
        ${techTagsHtml || moreTags ? `
            <div class="tech-tags">
                ${techTagsHtml}
                ${moreTags}
            </div>
        ` : ''}
        
        <div class="project-card-footer">
            <div class="project-links">
                ${project.githubUrl ? `
                    <a href="${escapeHtml(project.githubUrl)}" class="project-link" target="_blank" rel="noopener" title="GitHub" onclick="event.stopPropagation()">
                        <i data-lucide="github"></i>
                    </a>
                ` : ''}
                ${project.liveUrl ? `
                    <a href="${escapeHtml(project.liveUrl)}" class="project-link" target="_blank" rel="noopener" title="Live Demo" onclick="event.stopPropagation()">
                        <i data-lucide="globe"></i>
                    </a>
                ` : ''}
            </div>
            <div class="project-meta">
                ${project.googleAccount ? `
                    <span class="project-email">${escapeHtml(project.googleAccount)}</span>
                ` : ''}
                <span class="project-date">Updated: ${updatedDate}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openViewModal(project.id));
    
    return card;
}

function populateTechFilter() {
    const tags = getAllTechTags();
    
    while (DOM.techFilter.options.length > 1) {
        DOM.techFilter.remove(1);
    }
    
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        DOM.techFilter.appendChild(option);
    });
}


// ============================================================
// SECTION 8: MODAL MANAGEMENT
// Open/close modal dialogs
// ============================================================

function openAddModal() {
    currentProjectId = null;
    
    DOM.projectForm.reset();
    DOM.projectId.value = '';
    DOM.accountsList.innerHTML = '';
    DOM.apisList.innerHTML = '';
    DOM.tagsPreview.innerHTML = '';
    
    document.querySelectorAll('.form-group.has-error').forEach(group => {
        group.classList.remove('has-error');
    });
    
    DOM.modalTitle.textContent = 'Add New Project';
    DOM.modalDeleteBtn.style.display = 'none';
    DOM.projectModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => DOM.projectName.focus(), 100);
    
    lucide.createIcons();
}

function openEditModal(projectId) {
    const project = getProjectById(projectId);
    if (!project) {
        showToast('Project not found', 'error');
        return;
    }
    
    currentProjectId = projectId;
    
    DOM.projectId.value = project.id;
    DOM.projectName.value = project.name || '';
    DOM.projectDescription.value = project.description || '';
    DOM.projectTechStack.value = (project.techStack || []).join(', ');
    DOM.projectGithub.value = project.githubUrl || '';
    DOM.projectLive.value = project.liveUrl || '';
    DOM.projectGoogleAccount.value = project.googleAccount || '';
    DOM.projectCredentialNote.value = project.credentialNote || '';
    DOM.projectNotes.value = project.notes || '';
    
    const statusRadio = document.querySelector(`input[name="status"][value="${project.status}"]`);
    if (statusRadio) statusRadio.checked = true;
    
    renderTagsPreview();
    
    DOM.accountsList.innerHTML = '';
    (project.otherAccounts || []).forEach(account => {
        addAccountRow(account);
    });
    
    DOM.apisList.innerHTML = '';
    (project.apis || []).forEach(api => {
        addApiRow(api);
    });
    
    DOM.modalTitle.textContent = 'Edit Project';
    DOM.modalDeleteBtn.style.display = 'inline-flex';
    DOM.projectModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    lucide.createIcons();
}

function closeProjectModal() {
    DOM.projectModal.classList.remove('active');
    document.body.style.overflow = '';
    currentProjectId = null;
}

function openViewModal(projectId) {
    const project = getProjectById(projectId);
    if (!project) {
        showToast('Project not found', 'error');
        return;
    }
    
    currentProjectId = projectId;
    DOM.viewModalTitle.textContent = project.name;
    DOM.viewModalBody.innerHTML = createProjectDetailHtml(project);
    DOM.viewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    lucide.createIcons();
}

function createProjectDetailHtml(project) {
    const statusLabels = {
        'idea': '💡 Idea',
        'in-progress': '🚧 In Progress',
        'completed': '✅ Completed'
    };
    
    const techTagsHtml = (project.techStack || [])
        .map(tag => `<span class="tech-tag">${escapeHtml(tag)}</span>`)
        .join('') || '<span class="detail-value empty">None</span>';
    
    let accountsHtml = '<span class="detail-value empty">None</span>';
    if (project.otherAccounts && project.otherAccounts.length > 0) {
        accountsHtml = `
            <div class="detail-list">
                ${project.otherAccounts.map(account => `
                    <div class="detail-list-item">
                        <div class="detail-list-item-title">${escapeHtml(account.service)}</div>
                        <div class="detail-list-item-info">
                            ${account.email ? `<div>Email: ${escapeHtml(account.email)}</div>` : ''}
                            ${account.note ? `<div>Note: ${escapeHtml(account.note)}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    let apisHtml = '<span class="detail-value empty">None</span>';
    if (project.apis && project.apis.length > 0) {
        apisHtml = `
            <div class="detail-list">
                ${project.apis.map(api => `
                    <div class="detail-list-item">
                        <div class="detail-list-item-title">${escapeHtml(api.name)}</div>
                        <div class="detail-list-item-info">
                            Key Reference: ${escapeHtml(api.keyRef) || 'Not specified'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    return `
        <div class="detail-section">
            <div class="detail-title">
                <i data-lucide="info"></i>
                Basic Information
            </div>
            <div class="detail-content">
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">
                        <span class="status-badge ${project.status}">${statusLabels[project.status]}</span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value ${!project.description ? 'empty' : ''}">
                        ${project.description ? escapeHtml(project.description) : 'No description'}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">
                <i data-lucide="code-2"></i>
                Tech Stack
            </div>
            <div class="detail-content">
                <div class="detail-tags">
                    ${techTagsHtml}
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">
                <i data-lucide="link"></i>
                Links
            </div>
            <div class="detail-content">
                <div class="detail-row">
                    <span class="detail-label">GitHub</span>
                    <span class="detail-value ${!project.githubUrl ? 'empty' : ''}">
                        ${project.githubUrl 
                            ? `<a href="${escapeHtml(project.githubUrl)}" target="_blank" rel="noopener">${escapeHtml(project.githubUrl)}</a>` 
                            : 'Not provided'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Live Demo</span>
                    <span class="detail-value ${!project.liveUrl ? 'empty' : ''}">
                        ${project.liveUrl 
                            ? `<a href="${escapeHtml(project.liveUrl)}" target="_blank" rel="noopener">${escapeHtml(project.liveUrl)}</a>` 
                            : 'Not provided'}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">
                <i data-lucide="user-circle"></i>
                Accounts
            </div>
            <div class="detail-content">
                <div class="detail-row">
                    <span class="detail-label">Google Account</span>
                    <span class="detail-value ${!project.googleAccount ? 'empty' : ''}">
                        ${project.googleAccount ? escapeHtml(project.googleAccount) : 'Not provided'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Other Accounts</span>
                    <span class="detail-value">
                        ${accountsHtml}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">
                <i data-lucide="key"></i>
                API References
            </div>
            <div class="detail-content">
                ${apisHtml}
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">
                <i data-lucide="file-text"></i>
                Credentials & Notes
            </div>
            <div class="detail-content">
                <div class="detail-row">
                    <span class="detail-label">Credential Ref</span>
                    <span class="detail-value ${!project.credentialNote ? 'empty' : ''}">
                        ${project.credentialNote ? escapeHtml(project.credentialNote) : 'Not provided'}
                    </span>
                </div>
                ${project.notes ? `
                    <div class="detail-row">
                        <span class="detail-label">Notes</span>
                        <span class="detail-value">
                            <div class="detail-notes">${escapeHtml(project.notes)}</div>
                        </span>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="detail-timestamps">
            <span>Created: ${formatDateTime(project.createdAt)}</span>
            <span>Updated: ${formatDateTime(project.updatedAt)}</span>
        </div>
    `;
}

function closeViewModal() {
    DOM.viewModal.classList.remove('active');
    document.body.style.overflow = '';
}

function showConfirmDialog(title, message, onConfirm) {
    DOM.confirmTitle.textContent = title;
    DOM.confirmMessage.textContent = message;
    confirmCallback = onConfirm;
    
    DOM.confirmModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    lucide.createIcons();
}

function closeConfirmDialog() {
    DOM.confirmModal.classList.remove('active');
    document.body.style.overflow = '';
    confirmCallback = null;
}


// ============================================================
// SECTION 9: FORM HANDLING
// Process form data and dynamic fields
// ============================================================

function handleProjectFormSubmit(e) {
    e.preventDefault();
    
    if (!validateProjectForm()) {
        return;
    }
    
    const projectData = {
        name: DOM.projectName.value.trim(),
        description: DOM.projectDescription.value.trim(),
        status: document.querySelector('input[name="status"]:checked').value,
        techStack: parseTechStack(DOM.projectTechStack.value),
        githubUrl: DOM.projectGithub.value.trim(),
        liveUrl: DOM.projectLive.value.trim(),
        googleAccount: DOM.projectGoogleAccount.value.trim(),
        otherAccounts: gatherOtherAccounts(),
        apis: gatherApis(),
        credentialNote: DOM.projectCredentialNote.value.trim(),
        notes: DOM.projectNotes.value.trim()
    };
    
    if (currentProjectId) {
        updateProject(currentProjectId, projectData);
        showToast('Project updated successfully!', 'success');
    } else {
        createProject(projectData);
        showToast('Project created successfully!', 'success');
    }
    
    closeProjectModal();
    renderDashboard();
    renderProjectsList();
    populateTechFilter();
}

function validateProjectForm() {
    let isValid = true;
    
    document.querySelectorAll('.form-group.has-error').forEach(group => {
        group.classList.remove('has-error');
    });
    
    if (!DOM.projectName.value.trim()) {
        DOM.projectName.closest('.form-group').classList.add('has-error');
        DOM.projectName.focus();
        isValid = false;
    }
    
    return isValid;
}

function parseTechStack(input) {
    if (!input) return [];
    
    return input
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
}

function renderTagsPreview() {
    const tags = parseTechStack(DOM.projectTechStack.value);
    
    DOM.tagsPreview.innerHTML = tags
        .map(tag => `<span class="tag-item">${escapeHtml(tag)}</span>`)
        .join('');
}

function addAccountRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'dynamic-row account-row';
    
    row.innerHTML = `
        <button type="button" class="remove-row-btn" title="Remove">
            <i data-lucide="x"></i>
        </button>
        <div class="form-group">
            <label>Service Name</label>
            <input type="text" class="form-input account-service" placeholder="e.g., Vercel, Firebase" value="${escapeHtml(data.service || '')}">
        </div>
        <div class="form-group">
            <label>Email/Username</label>
            <input type="text" class="form-input account-email" placeholder="Email or username" value="${escapeHtml(data.email || '')}">
        </div>
        <div class="form-group full-width">
            <label>Note</label>
            <input type="text" class="form-input account-note" placeholder="e.g., Password in Bitwarden as 'proj-x-vercel'" value="${escapeHtml(data.note || '')}">
        </div>
    `;
    
    row.querySelector('.remove-row-btn').addEventListener('click', () => {
        row.remove();
    });
    
    DOM.accountsList.appendChild(row);
    lucide.createIcons();
}

function gatherOtherAccounts() {
    const accounts = [];
    
    DOM.accountsList.querySelectorAll('.account-row').forEach(row => {
        const service = row.querySelector('.account-service').value.trim();
        const email = row.querySelector('.account-email').value.trim();
        const note = row.querySelector('.account-note').value.trim();
        
        if (service || email || note) {
            accounts.push({ service, email, note });
        }
    });
    
    return accounts;
}

function addApiRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'dynamic-row api-row';
    
    row.innerHTML = `
        <button type="button" class="remove-row-btn" title="Remove">
            <i data-lucide="x"></i>
        </button>
        <div class="form-group">
            <label>API/Service Name</label>
            <input type="text" class="form-input api-name" placeholder="e.g., OpenAI, Stripe" value="${escapeHtml(data.name || '')}">
        </div>
        <div class="form-group">
            <label>Key Reference (NOT the actual key!)</label>
            <input type="text" class="form-input api-keyref" placeholder="e.g., Check Bitwarden: openai-key" value="${escapeHtml(data.keyRef || '')}">
        </div>
    `;
    
    row.querySelector('.remove-row-btn').addEventListener('click', () => {
        row.remove();
    });
    
    DOM.apisList.appendChild(row);
    lucide.createIcons();
}

function gatherApis() {
    const apis = [];
    
    DOM.apisList.querySelectorAll('.api-row').forEach(row => {
        const name = row.querySelector('.api-name').value.trim();
        const keyRef = row.querySelector('.api-keyref').value.trim();
        
        if (name || keyRef) {
            apis.push({ name, keyRef });
        }
    });
    
    return apis;
}


// ============================================================
// SECTION 10: SEARCH & FILTER
// Search and filter functionality
// ============================================================

function handleSearch() {
    DOM.searchClear.classList.toggle('visible', DOM.searchInput.value.length > 0);
    renderProjectsList();
}

function clearSearch() {
    DOM.searchInput.value = '';
    DOM.searchClear.classList.remove('visible');
    renderProjectsList();
    DOM.searchInput.focus();
}


// ============================================================
// SECTION 11: IMPORT & EXPORT
// Backup and restore functionality
// ============================================================

function exportToJson() {
    const projects = getProjects();
    const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        projects: projects
    };
    
    const json = JSON.stringify(data, null, 2);
    
    DOM.exportTextarea.value = json;
    DOM.exportPreview.classList.add('visible');
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-vault-backup-${formatDateForFilename(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully!', 'success');
}

function copyJsonToClipboard() {
    const projects = getProjects();
    const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        projects: projects
    };
    
    const json = JSON.stringify(data, null, 2);
    
    navigator.clipboard.writeText(json)
        .then(() => {
            showToast('Copied to clipboard!', 'success');
            DOM.exportTextarea.value = json;
            DOM.exportPreview.classList.add('visible');
        })
        .catch(() => {
            showToast('Failed to copy. Try the export button.', 'error');
        });
}

function handleFileDrop(e) {
    e.preventDefault();
    DOM.fileDropZone.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        readImportFile(file);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        readImportFile(file);
    }
}

function readImportFile(file) {
    if (!file.name.endsWith('.json')) {
        showToast('Please select a JSON file', 'error');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        DOM.importTextarea.value = e.target.result;
        showToast('File loaded! Click "Import Data" to confirm.', 'info');
    };
    
    reader.onerror = () => {
        showToast('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

function importData() {
    const jsonText = DOM.importTextarea.value.trim();
    
    if (!jsonText) {
        showToast('Please paste JSON data or select a file first', 'warning');
        return;
    }
    
    try {
        const data = JSON.parse(jsonText);
        
        if (!data.projects || !Array.isArray(data.projects)) {
            throw new Error('Invalid data format');
        }
        
        showConfirmDialog(
            'Import Data?',
            `This will replace all current data with ${data.projects.length} project(s). This cannot be undone!`,
            () => {
                const validProjects = data.projects.map(project => ({
                    id: project.id || generateId(),
                    name: project.name || 'Untitled Project',
                    description: project.description || '',
                    status: ['idea', 'in-progress', 'completed'].includes(project.status) 
                        ? project.status : 'idea',
                    techStack: Array.isArray(project.techStack) ? project.techStack : [],
                    githubUrl: project.githubUrl || '',
                    liveUrl: project.liveUrl || '',
                    googleAccount: project.googleAccount || '',
                    otherAccounts: Array.isArray(project.otherAccounts) ? project.otherAccounts : [],
                    apis: Array.isArray(project.apis) ? project.apis : [],
                    credentialNote: project.credentialNote || '',
                    notes: project.notes || '',
                    createdAt: project.createdAt || new Date().toISOString(),
                    updatedAt: project.updatedAt || new Date().toISOString()
                }));
                
                saveProjects(validProjects);
                DOM.importTextarea.value = '';
                renderDashboard();
                renderProjectsList();
                populateTechFilter();
                
                showToast(`Successfully imported ${validProjects.length} project(s)!`, 'success');
            }
        );
    } catch (error) {
        console.error('Import error:', error);
        showToast('Invalid JSON format. Please check your data.', 'error');
    }
}


// ============================================================
// SECTION 12: TOAST NOTIFICATIONS
// Show temporary success/error messages
// ============================================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };
    
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="toast-icon"></i>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}


// ============================================================
// SECTION 13: EVENT LISTENERS
// Connect UI elements to functions
// ============================================================

function setupEventListeners() {
    // Navigation
    DOM.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.section);
        });
    });
    
    document.querySelector('.view-all-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('projects');
    });
    
    // Mobile sidebar
    DOM.mobileMenuBtn.addEventListener('click', openSidebar);
    DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);
    DOM.sidebarOverlay.addEventListener('click', closeSidebar);
    
    // Theme
    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            setTheme(option.dataset.theme);
        });
    });
    
    // Add project buttons
    DOM.headerAddBtn.addEventListener('click', openAddModal);
    DOM.dashboardAddBtn.addEventListener('click', openAddModal);
    DOM.projectsAddBtn.addEventListener('click', openAddModal);
    DOM.emptyAddBtn.addEventListener('click', openAddModal);
    
    // Project modal
    DOM.modalCloseBtn.addEventListener('click', closeProjectModal);
    DOM.modalCancelBtn.addEventListener('click', closeProjectModal);
    DOM.projectModal.addEventListener('click', (e) => {
        if (e.target === DOM.projectModal) closeProjectModal();
    });
    DOM.projectForm.addEventListener('submit', handleProjectFormSubmit);
    DOM.projectTechStack.addEventListener('input', renderTagsPreview);
    DOM.addAccountBtn.addEventListener('click', () => addAccountRow());
    DOM.addApiBtn.addEventListener('click', () => addApiRow());
    
    DOM.modalDeleteBtn.addEventListener('click', () => {
        if (currentProjectId) {
            showConfirmDialog(
                'Delete Project?',
                'Are you sure you want to delete this project? This action cannot be undone.',
                () => {
                    deleteProject(currentProjectId);
                    closeProjectModal();
                    renderDashboard();
                    renderProjectsList();
                    showToast('Project deleted', 'success');
                }
            );
        }
    });
    
    // View modal
    DOM.viewModalCloseBtn.addEventListener('click', closeViewModal);
    DOM.viewModalClose2Btn.addEventListener('click', closeViewModal);
    DOM.viewModal.addEventListener('click', (e) => {
        if (e.target === DOM.viewModal) closeViewModal();
    });
    
    DOM.viewEditBtn.addEventListener('click', () => {
        closeViewModal();
        openEditModal(currentProjectId);
    });
    
    DOM.viewDeleteBtn.addEventListener('click', () => {
        showConfirmDialog(
            'Delete Project?',
            'Are you sure you want to delete this project? This action cannot be undone.',
            () => {
                deleteProject(currentProjectId);
                closeViewModal();
                renderDashboard();
                renderProjectsList();
                showToast('Project deleted', 'success');
            }
        );
    });
    
    // Confirm modal
    DOM.confirmCancelBtn.addEventListener('click', closeConfirmDialog);
    DOM.confirmModal.addEventListener('click', (e) => {
        if (e.target === DOM.confirmModal) closeConfirmDialog();
    });
    DOM.confirmDeleteBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
        closeConfirmDialog();
    });
    
    // Search & filter
    DOM.searchInput.addEventListener('input', debounce(handleSearch, 300));
    DOM.searchClear.addEventListener('click', clearSearch);
    DOM.statusFilter.addEventListener('change', renderProjectsList);
    DOM.techFilter.addEventListener('change', renderProjectsList);
    
    // Export
    DOM.exportBtn.addEventListener('click', exportToJson);
    DOM.copyJsonBtn.addEventListener('click', copyJsonToClipboard);
    
    // Import
    DOM.fileDropZone.addEventListener('click', () => DOM.importFileInput.click());
    DOM.importFileInput.addEventListener('change', handleFileSelect);
    DOM.fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.fileDropZone.classList.add('dragover');
    });
    DOM.fileDropZone.addEventListener('dragleave', () => {
        DOM.fileDropZone.classList.remove('dragover');
    });
    DOM.fileDropZone.addEventListener('drop', handleFileDrop);
    DOM.importBtn.addEventListener('click', importData);
    
    // Delete all
    DOM.deleteAllBtn.addEventListener('click', () => {
        const projectCount = getProjects().length;
        
        if (projectCount === 0) {
            showToast('No projects to delete', 'info');
            return;
        }
        
        showConfirmDialog(
            'Delete All Projects?',
            `This will permanently delete all ${projectCount} project(s). This cannot be undone!`,
            () => {
                deleteAllProjects();
                renderDashboard();
                renderProjectsList();
                showToast('All projects deleted', 'success');
            }
        );
    });
    
    // === GITHUB SYNC EVENT LISTENERS ===
    
    // Save GitHub token
    DOM.saveTokenBtn?.addEventListener('click', () => {
        const token = DOM.githubTokenInput.value.trim();
        
        if (!token) {
            showToast('Please enter a GitHub token', 'warning');
            return;
        }
        
        // Basic validation (GitHub tokens start with ghp_ or github_pat_)
        if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
            showToast('Invalid token format. Make sure you copied it correctly.', 'error');
            return;
        }
        
        saveGithubToken(token);
        DOM.githubTokenInput.value = '';
        updateSyncStatus();
        showToast('GitHub token saved! You can now sync to cloud.', 'success');
    });
    
    // Toggle token visibility
    DOM.toggleTokenBtn?.addEventListener('click', () => {
        const input = DOM.githubTokenInput;
        const icon = DOM.toggleTokenBtn.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.setAttribute('data-lucide', 'eye-off');
        } else {
            input.type = 'password';
            icon.setAttribute('data-lucide', 'eye');
        }
        
        lucide.createIcons();
    });
    
    // Disconnect GitHub
    DOM.disconnectBtn?.addEventListener('click', () => {
        showConfirmDialog(
            'Disconnect GitHub?',
            'This will remove your GitHub token. Your local data will not be affected, but you won\'t be able to sync until you set up a new token.',
            () => {
                removeGithubToken();
                updateSyncStatus();
                showToast('GitHub disconnected', 'info');
            }
        );
    });
    
    // Upload to cloud
    DOM.uploadBtn?.addEventListener('click', async () => {
        const btn = DOM.uploadBtn;
        const originalHtml = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<span class="sync-loading"><i data-lucide="loader"></i> Uploading...</span>';
        lucide.createIcons();
        
        await uploadToGist();
        
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        lucide.createIcons();
    });
    
    // Download from cloud
    DOM.downloadBtn?.addEventListener('click', async () => {
        const btn = DOM.downloadBtn;
        const originalHtml = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<span class="sync-loading"><i data-lucide="loader"></i> Downloading...</span>';
        lucide.createIcons();
        
        await downloadFromGist();
        
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        lucide.createIcons();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (DOM.confirmModal.classList.contains('active')) {
                closeConfirmDialog();
            } else if (DOM.viewModal.classList.contains('active')) {
                closeViewModal();
            } else if (DOM.projectModal.classList.contains('active')) {
                closeProjectModal();
            } else if (DOM.sidebar.classList.contains('open')) {
                closeSidebar();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            navigateTo('projects');
            DOM.searchInput.focus();
        }
    });
}


// ============================================================
// SECTION 14: UTILITY FUNCTIONS
// Helper functions used throughout the app
// ============================================================

function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateForFilename(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Format a timestamp as relative time (e.g., "2 minutes ago")
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time string
 */
function formatRelativeTime(dateString) {
    if (!dateString) return 'Never';
    
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return formatDate(dateString);
}

function debounce(func, wait) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}