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
            items.forEach(function(item) {
                if (item.classList.contains('filter-item-hidden')) return;
                var cb = item.querySelector('input[type="checkbox"]');
                if (cb && cb.checked !== checked) {
                    cb.checked = checked;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            setTimeout(function() {
                var currentItems = getFilterItems(checkboxList);
                sortEnabledToTop(currentItems, checkboxList);
                if (searchInput) filterItems(currentItems, searchInput.value, checkboxList);
            }, 10);
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

    function init() {
        console.log('[' + PLUGIN_ID + '] Initializing Filter Search Plugin');
        injectStyles();
        setupObserver();
        document.querySelectorAll('.filterDialog').forEach(processFilterDialog);
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
        initializeSection: initializeSection
    };
})();
