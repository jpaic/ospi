const MIN_DISPLAY_MS = 350
let _overlayShownAt = 0

function applyHide() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById('ospi-boot-overlay')
      if (el) el.classList.add('ospi-hidden')
    })
  })
}

export function showNavOverlay(title?: string, subtitle?: string) {
  const el = document.getElementById('ospi-boot-overlay')
  if (!el) return
  const titleEl = document.getElementById('ospi-overlay-title')
  const subEl = document.getElementById('ospi-overlay-subtitle')
  if (titleEl && title !== undefined) titleEl.textContent = title
  if (subEl && subtitle !== undefined) subEl.textContent = subtitle
  el.classList.remove('ospi-hidden')
  _overlayShownAt = Date.now()
}

export function hideNavOverlay() {
  const elapsed = Date.now() - _overlayShownAt
  const remaining = MIN_DISPLAY_MS - elapsed
  if (remaining > 0) {
    setTimeout(applyHide, remaining)
  } else {
    applyHide()
  }
}
