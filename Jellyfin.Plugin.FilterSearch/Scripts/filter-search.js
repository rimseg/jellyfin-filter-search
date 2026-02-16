/**
 * Jellyfin Filter Search Plugin
 * Adds search functionality to filter dialogs (tags, genres, studios, etc.)
 * and displays enabled/checked filters at the top of the list.
 */

(function() {
    'use strict';

    const PLUGIN_ID = 'filter-search-plugin';
    const SEARCH_INPUT_CLASS = 'filter-search-input';
    const WRAPPER_CLASS = 'filter-search-wrapper';

    const styles = `
        .${WRAPPER_CLASS} {
            padding: 0.5em 0;
            position: sticky;
            top: 0;
            background: inherit;
            z-index: 10;
        }
        .${SEARCH_INPUT_CLASS} {
            width: 100%;
            padding: 0.5em 0.8em;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            background: rgba(0, 0, 0, 0.3);
            color: inherit;
            font-size: 0.9em;
            outline: none;
            box-sizing: border-box;
        }
        .${SEARCH_INPUT_CLASS}:focus {
            border-color: #00a4dc;
            box-shadow: 0 0 0 2px rgba(0, 164, 220, 0.2);
        }
        .${SEARCH_INPUT_CLASS}::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
        .filter-item-hidden {
            display: none !important;
        }
        .filter-item-enabled {
            order: -1 !important;
        }
        .checkboxList {
            display: flex !important;
            flex-direction: column !important;
        }
        .filter-separator {
            width: 100%;
            border: none;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            margin: 0.5em 0;
            order: -1;
        }
        .filter-enabled-header {
            font-size: 0.8em;
            color: rgba(255, 255, 255, 0.6);
            padding: 0.2em 0;
            order: -2;
            font-weight: 500;
        }
        .no-results-message {
            padding: 0.5em;
            text-align: center;
            color: rgba(255, 255, 255, 0.5);
            font-style: italic;
            font-size: 0.9em;
        }
        .filter-select-actions {
            display: flex;
            gap: 0.8em;
            padding: 0.4em 0;
            align-items: center;
        }
        .filter-select-actions .filter-action-btn {
            background: none;
            border: none;
            color: #00a4dc;
            cursor: pointer;
            font-size: 0.85em;
            padding: 0.2em 0.4em;
            text-decoration: underline;
            font-weight: 500;
        }
        .filter-select-actions .filter-action-btn:hover {
            color: #0fbcff;
        }
        .active-filters-bar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5em;
            padding: 0.6em 1em;
            margin: 0.5em 0;
            background: rgba(0, 164, 220, 0.1);
            border: 1px solid rgba(0, 164, 220, 0.3);
            border-radius: 6px;
        }
        .active-filters-bar.hidden {
            display: none;
        }
        .active-filters-label {
            font-size: 0.85em;
            color: rgba(255, 255, 255, 0.7);
            margin-right: 0.3em;
        }
        .active-filter-tag {
            display: inline-flex;
            align-items: center;
            gap: 0.4em;
            padding: 0.25em 0.6em;
            background: rgba(0, 164, 220, 0.2);
            border: 1px solid rgba(0, 164, 220, 0.4);
            border-radius: 4px;
            font-size: 0.8em;
            color: #fff;
        }
        .active-filter-tag .filter-category {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9em;
        }
        .active-filter-tag .remove-filter {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            padding: 0;
            font-size: 1.1em;
            line-height: 1;
            margin-left: 0.2em;
        }
        .active-filter-tag .remove-filter:hover {
            color: #ff6b6b;
        }
        .clear-all-filters-btn {
            background: rgba(255, 107, 107, 0.2);
            border: 1px solid rgba(255, 107, 107, 0.4);
            color: #ff6b6b;
            cursor: pointer;
            padding: 0.25em 0.6em;
            border-radius: 4px;
            font-size: 0.8em;
            margin-left: auto;
        }
        .clear-all-filters-btn:hover {
            background: rgba(255, 107, 107, 0.3);
            border-color: rgba(255, 107, 107, 0.6);
        }
    `;

    function injectStyles() {
        if (document.getElementById(PLUGIN_ID + '-styles')) return;
        const styleElement = document.createElement('style');
        styleElement.id = PLUGIN_ID + '-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    function createSearchInput(placeholder) {
        const wrapper = document.createElement('div');
        wrapper.className = WRAPPER_CLASS;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = SEARCH_INPUT_CLASS;
        input.placeholder = placeholder || 'Search...';
        input.autocomplete = 'off';
        input.spellcheck = false;
        wrapper.appendChild(input);
        return wrapper;
    }

    function getFilterItems(container) {
        const items = container.querySelectorAll('label');
        return Array.from(items).filter(function(label) {
            return label.querySelector('input[type="checkbox"]') || label.classList.contains('emby-checkbox-label');
        });
    }

    function isItemEnabled(item) {
        const checkbox = item.querySelector('input[type="checkbox"]');
        return checkbox ? checkbox.checked : false;
    }

    function getItemText(item) {
        const clone = item.cloneNode(true);
        const toRemove = clone.querySelectorAll('input, .checkboxOutline, .material-icons, .md-icon, span.checkboxIcon');
        toRemove.forEach(function(el) { el.remove(); });
        return clone.textContent.trim().toLowerCase();
    }

    function filterItems(items, query, checkboxList) {
        const normalizedQuery = query.toLowerCase().trim();
        let visibleCount = 0;
        items.forEach(function(item) {
            const text = getItemText(item);
            const matches = normalizedQuery === '' || text.includes(normalizedQuery);
            if (matches) {
                item.classList.remove('filter-item-hidden');
                visibleCount++;
            } else {
                item.classList.add('filter-item-hidden');
            }
        });
        let noResultsMsg = checkboxList.querySelector('.no-results-message');
        if (visibleCount === 0 && normalizedQuery !== '') {
            if (!noResultsMsg) {
                noResultsMsg = document.createElement('div');
                noResultsMsg.className = 'no-results-message';
                noResultsMsg.textContent = 'No matches found';
                checkboxList.appendChild(noResultsMsg);
            }
        } else if (noResultsMsg) {
            noResultsMsg.remove();
        }
    }

    function sortEnabledToTop(items, checkboxList) {
        const existingSeparator = checkboxList.querySelector('.filter-separator');
        const existingHeader = checkboxList.querySelector('.filter-enabled-header');
        if (existingSeparator) existingSeparator.remove();
        if (existingHeader) existingHeader.remove();
        let hasEnabled = false;
        items.forEach(function(item) {
            if (isItemEnabled(item)) {
                item.classList.add('filter-item-enabled');
                hasEnabled = true;
            } else {
                item.classList.remove('filter-item-enabled');
            }
        });
        if (hasEnabled) {
            const separator = document.createElement('hr');
            separator.className = 'filter-separator';
            const header = document.createElement('div');
            header.className = 'filter-enabled-header';
            header.textContent = 'Selected';
            checkboxList.insertBefore(separator, checkboxList.firstChild);
            checkboxList.insertBefore(header, checkboxList.firstChild);
        }
    }

    function createSelectActions(checkboxList, searchInput) {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-select-actions';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.type = 'button';
        selectAllBtn.className = 'filter-action-btn';
        selectAllBtn.textContent = 'Select All';

        const selectNoneBtn = document.createElement('button');
        selectNoneBtn.type = 'button';
        selectNoneBtn.className = 'filter-action-btn';
        selectNoneBtn.textContent = 'None';

        function setAll(checked) {
            var items = getFilterItems(checkboxList);
            var changedCheckboxes = [];
            items.forEach(function(item) {
                if (item.classList.contains('filter-item-hidden')) return;
                var cb = item.querySelector('input[type="checkbox"]');
                if (cb && cb.checked !== checked) {
                    changedCheckboxes.push({ checkbox: cb, label: item });
                }
            });
            // Use click() to properly trigger Jellyfin's event handlers
            changedCheckboxes.forEach(function(item) {
                // Click triggers the full event chain that Jellyfin listens to
                item.checkbox.click();
            });
            setTimeout(function() {
                var currentItems = getFilterItems(checkboxList);
                sortEnabledToTop(currentItems, checkboxList);
                if (searchInput) filterItems(currentItems, searchInput.value, checkboxList);
            }, 50);
        }

        selectAllBtn.addEventListener('click', function() { setAll(true); });
        selectNoneBtn.addEventListener('click', function() { setAll(false); });

        wrapper.appendChild(selectAllBtn);
        wrapper.appendChild(selectNoneBtn);
        return wrapper;
    }

    function initializeSection(collapseSection) {
        const content = collapseSection.querySelector('.collapseContent, .filterOptions');
        if (!content) return;
        const checkboxList = content.querySelector('.checkboxList');
        if (!checkboxList) return;
        if (content.querySelector('.' + WRAPPER_CLASS)) return;

        const items = getFilterItems(checkboxList);
        sortEnabledToTop(items, checkboxList);
        if (items.length < 5) return;

        const titleEl = collapseSection.querySelector('.emby-collapsible-title, h3');
        const title = collapseSection.getAttribute('title') || (titleEl ? titleEl.textContent : 'filters');
        const placeholder = 'Search ' + title.toLowerCase() + '...';

        const searchWrapper = createSearchInput(placeholder);
        content.insertBefore(searchWrapper, content.firstChild);
        const searchInput = searchWrapper.querySelector('.' + SEARCH_INPUT_CLASS);

        const selectActions = createSelectActions(checkboxList, searchInput);
        content.insertBefore(selectActions, checkboxList);

        searchInput.addEventListener('input', function(e) {
            filterItems(items, e.target.value, checkboxList);
        });
        searchInput.addEventListener('keydown', function(e) {
            e.stopPropagation();
        });
        checkboxList.addEventListener('change', function(e) {
            if (e.target.type === 'checkbox') {
                setTimeout(function() {
                    const currentItems = getFilterItems(checkboxList);
                    sortEnabledToTop(currentItems, checkboxList);
                    filterItems(currentItems, searchInput.value, checkboxList);
                }, 10);
            }
        });
        console.log('[' + PLUGIN_ID + '] Initialized search for: ' + title);
    }

    function processFilterDialog(dialog) {
        const collapseSections = dialog.querySelectorAll('[is="emby-collapse"], .emby-collapse');
        collapseSections.forEach(function(section) {
            const content = section.querySelector('.collapseContent');
            if (content && content.classList.contains('expanded')) {
                initializeSection(section);
            }
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (mutation.target.classList.contains('expanded')) {
                            setTimeout(function() { initializeSection(section); }, 50);
                        }
                    }
                });
            });
            if (content) {
                observer.observe(content, { attributes: true, attributeFilter: ['class'] });
            }
            const button = section.querySelector('.emby-collapsible-button, button');
            if (button) {
                button.addEventListener('click', function() {
                    setTimeout(function() { initializeSection(section); }, 100);
                });
            }
        });
    }

    function setupObserver() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    if (node.classList && (node.classList.contains('filterDialog') || node.classList.contains('dialogContainer'))) {
                        const dialog = node.classList.contains('filterDialog') ? node : node.querySelector('.filterDialog');
                        if (dialog) {
                            setTimeout(function() { processFilterDialog(dialog); }, 100);
                        }
                    }
                    if (node.querySelector) {
                        const dialog = node.querySelector('.filterDialog');
                        if (dialog) {
                            setTimeout(function() { processFilterDialog(dialog); }, 100);
                        }
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return observer;
    }

    // Active filter bar functionality
    const ACTIVE_FILTERS_BAR_ID = PLUGIN_ID + '-active-filters';
    let activeFiltersData = {};

    function parseUrlFilters() {
        const params = new URLSearchParams(window.location.search);
        const filters = {};
        const filterParams = ['Genres', 'Tags', 'Studios', 'OfficialRatings', 'Years', 'VideoTypes'];
        filterParams.forEach(function(param) {
            const value = params.get(param);
            if (value) {
                filters[param] = value.split(',').map(function(v) { return decodeURIComponent(v); });
            }
        });
        return filters;
    }

    function createActiveFiltersBar() {
        let bar = document.getElementById(ACTIVE_FILTERS_BAR_ID);
        if (!bar) {
            bar = document.createElement('div');
            bar.id = ACTIVE_FILTERS_BAR_ID;
            bar.className = 'active-filters-bar hidden';
        }
        return bar;
    }

    function updateActiveFiltersBar() {
        const filters = parseUrlFilters();
        let bar = document.getElementById(ACTIVE_FILTERS_BAR_ID);
        
        const hasFilters = Object.keys(filters).some(function(key) {
            return filters[key] && filters[key].length > 0;
        });

        if (!hasFilters) {
            if (bar) bar.classList.add('hidden');
            return;
        }

        // Find the appropriate container to insert the bar
        const itemsContainer = document.querySelector('.itemsContainer, .view-content, [data-type="itemsContainer"]');
        if (!itemsContainer) return;

        if (!bar) {
            bar = createActiveFiltersBar();
        }

        // Insert bar before items container if not already there
        if (!bar.parentElement || bar.parentElement !== itemsContainer.parentElement) {
            itemsContainer.parentElement.insertBefore(bar, itemsContainer);
        }

        // Build the bar content
        bar.innerHTML = '';
        bar.classList.remove('hidden');

        const label = document.createElement('span');
        label.className = 'active-filters-label';
        label.textContent = 'Active Filters:';
        bar.appendChild(label);

        const categoryNames = {
            'Genres': 'Genre',
            'Tags': 'Tag',
            'Studios': 'Studio',
            'OfficialRatings': 'Rating',
            'Years': 'Year',
            'VideoTypes': 'Type'
        };

        Object.keys(filters).forEach(function(category) {
            filters[category].forEach(function(value) {
                const tag = document.createElement('span');
                tag.className = 'active-filter-tag';
                
                const catSpan = document.createElement('span');
                catSpan.className = 'filter-category';
                catSpan.textContent = (categoryNames[category] || category) + ':';
                tag.appendChild(catSpan);

                const valueSpan = document.createElement('span');
                valueSpan.textContent = value;
                tag.appendChild(valueSpan);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-filter';
                removeBtn.innerHTML = '×';
                removeBtn.title = 'Remove filter';
                removeBtn.addEventListener('click', function() {
                    removeFilter(category, value);
                });
                tag.appendChild(removeBtn);

                bar.appendChild(tag);
            });
        });

        const clearAllBtn = document.createElement('button');
        clearAllBtn.className = 'clear-all-filters-btn';
        clearAllBtn.textContent = 'Clear All';
        clearAllBtn.addEventListener('click', clearAllFilters);
        bar.appendChild(clearAllBtn);
    }

    function removeFilter(category, value) {
        const params = new URLSearchParams(window.location.search);
        const currentValues = params.get(category);
        if (currentValues) {
            const values = currentValues.split(',').filter(function(v) {
                return decodeURIComponent(v) !== value;
            });
            if (values.length > 0) {
                params.set(category, values.join(','));
            } else {
                params.delete(category);
            }
            const newUrl = window.location.pathname + '?' + params.toString();
            window.history.pushState({}, '', newUrl);
            window.location.reload();
        }
    }

    function clearAllFilters() {
        const params = new URLSearchParams(window.location.search);
        const filterParams = ['Genres', 'Tags', 'Studios', 'OfficialRatings', 'Years', 'VideoTypes'];
        filterParams.forEach(function(param) {
            params.delete(param);
        });
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.pushState({}, '', newUrl);
        window.location.reload();
    }

    function setupPageObserver() {
        // Update active filters bar when page content changes
        let debounceTimer;
        const pageObserver = new MutationObserver(function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(updateActiveFiltersBar, 200);
        });
        pageObserver.observe(document.body, { childList: true, subtree: true });

        // Also listen for URL changes (popstate)
        window.addEventListener('popstate', function() {
            setTimeout(updateActiveFiltersBar, 100);
        });

        // Initial update
        setTimeout(updateActiveFiltersBar, 500);
    }

    function init() {
        console.log('[' + PLUGIN_ID + '] Initializing Filter Search Plugin');
        injectStyles();
        setupObserver();
        setupPageObserver();
        document.querySelectorAll('.filterDialog').forEach(processFilterDialog);
        updateActiveFiltersBar();
        console.log('[' + PLUGIN_ID + '] Filter Search Plugin initialized successfully');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.JellyfinFilterSearch = {
        init: init,
        processFilterDialog: processFilterDialog,
        initializeSection: initializeSection,
        updateActiveFiltersBar: updateActiveFiltersBar,
        clearAllFilters: clearAllFilters
    };
})();
