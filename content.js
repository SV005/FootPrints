// --- Utility Functions ---

// Get XPath of a node (for both element and text nodes)
function getXPath(node) {
  const xpath = [];
  while (node && node.nodeType !== Node.DOCUMENT_NODE) {
    let index = 1;
    let sibling = node.previousSibling;
    while (sibling) {
      if (sibling.nodeType === node.nodeType) {
        if (node.nodeType === Node.TEXT_NODE && sibling.nodeType === Node.TEXT_NODE) {
          index++;
        } else if (sibling.nodeName === node.nodeName) {
          index++;
        }
      }
      sibling = sibling.previousSibling;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      xpath.unshift(`text()[${index}]`);
    } else {
      xpath.unshift(`${node.nodeName.toUpperCase()}[${index}]`);
    }
    node = node.parentNode;
  }
  return xpath.length ? '/' + xpath.join('/') : null;
}

// Get node by XPath
function getNodeByXPath(xpath) {
  try {
    const evaluator = new XPathEvaluator();
    const resolver = evaluator.createNSResolver(document.documentElement);
    const result = evaluator.evaluate(
      xpath,
      document.documentElement,
      resolver,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch (error) {
    console.error(`Error evaluating XPath: ${xpath}`, error);
    return null;
  }
}

// --- Highlight Button Creation ---

function createHighlightButton(range, color) {
  // Remove any existing highlight button
  const existingButton = document.getElementById('footprints-highlight-button');
  if (existingButton) {
    existingButton.remove();
  }

  const rect = range.getBoundingClientRect();
  const button = document.createElement('button');
  button.id = 'footprints-highlight-button';
  button.style.position = 'absolute';
  button.style.top = `${rect.top + window.scrollY - 50}px`;
  button.style.left = `${rect.left + window.scrollX}px`;
  button.style.width =  '35px';
  button.style.height = '35px';
  button.style.padding = '0';
  button.style.background = 'rgba(53, 53, 53, 0.85)'; // Gray with transparency
  button.style.border = '2px solid rgba(210, 210, 210, 0.93)'; // White border with transparency
  button.style.borderRadius = '50%';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
  button.style.zIndex = '1000';
  button.style.cursor = 'pointer';
  button.style.overflow = 'hidden';

  // Add the image inside the button
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons\Icons-highlight.PNG');
  img.alt = 'Highlight';
  img.style.width = '38px';
  img.style.height = '38px';
  img.style.objectFit = 'cover';
  img.style.borderRadius = '50%';
  button.appendChild(img);

  document.body.appendChild(button);

  button.addEventListener('click', () => {
    try {
      // Save the overall range data and apply highlight to each text node in the range
      highlightSelection(range, color);
    } catch (error) {
      console.error('Error during highlighting:', error);
    }
    button.remove();
  });

  // Remove the button if the user clicks anywhere else
  const removeButton = (e) => {
    if (e.target !== button && e.target !== img) {
      button.remove();
      document.removeEventListener('click', removeButton);
    }
  };
  document.addEventListener('click', removeButton);
}

// --- Highlighting Functions ---

// Helper function to determine if a color is light or dark
function isColorLight(color) {
  // Convert hex color to RGB
  let r, g, b;
  if (color.startsWith('#')) {
    color = color.slice(1);
  }
  if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16);
    g = parseInt(color[1] + color[1], 16);
    b = parseInt(color[2] + color[2], 16);
  } else if (color.length === 6) {
    r = parseInt(color.substring(0, 2), 16);
    g = parseInt(color.substring(2, 4), 16);
    b = parseInt(color.substring(4, 6), 16);
  } else {
    // Invalid color format, default to considering it light
    return true;
  }

  // Calculate brightness (YIQ formula)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128);
}

