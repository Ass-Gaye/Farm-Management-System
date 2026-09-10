const API_URL = "http://localhost:5000/api";

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Something went wrong");
  }

  return result;
};

// Houses

export const getHouses = async () => {
  return request("/houses");
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

// Daily records

export const getDailyRecords = async () => {
  return request("/daily-records");
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

// Dashboard

export const getHouseDashboard = async (houseId) => {
  return request(`/houses/${houseId}/dashboard`);
};