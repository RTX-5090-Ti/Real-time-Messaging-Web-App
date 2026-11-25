// Display hints only. User-Agent is untrusted and must never grant access.
export function describeDevice(value = "") {
  const ua = String(value).slice(0, 1024);
  const browser = /Edg(?:e|A|iOS)?\//.test(ua) ? "Edge"
    : /OPR\/|Opera\//.test(ua) ? "Opera"
    : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
    : /Version\/.*Safari\//.test(ua) ? "Safari" : "Trình duyệt không xác định";
  const os = /iPhone|iPod/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows NT/.test(ua) ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux" : "Hệ điều hành không xác định";
  return { browser, os, kind: /iPhone|iPad|iPod|Android|Mobile/.test(ua) ? "mobile" : "desktop" };
}