// This function saves the highlight data and then highlights each text node in the range.
function highlightSelection(range, color) {
  const selectedText = range.toString();
  if (!selectedText.trim()) return;

  // Generate a unique ID for this highlight (using a timestamp; you might use a UUID instead)
  const highlightId = Date.now().toString();

  // Build a single highlight data object (covering the whole range)
  const highlightData = {
    id: highlightId,
    startXPath: getXPath(range.startContainer),
    startOffset: range.startOffset,
    endXPath: getXPath(range.endContainer),
    endOffset: range.endOffset,
    color: color,
    text: selectedText
  };

  // Apply the highlight to the page (pass along the highlightId)
  highlightRange(range, color, highlightId);

  // Save the highlight data to chrome.storage.local (keyed by page URL)
  const pageUrl = window.location.href;
  chrome.storage.local.get([pageUrl], (result) => {
    const existingHighlights = result[pageUrl] || [];
    existingHighlights.push(highlightData);
    chrome.storage.local.set({ [pageUrl]: existingHighlights }, () => {
      console.log('Highlight saved successfully', highlightData);
      // Optionally, send the highlight to background.js as well:
      chrome.runtime.sendMessage({
        type: "SAVE_HIGHLIGHT",
        id: highlightId,
        text: selectedText,
        url: pageUrl,
        color: color,
        xpath: getXPath(range.startContainer),
        startOffset: range.startOffset,
        endOffset: range.endOffset
      });
    });
  });

  // Clear the selection
  window.getSelection().removeAllRanges();
}

// Modified highlightRange now accepts a third parameter: highlightId.
// For each wrapped text node, we add a data attribute so we can find it later.
function highlightRange(range, color, highlightId) {
  let textNodes = [];

  // If the common ancestor is a text node, use it directly.
  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    textNodes.push(range.commonAncestorContainer);
  } else {
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          if (
            range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
            range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
          ) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );
    while (treeWalker.nextNode()) {
      textNodes.push(treeWalker.currentNode);
    }
  }

  textNodes.forEach((node) => {
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);
    const effectiveStart = (node === range.startContainer) ? range.startOffset : 0;
    const effectiveEnd = (node === range.endContainer) ? range.endOffset : node.nodeValue.length;
    if (effectiveStart >= effectiveEnd) return;

    // Create the highlight span and set its data attribute.
    const span = document.createElement('span');
    span.classList.add('footprints-highlight');
    span.style.backgroundColor = color;
    span.style.borderRadius = '3px';
    span.style.padding = '0 2px';
    span.setAttribute('data-highlight-id', highlightId);

    // Set text color based on highlight color lightness
    span.style.color = isColorLight(color) ? 'black' : 'black';

    // Split the text node into before, selected, and after parts.
    const beforeText = node.nodeValue.slice(0, effectiveStart);
    const selectedText = node.nodeValue.slice(effectiveStart, effectiveEnd);
    const afterText = node.nodeValue.slice(effectiveEnd);

    const beforeNode = document.createTextNode(beforeText);
    const selectedNode = document.createTextNode(selectedText);
    const afterNode = document.createTextNode(afterText);
    span.appendChild(selectedNode);

    // Replace the original text node with the three parts.
    node.parentNode.insertBefore(beforeNode, node);
    node.parentNode.insertBefore(span, node);
    node.parentNode.insertBefore(afterNode, node);
    node.parentNode.removeChild(node);
  });
}

// --- Restoration Function ---
// Updated restoreHighlights prevents duplicate highlights on dynamic content.
function restoreHighlights() {
  const pageUrl = window.location.href;
  chrome.storage.local.get([pageUrl], (result) => {
    const highlights = result[pageUrl] || [];
    if (highlights.length === 0) return;
    highlights.forEach((hl) => {
      if (document.querySelector(`[data-highlight-id="${hl.id}"]`)) return; // Skip if already applied
      const startNode = getNodeByXPath(hl.startXPath);
      const endNode = getNodeByXPath(hl.endXPath);
      if (!startNode || !endNode) return;
      const range = document.createRange();
      try {
        range.setStart(startNode, hl.startOffset);
        range.setEnd(endNode, hl.endOffset);
      } catch (error) {
        console.error('Error re-creating range:', error);
        return;
      }
      highlightRange(range, hl.color, hl.id);
    });
  });
}

