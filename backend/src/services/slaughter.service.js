/**
 * Slaughter planning domain service.
 * Extracted from slaughterPlan.controller.js to break the
 * controller -> service -> controller import cycle.
 */

const computeSlaughterStatus = (plan) => {
  if (plan.status === "Completed") return "Completed";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expectedDate = new Date(plan.expectedSlaughterDate);
  const targetDate = new Date(expectedDate.getFullYear(), expectedDate.getMonth(), expectedDate.getDate());
  const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays <= 7) return "Due soon";
  return "Upcoming";
};

module.exports = { computeSlaughterStatus };
