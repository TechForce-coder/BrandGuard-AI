import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const toastStyles = {
  success: {
    border: 'border-l-emerald-500',
    icon: 'text-emerald-600',
    Icon: CheckCircle2
  },
  error: {
    border: 'border-l-rose-500',
    icon: 'text-rose-600',
    Icon: XCircle
  },
  warning: {
    border: 'border-l-amber-500',
    icon: 'text-amber-600',
    Icon: TriangleAlert
  },
  info: {
    border: 'border-l-blue-600',
    icon: 'text-blue-700',
    Icon: Info
  }
};

function ToastItem({ item, onDismiss, onPause, onResume }) {
  const [entered, setEntered] = useState(false);
  const style = toastStyles[item.type];
  const Icon = style.Icon;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      className={`flex w-full items-start gap-3 rounded-xl border border-slate-200 border-l-4 ${style.border} bg-white p-4 text-sm text-slate-800 shadow-lg shadow-slate-900/10 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        entered
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 motion-reduce:translate-x-0 motion-reduce:opacity-100'
      }`}
      onMouseEnter={() => onPause(item.id)}
      onMouseLeave={() => onResume(item.id)}
    >
      <Icon className={`mt-0.5 shrink-0 ${style.icon}`} size={18} aria-hidden="true" />
      <div className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-5">
        {item.message}
        {item.action && (
          <button
            type="button"
            className="ml-2 font-semibold text-blue-800 underline underline-offset-2"
            onClick={() => {
              try {
                item.action.onClick();
              } finally {
                onDismiss(item.id);
              }
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="ml-1 shrink-0 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const timersRef = useRef(new Map());
  const nextIdRef = useRef(0);

  const updateItems = useCallback(nextItems => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const dismiss = useCallback(id => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer.timeout);
    timersRef.current.delete(id);
    updateItems(itemsRef.current.filter(item => item.id !== id));
  }, [updateItems]);

  const schedule = useCallback((id, duration) => {
    const timeout = setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, {
      timeout,
      deadline: Date.now() + duration,
      remaining: duration
    });
  }, [dismiss]);

  const showToast = useCallback((type, message, options = {}) => {
    const text = String(message ?? '');
    if (!text) return;

    const duration = type === 'error' ? 6000 : 4000;
    const duplicate = itemsRef.current.find(item => item.message === text);
    if (duplicate) {
      const timer = timersRef.current.get(duplicate.id);
      if (timer) clearTimeout(timer.timeout);
      const updated = {
        ...duplicate,
        type,
        action: options.action || null
      };
      const nextItems = [updated, ...itemsRef.current.filter(item => item.id !== duplicate.id)];
      updateItems(nextItems);
      schedule(updated.id, duration);
      return;
    }

    const item = {
      id: ++nextIdRef.current,
      type,
      message: text,
      action: options.action || null
    };
    const nextItems = [item, ...itemsRef.current].slice(0, 4);
    for (const removed of itemsRef.current.slice(3)) {
      const timer = timersRef.current.get(removed.id);
      if (timer) clearTimeout(timer.timeout);
      timersRef.current.delete(removed.id);
    }
    updateItems(nextItems);
    schedule(item.id, duration);
  }, [schedule, updateItems]);

  const pause = useCallback(id => {
    const timer = timersRef.current.get(id);
    if (!timer) return;
    clearTimeout(timer.timeout);
    timer.remaining = Math.max(0, timer.deadline - Date.now());
    timer.timeout = null;
  }, []);

  const resume = useCallback(id => {
    const timer = timersRef.current.get(id);
    if (!timer || timer.timeout) return;
    timer.deadline = Date.now() + timer.remaining;
    timer.timeout = setTimeout(() => dismiss(id), timer.remaining);
  }, [dismiss]);

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer.timeout);
    }
    timersRef.current.clear();
  }, []);

  const toast = useMemo(() => ({
    success: (message, options) => showToast('success', message, options),
    error: (message, options) => showToast('error', message, options),
    warning: (message, options) => showToast('warning', message, options),
    info: (message, options) => showToast('info', message, options)
  }), [showToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div
          aria-live="polite"
          aria-relevant="additions text"
          className="fixed right-4 top-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-[360px] flex-col gap-2"
        >
          {items.map(item => (
            <ToastItem
              key={item.id}
              item={item}
              onDismiss={dismiss}
              onPause={pause}
              onResume={resume}
            />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error('useToast must be used within a ToastProvider.');
  }
  return { toast };
}
