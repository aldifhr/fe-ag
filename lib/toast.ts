let toastContainer: HTMLDivElement | null = null;

function getContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  toastContainer.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message: string, duration = 2000) {
  const container = getContainer();
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = `
    pointer-events:auto;
    padding:10px 20px;
    border-radius:8px;
    font-size:13px;
    font-weight:500;
    color:#fff;
    background:rgba(30,30,40,0.95);
    border:1px solid rgba(255,255,255,0.08);
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    backdrop-filter:blur(12px);
    opacity:0;
    transform:translateY(8px);
    transition:opacity .2s,transform .2s;
    white-space:nowrap;
  `;
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 200);
  }, duration);
}
