/**
 * Form Renderer
 * Takes a form schema and renders it as HTML with all functionality
 */

class FormRenderer {
    constructor(schema, container, options = {}) {
        this.schema = schema;
        this.container = container;
        this.options = {
            mode: 'fill', // 'fill', 'preview', 'readonly'
            showProgress: true,
            autoSave: true,
            autoSaveInterval: 30000,
            onFieldChange: null,
            onPageChange: null,
            onSubmit: null,
            onSave: null,
            ...options
        };
        
        this.currentPage = 0;
        this.formData = {};
        this.errors = {};
        this.touched = {};
        this.logic = new FormLogicEngine(schema.logic || []);
        this.calculations = new FormCalculationEngine(schema.calculations || []);
        
        this.init();
    }
    
    init() {
        // Load saved state if exists
        if (this.schema.state && this.schema.state.data) {
            this.formData = this.schema.state.data;
            this.currentPage = this.schema.state.currentPage || 0;
        }
        
        // Render initial form
        this.render();
        
        // Set up auto-save if enabled
        if (this.options.autoSave && this.schema.settings.autoSave) {
            setInterval(() => this.autoSave(), this.options.autoSaveInterval);
        }
    }
    
    render() {
        this.container.innerHTML = '';
        
        // Add progress bar if enabled
        if (this.options.showProgress && this.schema.settings.showProgressBar) {
            this.renderProgressBar();
        }
        
        // Render current page
        this.renderPage(this.currentPage);
        
        // Apply initial logic
        this.applyLogic();
    }
    
    renderProgressBar() {
        const totalPages = this.schema.pages.length;
        const progress = ((this.currentPage + 1) / totalPages) * 100;
        
        const progressHTML = `
            <div class="form-progress mb-4">
                <div class="progress">
                    <div class="progress-bar" role="progressbar" style="width: ${progress}%">
                        Step ${this.currentPage + 1} of ${totalPages}
                    </div>
                </div>
            </div>
        `;
        
        this.container.insertAdjacentHTML('beforeend', progressHTML);
    }
    
    renderPage(pageIndex) {
        const page = this.schema.pages[pageIndex];
        if (!page) return;
        
        const pageHTML = `
            <div class="form-page" data-page-id="${page.id}">
                ${page.title ? `<h3>${page.title}</h3>` : ''}
                ${page.description ? `<p class="text-muted">${page.description}</p>` : ''}
                <div class="page-sections">
                    ${page.sections.map(section => this.renderSection(section)).join('')}
                </div>
                <div class="form-navigation mt-4">
                    ${this.renderNavigation(page)}
                </div>
            </div>
        `;
        
        const pageElement = this.createElementFromHTML(pageHTML);
        this.container.appendChild(pageElement);
        
        // Attach event listeners
        this.attachEventListeners(pageElement);
    }
    
    renderSection(section) {
        const sectionClass = `form-section ${section.collapsed ? 'collapsed' : ''}`;
        const display = this.shouldDisplay(section.visibility) ? 'block' : 'none';
        
        let sectionHTML = `
            <div class="form-section-wrapper" data-section-id="${section.id}" style="display: ${display};">
                <div class="${sectionClass}">
        `;
        
        if (section.title) {
            sectionHTML += `
                <div class="section-header">
                    <h5>${section.title}</h5>
                    ${section.collapsible ? '<i class="fas fa-chevron-down toggle-icon"></i>' : ''}
                </div>
            `;
        }
        
        sectionHTML += '<div class="section-content">';
        
        if (section.description) {
            sectionHTML += `<p class="section-description">${section.description}</p>`;
        }
        
        // Render section items
        if (section.type === 'repeater' && section.repeatable) {
            sectionHTML += this.renderRepeaterSection(section);
        } else {
            sectionHTML += this.renderSectionItems(section);
        }
        
        sectionHTML += '</div></div></div>';
        
        return sectionHTML;
    }
    
    renderSectionItems(section) {
        let html = '<div class="row">';
        
        section.items.forEach(item => {
            if (item.type === 'field' && this.schema.fields[item.fieldId]) {
                html += this.renderField(this.schema.fields[item.fieldId]);
            } else if (item.type === 'html') {
                html += `<div class="col-12">${item.content}</div>`;
            } else if (item.type === 'section') {
                html += '</div>' + this.renderSection(item) + '<div class="row">';
            }
        });
        
        html += '</div>';
        return html;
    }
    
