document.getElementById("uploadButton").addEventListener("click", () => {
  document.getElementById("uploadInput").click();
});

document.getElementById("uploadInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      // Assume uploaded data is an object mapping URLs to arrays of highlights.
      chrome.storage.local.get(null, (existingData) => {
        const mergedData = { ...existingData, ...data };
        chrome.storage.local.set(mergedData, () => {
          console.log("Highlights uploaded and merged for all websites.");
          // Restore highlights on the active tab.
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            chrome.tabs.sendMessage(tab.id, { action: "uploadHighlights" }, (response) => {
              console.log("Restore highlights response:", response);
            });
          });
        });
      });
    } catch (err) {
      console.error("Error parsing JSON file:", err);
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
});