// --- Hyperlink Check (if needed) ---
function isNodeWithinLink(node) {
  let currentNode = node;
  while (currentNode && currentNode !== document) {
    if (currentNode.nodeName === 'A') {
      return true;
    }
    currentNode = currentNode.parentNode;
  }
  return false;
}

function isSelectionWithinLink(range) {
  const isStartInLink = isNodeWithinLink(range.startContainer);
  const isEndInLink = isNodeWithinLink(range.endContainer);
  return isStartInLink || isEndInLink;
}

// --- Message Listener for Popup Actions ---
// This listener handles messages from the popup for deleting or updating highlights.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'deleteHighlight') {
    const id = message.id;
    // Remove all elements that have the given highlight id.
    document.querySelectorAll(`[data-highlight-id="${id}"]`).forEach(span => {
      // Remove the highlight style
      span.classList.remove('footprints-highlight');
      span.style.backgroundColor = '';
      span.style.color = '';
      span.removeAttribute('data-highlight-id');

      // Replace the span with its text content
      const textNode = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(textNode, span);
    });
    sendResponse({ status: "deleted" });
  } else if (message.action === 'updateHighlightColor') {
    const id = message.id;
    const newColor = message.color;
    document.querySelectorAll(`[data-highlight-id="${id}"]`).forEach(span => {
      span.style.backgroundColor = newColor;
      // Update text color based on new highlight color lightness
      span.style.color = isColorLight(newColor) ? 'black' : 'black';
    });
    sendResponse({ status: "updated" });
  } else if (message.action === "uploadHighlights") {
    restoreHighlights();
    sendResponse({ status: "restored" });
  }
});

// --- Event Listeners ---

// Show the highlight button on mouseup for any nonempty selection.
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (!selection || selection.toString().trim() === "") return;

  const range = selection.getRangeAt(0);
  console.log('Selection detected:', {
    text: selection.toString().trim(),
    range: range,
    startNode: range.startContainer,
    endNode: range.endContainer
  });

  // Always show the highlight button (ignoring whether the selection includes hyperlinks).
  chrome.storage.local.get('highlightColor', (result) => {
    const color = result.highlightColor || "yellow";
    createHighlightButton(range, color);
  });
});

// Restore highlights on page load (delay slightly to let the page render).
window.addEventListener('load', () => {
  setTimeout(restoreHighlights, 1000);
});

// --- Dynamic Content Handling ---
// Reapply highlights when DOM content updates (e.g. dynamic websites)
const observer = new MutationObserver((mutations) => {
  clearTimeout(window.restoreHighlightsTimeout);
  window.restoreHighlightsTimeout = setTimeout(() => {
    restoreHighlights();
  }, 500);
});
observer.observe(document.body, { childList: true, subtree: true });

// Listen for SPA navigation changes.
window.addEventListener('popstate', () => {
  setTimeout(restoreHighlights, 500);
});