    renderField(field) {
        const colWidth = this.getFieldWidth(field.display?.width);
        const display = this.shouldDisplayField(field.id) ? 'block' : 'none';
        
        let fieldHTML = `
            <div class="col-md-${colWidth} mb-3 field-wrapper" data-field-id="${field.id}" style="display: ${display};">
                <div class="form-group">
        `;
        
        // Label
        if (field.label && field.type !== 'heading' && field.type !== 'paragraph') {
            fieldHTML += `
                <label for="${field.id}" class="form-label">
                    ${field.label}
                    ${field.required ? '<span class="text-danger">*</span>' : ''}
                </label>
            `;
        }
        
        // Field input
        fieldHTML += this.renderFieldInput(field);
        
        // Help text
        if (field.helpText) {
            fieldHTML += `<small class="form-text text-muted">${field.helpText}</small>`;
        }
        
        // Error message
        fieldHTML += `<div class="invalid-feedback" id="${field.id}-error"></div>`;
        
        fieldHTML += '</div></div>';
        
        return fieldHTML;
    }
    
    renderFieldInput(field) {
        const value = this.formData[field.name] || field.defaultValue || '';
        const disabled = field.disabled || this.options.mode === 'readonly';
        const readonly = field.readonly;
        
        switch (field.type) {
            case 'text':
            case 'email':
            case 'url':
            case 'tel':
            case 'password':
                return `<input type="${field.type}" 
                    class="form-control" 
                    id="${field.id}" 
                    name="${field.name}" 
                    value="${value}"
                    placeholder="${field.placeholder || ''}"
                    ${disabled ? 'disabled' : ''}
                    ${readonly ? 'readonly' : ''}
                    ${field.validation?.maxLength ? `maxlength="${field.validation.maxLength}"` : ''}
                    ${field.validation?.pattern ? `pattern="${field.validation.pattern}"` : ''}>`;
                
            case 'number':
                return `<input type="number" 
                    class="form-control" 
                    id="${field.id}" 
                    name="${field.name}" 
                    value="${value}"
                    placeholder="${field.placeholder || ''}"
                    ${disabled ? 'disabled' : ''}
                    ${readonly ? 'readonly' : ''}
                    ${field.validation?.min !== null ? `min="${field.validation.min}"` : ''}
                    ${field.validation?.max !== null ? `max="${field.validation.max}"` : ''}>`;
                
            case 'date':
            case 'time':
            case 'datetime-local':
                const inputType = field.type === 'datetime' ? 'datetime-local' : field.type;
                return `<input type="${inputType}" 
                    class="form-control" 
                    id="${field.id}" 
                    name="${field.name}" 
                    value="${value}"
                    ${disabled ? 'disabled' : ''}
                    ${readonly ? 'readonly' : ''}>`;
                
            case 'textarea':
                return `<textarea 
                    class="form-control" 
                    id="${field.id}" 
                    name="${field.name}" 
                    rows="${field.rows || 3}"
                    placeholder="${field.placeholder || ''}"
                    ${disabled ? 'disabled' : ''}
                    ${readonly ? 'readonly' : ''}
                    ${field.validation?.maxLength ? `maxlength="${field.validation.maxLength}"` : ''}>${value}</textarea>`;
                
            case 'select':
                let selectHTML = `<select class="form-control" id="${field.id}" name="${field.name}" ${disabled ? 'disabled' : ''}>`;
                selectHTML += `<option value="">${field.placeholder || 'Select...'}</option>`;
                
                if (field.options) {
                    field.options.forEach(option => {
                        const selected = value == option.value ? 'selected' : '';
                        selectHTML += `<option value="${option.value}" ${selected} ${option.disabled ? 'disabled' : ''}>${option.label}</option>`;
                    });
                }
                
                selectHTML += '</select>';
                return selectHTML;
                
            case 'radio':
                let radioHTML = '<div class="radio-group">';
                
                if (field.options) {
                    field.options.forEach((option, index) => {
                        const checked = value == option.value ? 'checked' : '';
                        radioHTML += `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" 
                                    name="${field.name}" 
                                    id="${field.id}_${index}" 
                                    value="${option.value}"
                                    ${checked}
                                    ${disabled ? 'disabled' : ''}
                                    ${option.disabled ? 'disabled' : ''}>
                                <label class="form-check-label" for="${field.id}_${index}">
                                    ${option.label}
                                </label>
                            </div>
                        `;
                    });
                }
                
                radioHTML += '</div>';
                return radioHTML;
                
            case 'checkbox':
                if (field.options && field.options.length > 1) {
                    // Multiple checkboxes
                    let checkboxHTML = '<div class="checkbox-group">';
                    const values = Array.isArray(value) ? value : [];
                    
                    field.options.forEach((option, index) => {
                        const checked = values.includes(option.value) ? 'checked' : '';
                        checkboxHTML += `
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" 
                                    name="${field.name}[]" 
                                    id="${field.id}_${index}" 
                                    value="${option.value}"
                                    ${checked}
                                    ${disabled ? 'disabled' : ''}
                                    ${option.disabled ? 'disabled' : ''}>
                                <label class="form-check-label" for="${field.id}_${index}">
                                    ${option.label}
                                </label>
                            </div>
                        `;
                    });
                    
                    checkboxHTML += '</div>';
                    return checkboxHTML;
                } else {
                    // Single checkbox
                    const checked = value ? 'checked' : '';
                    return `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" 
                                id="${field.id}" 
                                name="${field.name}"
                                ${checked}
                                ${disabled ? 'disabled' : ''}>
                            <label class="form-check-label" for="${field.id}">
                                ${field.options?.[0]?.label || 'Check to confirm'}
                            </label>
                        </div>
                    `;
                }
                
            case 'toggle':
                const toggleChecked = value ? 'checked' : '';
                return `
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" 
                            id="${field.id}" 
                            name="${field.name}"
                            ${toggleChecked}
                            ${disabled ? 'disabled' : ''}>
                        <label class="form-check-label" for="${field.id}">
                            ${field.label}
                        </label>
                    </div>
                `;
                
            case 'file':
                return `<input type="file" 
                    class="form-control" 
                    id="${field.id}" 
                    name="${field.name}"
                    accept="${field.accept || ''}"
                    ${field.multiple ? 'multiple' : ''}
                    ${disabled ? 'disabled' : ''}>`;
                
            case 'signature':
                return `
                    <div class="signature-pad border rounded p-3" id="${field.id}">
                        <canvas width="400" height="200"></canvas>
                        <button type="button" class="btn btn-sm btn-secondary mt-2" onclick="clearSignature('${field.id}')">Clear</button>
                    </div>
                `;
                
            case 'rating':
                let ratingHTML = '<div class="rating-field">';
                const maxRating = field.maxRating || 5;
                
                for (let i = 1; i <= maxRating; i++) {
                    const checked = value == i ? 'checked' : '';
                    ratingHTML += `
                        <input type="radio" name="${field.name}" id="${field.id}_${i}" value="${i}" ${checked} ${disabled ? 'disabled' : ''}>
                        <label for="${field.id}_${i}"><i class="fas fa-star"></i></label>
                    `;
                }
                
                ratingHTML += '</div>';
                return ratingHTML;
                
            case 'slider':
                return `
                    <input type="range" 
                        class="form-range" 
                        id="${field.id}" 
                        name="${field.name}"
                        value="${value || field.min || 0}"
                        min="${field.min || 0}"
                        max="${field.max || 100}"
                        step="${field.step || 1}"
                        ${disabled ? 'disabled' : ''}>
                    <output for="${field.id}">${value || field.min || 0}</output>
                `;
                
            case 'heading':
                return `<h${field.level || 4}>${field.label}</h${field.level || 4}>`;
                
            case 'paragraph':
                return `<p>${field.content || field.label}</p>`;
                
            case 'divider':
                return '<hr>';
                
            case 'address':
                return this.renderAddressFields(field, value, disabled, readonly);
                
            case 'fieldset-repeater':
                return this.renderFieldsetRepeater(field, value, disabled, readonly);
                
            default:
                return `<input type="text" class="form-control" id="${field.id}" name="${field.name}" value="${value}" ${disabled ? 'disabled' : ''}>`;
        }
    }
    
