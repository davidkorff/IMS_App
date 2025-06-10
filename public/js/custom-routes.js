// Custom Routes Management
class CustomRoutesManager {
    constructor() {
        this.instanceId = this.getInstanceId();
        this.routes = [];
        this.submissions = [];
        this.currentTab = 'routes';
        
        this.init();
    }

    getInstanceId() {
        const path = window.location.pathname;
        const matches = path.match(/\/instance\/(\d+)/);
        return matches ? parseInt(matches[1]) : null;
    }

    async init() {
        console.log('🚀 [Custom Routes] Initializing Custom Routes Manager');
        console.log('📍 [Custom Routes] Instance ID:', this.instanceId);
        
        // Check authentication
        if (!window.authUtils || !window.authUtils.isAuthenticated()) {
            console.log('❌ [Custom Routes] Not authenticated, redirecting to login');
            window.location.href = '/login';
            return;
        }

        console.log('✅ [Custom Routes] Authentication OK');
        this.setupEventListeners();
        await this.loadRoutes();
        this.showTab('routes');
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('backToInstance').addEventListener('click', () => {
            window.location.href = `/instance/${this.instanceId}`;
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.authUtils.logout();
        });

        // Tab navigation
        document.getElementById('routesTab').addEventListener('click', (e) => {
            e.preventDefault();
            this.showTab('routes');
        });

        document.getElementById('submissionsTab').addEventListener('click', (e) => {
            e.preventDefault();
            this.showTab('submissions');
        });

        document.getElementById('analyticsTab').addEventListener('click', (e) => {
            e.preventDefault();
            this.showTab('analytics');
        });

        // Create route buttons
        const createRouteBtn = document.getElementById('createRouteBtn');
        if (createRouteBtn) {
            console.log('✅ [Custom Routes] Create Route button found, adding listener');
            createRouteBtn.addEventListener('click', () => {
                console.log('🔧 [Custom Routes] Create Route button clicked');
                this.createNewRoute();
            });
        } else {
            console.error('❌ [Custom Routes] Create Route button NOT found!');
        }

        const createFirstRouteBtn = document.getElementById('createFirstRouteBtn');
        if (createFirstRouteBtn) {
            createFirstRouteBtn.addEventListener('click', () => {
                console.log('🔧 [Custom Routes] Create First Route button clicked');
                this.createNewRoute();
            });
        }
    }

