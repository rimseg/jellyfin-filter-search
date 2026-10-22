/**
 * Jellyfin Filter Search Plugin
 * Adds search functionality to filter dialogs (tags, genres, studios, etc.)
 * and displays enabled/checked filters at the top of the list.
 *
 * Supports both the legacy filter dialog (.filterDialog / emby-collapse) and the
 * modern (React/MUI) layout introduced in Jellyfin 12, where filters live in a
 * MUI Popover with accordions and FormControlLabel checkboxes.
 */

(function() {
    'use strict';

    const PLUGIN_ID = 'filter-search-plugin';
    const SEARCH_INPUT_CLASS = 'filter-search-input';
    const WRAPPER_CLASS = 'filter-search-wrapper';
    const MODERN_CLASS = 'filter-search-modern';
    const LEGACY_CLASS = 'filter-search-legacy';
    const NAVIGATION_KEYS = ['Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'GoBack', 'BrowserBack'];
    // Jellyfin resolves remote/gamepad keys by keyCode: Escape, Up, Down, UWP gamepad/navigation
    // keys, webOS Back (461) and Tizen Back (10009).
    const NAVIGATION_KEYCODES = [27, 38, 40, 138, 139, 196, 203, 204, 211, 212, 461, 10009];
    const REFRESH_EVENT = 'filtersearch-refresh';

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
            border: 1px solid rgba(128, 128, 128, 0.45);
            border-radius: 4px;
            background: rgba(128, 128, 128, 0.12);
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
            color: inherit;
            opacity: 0.55;
        }
        .filter-item-hidden {
            display: none !important;
        }
        .filter-item-enabled {
            order: -1 !important;
        }
        .filterDialog .checkboxList:not(.hide) {
            display: flex !important;
            flex-direction: column !important;
        }
        .filter-separator {
            width: 100%;
            border: none;
            border-top: 1px solid rgba(128, 128, 128, 0.35);
            margin: 0.5em 0;
            order: -1;
        }
        .filter-enabled-header {
            font-size: 0.8em;
            color: inherit;
            opacity: 0.65;
            padding: 0.2em 0;
            order: -2;
            font-weight: 500;
        }
        .no-results-message {
            padding: 0.5em;
            text-align: center;
            color: inherit;
            opacity: 0.55;
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

        /* Modern (MUI) layout: tighter spacing and the app's font */
        .${MODERN_CLASS} .${WRAPPER_CLASS} {
            padding: 0 0 0.5em 0;
            margin-top: -0.5em;
            top: -16px;
        }
        .${MODERN_CLASS} .${SEARCH_INPUT_CLASS} {
            font: inherit;
            font-size: 0.9rem;
        }
        .${MODERN_CLASS} .MuiFormGroup-root {
            flex-wrap: nowrap;
        }

        /* Legacy layout: Jellyfin fixes checkbox rows at 2.35em, so long names overlap
           the next rows. Let rows in sections managed by this plugin grow instead. */
        .${LEGACY_CLASS} .checkboxList > .emby-checkbox-label {
            height: auto;
            min-height: 2.35em;
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
            // Jellyfin hides options that don't apply to the current view with .hide (for example the
            // episode-only filters in a movie library). Never count, search or click those.
            if (label.classList.contains('hide')) return false;
            return label.querySelector('input[type="checkbox"]') || label.classList.contains('emby-checkbox-label');
        });
    }

    /**
     * Whether a filter checkbox is checked. In the modern (MUI) layout the "Mui-checked"
     * class reflects React's state as soon as it renders, while the input's checked
     * property can lag behind by a second or more on large lists.
     */
    function isCheckboxChecked(checkbox) {
        const muiRoot = checkbox.closest('.MuiCheckbox-root');
        return muiRoot ? muiRoot.classList.contains('Mui-checked') : checkbox.checked;
    }

    function isItemEnabled(item) {
        const checkbox = item.querySelector('input[type="checkbox"]');
        return checkbox ? isCheckboxChecked(checkbox) : false;
    }

    // Label text never changes for a given element, so compute it once per element
    const itemTextCache = new WeakMap();

    function getItemText(item) {
        let text = itemTextCache.get(item);
        if (text !== undefined) return text;
        // MUI FormControlLabel keeps the text in a dedicated span
        const muiLabel = item.querySelector('.MuiFormControlLabel-label');
        if (muiLabel) {
            text = muiLabel.textContent.trim().toLowerCase();
        } else {
            const clone = item.cloneNode(true);
            const toRemove = clone.querySelectorAll('input, svg, .checkboxOutline, .material-icons, .md-icon, span.checkboxIcon');
            toRemove.forEach(function(el) { el.remove(); });
            text = clone.textContent.trim().toLowerCase();
        }
        itemTextCache.set(item, text);
        return text;
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
        // Only show the "Selected" heading when at least one selected item is visible
        const anyEnabledVisible = items.some(function(item) {
            return item.classList.contains('filter-item-enabled') && !item.classList.contains('filter-item-hidden');
        });
        checkboxList.querySelectorAll('.filter-enabled-header, .filter-separator').forEach(function(el) {
            el.classList.toggle('filter-item-hidden', !anyEnabledVisible);
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
                if (cb && isCheckboxChecked(cb) !== checked) {
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
                // The checkbox may have been re-rendered or removed in the meantime
                if (checkboxesToChange[index].isConnected && isCheckboxChecked(checkboxesToChange[index]) !== checked) {
                    checkboxesToChange[index].click();
                }
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

    /**
     * Wires search input, select actions and re-sorting into a filter section.
     * @param {Element} content   Container that receives the search bar (above the list)
     * @param {Element} checkboxList  Element containing the checkbox labels
     * @param {string} title      Human readable section title
     */
    function attachSearch(content, checkboxList, title) {
        if (content.querySelector('.' + WRAPPER_CLASS)) return false;

        const items = getFilterItems(checkboxList);
        if (items.length < 5) return false;
        sortEnabledToTop(items, checkboxList);

        const placeholder = 'Search ' + title.toLowerCase() + '...';

        const searchWrapper = createSearchInput(placeholder);
        content.insertBefore(searchWrapper, content.firstChild);
        const searchInput = searchWrapper.querySelector('.' + SEARCH_INPUT_CLASS);

        const selectActions = createSelectActions(checkboxList, searchInput);
        content.insertBefore(selectActions, checkboxList);

        searchInput.addEventListener('input', function(e) {
            filterItems(getFilterItems(checkboxList), e.target.value, checkboxList);
        });
        searchInput.addEventListener('keydown', function(e) {
            // Keep typing from triggering app-wide shortcuts, but let keys through that close or
            // navigate the dialog (keyboard, TV remotes and gamepads).
            if (NAVIGATION_KEYS.indexOf(e.key) === -1 && NAVIGATION_KEYCODES.indexOf(e.keyCode) === -1) {
                e.stopPropagation();
            }
        });

        var refreshTimer = null;
        function refresh() {
            refreshTimer = null;
            if (!checkboxList.isConnected) return;
            const currentItems = getFilterItems(checkboxList);
            sortEnabledToTop(currentItems, checkboxList);
            filterItems(currentItems, searchInput.value, checkboxList);
        }
        function scheduleRefresh(delay) {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(refresh, delay || 60);
        }
        checkboxList.addEventListener('change', function(e) {
            if (e.target.type === 'checkbox') scheduleRefresh();
        });
        // Fired by this script when something outside the list changes the checkboxes
        // (the legacy dialog's "Reset Filters" sets checked = false without events).
        checkboxList.addEventListener(REFRESH_EVENT, function() { scheduleRefresh(10); });
        // React controlled checkboxes (modern layout) call preventDefault() in their
        // click handler, which suppresses the native 'change' event, and the new
        // checked state is only committed once React re-renders (which may take a
        // moment on a large library). Re-evaluate shortly after the click and again
        // a bit later as a fallback.
        checkboxList.addEventListener('click', function(e) {
            if (e.target.closest && e.target.closest('label')) {
                scheduleRefresh(60);
                setTimeout(function() { if (!refreshTimer) scheduleRefresh(10); }, 400);
            }
        });
        // Primary trigger for the modern layout: MUI toggles the "Mui-checked" class on
        // the checkbox element when React commits the new state. Ignore mutations caused
        // by this plugin itself (label classes and the header/separator/no-results nodes).
        if (typeof MutationObserver !== 'undefined') {
            const isOwnNode = function(n) {
                return n.nodeType === Node.ELEMENT_NODE && (
                    n.tagName === 'LABEL' ||
                    n.classList.contains('filter-enabled-header') ||
                    n.classList.contains('filter-separator') ||
                    n.classList.contains('no-results-message'));
            };
            const listObserver = new MutationObserver(function(mutations) {
                if (!checkboxList.isConnected) { listObserver.disconnect(); return; }
                for (var i = 0; i < mutations.length; i++) {
                    const m = mutations[i];
                    if (m.type === 'attributes') {
                        if (m.target.nodeType === Node.ELEMENT_NODE && !isOwnNode(m.target) && m.target.closest('label')) {
                            scheduleRefresh(10);
                            return;
                        }
                    } else if (m.type === 'childList') {
                        // React added/removed filter items (e.g. options reloaded)
                        const nodes = Array.prototype.slice.call(m.addedNodes).concat(Array.prototype.slice.call(m.removedNodes));
                        if (nodes.some(function(n) { return n.nodeType === Node.ELEMENT_NODE && n.tagName === 'LABEL'; })) {
                            scheduleRefresh(10);
                            return;
                        }
                    }
                }
            });
            listObserver.observe(checkboxList, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
        }
        console.log('[' + PLUGIN_ID + '] Initialized search for: ' + title);
        return true;
    }

    // ---------------------------------------------------------------------
    // Legacy filter dialog (Jellyfin 10.x, and the Legacy Desktop/Mobile/TV display modes in 12.x)
    // ---------------------------------------------------------------------

    function initializeSection(collapseSection) {
        const content = collapseSection.querySelector('.collapseContent, .filterOptions');
        if (!content) return;
        const checkboxList = content.querySelector('.checkboxList');
        if (!checkboxList) return;

        const titleEl = collapseSection.querySelector('.emby-collapsible-title, h3');
        const title = collapseSection.getAttribute('title') || (titleEl ? titleEl.textContent : 'filters');
        if (attachSearch(content, checkboxList, title)) {
            content.classList.add(LEGACY_CLASS);
        }
    }

    function processFilterDialog(dialog) {
        if (!dialog.dataset.filterSearchReset) {
            dialog.dataset.filterSearchReset = '1';
            dialog.addEventListener('click', function(e) {
                if (!e.target.closest || !e.target.closest('.resetFilters')) return;
                setTimeout(function() {
                    dialog.querySelectorAll('.' + LEGACY_CLASS + ' .checkboxList').forEach(function(list) {
                        list.dispatchEvent(new CustomEvent(REFRESH_EVENT));
                    });
                }, 50);
            });
        }
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

    // ---------------------------------------------------------------------
    // Modern layout (React/MUI, Jellyfin 12+ "Modern" and 10.11 "Experimental")
    //
    // DOM shape (see jellyfin-web apps/modern/.../filter/FilterButton.tsx):
    //   .MuiPopover-root#filter-popover
    //     .MuiPaper-root.MuiPopover-paper          <- scroll container
    //       .MuiAccordion-root
    //         .MuiAccordionSummary-root#filtersTags-header
    //         .MuiCollapse-root > .MuiAccordion-region
    //           .MuiAccordionDetails-root          <- mounted on expand (unmountOnExit)
    //             .MuiFormGroup-root
    //               label.MuiFormControlLabel-root > span.MuiCheckbox-root > input[type=checkbox]
    //                                             > span.MuiFormControlLabel-label
    // ---------------------------------------------------------------------

    function isModernFilterDetails(details) {
        const accordion = details.closest('.MuiAccordion-root');
        if (!accordion) return false;
        const summary = accordion.querySelector('.MuiAccordionSummary-root');
        if (!summary) return false;
        const id = summary.id || '';
        const controls = summary.getAttribute('aria-controls') || '';
        return /^filters/i.test(id) || /^filters/i.test(controls) || /languages-content$/i.test(controls);
    }

    function getModernSectionTitle(details) {
        const accordion = details.closest('.MuiAccordion-root');
        const summaryContent = accordion ? accordion.querySelector('.MuiAccordionSummary-content') : null;
        const text = summaryContent ? summaryContent.textContent.trim() : '';
        return text || 'filters';
    }

    function initializeModernSection(details) {
        if (!details || !details.isConnected) return;
        if (details.classList.contains(MODERN_CLASS)) return;
        if (!isModernFilterDetails(details)) return;

        const formGroup = details.querySelector('.MuiFormGroup-root');
        if (!formGroup) return;
        if (!formGroup.querySelector('input[type="checkbox"]')) return;

        details.classList.add(MODERN_CLASS);

        const title = getModernSectionTitle(details);
        const attached = attachSearch(details, formGroup, title);
        if (!attached) return;

        // Give the sticky search bar an opaque background matching the popover paper
        const paper = details.closest('.MuiPaper-root');
        const wrapper = details.querySelector('.' + WRAPPER_CLASS);
        if (paper && wrapper) {
            const bg = window.getComputedStyle(paper).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                wrapper.style.background = bg;
            }
            // MUI Paper may paint its elevation via a background-image overlay
            const bgImage = window.getComputedStyle(paper).backgroundImage;
            if (bgImage && bgImage !== 'none') {
                wrapper.style.backgroundImage = bgImage;
            }
        }
    }

    function processModernPopover(popover) {
        popover.querySelectorAll('.MuiAccordionDetails-root').forEach(function(details) {
            setTimeout(function() { initializeModernSection(details); }, 50);
        });
    }

    function handleModernAddedNode(node) {
        // Node is inside a popover (e.g. accordion details mounted on expand)
        const popover = node.closest ? node.closest('.MuiPopover-root') : null;
        if (popover) {
            if (node.classList.contains('MuiAccordionDetails-root')) {
                setTimeout(function() { initializeModernSection(node); }, 50);
            } else {
                node.querySelectorAll('.MuiAccordionDetails-root').forEach(function(details) {
                    setTimeout(function() { initializeModernSection(details); }, 50);
                });
            }
            return;
        }
        // Node is (or contains) a newly opened popover
        if (node.classList.contains('MuiPopover-root')) {
            processModernPopover(node);
        } else if (node.querySelector) {
            node.querySelectorAll('.MuiPopover-root').forEach(processModernPopover);
        }
    }

    // ---------------------------------------------------------------------

    function setupObserver() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;

                    // Legacy dialog
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

                    // Modern (MUI) layout
                    handleModernAddedNode(node);
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
        document.querySelectorAll('.MuiPopover-root').forEach(processModernPopover);
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
        initializeModernSection: initializeModernSection
    };
})();
