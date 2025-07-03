/**
 * Form Builder JavaScript
 * Handles all form building functionality including drag-drop, schema generation, and persistence
 */

// Global state
let formSchema = {
    id: generateId(),
    version: '1.0',
    metadata: {
        title: 'New Form',
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    pages: [
        {
            id: 'page1',
            title: 'Basic Information',
            description: 'Collect primary insured details',
            order: 1,
            sections: [
                {
                    id: 'section1',
                    type: 'fieldset',
                    title: 'Insured Information',
                    layout: '1-column',
                    items: []
                }
            ]
        }
    ],
    fields: {},
    logic: [],
    calculations: [],
    settings: {
        allowSaveDraft: true,
        autoSave: true,
        showProgressBar: true,
        submitButtonText: 'Submit Application'
    }
};

let currentPageIndex = 0;
let selectedElement = null;
let undoStack = [];
let redoStack = [];

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initializeDragDrop();
    initializeEventHandlers();
    renderForm();
});

// Utility function to generate unique IDs
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

// Initialize drag and drop functionality
function initializeDragDrop() {
    // Initialize sortable for field palette (source)
    const fieldCategories = document.querySelectorAll('.field-category');
    fieldCategories.forEach(category => {
        new Sortable(category, {
            group: {
                name: 'fields',
                pull: 'clone',
                put: false
            },
            sort: false,
            animation: 150,
            onEnd: function(evt) {
                // Don't remove the original from palette
                if (evt.from === evt.to) {
                    evt.item.style.display = '';
                }
            }
        });
    });
    
    // Initialize sortable for existing sections
    initializeSortableForSections();
}

// Initialize sortable for sections
function initializeSortableForSections() {
    const sections = document.querySelectorAll('.section-fields');
    sections.forEach(section => {
        new Sortable(section, {
            group: {
                name: 'fields',
                pull: true,
                put: true
            },
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            fallbackOnBody: true,
            swapThreshold: 0.65,
            onAdd: function(evt) {
                // Check if it's from the palette (has field-item class)
                if (evt.item.classList.contains('field-item')) {
                    handleFieldDrop(evt);
                }
            },
            onUpdate: function(evt) {
                handleFieldReorder(evt);
            },
            onSort: function(evt) {
                // Handle sorting within the same container
                if (evt.from === evt.to && !evt.item.classList.contains('field-item')) {
                    handleFieldReorder(evt);
                }
            }
        });
    });
}

// No longer needed - using Sortable.js instead of native drag/drop

// Handle field drop
function handleFieldDrop(evt) {
    const fieldType = evt.item.dataset.fieldType;
    
    if (!fieldType) {
        console.error('No field type found on dropped item');
        return;
    }
    
    const sectionElement = evt.to.closest('.form-section');
    if (!sectionElement) {
        console.error('No section found for drop target');
        return;
    }
    
    const sectionId = sectionElement.dataset.sectionId;
    
    // Create new field
    const fieldId = generateId();
    const field = createFieldSchema(fieldType, fieldId);
    
    // Add to schema
    formSchema.fields[fieldId] = field;
    
    // Add to section
    const pageIndex = currentPageIndex;
    const section = findSection(pageIndex, sectionId);
    if (section) {
        section.items.splice(evt.newIndex, 0, {
            type: 'field',
            fieldId: fieldId
        });
    }
    
    // Replace the cloned palette item with actual field element
    const fieldElement = createFieldElement(field);
    evt.item.replaceWith(fieldElement);
    
    // Remove empty section message if it exists
    const emptySection = evt.to.querySelector('.empty-section');
    if (emptySection) {
        emptySection.remove();
    }
    
    // Select the new field
    selectElement(fieldElement);
    
    saveToUndoStack();
}

// Handle field reorder
function handleFieldReorder(evt) {
    const sectionId = evt.to.closest('.form-section').dataset.sectionId;
    const pageIndex = currentPageIndex;
    const section = findSection(pageIndex, sectionId);
    
    if (section) {
        const item = section.items.splice(evt.oldIndex, 1)[0];
        section.items.splice(evt.newIndex, 0, item);
        saveToUndoStack();
    }
}

