function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="section-header page-header-wrapper">
      <div className="page-header-content">
        {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export default PageHeader;
