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
            margin: 0.5em 3.3%;
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
        .filter-dialog-hidden .dialogContainer,
        .filter-dialog-hidden .dialog,
        .filter-dialog-hidden .filterDialog,
        .filter-dialog-hidden .dialogBackdrop,
        .filter-dialog-hidden .dialogBackdropOpened,
        body.filter-dialog-hidden > .dialogContainer,
        body.filter-dialog-hidden > .dialogBackdrop {
            opacity: 0 !important;
            transition: none !important;
            animation: none !important;
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

        var isProcessing = false;

        function setAll(checked, btn) {
            if (isProcessing) return;
            
            var items = getFilterItems(checkboxList);
            var checkboxesToChange = [];
            
            // Collect all checkboxes that need to change
            items.forEach(function(item) {
                if (item.classList.contains('filter-item-hidden')) return;
                var cb = item.querySelector('input[type="checkbox"]');
                if (cb && cb.checked !== checked) {
                    checkboxesToChange.push(cb);
                }
            });
            
            if (checkboxesToChange.length === 0) return;
            
            // Disable buttons and show progress
            isProcessing = true;
            var originalText = btn.textContent;
            selectAllBtn.disabled = true;
            selectNoneBtn.disabled = true;
            selectAllBtn.style.opacity = '0.5';
            selectNoneBtn.style.opacity = '0.5';
            
            var total = checkboxesToChange.length;
            var index = 0;
            
            function updateProgress() {
                btn.textContent = originalText + ' (' + index + '/' + total + ')';
            }
            
            function finishProcessing() {
                isProcessing = false;
                selectAllBtn.disabled = false;
                selectNoneBtn.disabled = false;
                selectAllBtn.style.opacity = '1';
                selectNoneBtn.style.opacity = '1';
                btn.textContent = originalText;
                
                var currentItems = getFilterItems(checkboxList);
                sortEnabledToTop(currentItems, checkboxList);
                if (searchInput) filterItems(currentItems, searchInput.value, checkboxList);
            }
            
            // Click checkboxes one at a time with delay to avoid overwhelming the server
            var clickInterval = setInterval(function() {
                if (index >= checkboxesToChange.length) {
                    clearInterval(clickInterval);
                    setTimeout(finishProcessing, 150);
                    return;
                }
                checkboxesToChange[index].click();
                index++;
                updateProgress();
            }, 80); // 80ms delay between each click for server stability
        }

        selectAllBtn.addEventListener('click', function() { setAll(true, selectAllBtn); });
        selectNoneBtn.addEventListener('click', function() { setAll(false, selectNoneBtn); });

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
        
        // Watch for dialog close and capture filters
        var dialogObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.removedNodes.forEach(function(node) {
                    if (node === dialog || (node.contains && node.contains(dialog))) {
                        // Dialog is being removed, capture filters first
                        captureFiltersFromDialog(dialog);
                        setTimeout(updateActiveFiltersBar, 300);
                        dialogObserver.disconnect();
                    }
                });
            });
        });
        if (dialog.parentElement) {
            dialogObserver.observe(dialog.parentElement, { childList: true });
        }
        
        // Also capture filters on any checkbox change in the dialog
        dialog.addEventListener('change', function(e) {
            if (e.target.type === 'checkbox') {
                captureFiltersFromDialog(dialog);
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
    let cachedActiveFilters = {}; // Store filters when dialog closes

    function parseUrlFilters() {
        // Check both URL search params and hash params (Jellyfin uses different methods)
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace('#', '').replace(/^.*\?/, ''));
        
        const filters = {};
        const filterParams = ['Genres', 'Tags', 'Studios', 'OfficialRatings', 'Years', 'VideoTypes', 'genres', 'tags', 'studios'];
        
        filterParams.forEach(function(param) {
            // Check search params first, then hash params
            let value = searchParams.get(param) || hashParams.get(param);
            if (value) {
                const normalizedParam = param.charAt(0).toUpperCase() + param.slice(1);
                filters[normalizedParam] = value.split(',').map(function(v) { return decodeURIComponent(v); });
            }
        });
        return filters;
    }

    // Capture active filters from the filter dialog
    function captureFiltersFromDialog(dialog) {
        var filters = {};
        var collapseSections = dialog.querySelectorAll('[is="emby-collapse"], .emby-collapse');
        
        collapseSections.forEach(function(section) {
            var titleEl = section.querySelector('.emby-collapsible-title, h3');
            var title = section.getAttribute('title') || (titleEl ? titleEl.textContent.trim() : 'Unknown');
            
            var content = section.querySelector('.collapseContent, .filterOptions');
            if (!content) return;
            
            var checkboxList = content.querySelector('.checkboxList');
            if (!checkboxList) return;
            
            var items = getFilterItems(checkboxList);
            var selectedValues = [];
            
            items.forEach(function(item) {
                var cb = item.querySelector('input[type="checkbox"]');
                if (cb && cb.checked) {
                    var text = getItemText(item);
                    // Capitalize first letter
                    text = text.charAt(0).toUpperCase() + text.slice(1);
                    selectedValues.push(text);
                }
            });
            
            if (selectedValues.length > 0) {
                filters[title] = selectedValues;
            }
        });
        
        cachedActiveFilters = filters;
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
        // First try URL params, then fall back to cached filters from dialog
        var filters = parseUrlFilters();
        
        // If no URL filters, use cached filters
        if (Object.keys(filters).length === 0) {
            filters = cachedActiveFilters;
        }
        
        var bar = document.getElementById(ACTIVE_FILTERS_BAR_ID);
        
        var hasFilters = Object.keys(filters).some(function(key) {
            return filters[key] && filters[key].length > 0;
        });

        // Also check if the filter indicator is visible (Jellyfin shows ! when filters active)
        var filterIndicator = document.querySelector('.filterIndicator:not(.hide)');
        var hasIndicator = filterIndicator && !filterIndicator.classList.contains('hide');

        if (!hasFilters && !hasIndicator) {
            if (bar) bar.classList.add('hidden');
            return;
        }

        // Find the appropriate container - look for the toolbar area
        var toolbar = document.querySelector('.flex.align-items-center.justify-content-center.flex-wrap-wrap.padded-top');
        if (!toolbar) {
            toolbar = document.querySelector('.btnFilter-wrapper');
            if (toolbar) toolbar = toolbar.closest('.flex');
        }
        if (!toolbar) {
            toolbar = document.querySelector('.itemsContainer');
        }
        
        if (!toolbar) {
            console.log('[' + PLUGIN_ID + '] Could not find container for active filters bar');
            return;
        }

        if (!bar) {
            bar = createActiveFiltersBar();
        }

        // Insert bar after the toolbar
        if (!bar.parentElement) {
            if (toolbar.nextSibling) {
                toolbar.parentElement.insertBefore(bar, toolbar.nextSibling);
            } else {
                toolbar.parentElement.appendChild(bar);
            }
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

    function hideDialogDuringOperation() {
        document.body.classList.add('filter-dialog-hidden');
    }

    function showDialogAfterOperation() {
        document.body.classList.remove('filter-dialog-hidden');
    }

    function waitForDialogClose(callback) {
        // Wait until the filterDialog is fully removed from the DOM before un-hiding
        var done = false;
        function finish() {
            if (done) return;
            done = true;
            clearInterval(checkInterval);
            showDialogAfterOperation();
            if (callback) callback();
        }
        var checkInterval = setInterval(function() {
            if (!document.querySelector('.filterDialog')) {
                finish();
            }
        }, 50);
        // Safety timeout: force un-hide after 3 seconds
        setTimeout(finish, 3000);
    }

    function closeDialogAndWait(dialog, callback) {
        var closeBtn = dialog.querySelector('.btnCancel, .dialogCloseButton, [data-action="close"]');
        if (closeBtn) {
            closeBtn.click();
        }
        waitForDialogClose(callback);
    }

    function removeFilter(category, value) {
        // Open filter dialog invisibly and uncheck the specific filter
        var filterBtn = document.querySelector('.btnFilter');
        if (filterBtn) {
            hideDialogDuringOperation();
            filterBtn.click();
            
            // Wait for dialog to appear in DOM
            var attempts = 0;
            var waitForDialog = setInterval(function() {
                var dialog = document.querySelector('.filterDialog');
                attempts++;
                if (!dialog && attempts < 20) return; // keep waiting up to 1 second
                clearInterval(waitForDialog);
                
                if (!dialog) {
                    showDialogAfterOperation();
                    return;
                }
                
                var collapseSections = dialog.querySelectorAll('[is="emby-collapse"], .emby-collapse');
                collapseSections.forEach(function(section) {
                    var titleEl = section.querySelector('.emby-collapsible-title, h3');
                    var title = section.getAttribute('title') || (titleEl ? titleEl.textContent.trim() : '');
                    
                    if (title.toLowerCase() === category.toLowerCase() || 
                        title.toLowerCase().includes(category.toLowerCase())) {
                        // Expand this section
                        var btn = section.querySelector('.emby-collapsible-button, button');
                        var content = section.querySelector('.collapseContent');
                        if (content && !content.classList.contains('expanded') && btn) {
                            btn.click();
                        }
                        setTimeout(function() {
                            var checkboxList = section.querySelector('.checkboxList');
                            if (checkboxList) {
                                var items = getFilterItems(checkboxList);
                                items.forEach(function(item) {
                                    var text = getItemText(item);
                                    if (text === value.toLowerCase()) {
                                        var cb = item.querySelector('input[type="checkbox"]');
                                        if (cb && cb.checked) {
                                            cb.click();
                                        }
                                    }
                                });
                            }
                            // Close dialog and wait for it to disappear
                            closeDialogAndWait(dialog);
                        }, 300);
                    }
                });
            }, 50);
        }
    }

    function clearAllFilters() {
        // Click the filter button to open the dialog invisibly
        var filterBtn = document.querySelector('.btnFilter');
        if (filterBtn) {
            hideDialogDuringOperation();
            filterBtn.click();
            
            // Wait for dialog to appear in DOM
            var attempts = 0;
            var waitForDialog = setInterval(function() {
                var dialog = document.querySelector('.filterDialog');
                attempts++;
                if (!dialog && attempts < 20) return; // keep waiting up to 1 second
                clearInterval(waitForDialog);
                
                if (!dialog) {
                    showDialogAfterOperation();
                    return;
                }
                
                // Find all checked checkboxes and uncheck them
                var allCheckboxes = dialog.querySelectorAll('input[type="checkbox"]:checked');
                var index = 0;
                
                function uncheckNext() {
                    if (index >= allCheckboxes.length) {
                        // All done, close the dialog and wait for it to disappear
                        cachedActiveFilters = {};
                        closeDialogAndWait(dialog, updateActiveFiltersBar);
                        return;
                    }
                    allCheckboxes[index].click();
                    index++;
                    setTimeout(uncheckNext, 80);
                }
                
                uncheckNext();
            }, 50);
        } else {
            // Fallback to URL manipulation
            var params = new URLSearchParams(window.location.search);
            var filterParams = ['Genres', 'Tags', 'Studios', 'OfficialRatings', 'Years', 'VideoTypes'];
            filterParams.forEach(function(param) {
                params.delete(param);
            });
            var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
            window.history.pushState({}, '', newUrl);
            window.location.reload();
        }
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
