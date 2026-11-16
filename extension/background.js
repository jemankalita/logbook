// Save to Logbook — opens your Logbook's /capture page, pre-filled, in a small window.
// Nothing is saved until you press Save there, and the extension never reads page content:
// it only passes along the URL, the tab title and any text you selected.

const MAX_TEXT = 4000;

async function appUrl() {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return typeof appUrl === "string" && appUrl ? appUrl.replace(/\/+$/, "") : null;
}

const isWebUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

async function openCapture({ url, title, text }) {
  const base = await appUrl();
  if (!base) {
    chrome.runtime.openOptionsPage();
    return;
  }
  const target = new URL("/capture", base);
  if (isWebUrl(url)) target.searchParams.set("url", url);
  if (title) target.searchParams.set("title", title.slice(0, 300));
  if (text) target.searchParams.set("text", text.slice(0, MAX_TEXT));
  chrome.windows.create({ url: target.toString(), type: "popup", width: 520, height: 680 });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "save-page", title: "Save page to Logbook", contexts: ["page"] });
    chrome.contextMenus.create({ id: "save-link", title: "Save link to Logbook", contexts: ["link"] });
    chrome.contextMenus.create({ id: "save-selection", title: "Save selection to Logbook", contexts: ["selection"] });
  });
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-link") {
    openCapture({ url: info.linkUrl, title: info.selectionText || "" });
  } else if (info.menuItemId === "save-selection") {
    openCapture({ url: tab?.url, title: tab?.title, text: info.selectionText });
  } else {
    openCapture({ url: info.pageUrl || tab?.url, title: tab?.title });
  }
});

chrome.action.onClicked.addListener((tab) => {
  openCapture({ url: tab?.url, title: tab?.title });
});