    async showTab(tabName) {
        this.currentTab = tabName;

        // Update tab indicators
        document.querySelectorAll('.list-group-item').forEach(item => {
            item.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // Hide all content
        document.getElementById('routesContent').style.display = 'none';
        document.getElementById('submissionsContent').style.display = 'none';
        document.getElementById('analyticsContent').style.display = 'none';

        // Show selected content
        switch (tabName) {
            case 'routes':
                document.getElementById('routesContent').style.display = 'block';
                break;
            case 'submissions':
                document.getElementById('submissionsContent').style.display = 'block';
                await this.loadAllSubmissions();
                break;
            case 'analytics':
                document.getElementById('analyticsContent').style.display = 'block';
                await this.loadAnalytics();
                break;
        }
    }

    async loadRoutes() {
        try {
            console.log('📡 [Custom Routes] Loading routes for instance', this.instanceId);
            document.getElementById('loadingState').style.display = 'block';
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('routesGrid').style.display = 'none';

            const url = `/api/custom-routes/instance/${this.instanceId}/routes`;
            console.log('📍 [Custom Routes] Fetching from:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${window.authUtils.getToken()}`
                }
            });

            console.log('📡 [Custom Routes] Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [Custom Routes] API Error:', errorText);
                throw new Error(`Failed to load routes: ${response.status}`);
            }

            this.routes = await response.json();
            console.log('✅ [Custom Routes] Loaded routes:', this.routes);
            this.renderRoutes();

        } catch (error) {
            console.error('❌ [Custom Routes] Error loading routes:', error);
            this.showError('Failed to load routes');
        } finally {
            document.getElementById('loadingState').style.display = 'none';
        }
    }

    renderRoutes() {
        const routesList = document.getElementById('routesList');
        
        if (this.routes.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('routesGrid').style.display = 'none';
            return;
        }

        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('routesGrid').style.display = 'block';

        routesList.innerHTML = '';

        this.routes.forEach(route => {
            const routeElement = this.createRouteCard(route);
            routesList.appendChild(routeElement);
        });
    }

    createRouteCard(route) {
        const template = document.getElementById('routeCardTemplate');
        const routeElement = template.content.cloneNode(true);

        // Set route data
        routeElement.querySelector('.route-name').textContent = route.name;
        routeElement.querySelector('.route-description').textContent = route.description || 'No description';
        routeElement.querySelector('.submission-count').textContent = route.submission_count || 0;
        
        // Set status badge
        const statusBadge = routeElement.querySelector('.route-status');
        if (route.is_active) {
            statusBadge.textContent = 'Active';
            statusBadge.className = 'badge bg-success route-status';
        } else {
            statusBadge.textContent = 'Inactive';
            statusBadge.className = 'badge bg-warning route-status';
        }

        // Set created date
        const createdDate = new Date(route.created_at).toLocaleDateString();
        routeElement.querySelector('.route-created').textContent = `Created ${createdDate}`;

        // Set up event listeners
        const card = routeElement.querySelector('.route-card');
        
        // Edit buttons
        card.querySelectorAll('.edit-route').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editRoute(route.route_id);
            });
        });

        // Preview button
        card.querySelector('.preview-route').addEventListener('click', (e) => {
            e.preventDefault();
            this.previewRoute(route);
        });

        // View submissions
        card.querySelector('.view-submissions').addEventListener('click', (e) => {
            e.preventDefault();
            this.viewRouteSubmissions(route.route_id);
        });

        // Copy link
        card.querySelector('.copy-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.copyPublicLink(route);
        });

        // Delete route
        card.querySelector('.delete-route').addEventListener('click', (e) => {
            e.preventDefault();
            this.deleteRoute(route);
        });

        return routeElement;
    }

    createNewRoute() {
        console.log('🎯 [Custom Routes] Navigating to new route builder');
        const url = `/instance/${this.instanceId}/custom-routes/new`;
        console.log('📍 [Custom Routes] URL:', url);
        window.location.href = url;
    }

    editRoute(routeId) {
        window.location.href = `/instance/${this.instanceId}/custom-routes/${routeId}`;
    }

    previewRoute(route) {
        const publicUrl = `${window.location.origin}/form/${route.slug}`;
        window.open(publicUrl, '_blank');
    }

    viewRouteSubmissions(routeId) {
        window.location.href = `/instance/${this.instanceId}/custom-routes/${routeId}/submissions`;
    }

    async copyPublicLink(route) {
        const publicUrl = `${window.location.origin}/form/${route.slug}`;
        
        try {
            await navigator.clipboard.writeText(publicUrl);
            this.showSuccess('Public link copied to clipboard');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = publicUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('Public link copied to clipboard');
        }
    }

    async deleteRoute(route) {
        if (!confirm(`Are you sure you want to delete "${route.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/custom-routes/instance/${this.instanceId}/routes/${route.route_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${window.authUtils.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete route');
            }

            this.showSuccess('Route deleted successfully');
            await this.loadRoutes();

        } catch (error) {
            console.error('Error deleting route:', error);
            this.showError('Failed to delete route');
        }
    }

    async loadAllSubmissions() {
        try {
            const promises = this.routes.map(route => 
                fetch(`/api/custom-routes/instance/${this.instanceId}/routes/${route.route_id}/submissions`, {
                    headers: {
                        'Authorization': `Bearer ${window.authUtils.getToken()}`
                    }
                }).then(res => res.json())
            );

            const submissionArrays = await Promise.all(promises);
            this.submissions = submissionArrays.flat();
            this.renderSubmissions();

        } catch (error) {
            console.error('Error loading submissions:', error);
            this.showError('Failed to load submissions');
        }
    }

    renderSubmissions() {
        const tbody = document.querySelector('#submissionsTable tbody');
        tbody.innerHTML = '';

        if (this.submissions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        No submissions found
                    </td>
                </tr>
            `;
            return;
        }

        this.submissions.forEach(submission => {
            const row = document.createElement('tr');
            
            const statusBadge = this.getStatusBadge(submission.status);
            const submittedDate = new Date(submission.submitted_at).toLocaleDateString();
            const routeName = this.routes.find(r => r.route_id === submission.route_id)?.name || 'Unknown';

            row.innerHTML = `
                <td>
                    <code>${submission.submission_uuid}</code>
                </td>
                <td>${routeName}</td>
                <td>
                    <div>
                        <strong>${submission.applicant_name || 'N/A'}</strong>
                        ${submission.applicant_email ? `<br><small class="text-muted">${submission.applicant_email}</small>` : ''}
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td>${submittedDate}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary view-submission" data-id="${submission.submission_id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary process-submission" data-id="${submission.submission_id}">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

        // Add event listeners for action buttons
        document.querySelectorAll('.view-submission').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const submissionId = e.target.closest('button').dataset.id;
                this.viewSubmission(submissionId);
            });
        });

        document.querySelectorAll('.process-submission').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const submissionId = e.target.closest('button').dataset.id;
                this.processSubmission(submissionId);
            });
        });
    }

    getStatusBadge(status) {
        const statusConfig = {
            'submitted': { class: 'bg-primary', text: 'Submitted' },
            'processing': { class: 'bg-warning', text: 'Processing' },
            'quoted': { class: 'bg-info', text: 'Quoted' },
            'bound': { class: 'bg-success', text: 'Bound' },
            'issued': { class: 'bg-success', text: 'Issued' },
            'rejected': { class: 'bg-danger', text: 'Rejected' },
            'error': { class: 'bg-danger', text: 'Error' }
        };

        const config = statusConfig[status] || { class: 'bg-secondary', text: status };
        return `<span class="badge ${config.class}">${config.text}</span>`;
    }

    async loadAnalytics() {
        try {
            // Calculate analytics from loaded data
            const totalRoutes = this.routes.length;
            const totalSubmissions = this.routes.reduce((sum, route) => sum + (route.submission_count || 0), 0);
            
            // Load submission statuses for more detailed analytics
            await this.loadAllSubmissions();
            
            const pendingSubmissions = this.submissions.filter(s => 
                ['submitted', 'processing'].includes(s.status)
            ).length;
            
            const completedSubmissions = this.submissions.filter(s => 
                ['bound', 'issued'].includes(s.status)
            ).length;

            // Update analytics display
            document.getElementById('totalRoutes').textContent = totalRoutes;
            document.getElementById('totalSubmissions').textContent = totalSubmissions;
            document.getElementById('pendingSubmissions').textContent = pendingSubmissions;
            document.getElementById('completedSubmissions').textContent = completedSubmissions;

        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showError('Failed to load analytics');
        }
    }

    viewSubmission(submissionId) {
        // This would open a modal or navigate to a submission detail page
        console.log('View submission:', submissionId);
        // TODO: Implement submission detail view
    }

    async processSubmission(submissionId) {
        if (!confirm('Process this submission now? This will attempt to create the submission in IMS.')) {
            return;
        }

        try {
            const response = await fetch(`/api/custom-routes/submissions/${submissionId}/process`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.authUtils.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to process submission');
            }

            const result = await response.json();
            this.showSuccess('Submission processed successfully');
            await this.loadAllSubmissions();

        } catch (error) {
            console.error('Error processing submission:', error);
            this.showError('Failed to process submission');
        }
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-floating`;
        alertDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        document.body.appendChild(alertDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }
}

// Initialize the Custom Routes Manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 [Custom Routes] DOM loaded, initializing...');
    try {
        new CustomRoutesManager();
    } catch (error) {
        console.error('❌ [Custom Routes] Failed to initialize:', error);
    }
});