import { NavLink } from "react-router-dom";
import { useFarm } from "../../context/useFarm";
import {
  DashboardIcon,
  RecordsIcon,
  BreedsIcon,
  HealthIcon,
  SlaughterIcon,
} from "../Icons";

function PageNavigation() {
  const { records, breeds, conditions, slaughterPlans } = useFarm();

  const navItems = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: <DashboardIcon size={15} />,
      badge: null,
    },
    {
      to: "/daily-records",
      label: "Daily Records",
      icon: <RecordsIcon size={15} />,
      badge: records.length,
    },
    {
      to: "/breeds",
      label: "Bird Breeds",
      icon: <BreedsIcon size={15} />,
      badge: breeds.length,
    },
    {
      to: "/health-condition",
      label: "Health & Condition",
      icon: <HealthIcon size={15} />,
      badge: conditions.length,
    },
    {
      to: "/slaughter-planning",
      label: "Slaughter Planning",
      icon: <SlaughterIcon size={15} />,
      badge: slaughterPlans.length,
    },
  ];

  return (
    <nav className="tabs-nav" aria-label="Page navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `tab-button ${isActive ? "active" : ""}`
          }
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge !== null && (
            <span className="tab-badge">{item.badge}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default PageNavigation;
