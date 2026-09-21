import { AlertTriangleIcon } from "./Icons";

function ConfirmDialog({
  isOpen = true,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  confirmDisabled = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-icon">
          <AlertTriangleIcon size={20} />
        </div>

        <h2 id="dialog-title">{title}</h2>

        <p>{message}</p>

        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className="danger-button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;