    renderAddressFields(field, value = {}, disabled, readonly) {
        const includeFields = field.includeFields || ['street', 'city', 'state', 'zip', 'country'];
        let html = '<div class="address-fields">';
        
        if (includeFields.includes('street')) {
            html += `
                <input type="text" class="form-control mb-2" 
                    name="${field.name}_street" 
                    placeholder="Street Address"
                    value="${value.street || ''}"
                    ${disabled ? 'disabled' : ''}
                    ${readonly ? 'readonly' : ''}>
            `;
        }
        
        html += '<div class="row">';
        
        if (includeFields.includes('city')) {
            html += `
                <div class="col-md-6">
                    <input type="text" class="form-control mb-2" 
                        name="${field.name}_city" 
                        placeholder="City"
                        value="${value.city || ''}"
                        ${disabled ? 'disabled' : ''}
                        ${readonly ? 'readonly' : ''}>
                </div>
            `;
        }
        
        if (includeFields.includes('state')) {
            html += `
                <div class="col-md-3">
                    <input type="text" class="form-control mb-2" 
                        name="${field.name}_state" 
                        placeholder="State"
                        value="${value.state || ''}"
                        ${disabled ? 'disabled' : ''}
                        ${readonly ? 'readonly' : ''}>
                </div>
            `;
        }
        
        if (includeFields.includes('zip')) {
            html += `
                <div class="col-md-3">
                    <input type="text" class="form-control mb-2" 
                        name="${field.name}_zip" 
                        placeholder="ZIP"
                        value="${value.zip || ''}"
                        ${disabled ? 'disabled' : ''}
                        ${readonly ? 'readonly' : ''}>
                </div>
            `;
        }
        
        html += '</div>';
        
        if (includeFields.includes('country')) {
            html += `
                <input type="text" class="form-control" 
                    name="${field.name}_country" 
                    placeholder="Country"
                    value="${value.country || ''}"
                    ${disabled ? 'disabled' : ''}
                    ${readonly ? 'readonly' : ''}>
            `;
        }
        
        html += '</div>';
        return html;
    }
    
