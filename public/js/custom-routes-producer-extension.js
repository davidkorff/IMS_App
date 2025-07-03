// Producer Portal Extension for Custom Routes
// This adds producer-specific functionality to the custom routes builder

// Add producer portal configuration section to route builder
function addProducerPortalSection() {
    // Find the route configuration header card
    const configCard = document.querySelector('.card-body');
    if (!configCard) return;
    
    // Create producer portal configuration section
    const producerSection = document.createElement('div');
    producerSection.className = 'row mt-3 border-top pt-3';
    producerSection.innerHTML = `
        <div class="col-12">
            <h6 class="text-primary mb-3">
                <i class="fas fa-users me-2"></i>Producer Portal Settings
            </h6>
        </div>
        <div class="col-md-3">
            <label for="routeCategory" class="form-label">Route Category</label>
            <select class="form-select" id="routeCategory">
                <option value="general">General (MGA Use)</option>
                <option value="producer-only">Producer Only</option>
                <option value="internal">Internal Only</option>
            </select>
        </div>
        <div class="col-md-3">
            <label for="producerAccess" class="form-label">Producer Access</label>
            <select class="form-select" id="producerAccess">
                <option value="all">All Producers</option>
                <option value="approved">Approved Only</option>
                <option value="specific">Specific Producers</option>
                <option value="none">No Producer Access</option>
            </select>
        </div>
        <div class="col-md-3">
            <label for="routeLOB" class="form-label">Line of Business</label>
            <select class="form-select" id="routeLOB">
                <option value="">None</option>
            </select>
        </div>
        <div class="col-md-3">
            <label for="raterTemplate" class="form-label">Excel Rater</label>
            <select class="form-select" id="raterTemplate">
                <option value="">None</option>
                <option value="upload">Upload New...</option>
            </select>
        </div>
    `;
    
    // Insert after the existing configuration
    configCard.appendChild(producerSection);
    
    // Add specific producer selection UI when needed
    document.getElementById('producerAccess').addEventListener('change', function(e) {
        if (e.target.value === 'specific') {
            showProducerSelectionModal();
        }
    });
    
    // Add rater upload functionality
    document.getElementById('raterTemplate').addEventListener('change', function(e) {
        if (e.target.value === 'upload') {
            showRaterUploadModal();
        }
    });
}

// Load available lines of business
async function loadLinesOfBusiness() {
    try {
        const instanceId = window.location.pathname.split('/')[2];
        const response = await fetch(`/api/producer-admin/lines-of-business?instanceId=${instanceId}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });
        
        if (response.ok) {
            const lobs = await response.json();
            const select = document.getElementById('routeLOB');
            
            lobs.forEach(lob => {
                const option = document.createElement('option');
                option.value = lob.lob_id;
                option.textContent = lob.line_name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load lines of business:', error);
    }
}

// Show producer selection modal
function showProducerSelectionModal() {
    // Create modal HTML
    const modalHtml = `
        <div class="modal fade" id="producerSelectionModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Select Producers</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <input type="text" class="form-control" id="producerSearch" placeholder="Search producers...">
                        </div>
                        <div id="producerList" class="producer-list">
                            <div class="text-center">
                                <i class="fas fa-spinner fa-spin"></i> Loading producers...
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="saveProducerSelection">Save Selection</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page if not exists
    if (!document.getElementById('producerSelectionModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('producerSelectionModal'));
    modal.show();
    
    // Load producers
    loadProducersForSelection();
}

// Load producers for selection
async function loadProducersForSelection() {
    try {
        const instanceId = window.location.pathname.split('/')[2];
        const response = await fetch(`/api/producer-admin/producers?status=approved&instanceId=${instanceId}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });
        
        if (response.ok) {
            const producers = await response.json();
            const listContainer = document.getElementById('producerList');
            
            if (producers.length === 0) {
                listContainer.innerHTML = '<div class="alert alert-info">No approved producers found</div>';
                return;
            }
            
            listContainer.innerHTML = producers.map(producer => `
                <div class="form-check mb-2">
                    <input class="form-check-input producer-checkbox" type="checkbox" value="${producer.producer_id}" id="producer_${producer.producer_id}">
                    <label class="form-check-label" for="producer_${producer.producer_id}">
                        <strong>${producer.agency_name}</strong> - ${producer.first_name} ${producer.last_name} (${producer.email})
                    </label>
                </div>
            `).join('');
            
            // Add search functionality
            document.getElementById('producerSearch').addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase();
                document.querySelectorAll('.form-check').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(searchTerm) ? 'block' : 'none';
                });
            });
        }
    } catch (error) {
        console.error('Failed to load producers:', error);
        document.getElementById('producerList').innerHTML = '<div class="alert alert-danger">Failed to load producers</div>';
    }
}

// Show rater upload modal
function showRaterUploadModal() {
    const modalHtml = `
        <div class="modal fade" id="raterUploadModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Upload Excel Rater Template</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="raterFile" class="form-label">Select Excel File</label>
                            <input type="file" class="form-control" id="raterFile" accept=".xlsx,.xls">
                            <div class="form-text">Upload an Excel template with formulas for premium calculation</div>
                        </div>
                        <div class="mb-3">
                            <label for="raterName" class="form-label">Template Name</label>
                            <input type="text" class="form-control" id="raterName" placeholder="e.g., Workers Comp Rater v2">
                        </div>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Rater Requirements:</strong>
                            <ul class="mb-0 mt-2">
                                <li>Must contain named ranges for all input fields</li>
                                <li>Premium calculation formula should be in a cell named "Premium"</li>
                                <li>All formulas will be calculated server-side</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="uploadRaterBtn">Upload</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (!document.getElementById('raterUploadModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('raterUploadModal'));
    modal.show();
}

// Extend save functionality to include producer settings
const originalSaveRoute = window.saveRoute;
window.saveRoute = async function() {
    // Get producer-specific settings
    const routeCategory = document.getElementById('routeCategory')?.value || 'general';
    const producerAccess = document.getElementById('producerAccess')?.value || 'all';
    const lobId = document.getElementById('routeLOB')?.value || null;
    const selectedProducers = Array.from(document.querySelectorAll('.producer-checkbox:checked'))
        .map(cb => cb.value);
    
    // Add to route data
    if (window.currentRoute) {
        window.currentRoute.route_category = routeCategory;
        window.currentRoute.producer_access_level = producerAccess === 'none' ? 'none' : producerAccess;
        window.currentRoute.lob_id = lobId;
        
        // Store selected producers if specific access
        if (producerAccess === 'specific') {
            window.currentRoute.selected_producers = selectedProducers;
        }
    }
    
    // Call original save function
    if (originalSaveRoute) {
        return originalSaveRoute();
    }
};

// Initialize producer portal extension when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add producer portal section to the form
    setTimeout(() => {
        addProducerPortalSection();
        loadLinesOfBusiness();
    }, 500);
});

// Add styles
const style = document.createElement('style');
style.textContent = `
    .producer-list {
        max-height: 400px;
        overflow-y: auto;
        padding: 10px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
    }
    
    .producer-checkbox {
        cursor: pointer;
    }
    
    .form-check-label {
        cursor: pointer;
        user-select: none;
    }
`;
document.head.appendChild(style);