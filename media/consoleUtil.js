/**
 * Console utility for rendering structured logs with expandable objects/arrays
 */
(function() {
  'use strict';

  // Helper to check if value is a plain object or array
  function isPlainObjectOrArray(val) {
    if (val === null) return false;
    return Array.isArray(val) || (typeof val === 'object' && val.constructor === Object);
  }

  // Helper to safely stringify for preview
  function safeStringify(val, maxLength = 50) {
    try {
      const str = JSON.stringify(val);
      return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    } catch {
      return String(val);
    }
  }

  // Create expandable tree node for objects/arrays
  function createTreeNode(key, value, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) {
      const leaf = document.createElement('span');
      leaf.className = 'tree-value';
      leaf.textContent = '{...}';
      return leaf;
    }

    const container = document.createElement('div');
    container.className = 'tree-node';

    if (isPlainObjectOrArray(value)) {
      const isArray = Array.isArray(value);
      const isEmpty = isArray ? value.length === 0 : Object.keys(value).length === 0;
      
      const expander = document.createElement('span');
      expander.className = 'tree-expander';
      expander.textContent = isEmpty ? (isArray ? '[]' : '{}') : '▶';
      expander.style.cursor = isEmpty ? 'default' : 'pointer';
      
      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = key !== undefined ? `${key}: ` : '';
      
      const preview = document.createElement('span');
      preview.className = 'tree-preview';
      if (isEmpty) {
        preview.textContent = isArray ? '[]' : '{}';
      } else {
        const count = isArray ? value.length : Object.keys(value).length;
        preview.textContent = isArray ? `Array(${count})` : `{${count}}`;
      }
      
      const header = document.createElement('div');
      header.className = 'tree-header';
      header.appendChild(expander);
      header.appendChild(keySpan);
      header.appendChild(preview);
      
      const children = document.createElement('div');
      children.className = 'tree-children';
      children.hidden = true;
      
      if (!isEmpty) {
        // Populate children on first expand (lazy loading for performance)
        let populated = false;
        const populateChildren = () => {
          if (populated) return;
          populated = true;
          children.innerHTML = '';
          
          if (isArray) {
            value.forEach((item, idx) => {
              const childContainer = document.createElement('div');
              childContainer.className = 'tree-item';
              const childNode = createTreeNode(idx, item, depth + 1, maxDepth);
              childContainer.appendChild(childNode);
              children.appendChild(childContainer);
            });
          } else {
            Object.keys(value).forEach((k) => {
              const childContainer = document.createElement('div');
              childContainer.className = 'tree-item';
              const childNode = createTreeNode(k, value[k], depth + 1, maxDepth);
              childContainer.appendChild(childNode);
              children.appendChild(childContainer);
            });
          }
        };

        const toggleExpand = (e) => {
          e.stopPropagation();
          const isExpanded = !children.hidden;
          children.hidden = isExpanded;
          expander.textContent = isExpanded ? '▶' : '▼';
          
          // Populate children when expanding for the first time
          if (!isExpanded && !populated) {
            populateChildren();
          }
        };
        
        // Make the entire header clickable to toggle
        header.style.cursor = 'pointer';
        expander.addEventListener('click', toggleExpand);
        preview.addEventListener('click', toggleExpand);
        keySpan.addEventListener('click', toggleExpand);
        header.addEventListener('click', toggleExpand);

        // Basic keyboard accessibility on header
        header.setAttribute('tabindex', '0');
        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand(e);
          }
        });
      }
      
      container.appendChild(header);
      container.appendChild(children);
    } else {
      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      if (key !== undefined) {
        keySpan.textContent = `${key}: `;
      }
      
      const valueSpan = document.createElement('span');
      valueSpan.className = 'tree-value';
      
      if (typeof value === 'string') {
        valueSpan.textContent = `"${value}"`;
      } else if (value === null) {
        valueSpan.textContent = 'null';
        valueSpan.className += ' null-value';
      } else if (value === undefined) {
        valueSpan.textContent = 'undefined';
        valueSpan.className += ' undefined-value';
      } else if (typeof value === 'number') {
        valueSpan.textContent = String(value);
        valueSpan.className += ' number-value';
      } else if (typeof value === 'boolean') {
        valueSpan.textContent = String(value);
        valueSpan.className += ' boolean-value';
      } else {
        valueSpan.textContent = String(value);
      }
      
      container.appendChild(keySpan);
      container.appendChild(valueSpan);
    }

    return container;
  }

  /**
   * Creates a log appender function
   * @param {HTMLElement} logsEl - The DOM element to append logs to
   * @param {HTMLElement|null} autoEl - The checkbox element for auto-scroll (optional)
   * @returns {Function} appendLog function that takes (level, args, origin)
   */
  function createLogAppender(logsEl, autoEl) {
    return function appendLog(level, args, origin) {
      if (!logsEl) return;
      const item = document.createElement('div');
      item.className = `log ${level || 'log'}`;

      const msg = document.createElement('div');
      msg.className = 'log-content';
      
      try {
        if (!args || args.length === 0) {
          msg.textContent = '';
        } else {
          args.forEach((arg, idx) => {
            if (idx > 0) {
              const spacer = document.createElement('span');
              spacer.textContent = ' ';
              msg.appendChild(spacer);
            }

            if (typeof arg === 'string') {
              const textSpan = document.createElement('span');
              textSpan.textContent = arg;
              msg.appendChild(textSpan);
            } else if (isPlainObjectOrArray(arg)) {
              const treeNode = createTreeNode(undefined, arg);
              msg.appendChild(treeNode);
            } else {
              const textSpan = document.createElement('span');
              if (arg === null) {
                textSpan.textContent = 'null';
                textSpan.className = 'null-value';
              } else if (arg === undefined) {
                textSpan.textContent = 'undefined';
                textSpan.className = 'undefined-value';
              } else {
                textSpan.textContent = String(arg);
              }
              msg.appendChild(textSpan);
            }
          });
        }
      } catch (err) {
        const errorSpan = document.createElement('span');
        errorSpan.textContent = `[Error rendering log: ${err}]`;
        errorSpan.className = 'error-text';
        msg.appendChild(errorSpan);
      }

      item.appendChild(msg);
      logsEl.appendChild(item);
      if (autoEl && autoEl.checked) {
        item.scrollIntoView({ block: 'nearest' });
      }
    };
  }

  // Export to global namespace
  if (typeof window !== 'undefined') {
    window.ConsoleUtil = {
      createLogAppender,
      isPlainObjectOrArray,
      safeStringify,
      createTreeNode
    };
  }
})();