// --- Hover Actions for Highlights ---
document.addEventListener('mouseover', (e) => {
  const target = e.target;
  if (target.classList.contains('footprints-highlight') && !target.querySelector('.hover-actions')) {
    target.style.position = 'relative';
    const container = document.createElement('span');
    container.className = 'hover-actions';
    container.style.position = 'absolute';
    container.style.top = '-20px';
    container.style.right = '0';
    container.style.zIndex = '1001';
    // Add flex properties to the container for horizontal arrangement
    container.style.display = 'flex';
    container.style.flexDirection = 'row'; // Ensure horizontal
    container.style.alignItems = 'center'; // Vertically center items
    container.style.gap = '5px' // add some gap between the icons
    container.style.minWidth = '60px'; // Add minimum width to prevent squeezing
container.style.overflow = 'hidden'; // Hide overflow if icons get too wide.
container.style.backgroundColor = 'rgba(172, 172, 172, 0)';

 // Add mouseleave event listener to the container
 container.addEventListener('mouseleave', () => {
  if (container) {
    container.remove();
  }
});

    const colorIcon = document.createElement('img');
    colorIcon.className = 'color-icon';
    colorIcon.src = chrome.runtime.getURL('icons/icons-color-mode.png');
    colorIcon.style.cursor = 'pointer';
    colorIcon.style.width = '25px';
    colorIcon.style.height = '25px';

    // Replace the prompt-based color change with a menu-based selection:
    colorIcon.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Create a menu container for color options
      const menu = document.createElement('div');
      menu.style.position = 'absolute';
      menu.style.top = '20px';
      menu.style.left = '0';
      menu.style.background = '#fff';
      menu.style.border = '1px solid #ccc';
      menu.style.padding = '5px';
      menu.style.display = 'contents';
      menu.style.gap = '5px';
      menu.style.zIndex = '1002';
      
      // Define the color options (same as in the popup panel)
      const colors = ["#f5a9b8", "#f6c38f", "#ffe787", "#a8e6cf", "#85c5f9"];
      colors.forEach(col => {
        const colorDiv = document.createElement('div');
        colorDiv.style.width = '20px';
        colorDiv.style.height = '20px';
        colorDiv.style.borderRadius = '50%';
        colorDiv.style.background = col;
        colorDiv.style.cursor = 'pointer';
        colorDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          const highlightElement = ev.target.closest('.footprints-highlight');
          const highlightId = highlightElement.getAttribute('data-highlight-id');
          document.querySelectorAll(`[data-highlight-id="${highlightId}"]`).forEach(span => {
            span.style.backgroundColor = col;
            span.style.color = isColorLight(col) ? 'black' : 'black';
          });
          // Notify the update to storage and content script.
          chrome.runtime.sendMessage({ action: "updateHighlightColor", id: highlightId, color: col, url: window.location.href });
          // Set the chosen color as the default highlight color for future selections.
          chrome.storage.local.set({ highlightColor: col });
          menu.remove();
        });
        menu.appendChild(colorDiv);
      });
      // Append the menu to the hover actions container.
      container.appendChild(menu);
    });

    const deleteIcon = document.createElement('img');
    deleteIcon.className = 'delete-icon';
    deleteIcon.src = chrome.runtime.getURL('icons/icons-delete.png'); // Correct path to icon
    deleteIcon.style.width = '25px';
    deleteIcon.style.height = '25px';
    deleteIcon.style.cursor = 'pointer';

    container.appendChild(colorIcon);
    container.appendChild(deleteIcon);
    target.appendChild(container);

    deleteIcon.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Use closest to retrieve the highlight container regardless of where the icon is clicked.
      const highlightElement = ev.target.closest('.footprints-highlight');
      const highlightId = highlightElement.getAttribute('data-highlight-id');
      // Remove hover actions if any
      const hoverActions = highlightElement.querySelector('.hover-actions');
      if (hoverActions) {
        hoverActions.remove();
      }
      // Immediately remove all elements with this highlightId from the DOM.
      document.querySelectorAll(`[data-highlight-id="${highlightId}"]`).forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
      });
      // Notify deletion to update storage/background.
      chrome.runtime.sendMessage({ action: "deleteHighlight", id: highlightId, url: window.location.href });
    });
  }
});

document.addEventListener('mouseout', (e) => {
  const target = e.target;
  if (target.classList.contains('footprints-highlight')) {
    // Check if the new element is still inside the highlight or its hover actions.
    if (e.relatedTarget && target.contains(e.relatedTarget)) {
      return;
    }
    const container = target.querySelector('.hover-actions');
    if (container) {
      container.remove();
    }
  }
});