    renderFieldsetRepeater(field, value = [], disabled, readonly) {
        // Ensure value is an array
        if (!Array.isArray(value)) {
            value = [];
        }
        
        const minItems = field.minItems || 0;
        const maxItems = field.maxItems || 100;
        const defaultItems = field.defaultItems || 0;
        
        // Initialize with default items if empty
        if (value.length === 0 && defaultItems > 0) {
            for (let i = 0; i < defaultItems; i++) {
                value.push({});
            }
        }
        
        let html = `<div class="fieldset-repeater" data-field-id="${field.id}" data-min-items="${minItems}" data-max-items="${maxItems}">`;
        
        // Add help text if available
        if (field.helpText) {
            html += `<p class="text-muted small">${field.helpText}</p>`;
        }
        
        // Container for all items
        html += `<div class="repeater-items" id="${field.id}_items">`;
        
        // Render existing items
        value.forEach((item, index) => {
            html += this.renderRepeaterItem(field, item, index, disabled, readonly);
        });
        
        html += '</div>'; // Close repeater-items
        
        // Add button (if not at max items and not disabled)
        if (!disabled && value.length < maxItems) {
            html += `
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="window.formRenderer.addRepeaterItem('${field.id}')">
                    ${field.addButtonText || '+ Add Item'}
                </button>
            `;
        }
        
        html += '</div>'; // Close fieldset-repeater
        
        return html;
    }
    
    renderRepeaterItem(field, itemValue = {}, index, disabled, readonly) {
        const itemLabel = field.itemLabel ? field.itemLabel.replace('#{index}', index + 1) : `Item ${index + 1}`;
        const canRemove = !disabled && (!field.minItems || this.getRepeaterItemCount(field.id) > field.minItems);
        
        let html = `<div class="repeater-item border rounded p-3 mb-2" data-item-index="${index}">`;
        
        // Item header with label and remove button
        html += '<div class="d-flex justify-content-between align-items-center mb-2">';
        html += `<h6 class="mb-0">${itemLabel}</h6>`;
        
        if (canRemove) {
            html += `
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.formRenderer.removeRepeaterItem('${field.id}', ${index})">
                    ${field.removeButtonText || 'Remove'}
                </button>
            `;
        }
        
        html += '</div>';
        
        // Render fields within the repeater item
        if (field.fields && Array.isArray(field.fields)) {
            field.fields.forEach(subField => {
                // Create a unique field instance for this item
                const itemField = {
                    ...subField,
                    id: `${field.id}_${index}_${subField.id}`,
                    name: `${field.name}[${index}][${subField.name}]`
                };
                
                // Get value for this specific field
                const fieldValue = itemValue[subField.name] || '';
                
                // Render the field
                html += '<div class="mb-3">';
                html += this.renderField(itemField, fieldValue);
                html += '</div>';
            });
        }
        
        html += '</div>'; // Close repeater-item
        
        return html;
    }
    