// Create field schema based on type
function createFieldSchema(type, id) {
    const baseField = {
        id: id,
        type: type,
        name: `field_${id}`,
        label: getDefaultLabel(type),
        placeholder: '',
        helpText: '',
        defaultValue: null,
        required: false,
        validation: {},
        display: {
            width: '100%'
        }
    };
    
    // Add type-specific properties
    switch(type) {
        case 'select':
        case 'radio':
        case 'checkbox':
            baseField.options = [
                { value: 'option1', label: 'Option 1' },
                { value: 'option2', label: 'Option 2' },
                { value: 'option3', label: 'Option 3' }
            ];
            break;
        case 'number':
            baseField.validation.min = null;
            baseField.validation.max = null;
            break;
        case 'text':
        case 'textarea':
            baseField.validation.minLength = null;
            baseField.validation.maxLength = null;
            break;
        case 'file':
            baseField.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
            baseField.maxSize = 5242880; // 5MB
            break;
        case 'address':
            baseField.includeFields = ['street', 'city', 'state', 'zip', 'country'];
            break;
    }
    
    return baseField;
}

// Get default label for field type
function getDefaultLabel(type) {
    const labels = {
        text: 'Text Field',
        number: 'Number Field',
        email: 'Email Address',
        phone: 'Phone Number',
        date: 'Date',
        textarea: 'Text Area',
        select: 'Dropdown',
        radio: 'Radio Buttons',
        checkbox: 'Checkboxes',
        file: 'File Upload',
        signature: 'Signature',
        address: 'Address',
        toggle: 'Toggle',
        rating: 'Rating',
        slider: 'Slider'
    };
    return labels[type] || 'Field';
}

