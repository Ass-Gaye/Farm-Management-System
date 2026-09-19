const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TOKEN_KEY = "poultry_mgmt_token";

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const removeAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

const request = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const { headers, ...restOptions } = options;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...headers,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      // If unauthorized, clear invalid token
      removeAuthToken();
    }
    throw new Error(result.message || "Something went wrong");
  }

  return result;
};

// ==================== Authentication ====================

export const registerUser = async ({ name, email, password }) => {
  const result = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  if (result.data?.token) {
    setAuthToken(result.data.token);
  }
  return result;
};

export const loginUser = async ({ email, password }) => {
  const result = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.data?.token) {
    setAuthToken(result.data.token);
  }
  return result;
};

export const getCurrentUser = async () => {
  return request("/auth/me");
};

export const logoutUser = () => {
  removeAuthToken();
};

// ==================== Houses ====================

export const getHouses = async () => {
  return request("/houses");
};

export const getHouseById = async (houseId) => {
  return request(`/houses/${houseId}`);
};

export const createHouse = async (houseData) => {
  return request("/houses", {
    method: "POST",
    body: JSON.stringify(houseData),
  });
};

export const updateHouse = async (houseId, houseData) => {
  return request(`/houses/${houseId}`, {
    method: "PUT",
    body: JSON.stringify(houseData),
  });
};

export const deleteHouse = async (houseId) => {
  return request(`/houses/${houseId}`, {
    method: "DELETE",
  });
};

// ==================== Daily Records ====================

export const getDailyRecords = async (houseId) => {
  const query = houseId ? `?houseId=${houseId}` : "";
  return request(`/daily-records${query}`);
};

export const getDailyRecordById = async (recordId) => {
  return request(`/daily-records/${recordId}`);
};

export const createDailyRecord = async (recordData) => {
  return request("/daily-records", {
    method: "POST",
    body: JSON.stringify(recordData),
  });
};

export const updateDailyRecord = async (recordId, recordData) => {
  return request(`/daily-records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(recordData),
  });
};

export const deleteDailyRecord = async (recordId) => {
  return request(`/daily-records/${recordId}`, {
    method: "DELETE",
  });
};

// ==================== Dashboard ====================

export const getHouseDashboard = async (houseId) => {
  return request(`/houses/${houseId}/dashboard`);
};

// ==================== Breeds ====================

export const getBreeds = async (houseId) => {
  const query = houseId ? `?houseId=${houseId}` : "";
  return request(`/breeds${query}`);
};

export const getBreedById = async (breedId) => {
  return request(`/breeds/${breedId}`);
};

export const createBreed = async (breedData) => {
  return request("/breeds", {
    method: "POST",
    body: JSON.stringify(breedData),
  });
};

export const updateBreed = async (breedId, breedData) => {
  return request(`/breeds/${breedId}`, {
    method: "PUT",
    body: JSON.stringify(breedData),
  });
};

export const deleteBreed = async (breedId) => {
  return request(`/breeds/${breedId}`, {
    method: "DELETE",
  });
};

// ==================== Bird Conditions / Health ====================

export const getBirdConditions = async (houseId) => {
  const query = houseId ? `?houseId=${houseId}` : "";
  return request(`/bird-conditions${query}`);
};

export const getBirdConditionById = async (conditionId) => {
  return request(`/bird-conditions/${conditionId}`);
};

export const createBirdCondition = async (conditionData) => {
  return request("/bird-conditions", {
    method: "POST",
    body: JSON.stringify(conditionData),
  });
};

export const updateBirdCondition = async (conditionId, conditionData) => {
  return request(`/bird-conditions/${conditionId}`, {
    method: "PUT",
    body: JSON.stringify(conditionData),
  });
};

export const deleteBirdCondition = async (conditionId) => {
  return request(`/bird-conditions/${conditionId}`, {
    method: "DELETE",
  });
};

// ==================== Slaughter Planning ====================

export const getSlaughterPlans = async (houseId) => {
  const query = houseId ? `?houseId=${houseId}` : "";
  return request(`/slaughter-plans${query}`);
};

export const getSlaughterPlanById = async (planId) => {
  return request(`/slaughter-plans/${planId}`);
};

export const createSlaughterPlan = async (planData) => {
  return request("/slaughter-plans", {
    method: "POST",
    body: JSON.stringify(planData),
  });
};

export const updateSlaughterPlan = async (planId, planData) => {
  return request(`/slaughter-plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify(planData),
  });
};

export const toggleSlaughterPlanComplete = async (planId, completed) => {
  return request(`/slaughter-plans/${planId}/complete`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
};

export const deleteSlaughterPlan = async (planId) => {
  return request(`/slaughter-plans/${planId}`, {
    method: "DELETE",
  });
};

// ==================== Financial Management ====================

export const getFinancialSummary = async (houseId) => {
  const query = houseId ? `?houseId=${houseId}` : "";
  return request(`/finances/summary${query}`);
};

export const getFinancialTransactions = async (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      queryParams.append(key, val);
    }
  });
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return request(`/finances/transactions${queryString}`);
};

export const getFinancialReports = async (houseId) => {
  const query = houseId ? `?houseId=${houseId}` : "";
  return request(`/finances/reports${query}`);
};

// Expenses CRUD
export const getExpenses = async (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      queryParams.append(key, val);
    }
  });
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return request(`/expenses${queryString}`);
};

export const getExpenseById = async (id) => {
  return request(`/expenses/${id}`);
};

export const createExpense = async (expenseData) => {
  return request("/expenses", {
    method: "POST",
    body: JSON.stringify(expenseData),
  });
};

export const updateExpense = async (id, expenseData) => {
  return request(`/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(expenseData),
  });
};

export const deleteExpense = async (id) => {
  return request(`/expenses/${id}`, {
    method: "DELETE",
  });
};

// Income CRUD
export const getIncome = async (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      queryParams.append(key, val);
    }
  });
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return request(`/income${queryString}`);
};

export const getIncomeById = async (id) => {
  return request(`/income/${id}`);
};

export const createIncome = async (incomeData) => {
  return request("/income", {
    method: "POST",
    body: JSON.stringify(incomeData),
  });
};

export const updateIncome = async (id, incomeData) => {
  return request(`/income/${id}`, {
    method: "PUT",
    body: JSON.stringify(incomeData),
  });
};

export const deleteIncome = async (id) => {
  return request(`/income/${id}`, {
    method: "DELETE",
  });
};