import { useEffect, useRef } from 'react'

/** Keep keyboard focus inside an open dialog and return it to its trigger. */
export function useDialogFocus(open, selector, onClose) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const dialog = document.querySelector(selector)
    if (!dialog) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const focusable = () =>
      [
        ...dialog.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        ),
      ].filter(element => element.getClientRects().length > 0)
    document.body.style.overflow = 'hidden'
    dialog.setAttribute('tabindex', '-1')
    const frame = requestAnimationFrame(() => (focusable()[0] || dialog).focus())
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (!first) {
        event.preventDefault()
        dialog.focus()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    const onFocus = event => {
      if (!dialog.contains(event.target)) (focusable()[0] || dialog).focus()
    }
    dialog.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocus)
    return () => {
      cancelAnimationFrame(frame)
      dialog.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocus)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, selector])
}
