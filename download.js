function downloadHighlights() {
    chrome.storage.local.get(null, (result) => {
        let highlightsMapping = {};
        for (let key in result) {
            if (Array.isArray(result[key])) {  // Only include keys storing highlight arrays
                highlightsMapping[key] = result[key];
            }
        }
        if (Object.keys(highlightsMapping).length === 0) {
            alert("No highlights found.");
            return;
        }
        const json = JSON.stringify(highlightsMapping);
        const blob = new Blob([json], { type: "application/json" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "all-highlights.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    });
}
