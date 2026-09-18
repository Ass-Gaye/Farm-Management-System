function EmptyState({
  icon = "📁",
  title = "No data found",
  message = "There are no records to display for this poultry house.",
  actionText,
  onAction,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ fontSize: 36, marginBottom: 12 }}>
        {icon}
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
      {actionText && onAction && (
        <button
          type="button"
          className="primary-button"
          style={{ marginTop: 16 }}
          onClick={onAction}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
