/* ============================================================
   PROJECT VAULT - WITH FIREBASE AUTHENTICATION
   Complete rewrite with cloud sync and login system
   ============================================================ */

// ============================================================
// FIREBASE & AUTH STATE
// ============================================================

let currentUser = null;
let unsubscribeProjects = null; // Firestore listener

// ============================================================
// STORAGE KEYS (for theme only - data is now in Firestore)
// ============================================================

const STORAGE_KEYS = {
    THEME: 'projectVault_theme'
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

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

// ============================================================
// DOM REFERENCES
// ============================================================

const DOM = {
    // Login elements
    loginContainer: document.getElementById('loginContainer'),
    signupForm: document.getElementById('signupForm'),
    signinForm: document.getElementById('signinForm'),
    googleSignInBtn: document.getElementById('googleSignInBtn'),
    toggleFormBtn: document.getElementById('toggleFormBtn'),
    toggleText: document.getElementById('toggleText'),
    loginLoading: document.getElementById('loginLoading'),
    loginError: document.getElementById('loginError'),
    loginErrorText: document.getElementById('loginErrorText'),
    
    // App container
    appContainer: document.getElementById('appContainer'),
    
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    navLinks: document.querySelectorAll('.nav-link'),
    themeToggle: document.getElementById('themeToggle'),
    
    // User profile
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    userEmail: document.getElementById('userEmail'),
    settingsUserEmail: document.getElementById('settingsUserEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    
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
    
    // Projects
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
    deleteAllBtn: document.getElementById('deleteAllBtn'),
    
    // Modals
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
    
    viewModal: document.getElementById('viewModal'),
    viewModalTitle: document.getElementById('viewModalTitle'),
    viewModalCloseBtn: document.getElementById('viewModalCloseBtn'),
    viewModalBody: document.getElementById('viewModalBody'),
    viewModalClose2Btn: document.getElementById('viewModalClose2Btn'),
    viewEditBtn: document.getElementById('viewEditBtn'),
    viewDeleteBtn: document.getElementById('viewDeleteBtn'),
    
    confirmModal: document.getElementById('confirmModal'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    
    toastContainer: document.getElementById('toastContainer')
};

// ============================================================
// STATE
// ============================================================

let currentSection = 'dashboard';
let currentProjectId = null;
let confirmCallback = null;
let cachedProjects = []; // Local cache of projects

// ============================================================
// AUTHENTICATION FUNCTIONS
// ============================================================

/**
 * Show login screen, hide app
 */
function showLoginScreen() {
    DOM.loginContainer.style.display = 'flex';
    DOM.appContainer.style.display = 'none';
    DOM.loginLoading.style.display = 'none';
    DOM.loginError.style.display = 'none';
}

/**
 * Show app, hide login screen
 */
function showApp() {
    DOM.loginContainer.style.display = 'none';
    DOM.appContainer.style.display = 'flex';
}

/**
 * Show error on login screen
 */
function showLoginError(message) {
    DOM.loginErrorText.textContent = message;
    DOM.loginError.style.display = 'flex';
    DOM.loginLoading.style.display = 'none';
}

/**
 * Hide error on login screen
 */
function hideLoginError() {
    DOM.loginError.style.display = 'none';
}

/**
 * Sign up with email and password
 */
async function signUpWithEmail(email, password) {
    try {
        DOM.loginLoading.style.display = 'flex';
        hideLoginError();
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('User signed up:', userCredential.user.uid);
        
        // User will be automatically signed in
        
    } catch (error) {
        console.error('Sign up error:', error);
        
        let message = 'Failed to create account. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            message = 'This email is already in use. Try signing in instead.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address.';
        } else if (error.code === 'auth/weak-password') {
            message = 'Password should be at least 6 characters.';
        }
        
        showLoginError(message);
    }
}

/**
 * Sign in with email and password
 */
async function signInWithEmail(email, password) {
    try {
        DOM.loginLoading.style.display = 'flex';
        hideLoginError();
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('User signed in:', userCredential.user.uid);
        
    } catch (error) {
        console.error('Sign in error:', error);
        
        let message = 'Failed to sign in. Please check your credentials.';
        
        if (error.code === 'auth/user-not-found') {
            message = 'No account found with this email. Try signing up.';
        } else if (error.code === 'auth/wrong-password') {
            message = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address.';
        }
        
        showLoginError(message);
    }
}

/**
 * Sign in with Google
 */
async function signInWithGoogle() {
    try {
        DOM.loginLoading.style.display = 'flex';
        hideLoginError();
        
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        
        console.log('Google sign in successful:', result.user.uid);
        
    } catch (error) {
        console.error('Google sign in error:', error);
        
        let message = 'Failed to sign in with Google.';
        
        if (error.code === 'auth/popup-closed-by-user') {
            message = 'Sign in cancelled.';
        } else if (error.code === 'auth/popup-blocked') {
            message = 'Popup blocked. Please allow popups for this site.';
        }
        
        showLoginError(message);
    }
}

/**
 * Sign out
 */
async function signOut() {
    try {
        await auth.signOut();
        showToast('Signed out successfully', 'success');
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Failed to sign out', 'error');
    }
}

/**
 * Update user profile display
 */
function updateUserProfile(user) {
    if (!user) return;
    
    const displayName = user.displayName || user.email.split('@')[0];
    const email = user.email;
    const photoURL = user.photoURL;
    
    // Update sidebar
    DOM.userName.textContent = displayName;
    DOM.userEmail.textContent = email;
    
    // Update avatar
    if (photoURL) {
        DOM.userAvatar.innerHTML = `<img src="${photoURL}" alt="Profile">`;
    } else {
        DOM.userAvatar.innerHTML = `<i data-lucide="user"></i>`;
        lucide.createIcons();
    }
    
    // Update settings
    DOM.settingsUserEmail.textContent = email;
}

// ============================================================
// FIRESTORE DATA FUNCTIONS
// ============================================================

/**
 * Get reference to user's projects collection
 */
function getUserProjectsRef() {
    if (!currentUser) return null;
    return db.collection('users').doc(currentUser.uid).collection('projects');
}

/**
 * Listen to projects in real-time
 */
function listenToProjects() {
    const projectsRef = getUserProjectsRef();
    if (!projectsRef) return;
    
    // Unsubscribe from previous listener if exists
    if (unsubscribeProjects) {
        unsubscribeProjects();
    }
    
    // Set up real-time listener
    unsubscribeProjects = projectsRef.onSnapshot(
        (snapshot) => {
            cachedProjects = [];
            
            snapshot.forEach((doc) => {
                cachedProjects.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log('Projects updated:', cachedProjects.length);
            
            // Refresh UI
            renderDashboard();
            renderProjectsList();
            populateTechFilter();
        },
        (error) => {
            console.error('Error listening to projects:', error);
            showToast('Failed to sync projects', 'error');
        }
    );
}

/**
 * Get all projects (from cache)
 */
function getProjects() {
    return cachedProjects;
}

/**
 * Get project by ID
 */
function getProjectById(id) {
    return cachedProjects.find(p => p.id === id) || null;
}

/**
 * Create a new project
 */
async function createProject(projectData) {
    const projectsRef = getUserProjectsRef();
    if (!projectsRef) {
        showToast('Not authenticated', 'error');
        return null;
    }
    
    const now = new Date().toISOString();
    const newProject = {
        ...projectData,
        createdAt: now,
        updatedAt: now
    };
    
    try {
        const docRef = await projectsRef.add(newProject);
        console.log('Project created:', docRef.id);
        return { id: docRef.id, ...newProject };
    } catch (error) {
        console.error('Error creating project:', error);
        showToast('Failed to create project', 'error');
        return null;
    }
}

/**
 * Update a project
 */
async function updateProject(id, projectData) {
    const projectsRef = getUserProjectsRef();
    if (!projectsRef) {
        showToast('Not authenticated', 'error');
        return null;
    }
    
    const updatedData = {
        ...projectData,
        updatedAt: new Date().toISOString()
    };
    
    try {
        await projectsRef.doc(id).update(updatedData);
        console.log('Project updated:', id);
        return { id, ...updatedData };
    } catch (error) {
        console.error('Error updating project:', error);
        showToast('Failed to update project', 'error');
        return null;
    }
}

/**
 * Delete a project
 */
async function deleteProject(id) {
    const projectsRef = getUserProjectsRef();
    if (!projectsRef) {
        showToast('Not authenticated', 'error');
        return false;
    }
    
    try {
        await projectsRef.doc(id).delete();
        console.log('Project deleted:', id);
        return true;
    } catch (error) {
        console.error('Error deleting project:', error);
        showToast('Failed to delete project', 'error');
        return false;
    }
}

/**
 * Delete all projects
 */
async function deleteAllProjects() {
    const projectsRef = getUserProjectsRef();
    if (!projectsRef) return;
    
    try {
        const batch = db.batch();
        const snapshot = await projectsRef.get();
        
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('All projects deleted');
    } catch (error) {
        console.error('Error deleting all projects:', error);
        showToast('Failed to delete all projects', 'error');
    }
}

/**
 * Get recent projects
 */
function getRecentProjects(limit = 5) {
    return [...cachedProjects]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit);
}

/**
 * Get project statistics
 */
function getProjectStats() {
    return {
        total: cachedProjects.length,
        idea: cachedProjects.filter(p => p.status === 'idea').length,
        inProgress: cachedProjects.filter(p => p.status === 'in-progress').length,
        completed: cachedProjects.filter(p => p.status === 'completed').length
    };
}

/**
 * Get all unique tech tags
 */
function getAllTechTags() {
    const allTags = cachedProjects.flatMap(p => p.techStack || []);
    return [...new Set(allTags)].sort();
}

// ============================================================
// INITIALIZATION
// ============================================================

function initApp() {
    lucide.createIcons();
    loadTheme();
    setupEventListeners();
    
    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            console.log('User authenticated:', user.uid);
            
            updateUserProfile(user);
            showApp();
            listenToProjects();
            
        } else {
            // User is signed out
            currentUser = null;
            console.log('User not authenticated');
            
            // Unsubscribe from projects listener
            if (unsubscribeProjects) {
                unsubscribeProjects();
                unsubscribeProjects = null;
            }
            
            cachedProjects = [];
            showLoginScreen();
        }
    });
}

