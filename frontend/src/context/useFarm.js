import { useContext } from "react";
import { FarmContext } from "./farmContextDef";

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error("useFarm must be used within a FarmProvider");
  }
  return context;
}