// Create field element for display
function createFieldElement(field) {
    const div = document.createElement('div');
    div.className = 'form-field';
    div.dataset.fieldId = field.id;
    div.dataset.fieldType = field.type;
    
    // Field actions
    const actions = document.createElement('div');
    actions.className = 'field-actions';
    actions.innerHTML = `
        <button class="btn btn-sm btn-outline-primary" onclick="duplicateField('${field.id}')">
            <i class="fas fa-copy"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteField('${field.id}')">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    // Field preview
    const preview = document.createElement('div');
    preview.innerHTML = `
        <div class="field-label">
            ${field.label}
            ${field.required ? '<span class="text-danger">*</span>' : ''}
        </div>
        <div class="field-preview">
            ${getFieldPreview(field)}
        </div>
    `;
    
    div.appendChild(actions);
    div.appendChild(preview);
    
    // Click handler
    div.addEventListener('click', function() {
        selectElement(this);
    });
    
    return div;
}

// Get field preview HTML
function getFieldPreview(field) {
    switch(field.type) {
        case 'text':
        case 'email':
        case 'phone':
        case 'number':
        case 'date':
            return `<input type="${field.type}" class="form-control form-control-sm" placeholder="${field.placeholder || field.label}" disabled>`;
        
        case 'textarea':
            return `<textarea class="form-control form-control-sm" rows="2" placeholder="${field.placeholder || field.label}" disabled></textarea>`;
        
        case 'select':
            return `<select class="form-control form-control-sm" disabled>
                <option>${field.placeholder || 'Select...'}</option>
                ${field.options.map(opt => `<option>${opt.label}</option>`).join('')}
            </select>`;
        
        case 'radio':
            return field.options.map((opt, i) => `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" disabled>
                    <label class="form-check-label">${opt.label}</label>
                </div>
            `).join('');
        
        case 'checkbox':
            return field.options.map((opt, i) => `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" disabled>
                    <label class="form-check-label">${opt.label}</label>
                </div>
            `).join('');
        
        case 'file':
            return `<input type="file" class="form-control form-control-sm" disabled>`;
        
        case 'toggle':
            return `
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" disabled>
                    <label class="form-check-label">Toggle</label>
                </div>
            `;
        
        case 'signature':
            return `<div class="border rounded p-3 text-center text-muted">Signature Field</div>`;
        
        case 'address':
            return `<div class="text-muted"><i class="fas fa-map-marker-alt"></i> Address Fields</div>`;
        
        case 'rating':
            return `<div><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i></div>`;
        
        case 'slider':
            return `<input type="range" class="form-range" disabled>`;
        
        default:
            return `<div class="text-muted">${field.type} field</div>`;
    }
}

// Select element and show properties
function selectElement(element) {
    // Remove previous selection
    document.querySelectorAll('.form-field.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection to new element
    element.classList.add('selected');
    selectedElement = element;
    
    // Show properties
    const fieldId = element.dataset.fieldId;
    const field = formSchema.fields[fieldId];
    
    if (field) {
        showFieldProperties(field);
    }
}

// Show field properties in right panel
function showFieldProperties(field) {
    document.getElementById('noSelectionMessage').style.display = 'none';
    document.getElementById('fieldProperties').style.display = 'block';
    
    // Basic properties
    document.getElementById('propLabel').value = field.label || '';
    document.getElementById('propName').value = field.name || '';
    document.getElementById('propPlaceholder').value = field.placeholder || '';
    document.getElementById('propHelpText').value = field.helpText || '';
    document.getElementById('propDefaultValue').value = field.defaultValue || '';
    
    // Validation
    document.getElementById('propRequired').checked = field.required || false;
    document.getElementById('propMinLength').value = field.validation?.minLength || '';
    document.getElementById('propMaxLength').value = field.validation?.maxLength || '';
    document.getElementById('propPattern').value = field.validation?.pattern || '';
    
    // Display
    document.getElementById('propWidth').value = field.display?.width || '100%';
    document.getElementById('propReadonly').checked = field.readonly || false;
    document.getElementById('propDisabled').checked = field.disabled || false;
    
    // Show/hide options for relevant field types
    const optionsGroup = document.getElementById('optionsGroup');
    if (['select', 'radio', 'checkbox'].includes(field.type)) {
        optionsGroup.style.display = 'block';
        renderOptions(field.options || []);
    } else {
        optionsGroup.style.display = 'none';
    }
    
    // Add property change handlers
    addPropertyChangeHandlers(field);
}

// Render options list
function renderOptions(options) {
    const container = document.getElementById('optionsList');
    container.innerHTML = options.map((opt, index) => `
        <div class="input-group mb-2">
            <input type="text" class="form-control form-control-sm" value="${opt.label}" 
                   onchange="updateOption(${index}, 'label', this.value)">
            <input type="text" class="form-control form-control-sm" value="${opt.value}" 
                   onchange="updateOption(${index}, 'value', this.value)">
            <button class="btn btn-sm btn-outline-danger" onclick="removeOption(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// Add property change handlers
function addPropertyChangeHandlers(field) {
    // Basic properties
    document.getElementById('propLabel').onchange = function() {
        field.label = this.value;
        updateFieldDisplay(field.id);
        saveToUndoStack();
    };
    
    document.getElementById('propName').onchange = function() {
        field.name = this.value;
        saveToUndoStack();
    };
    
    document.getElementById('propPlaceholder').onchange = function() {
        field.placeholder = this.value;
        updateFieldDisplay(field.id);
        saveToUndoStack();
    };
    
    document.getElementById('propRequired').onchange = function() {
        field.required = this.checked;
        updateFieldDisplay(field.id);
        saveToUndoStack();
    };
    
    // Add more handlers as needed...
}

// Update field display after property change
function updateFieldDisplay(fieldId) {
    const field = formSchema.fields[fieldId];
    const element = document.querySelector(`[data-field-id="${fieldId}"]`);
    
    if (field && element) {
        const newElement = createFieldElement(field);
        element.replaceWith(newElement);
        
        // Re-select if it was selected
        if (selectedElement?.dataset.fieldId === fieldId) {
            selectElement(newElement);
        }
    }
}

// Delete field
window.deleteField = function(fieldId) {
    if (confirm('Are you sure you want to delete this field?')) {
        // Remove from DOM
        const element = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (element) {
            element.remove();
        }
        
        // Remove from schema
        delete formSchema.fields[fieldId];
        
        // Remove from sections
        formSchema.pages.forEach(page => {
            page.sections.forEach(section => {
                section.items = section.items.filter(item => item.fieldId !== fieldId);
            });
        });
        
        // Clear properties panel
        document.getElementById('noSelectionMessage').style.display = 'block';
        document.getElementById('fieldProperties').style.display = 'none';
        
        saveToUndoStack();
    }
};

// Duplicate field
window.duplicateField = function(fieldId) {
    const originalField = formSchema.fields[fieldId];
    if (originalField) {
        const newFieldId = generateId();
        const newField = JSON.parse(JSON.stringify(originalField));
        newField.id = newFieldId;
        newField.name = `${originalField.name}_copy`;
        newField.label = `${originalField.label} (Copy)`;
        
        // Add to schema
        formSchema.fields[newFieldId] = newField;
        
        // Find the section containing the original field
        let targetSection = null;
        let targetIndex = -1;
        
        formSchema.pages[currentPageIndex].sections.forEach(section => {
            section.items.forEach((item, index) => {
                if (item.fieldId === fieldId) {
                    targetSection = section;
                    targetIndex = index;
                }
            });
        });
        
        if (targetSection) {
            targetSection.items.splice(targetIndex + 1, 0, {
                type: 'field',
                fieldId: newFieldId
            });
        }
        
        renderForm();
        saveToUndoStack();
    }
};

// Add new section
window.addSection = function(pageId) {
    const sectionId = generateId();
    const section = {
        id: sectionId,
        type: 'fieldset',
        title: 'New Section',
        layout: '1-column',
        items: []
    };
    
    const page = formSchema.pages[currentPageIndex];
    page.sections.push(section);
    
    renderForm();
    saveToUndoStack();
};

// Delete section
window.deleteSection = function(sectionId) {
    if (confirm('Are you sure you want to delete this section and all its fields?')) {
        const page = formSchema.pages[currentPageIndex];
        
        // Remove fields in this section from schema
        const section = page.sections.find(s => s.id === sectionId);
        if (section) {
            section.items.forEach(item => {
                if (item.fieldId) {
                    delete formSchema.fields[item.fieldId];
                }
            });
        }
        
        // Remove section
        page.sections = page.sections.filter(s => s.id !== sectionId);
        
        renderForm();
        saveToUndoStack();
    }
};

// Add new page
window.addPage = function() {
    const pageId = generateId();
    const page = {
        id: pageId,
        title: `Page ${formSchema.pages.length + 1}`,
        description: '',
        order: formSchema.pages.length + 1,
        sections: [{
            id: generateId(),
            type: 'fieldset',
            title: 'New Section',
            layout: '1-column',
            items: []
        }]
    };
    
    formSchema.pages.push(page);
    renderPageTabs();
    switchPage(formSchema.pages.length - 1);
    saveToUndoStack();
};

// Switch to a different page
window.switchPage = function(pageIndex) {
    currentPageIndex = pageIndex;
    renderForm();
    
    // Update page tabs
    document.querySelectorAll('.page-tab').forEach((tab, index) => {
        tab.classList.toggle('active', index === pageIndex);
    });
};

// Render the entire form
function renderForm() {
    const container = document.getElementById('formPagesContainer');
    const page = formSchema.pages[currentPageIndex];
    
    if (!page) return;
    
    let html = `
        <div class="form-page" data-page-id="${page.id}">
            <div class="page-header">
                <div>
                    <h5 class="mb-0">${page.title}</h5>
                    <small>${page.description}</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-light" onclick="editPageSettings('${page.id}')">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
            <div class="page-content">
    `;
    
    // Render sections
    page.sections.forEach(section => {
        html += renderSection(section);
    });
    
    // Add section button
    html += `
                <div class="text-center">
                    <button class="btn btn-outline-primary" onclick="addSection('${page.id}')">
                        <i class="fas fa-plus"></i> Add Section
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Re-initialize sortable
    initializeSortableForSections();
}

// Render a section
function renderSection(section) {
    let html = `
        <div class="form-section" data-section-id="${section.id}">
            <div class="section-header">
                <div class="section-title">${section.title}</div>
                <div class="section-actions">
                    <button class="btn btn-sm btn-outline-secondary" onclick="editSection('${section.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSection('${section.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="section-fields" id="${section.id}-fields">
    `;
    
    if (section.items.length === 0) {
        html += `
            <div class="empty-section">
                <i class="fas fa-arrow-left"></i>
                <p>Drag fields here to start building your form</p>
            </div>
        `;
    } else {
        section.items.forEach(item => {
            if (item.type === 'field' && formSchema.fields[item.fieldId]) {
                const fieldElement = createFieldElement(formSchema.fields[item.fieldId]);
                html += fieldElement.outerHTML;
            }
        });
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

// Render page tabs
function renderPageTabs() {
    const container = document.getElementById('pageNavigation');
    let html = '';
    
    formSchema.pages.forEach((page, index) => {
        html += `<button class="page-tab ${index === currentPageIndex ? 'active' : ''}" 
                         onclick="switchPage(${index})">
                    ${page.title}
                 </button>`;
    });
    
    html += `<button class="btn btn-sm btn-outline-primary" onclick="addPage()">
                <i class="fas fa-plus"></i>
             </button>`;
    
    container.innerHTML = html;
}

// Find section in current page
function findSection(pageIndex, sectionId) {
    const page = formSchema.pages[pageIndex];
    return page?.sections.find(s => s.id === sectionId);
}

// Show form settings
window.showFormSettings = function() {
    document.getElementById('formTitleInput').value = formSchema.metadata.title;
    document.getElementById('formDescriptionInput').value = formSchema.metadata.description;
    document.getElementById('submitButtonText').value = formSchema.settings.submitButtonText;
    document.getElementById('allowSaveDraft').checked = formSchema.settings.allowSaveDraft;
    document.getElementById('showProgressBar').checked = formSchema.settings.showProgressBar;
    document.getElementById('autoSave').checked = formSchema.settings.autoSave;
    
    const modal = new bootstrap.Modal(document.getElementById('formSettingsModal'));
    modal.show();
};

// Save form settings
window.saveFormSettings = function() {
    formSchema.metadata.title = document.getElementById('formTitleInput').value;
    formSchema.metadata.description = document.getElementById('formDescriptionInput').value;
    formSchema.settings.submitButtonText = document.getElementById('submitButtonText').value;
    formSchema.settings.allowSaveDraft = document.getElementById('allowSaveDraft').checked;
    formSchema.settings.showProgressBar = document.getElementById('showProgressBar').checked;
    formSchema.settings.autoSave = document.getElementById('autoSave').checked;
    
    document.getElementById('formTitle').textContent = formSchema.metadata.title;
    
    bootstrap.Modal.getInstance(document.getElementById('formSettingsModal')).hide();
    saveToUndoStack();
};

// Show logic builder
window.showLogicBuilder = function() {
    const modal = new bootstrap.Modal(document.getElementById('logicBuilderModal'));
    modal.show();
};

// Preview form
window.previewForm = function() {
    // Generate preview HTML
    const previewHtml = generatePreviewHtml();
    
    // Create blob URL
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Show in iframe
    document.getElementById('previewFrame').src = url;
    
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    modal.show();
};

// Generate preview HTML
function generatePreviewHtml() {
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${formSchema.metadata.title}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { background: #f8f9fa; padding: 20px; }
                .form-container { max-width: 800px; margin: 0 auto; }
                .form-page { background: white; border-radius: 8px; padding: 30px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .form-section { margin-bottom: 30px; }
                .section-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; }
            </style>
        </head>
        <body>
            <div class="form-container">
                <h2>${formSchema.metadata.title}</h2>
                <p class="text-muted">${formSchema.metadata.description}</p>
    `;
    
    // Render each page
    formSchema.pages.forEach((page, pageIndex) => {
        html += `<div class="form-page">`;
        if (formSchema.pages.length > 1) {
            html += `<h4>${page.title}</h4>`;
        }
        
        // Render sections
        page.sections.forEach(section => {
            html += `
                <div class="form-section">
                    <div class="section-title">${section.title}</div>
            `;
            
            // Render fields
            section.items.forEach(item => {
                if (item.type === 'field' && formSchema.fields[item.fieldId]) {
                    html += renderFieldForPreview(formSchema.fields[item.fieldId]);
                }
            });
            
            html += `</div>`;
        });
        
        html += `</div>`;
    });
    
    // Add submit button
    html += `
                <div class="text-center mt-4">
                    <button class="btn btn-primary">${formSchema.settings.submitButtonText}</button>
                </div>
            </div>
            
            <script>
                // Simple repeater functionality for preview
                window.addRepeaterItem = function(fieldId) {
                    console.log('addRepeaterItem called for:', fieldId);
                    const container = document.getElementById(fieldId + '_items');
                    if (!container) {
                        console.error('Container not found:', fieldId + '_items');
                        return;
                    }
                    
                    const currentCount = container.children.length;
                    console.log('Current count:', currentCount);
                    
                    const newItem = container.children[0].cloneNode(true);
                    
                    // Update index in title
                    const title = newItem.querySelector('h6');
                    if (title) {
                        title.textContent = title.textContent.replace(/\\d+/, currentCount + 1);
                    }
                    
                    // Update remove button onclick
                    const removeBtn = newItem.querySelector('button[onclick*="removeRepeaterItem"]');
                    if (removeBtn) {
                        removeBtn.setAttribute('onclick', 'removeRepeaterItem("' + fieldId + '", ' + currentCount + ')');
                    }
                    
                    // Clear input values and update IDs/names
                    newItem.querySelectorAll('input, select, textarea').forEach((input, idx) => {
                        if (input.type === 'checkbox' || input.type === 'radio') {
                            input.checked = false;
                        } else {
                            input.value = '';
                        }
                        
                        // Update IDs and names to avoid conflicts
                        if (input.id) {
                            input.id = input.id.replace(/_\\d+_/, '_' + currentCount + '_');
                        }
                        if (input.name) {
                            input.name = input.name.replace(/\\[\\d+\\]/, '[' + currentCount + ']');
                        }
                    });
                    
                    container.appendChild(newItem);
                    console.log('Item added, new count:', container.children.length);
                };
                
                window.removeRepeaterItem = function(fieldId, index) {
                    const container = document.getElementById(fieldId + '_items');
                    if (!container || container.children.length <= 1) return;
                    
                    const items = Array.from(container.children);
                    if (items[index]) {
                        items[index].remove();
                        
                        // Re-index remaining items
                        container.querySelectorAll('.repeater-item').forEach((item, newIndex) => {
                            const title = item.querySelector('h6');
                            if (title) {
                                title.textContent = title.textContent.replace(/\\d+/, newIndex + 1);
                            }
                        });
                    }
                };
            </script>
        </body>
        </html>
    `;
    
    return html;
}

// Render field for preview
function renderFieldForPreview(field) {
    let html = '<div class="mb-3">';
    
    // Label
    html += `<label class="form-label">${field.label}`;
    if (field.required) html += ' <span class="text-danger">*</span>';
    html += '</label>';
    
    // Field input
    switch(field.type) {
        case 'text':
        case 'email':
        case 'phone':
        case 'number':
        case 'date':
            html += `<input type="${field.type}" class="form-control" placeholder="${field.placeholder || ''}">`;
            break;
            
        case 'textarea':
            html += `<textarea class="form-control" rows="3" placeholder="${field.placeholder || ''}"></textarea>`;
            break;
            
        case 'select':
            html += `<select class="form-control">
                <option value="">${field.placeholder || 'Select...'}</option>
                ${field.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
            </select>`;
            break;
            
        case 'radio':
            field.options.forEach(opt => {
                html += `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="${field.name}" value="${opt.value}">
                        <label class="form-check-label">${opt.label}</label>
                    </div>
                `;
            });
            break;
            
        case 'checkbox':
            field.options.forEach(opt => {
                html += `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="${field.name}[]" value="${opt.value}">
                        <label class="form-check-label">${opt.label}</label>
                    </div>
                `;
            });
            break;
            
        case 'file':
            html += `<input type="file" class="form-control">`;
            break;
            
        case 'fieldset-repeater':
            html += renderFieldsetRepeaterForPreview(field);
            break;
            
        default:
            html += `<input type="text" class="form-control" placeholder="${field.placeholder || ''}">`;
            break;
    }
    
    // Help text
    if (field.helpText) {
        html += `<small class="form-text text-muted">${field.helpText}</small>`;
    }
    
    html += '</div>';
    return html;
}

// Render fieldset-repeater for preview
function renderFieldsetRepeaterForPreview(field) {
    let html = '<div class="fieldset-repeater-preview border rounded p-3">';
    
    // Add help text if available
    if (field.helpText) {
        html += `<p class="text-muted small">${field.helpText}</p>`;
    }
    
    // Container for all items with the expected ID
    html += `<div class="repeater-items" id="${field.id}_items">`;
    
    // Show at least one item for preview
    const itemsToShow = Math.max(1, field.defaultItems || 0);
    
    for (let i = 0; i < itemsToShow; i++) {
        const itemLabel = field.itemLabel ? field.itemLabel.replace('#{index}', i + 1) : `Item ${i + 1}`;
        
        html += `<div class="repeater-item border rounded p-2 mb-2">`;
        html += `<div class="d-flex justify-content-between align-items-center mb-2">`;
        html += `<h6 class="mb-0">${itemLabel}</h6>`;
        if (i > 0 || field.minItems === 0) {
            html += `<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeRepeaterItem('${field.id}', ${i})">
                ${field.removeButtonText || 'Remove'}
            </button>`;
        }
        html += `</div>`;
        
        // Render fields within the repeater
        if (field.fields && Array.isArray(field.fields)) {
            field.fields.forEach(subField => {
                html += renderFieldForPreview(subField);
            });
        }
        
        html += '</div>';
    }
    
    html += '</div>'; // Close repeater-items container
    
    // Add button
    html += `<button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="addRepeaterItem('${field.id}')">
        ${field.addButtonText || '+ Add Item'}
    </button>`;
    
    html += '</div>';
    return html;
}

// Save form
window.saveForm = async function() {
    // Update timestamp
    formSchema.metadata.updatedAt = new Date().toISOString();
    
    try {
        // Get instance ID from parent window if in popup
        const instanceId = window.opener ? 
            window.opener.document.querySelector('[data-instance-id]')?.dataset.instanceId : 
            document.querySelector('[data-instance-id]')?.dataset.instanceId;
            
        // Get LOB ID from parent window if available
        const lobId = window.opener?.currentLobId || null;
        
        const response = await fetch('/api/forms/schemas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'X-Instance-ID': instanceId
            },
            body: JSON.stringify({
                form_id: formSchema.id || null,
                lob_id: lobId,
                title: formSchema.metadata.title,
                description: formSchema.metadata.description,
                form_schema: formSchema,
                is_template: false
            })
        });
        
        if (response.ok) {
            const savedSchema = await response.json();
            formSchema.id = savedSchema.form_id;
            
            // If opened from parent window, send message back
            if (window.opener && window.opener.receiveFormSchema) {
                window.opener.receiveFormSchema(savedSchema);
            }
            
            alert('Form saved successfully!');
        } else {
            throw new Error('Failed to save form');
        }
    } catch (error) {
        console.error('Error saving form:', error);
        alert('Failed to save form. Please try again.');
    }
};

