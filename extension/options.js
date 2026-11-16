const form = document.getElementById("form");
const input = document.getElementById("url");
const status = document.getElementById("status");

function show(message, isError = false) {
  status.textContent = message;
  status.className = isError ? "error" : "";
}

chrome.storage.sync.get("appUrl").then(({ appUrl }) => {
  if (appUrl) input.value = appUrl;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let url;
  try {
    url = new URL(input.value.trim());
  } catch {
    return show("That doesn't look like a web address.", true);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    return show("Use an https:// address (http is only allowed for localhost).", true);
  }
  await chrome.storage.sync.set({ appUrl: url.origin });
  input.value = url.origin;
  show("Saved ✓");
});