document.addEventListener('DOMContentLoaded', initApp);

// ============================================================
// THEME
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
// NAVIGATION
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
// RENDERING
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
// MODALS
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
// FORM HANDLING
// ============================================================

async function handleProjectFormSubmit(e) {
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
        await updateProject(currentProjectId, projectData);
        showToast('Project updated successfully!', 'success');
    } else {
        await createProject(projectData);
        showToast('Project created successfully!', 'success');
    }
    
    closeProjectModal();
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
// SEARCH & FILTER
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
// EXPORT
// ============================================================

function exportToJson() {
    const projects = getProjects();
    const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        projects: projects
    };
    
    const json = JSON.stringify(data, null, 2);
    
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

// ============================================================
// TOAST
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
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // Login events
    DOM.signupForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        signUpWithEmail(email, password);
    });
    
    DOM.signinForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;
        signInWithEmail(email, password);
    });
    
    DOM.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    
    DOM.toggleFormBtn?.addEventListener('click', () => {
        const isSignUp = DOM.signupForm.style.display !== 'none';
        
        if (isSignUp) {
            DOM.signupForm.style.display = 'none';
            DOM.signinForm.style.display = 'block';
            DOM.toggleText.textContent = "Don't have an account?";
            DOM.toggleFormBtn.textContent = 'Sign Up';
        } else {
            DOM.signupForm.style.display = 'block';
            DOM.signinForm.style.display = 'none';
            DOM.toggleText.textContent = 'Already have an account?';
            DOM.toggleFormBtn.textContent = 'Sign In';
        }
        
        hideLoginError();
    });
    
    DOM.logoutBtn?.addEventListener('click', () => {
        showConfirmDialog(
            'Sign Out?',
            'Are you sure you want to sign out?',
            signOut
        );
    });
    
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
    DOM.mobileMenuBtn?.addEventListener('click', openSidebar);
    DOM.sidebarCloseBtn?.addEventListener('click', closeSidebar);
    DOM.sidebarOverlay?.addEventListener('click', closeSidebar);
    
    // Theme
    DOM.themeToggle?.addEventListener('click', toggleTheme);
    DOM.themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            setTheme(option.dataset.theme);
        });
    });
    
    // Add project
    DOM.headerAddBtn?.addEventListener('click', openAddModal);
    DOM.dashboardAddBtn?.addEventListener('click', openAddModal);
    DOM.projectsAddBtn?.addEventListener('click', openAddModal);
    DOM.emptyAddBtn?.addEventListener('click', openAddModal);
    
    // Project modal
    DOM.modalCloseBtn?.addEventListener('click', closeProjectModal);
    DOM.modalCancelBtn?.addEventListener('click', closeProjectModal);
    DOM.projectModal?.addEventListener('click', (e) => {
        if (e.target === DOM.projectModal) closeProjectModal();
    });
    DOM.projectForm?.addEventListener('submit', handleProjectFormSubmit);
    DOM.projectTechStack?.addEventListener('input', renderTagsPreview);
    DOM.addAccountBtn?.addEventListener('click', () => addAccountRow());
    DOM.addApiBtn?.addEventListener('click', () => addApiRow());
    
    DOM.modalDeleteBtn?.addEventListener('click', () => {
        if (currentProjectId) {
            showConfirmDialog(
                'Delete Project?',
                'Are you sure you want to delete this project? This action cannot be undone.',
                async () => {
                    await deleteProject(currentProjectId);
                    closeProjectModal();
                    showToast('Project deleted', 'success');
                }
            );
        }
    });
    
    // View modal
    DOM.viewModalCloseBtn?.addEventListener('click', closeViewModal);
    DOM.viewModalClose2Btn?.addEventListener('click', closeViewModal);
    DOM.viewModal?.addEventListener('click', (e) => {
        if (e.target === DOM.viewModal) closeViewModal();
    });
    
    DOM.viewEditBtn?.addEventListener('click', () => {
        closeViewModal();
        openEditModal(currentProjectId);
    });
    
    DOM.viewDeleteBtn?.addEventListener('click', () => {
        showConfirmDialog(
            'Delete Project?',
            'Are you sure you want to delete this project? This action cannot be undone.',
            async () => {
                await deleteProject(currentProjectId);
                closeViewModal();
                showToast('Project deleted', 'success');
            }
        );
    });
    
    // Confirm modal
    DOM.confirmCancelBtn?.addEventListener('click', closeConfirmDialog);
    DOM.confirmModal?.addEventListener('click', (e) => {
        if (e.target === DOM.confirmModal) closeConfirmDialog();
    });
    DOM.confirmDeleteBtn?.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
        closeConfirmDialog();
    });
    
    // Search & filter
    DOM.searchInput?.addEventListener('input', debounce(handleSearch, 300));
    DOM.searchClear?.addEventListener('click', clearSearch);
    DOM.statusFilter?.addEventListener('change', renderProjectsList);
    DOM.techFilter?.addEventListener('change', renderProjectsList);
    
    // Export
    DOM.exportBtn?.addEventListener('click', exportToJson);
    
    // Delete all
    DOM.deleteAllBtn?.addEventListener('click', () => {
        const projectCount = getProjects().length;
        
        if (projectCount === 0) {
            showToast('No projects to delete', 'info');
            return;
        }
        
        showConfirmDialog(
            'Delete All Projects?',
            `This will permanently delete all ${projectCount} project(s). This cannot be undone!`,
            async () => {
                await deleteAllProjects();
                showToast('All projects deleted', 'success');
            }
        );
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (DOM.confirmModal?.classList.contains('active')) {
                closeConfirmDialog();
            } else if (DOM.viewModal?.classList.contains('active')) {
                closeViewModal();
            } else if (DOM.projectModal?.classList.contains('active')) {
                closeProjectModal();
            } else if (DOM.sidebar?.classList.contains('open')) {
                closeSidebar();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (currentUser) {
                navigateTo('projects');
                DOM.searchInput?.focus();
            }
        }
    });
}