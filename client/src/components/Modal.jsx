import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export default function Modal({ open, onClose, title, description, children, size = 'md' }) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        setEntered(true);
        const target = dialogRef.current?.querySelector('[data-autofocus]') ||
          dialogRef.current?.querySelector('input, textarea, select, button');
        (target || dialogRef.current)?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (!mounted) return undefined;
    setEntered(false);
    const exitDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const timer = window.setTimeout(() => {
      setMounted(false);
      triggerRef.current?.focus?.();
    }, exitDuration);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...(dialogRef.current?.querySelectorAll(focusableSelector) || [])]
        .filter(element => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeInDialog = dialogRef.current?.contains(document.activeElement);
      if (!activeInDialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mounted, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`modal-backdrop ${entered ? 'modal-backdrop--entered' : ''}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`modal-panel modal-panel--${size} ${entered ? 'modal-panel--entered' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-950">{title}</h2>
            {description
              ? <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
              : <p id={descriptionId} className="sr-only">{title}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>,
    document.body
  );
}