    addRepeaterItem(fieldId) {
        const field = this.getFieldById(fieldId);
        if (!field) return;
        
        const container = document.getElementById(`${fieldId}_items`);
        if (!container) return;
        
        const currentCount = container.children.length;
        if (currentCount >= (field.maxItems || 100)) {
            alert(`Maximum ${field.maxItems} items allowed`);
            return;
        }
        
        // Create new empty item
        const newItemHtml = this.renderRepeaterItem(field, {}, currentCount, false, false);
        
        // Add to DOM
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newItemHtml;
        container.appendChild(tempDiv.firstChild);
        
        // Update form data
        if (!this.formData[field.name]) {
            this.formData[field.name] = [];
        }
        this.formData[field.name].push({});
        
        // Reinitialize any special fields in the new item
        this.initializeSpecialFields();
    }
    
    removeRepeaterItem(fieldId, index) {
        const field = this.getFieldById(fieldId);
        if (!field) return;
        
        const container = document.getElementById(`${fieldId}_items`);
        if (!container) return;
        
        const currentCount = container.children.length;
        if (field.minItems && currentCount <= field.minItems) {
            alert(`Minimum ${field.minItems} items required`);
            return;
        }
        
        // Remove from DOM
        const itemToRemove = container.querySelector(`[data-item-index="${index}"]`);
        if (itemToRemove) {
            itemToRemove.remove();
        }
        
        // Update form data
        if (this.formData[field.name] && Array.isArray(this.formData[field.name])) {
            this.formData[field.name].splice(index, 1);
        }
        
        // Re-index remaining items
        const remainingItems = container.querySelectorAll('.repeater-item');
        remainingItems.forEach((item, newIndex) => {
            item.setAttribute('data-item-index', newIndex);
            // Update labels and field names/ids
            this.reindexRepeaterItem(field, item, newIndex);
        });
    }
    
    reindexRepeaterItem(field, itemElement, newIndex) {
        // Update item label
        const labelElement = itemElement.querySelector('h6');
        if (labelElement && field.itemLabel) {
            labelElement.textContent = field.itemLabel.replace('#{index}', newIndex + 1);
        }
        
        // Update remove button
        const removeButton = itemElement.querySelector('button[onclick*="removeRepeaterItem"]');
        if (removeButton) {
            removeButton.setAttribute('onclick', `window.formRenderer.removeRepeaterItem('${field.id}', ${newIndex})`);
        }
        
        // Update field names and ids
        field.fields.forEach(subField => {
            const oldId = `${field.id}_${itemElement.dataset.itemIndex}_${subField.id}`;
            const newId = `${field.id}_${newIndex}_${subField.id}`;
            const newName = `${field.name}[${newIndex}][${subField.name}]`;
            
            const fieldElement = itemElement.querySelector(`#${oldId}`);
            if (fieldElement) {
                fieldElement.id = newId;
                fieldElement.name = newName;
                
                // Update associated labels
                const label = itemElement.querySelector(`label[for="${oldId}"]`);
                if (label) {
                    label.setAttribute('for', newId);
                }
            }
        });
    }
    
    getRepeaterItemCount(fieldId) {
        const container = document.getElementById(`${fieldId}_items`);
        return container ? container.children.length : 0;
    }
    
    getFieldById(fieldId) {
        return this.schema.fields[fieldId];
    }
    
    renderRepeaterSection(section) {
        // Implementation for repeatable sections
        let html = '<div class="repeater-section">';
        const repeatCount = this.formData[`${section.id}_count`] || section.minRepeat || 1;
        
        for (let i = 0; i < repeatCount; i++) {
            html += `
                <div class="repeater-item" data-index="${i}">
                    <div class="repeater-header">
                        <h6>${section.title} ${i + 1}</h6>
                        ${i >= (section.minRepeat || 1) ? `<button type="button" class="btn btn-sm btn-danger" onclick="removeRepeaterItem('${section.id}', ${i})"><i class="fas fa-times"></i></button>` : ''}
                    </div>
                    ${this.renderSectionItems(section)}
                </div>
            `;
        }
        
        if (!section.maxRepeat || repeatCount < section.maxRepeat) {
            html += `<button type="button" class="btn btn-sm btn-primary" onclick="addRepeaterItem('${section.id}')"><i class="fas fa-plus"></i> Add ${section.title}</button>`;
        }
        
        html += '</div>';
        return html;
    }
    
