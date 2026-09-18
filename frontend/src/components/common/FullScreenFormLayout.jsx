import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "../Icons";

function FullScreenFormLayout({
  title,
  subtitle,
  backPath,
  backLabel = "Back",
  onCancel,
  children,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onCancel) {
      onCancel();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="fullscreen-form-page">
      <div className="fullscreen-form-inner">
        <div className="fullscreen-form-topbar">
          {backPath ? (
            <Link to={backPath} className="form-back-link">
              <ArrowLeftIcon size={16} />
              <span>{backLabel}</span>
            </Link>
          ) : (
            <button
              type="button"
              className="form-back-link btn-link"
              onClick={handleBack}
            >
              <ArrowLeftIcon size={16} />
              <span>{backLabel}</span>
            </button>
          )}

          <button
            type="button"
            className="close-button"
            onClick={handleBack}
            title="Cancel and close"
            aria-label="Cancel and close"
          >
            ×
          </button>
        </div>

        <div className="fullscreen-form-card">
          <div className="form-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>

          <div className="fullscreen-form-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default FullScreenFormLayout;
