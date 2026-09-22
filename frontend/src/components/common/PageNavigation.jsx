import { NavLink } from "react-router-dom";
import { useFarm } from "../../context/useFarm";
import {
  DashboardIcon,
  RecordsIcon,
  BreedsIcon,
  HealthIcon,
  SlaughterIcon,
  FinanceIcon,
  InventoryIcon,
  FlockIcon,
  VaccineIcon,
  DepopulationIcon,
} from "../Icons";

function PageNavigation() {
  const { records, breeds, conditions, slaughterPlans, flocks, vaccinations } = useFarm();

  const pendingVaccinationsCount =
    vaccinations?.filter((v) => v.status === "PENDING").length || 0;

  const navItems = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: <DashboardIcon size={15} />,
      badge: null,
    },
    {
      to: "/flocks",
      label: "Flocks & Batches",
      icon: <FlockIcon size={15} />,
      badge: flocks?.length || 0,
    },
    {
      to: "/depopulation",
      label: "Depopulation",
      icon: <DepopulationIcon size={15} />,
      badge: null,
    },
    {
      to: "/daily-records",
      label: "Daily Records",
      icon: <RecordsIcon size={15} />,
      badge: records.length,
    },
    {
      to: "/vaccinations",
      label: "Vaccinations",
      icon: <VaccineIcon size={15} />,
      badge: pendingVaccinationsCount > 0 ? pendingVaccinationsCount : null,
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
    {
      to: "/inventory",
      label: "Inventory & Feed",
      icon: <InventoryIcon size={15} />,
      badge: null,
    },
    {
      to: "/finances",
      label: "Financials",
      icon: <FinanceIcon size={15} />,
      badge: null,
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