    renderNavigation(page) {
        let html = '<div class="d-flex justify-content-between">';
        
        // Default navigation settings if not specified
        const nav = page.navigation || {
            showPrevious: true,
            showNext: true,
            showSave: true,
            nextButtonText: 'Continue',
            previousButtonText: 'Back'
        };
        
        // Previous button
        if (this.currentPage > 0 && nav.showPrevious !== false) {
            html += `<button type="button" class="btn btn-secondary" onclick="formRenderer.previousPage()">
                <i class="fas fa-arrow-left"></i> ${nav.previousButtonText || 'Back'}
            </button>`;
        } else {
            html += '<div></div>';
        }
        
        // Save draft button
        if (nav.showSave !== false && this.schema.settings.allowSaveDraft) {
            html += `<button type="button" class="btn btn-outline-primary" onclick="formRenderer.saveDraft()">
                <i class="fas fa-save"></i> ${this.schema.settings.saveButtonText || 'Save Draft'}
            </button>`;
        }
        
        // Next/Submit button
        if (this.currentPage < this.schema.pages.length - 1 && nav.showNext !== false) {
            html += `<button type="button" class="btn btn-primary" onclick="formRenderer.nextPage()">
                ${nav.nextButtonText || 'Continue'} <i class="fas fa-arrow-right"></i>
            </button>`;
        } else if (this.currentPage === this.schema.pages.length - 1) {
            html += `<button type="button" class="btn btn-success" onclick="formRenderer.submit()">
                <i class="fas fa-check"></i> ${this.schema.settings.submitButtonText || 'Submit'}
            </button>`;
        }
        
        html += '</div>';
        return html;
    }
    