// Undo/Redo functionality
function saveToUndoStack() {
    undoStack.push(JSON.stringify(formSchema));
    redoStack = []; // Clear redo stack on new action
    
    // Limit stack size
    if (undoStack.length > 50) {
        undoStack.shift();
    }
}

window.undoAction = function() {
    if (undoStack.length > 1) {
        redoStack.push(undoStack.pop());
        formSchema = JSON.parse(undoStack[undoStack.length - 1]);
        renderForm();
    }
};

window.redoAction = function() {
    if (redoStack.length > 0) {
        const state = redoStack.pop();
        undoStack.push(state);
        formSchema = JSON.parse(state);
        renderForm();
    }
};

// Initialize event handlers
function initializeEventHandlers() {
    // Save initial state
    saveToUndoStack();
    
    // Auto-save
    if (formSchema.settings.autoSave) {
        setInterval(() => {
            // TODO: Implement auto-save to server
            console.log('Auto-saving...');
        }, 30000); // Every 30 seconds
    }
}

// Export schema for external use
window.getFormSchema = function() {
    return formSchema;
};

// Load schema (for editing existing forms)
window.loadFormSchema = function(schema) {
    formSchema = schema;
    currentPageIndex = 0;
    renderForm();
    renderPageTabs();
    saveToUndoStack();
};

