import { useState } from 'react';
import Modal from './Modal.jsx';

export default function ConfirmDialog({
  open,
  title = 'Confirm action',
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onClose
}) {
  const [confirming, setConfirming] = useState(false);

  const confirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={confirming} data-autofocus>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={confirm} disabled={confirming}>
          {confirming ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
