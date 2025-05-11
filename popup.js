// Helper function to display highlights in the popup
function displayHighlights(highlights, url) {
  const highlightList = document.getElementById("highlightList");
  highlightList.innerHTML = ""; // Clear any existing items

  if (highlights.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.textContent = "No highlights found.";
    emptyMessage.style.listStyle = "none";
    highlightList.appendChild(emptyMessage);
    return;
  }

  highlights.forEach((highlight) => {
    // Create the list item
    const li = document.createElement("li");
    li.classList.add("highlight-item");
    li.style.backgroundColor = highlight.color || "#ffefc1";
    
    // Create a span to display the highlight text (truncated if needed)
    const textSpan = document.createElement("span");
    textSpan.classList.add("text");
    textSpan.textContent = highlight.text.length > 50 
      ? highlight.text.substring(0, 50) + "..." 
      : highlight.text;
    li.appendChild(textSpan);
    
    // Create a Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.dataset.id = highlight.id;
    deleteBtn.style.marginLeft = "5px";
    li.appendChild(deleteBtn);

    // Create a color input for updating the highlight color
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = highlight.color || "#ffefc1";
    colorInput.dataset.id = highlight.id;
    colorInput.style.marginLeft = "5px";
    li.appendChild(colorInput);

    // Create an Update button
    const updateBtn = document.createElement("button");
    updateBtn.textContent = "Update Color";
    updateBtn.dataset.id = highlight.id;
    updateBtn.style.marginLeft = "5px";
    li.appendChild(updateBtn);

    highlightList.appendChild(li);
  });

  // Attach event listeners for delete and update actions
  document.querySelectorAll(".highlight-item button").forEach(button => {
    // Delete button event listener
    if (button.textContent === "Delete") {
      button.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        deleteHighlight(id, url);
      });
    }
    // Update button event listener
    if (button.textContent === "Update Color") {
      button.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        // Find the corresponding color input value
        const colorInput = document.querySelector(`input[type="color"][data-id="${id}"]`);
        const newColor = colorInput ? colorInput.value : "#ffefc1";
        updateHighlightColor(id, newColor, url);
      });
    }
  });
}

// Delete a highlight both from storage and the page
function deleteHighlight(id, url) {
  chrome.storage.local.get([url], (result) => {
    let highlights = result[url] || [];
    highlights = highlights.filter(hl => hl.id !== id);
    chrome.storage.local.set({ [url]: highlights }, () => {
      console.log("Highlight removed from storage.");
      // Send a message to the content script to remove highlight from the page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "deleteHighlight", id: id }, (response) => {
          console.log("Delete response:", response);
        });
      });
      // Refresh the list in the popup
      displayHighlights(highlights, url);
    });
  });
}

// Update the color of a highlight in storage and on the page
function updateHighlightColor(id, newColor, url) {
  chrome.storage.local.get([url], (result) => {
    let highlights = result[url] || [];
    highlights = highlights.map(hl => {
      if (hl.id === id) {
        hl.color = newColor;
      }
      return hl;
    });
    chrome.storage.local.set({ [url]: highlights }, () => {
      console.log("Highlight color updated in storage.");
      // Send a message to the content script to update the highlight's color on the page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "updateHighlightColor", id: id, color: newColor }, (response) => {
          console.log("Update color response:", response);
        });
      });
      // Refresh the list in the popup
      displayHighlights(highlights, url);
    });
  });
}

// On load, query the active tab and display its highlights
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const url = tab.url;
  chrome.storage.local.get([url], (result) => {
    const highlights = result[url] || [];
    displayHighlights(highlights, url);
  });
});

// Add event listeners for color options to set the default highlight color
const colorOptions = document.querySelectorAll(".color-option");
colorOptions.forEach(option => {
  option.addEventListener("click", () => {
    const selectedColor = option.getAttribute("data-color");
    chrome.storage.local.set({ "highlightColor": selectedColor }, () => {
      console.log(`Default highlight color set to ${selectedColor}`);
    });
  });
});

// Add event listener for the download button
document.getElementById("downloadButton").addEventListener("click", () => {
    downloadHighlights();
});