    attachEventListeners(container) {
        // Input change listeners
        container.querySelectorAll('input, select, textarea').forEach(element => {
            element.addEventListener('change', (e) => this.handleFieldChange(e));
            element.addEventListener('blur', (e) => this.handleFieldBlur(e));
        });
        
        // Collapsible sections
        container.querySelectorAll('.section-header').forEach(header => {
            if (header.querySelector('.toggle-icon')) {
                header.addEventListener('click', () => this.toggleSection(header));
            }
        });
        
        // Range sliders
        container.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const output = e.target.nextElementSibling;
                if (output) output.value = e.target.value;
            });
        });
    }
    
    handleFieldChange(event) {
        const field = this.getFieldByElement(event.target);
        if (!field) return;
        
        // Update form data
        if (event.target.type === 'checkbox' && event.target.name.endsWith('[]')) {
            // Handle multiple checkboxes
            if (!Array.isArray(this.formData[field.name])) {
                this.formData[field.name] = [];
            }
            
            if (event.target.checked) {
                this.formData[field.name].push(event.target.value);
            } else {
                this.formData[field.name] = this.formData[field.name].filter(v => v !== event.target.value);
            }
        } else if (event.target.type === 'checkbox') {
            this.formData[field.name] = event.target.checked;
        } else if (event.target.type === 'file') {
            this.formData[field.name] = event.target.files;
        } else {
            this.formData[field.name] = event.target.value;
        }
        
        // Apply conditional logic
        this.applyLogic();
        
        // Run calculations
        this.runCalculations();
        
        // Validate field
        this.validateField(field);
        
        // Call custom handler
        if (this.options.onFieldChange) {
            this.options.onFieldChange(field, this.formData[field.name]);
        }
    }
    
    handleFieldBlur(event) {
        const field = this.getFieldByElement(event.target);
        if (!field) return;
        
        this.touched[field.name] = true;
        this.validateField(field);
    }
    
    validateField(field) {
        const value = this.formData[field.name];
        const errors = [];
        
        // Required validation
        if (field.required && !value) {
            errors.push(field.validation?.messages?.required || `${field.label} is required`);
        }
        
        // Type-specific validation
        if (value) {
            switch (field.type) {
                case 'email':
                    if (!this.isValidEmail(value)) {
                        errors.push('Please enter a valid email address');
                    }
                    break;
                    
                case 'url':
                    if (!this.isValidURL(value)) {
                        errors.push('Please enter a valid URL');
                    }
                    break;
                    
                case 'number':
                    if (field.validation?.min !== null && value < field.validation.min) {
                        errors.push(`Minimum value is ${field.validation.min}`);
                    }
                    if (field.validation?.max !== null && value > field.validation.max) {
                        errors.push(`Maximum value is ${field.validation.max}`);
                    }
                    break;
                    
                case 'text':
                case 'textarea':
                    if (field.validation?.minLength && value.length < field.validation.minLength) {
                        errors.push(field.validation.messages?.minLength || `Minimum length is ${field.validation.minLength} characters`);
                    }
                    if (field.validation?.maxLength && value.length > field.validation.maxLength) {
                        errors.push(`Maximum length is ${field.validation.maxLength} characters`);
                    }
                    if (field.validation?.pattern) {
                        const regex = new RegExp(field.validation.pattern);
                        if (!regex.test(value)) {
                            errors.push(field.validation.messages?.pattern || 'Invalid format');
                        }
                    }
                    break;
            }
        }
        
        // Update errors
        if (errors.length > 0) {
            this.errors[field.name] = errors;
            this.showFieldError(field.id, errors[0]);
        } else {
            delete this.errors[field.name];
            this.clearFieldError(field.id);
        }
        
        return errors.length === 0;
    }
    
    showFieldError(fieldId, error) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field) {
            field.classList.add('is-invalid');
        }
        
        if (errorElement) {
            errorElement.textContent = error;
        }
    }
    
    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field) {
            field.classList.remove('is-invalid');
        }
        
        if (errorElement) {
            errorElement.textContent = '';
        }
    }
    
    applyLogic() {
        this.logic.evaluate(this.formData, (action) => {
            switch (action.type) {
                case 'visibility':
                    this.handleVisibilityAction(action);
                    break;
                case 'value':
                    this.handleValueAction(action);
                    break;
                case 'validation':
                    this.handleValidationAction(action);
                    break;
            }
        });
    }
    
    handleVisibilityAction(action) {
        const target = document.querySelector(`[data-field-id="${action.target}"], [data-section-id="${action.target}"]`);
        if (!target) return;
        
        switch (action.action) {
            case 'show':
                target.style.display = 'block';
                break;
            case 'hide':
                target.style.display = 'none';
                break;
            case 'toggle':
                target.style.display = target.style.display === 'none' ? 'block' : 'none';
                break;
        }
    }
    
    runCalculations() {
        this.calculations.calculate(this.formData, (fieldId, value) => {
            const field = this.schema.fields[fieldId];
            if (field) {
                this.formData[field.name] = value;
                const element = document.getElementById(fieldId);
                if (element) {
                    element.value = value;
                }
            }
        });
    }
    
    nextPage() {
        // Validate current page
        if (!this.validatePage(this.currentPage)) {
            alert('Please complete all required fields before continuing.');
            return;
        }
        
        if (this.currentPage < this.schema.pages.length - 1) {
            this.currentPage++;
            this.render();
            
            if (this.options.onPageChange) {
                this.options.onPageChange(this.currentPage);
            }
        }
    }
    
    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.render();
            
            if (this.options.onPageChange) {
                this.options.onPageChange(this.currentPage);
            }
        }
    }
    
    validatePage(pageIndex) {
        const page = this.schema.pages[pageIndex];
        let isValid = true;
        
        page.sections.forEach(section => {
            section.items.forEach(item => {
                if (item.type === 'field' && this.schema.fields[item.fieldId]) {
                    const field = this.schema.fields[item.fieldId];
                    if (!this.validateField(field)) {
                        isValid = false;
                    }
                }
            });
        });
        
        return isValid;
    }
    
    validateForm() {
        let isValid = true;
        
        this.schema.pages.forEach((page, index) => {
            if (!this.validatePage(index)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    async saveDraft() {
        const state = {
            currentPage: this.currentPage,
            data: this.formData,
            errors: this.errors,
            touched: this.touched,
            savedAt: new Date().toISOString()
        };
        
        if (this.options.onSave) {
            await this.options.onSave(state);
        }
        
        alert('Draft saved successfully!');
    }
    
    async submit() {
        if (!this.validateForm()) {
            alert('Please complete all required fields before submitting.');
            return;
        }
        
        if (this.options.onSubmit) {
            await this.options.onSubmit(this.formData);
        }
    }
    
    autoSave() {
        if (this.hasUnsavedChanges()) {
            this.saveDraft();
        }
    }
    
    hasUnsavedChanges() {
        // Implementation to check if there are unsaved changes
        return Object.keys(this.touched).length > 0;
    }
    
    getFormData() {
        return this.formData;
    }
    
    setFormData(data) {
        if (data) {
            this.formData = { ...this.formData, ...data };
            this.render();
        }
    }
    
    getCompleteState() {
        return {
            schema: this.schema,
            state: {
                currentPage: this.currentPage,
                data: this.formData,
                errors: this.errors,
                touched: this.touched,
                submitted: false,
                savedAt: new Date().toISOString(),
                completedPages: this.completedPages || []
            },
            visibilityState: this.visibilityState || {},
            calculatedValues: this.calculatedValues || {}
        };
    }
    
    restoreCompleteState(savedState) {
        if (savedState && savedState.state) {
            this.formData = savedState.state.data || {};
            this.currentPage = savedState.state.currentPage || 0;
            this.errors = savedState.state.errors || {};
            this.touched = savedState.state.touched || {};
            this.completedPages = savedState.state.completedPages || [];
            
            if (savedState.visibilityState) {
                this.visibilityState = savedState.visibilityState;
            }
            if (savedState.calculatedValues) {
                this.calculatedValues = savedState.calculatedValues;
            }
            
            this.render();
        }
    }
    
    getFieldByElement(element) {
        const fieldId = element.closest('[data-field-id]')?.dataset.fieldId;
        return this.schema.fields[fieldId];
    }
    
    shouldDisplay(visibility) {
        if (!visibility || !visibility.rules || visibility.rules.length === 0) {
            return true;
        }
        
        // Implementation for visibility rules
        return true;
    }
    
    shouldDisplayField(fieldId) {
        // Check if field should be displayed based on logic rules
        return true;
    }
    
    getFieldWidth(width) {
        switch (width) {
            case '25%': return 3;
            case '33%': return 4;
            case '50%': return 6;
            case '75%': return 9;
            case '100%': 
            default: return 12;
        }
    }
    
    toggleSection(header) {
        const section = header.parentElement;
        const icon = header.querySelector('.toggle-icon');
        
        section.classList.toggle('collapsed');
        
        if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        }
    }
    
    createElementFromHTML(htmlString) {
        const div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
    }
    
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}

// Logic Engine
class FormLogicEngine {
    constructor(rules) {
        this.rules = rules || [];
    }
    
    evaluate(formData, actionCallback) {
        this.rules.forEach(rule => {
            if (this.evaluateConditions(rule.trigger, formData)) {
                rule.actions.forEach(action => actionCallback(action));
            }
        });
    }
    
    evaluateConditions(trigger, formData) {
        if (!trigger || !trigger.conditions) return true;
        
        const results = trigger.conditions.map(condition => {
            return this.evaluateCondition(condition, formData);
        });
        
        switch (trigger.operator) {
            case 'all':
                return results.every(r => r);
            case 'any':
                return results.some(r => r);
            case 'none':
                return !results.some(r => r);
            default:
                return true;
        }
    }
    
    evaluateCondition(condition, formData) {
        const fieldValue = formData[condition.field];
        const compareValue = condition.value;
        
        switch (condition.operator) {
            case 'equals':
                return fieldValue == compareValue;
            case 'notEquals':
                return fieldValue != compareValue;
            case 'contains':
                return fieldValue && fieldValue.toString().includes(compareValue);
            case 'greaterThan':
                return Number(fieldValue) > Number(compareValue);
            case 'lessThan':
                return Number(fieldValue) < Number(compareValue);
            case 'empty':
                return !fieldValue;
            case 'notEmpty':
                return !!fieldValue;
            default:
                return true;
        }
    }
}

// Calculation Engine
class FormCalculationEngine {
    constructor(calculations) {
        this.calculations = calculations || [];
    }
    
    calculate(formData, updateCallback) {
        this.calculations.forEach(calc => {
            const result = this.evaluateFormula(calc.formula, formData);
            if (result !== null) {
                updateCallback(calc.target, result);
            }
        });
    }
    
    evaluateFormula(formula, formData) {
        // Simple formula evaluation
        // In production, use a proper expression parser
        try {
            // Replace field references with values
            let expression = formula;
            Object.keys(formData).forEach(key => {
                const value = Number(formData[key]) || 0;
                expression = expression.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            });
            
            // Evaluate the expression (BE CAREFUL WITH EVAL IN PRODUCTION)
            return eval(expression);
        } catch (error) {
            console.error('Calculation error:', error);
            return null;
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormRenderer;
}