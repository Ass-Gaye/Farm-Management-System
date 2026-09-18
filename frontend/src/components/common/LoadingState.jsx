export function LoadingState({
  title = "Loading data...",
  message = "Please wait while we retrieve farm operational records.",
}) {
  return (
    <div className="loading-screen" style={{ minHeight: "50vh" }}>
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({
  message = "An unexpected error occurred.",
  onRetry,
}) {
  return (
    <div className="error-message" style={{ margin: "20px 0" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          className="secondary-button"
          style={{ marginTop: 10, fontSize: 12, padding: "4px 10px" }}
          onClick={onRetry}
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export default LoadingState;
