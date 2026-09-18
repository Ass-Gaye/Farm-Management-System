import { useEffect } from "react";
import { useParams, Outlet } from "react-router-dom";
import { useFarm } from "../context/useFarm";

function HouseRouteSync() {
  const { houseId } = useParams();
  const { selectedHouse, selectHouse } = useFarm();

  useEffect(() => {
    if (houseId && Number(houseId) !== selectedHouse?.id) {
      selectHouse(Number(houseId));
    }
  }, [houseId, selectedHouse?.id, selectHouse]);

  return <Outlet />;
}

export default HouseRouteSync;