// Add option to field
window.addOption = function() {
    const fieldId = selectedElement?.dataset.fieldId;
    if (!fieldId) return;
    
    const field = formSchema.fields[fieldId];
    if (!field.options) field.options = [];
    
    field.options.push({
        value: `option${field.options.length + 1}`,
        label: `Option ${field.options.length + 1}`
    });
    
    renderOptions(field.options);
    updateFieldDisplay(fieldId);
    saveToUndoStack();
};

// Update option
window.updateOption = function(index, prop, value) {
    const fieldId = selectedElement?.dataset.fieldId;
    if (!fieldId) return;
    
    const field = formSchema.fields[fieldId];
    if (field.options && field.options[index]) {
        field.options[index][prop] = value;
        updateFieldDisplay(fieldId);
        saveToUndoStack();
    }
};

// Remove option
window.removeOption = function(index) {
    const fieldId = selectedElement?.dataset.fieldId;
    if (!fieldId) return;
    
    const field = formSchema.fields[fieldId];
    if (field.options) {
        field.options.splice(index, 1);
        renderOptions(field.options);
        updateFieldDisplay(fieldId);
        saveToUndoStack();
    }
};

// Edit section
window.editSection = function(sectionId) {
    const section = formSchema.pages[currentPageIndex].sections.find(s => s.id === sectionId);
    if (section) {
        const newTitle = prompt('Section Title:', section.title);
        if (newTitle !== null) {
            section.title = newTitle;
            renderForm();
            saveToUndoStack();
        }
    }
};

// Edit page settings
window.editPageSettings = function(pageId) {
    const page = formSchema.pages.find(p => p.id === pageId);
    if (page) {
        const newTitle = prompt('Page Title:', page.title);
        if (newTitle !== null) {
            page.title = newTitle;
            renderForm();
            renderPageTabs();
            saveToUndoStack();
        }
    }
};

// Add condition
window.addCondition = function() {
    // TODO: Implement condition builder
    alert('Condition builder coming soon!');
};

// Add action
window.addAction = function() {
    // TODO: Implement action builder
    alert('Action builder coming soon!');
};

// Save logic
window.saveLogic = function() {
    // TODO: Implement logic saving
    bootstrap.Modal.getInstance(document.getElementById('logicBuilderModal')).hide();
};