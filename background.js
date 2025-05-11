chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SAVE_HIGHLIGHT") {
      // Destructure the highlight data; note the new 'id' property.
      const { id, text, url, color, xpath, startOffset, endOffset } = message;
      chrome.storage.local.get([url], (result) => {
        const highlights = result[url] || [];
        // Avoid duplicate highlights by checking the key properties.
        const isDuplicate = highlights.some(
          (highlight) =>
            highlight.text === text &&
            highlight.color === color &&
            highlight.xpath === xpath &&
            highlight.startOffset === startOffset &&
            highlight.endOffset === endOffset
        );
        if (!isDuplicate) {
          highlights.push({ id, text, color, xpath, startOffset, endOffset });
          chrome.storage.local.set({ [url]: highlights }, () => {
            console.log(
              `Saved highlight for ${url}: "${text}" at ${xpath}[${startOffset}-${endOffset}]`
            );
            sendResponse({ status: "success" });
          });
        } else {
          sendResponse({ status: "duplicate" });
        }
      });
      // Return true to indicate asynchronous response.
      return true;
    } else if (message.action === "deleteHighlight") {
      // Message should include the id of the highlight to delete and the page URL.
      const { id, url } = message;
      chrome.storage.local.get([url], (result) => {
        let highlights = result[url] || [];
        highlights = highlights.filter((hl) => hl.id !== id);
        chrome.storage.local.set({ [url]: highlights }, () => {
          console.log(`Deleted highlight with id ${id} for ${url}`);
          sendResponse({ status: "deleted" });
        });
      });
      return true;
    } else if (message.action === "updateHighlightColor") {
      // Message should include the id, new color, and the page URL.
      const { id, url, color } = message;
      chrome.storage.local.get([url], (result) => {
        let highlights = result[url] || [];
        highlights = highlights.map((hl) => {
          if (hl.id === id) {
            hl.color = color;
          }
          return hl;
        });
        chrome.storage.local.set({ [url]: highlights }, () => {
          console.log(`Updated highlight ${id} color to ${color} for ${url}`);
          sendResponse({ status: "updated" });
        });
      });
      return true;
    }
  });
  