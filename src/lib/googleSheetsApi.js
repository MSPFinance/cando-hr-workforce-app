const API_URL =
  "PASTE_YOUR_WORKING_SCRIPT_URL_HERE";

export async function getDatabase() {
  try {
    const response = await fetch(API_URL);
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}

export async function addEmployee(employeeData) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "addRow",
        tab: "employees",
        data: employeeData,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error(error);
  }
}