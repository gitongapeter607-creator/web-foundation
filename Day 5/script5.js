const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusEl = document.getElementById("status");
const usersList = document.getElementById("users-list");

// Every loaded user is stored here so filtering needs no new request.
let allUsers = [];

function setStatus(message) {
  statusEl.textContent = message;
}

// Draws any array of users into the list.
function renderUsers(list) {
  usersList.innerHTML = "";

  list.forEach((user) => {
    const item = document.createElement("li");

    const name = document.createElement("strong");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = "Email: " + user.email;

    const city = document.createElement("p");
    city.textContent = "City: " + user.address.city;

    const company = document.createElement("p");
    company.textContent = "Company: " + user.company.name;

    item.append(name, email, city, company);
    usersList.appendChild(item);
  });
}

// Filters the stored array by name (not case-sensitive) and redraws.
function applyFilter() {
  const text = filterInput.value.trim().toLowerCase();

  const matches = allUsers.filter((user) =>
    user.name.toLowerCase().includes(text)
  );

  renderUsers(matches);

  if (matches.length === 0) {
    setStatus("No users match your filter.");
  } else if (text === "") {
    setStatus("Loaded " + allUsers.length + " users.");
  } else {
    setStatus("Showing " + matches.length + " of " + allUsers.length + " users.");
  }
}

async function loadUsers() {
  setStatus("Loading users...");
  loadButton.disabled = true;

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }

    allUsers = await response.json();
    applyFilter();
  } catch (error) {
    allUsers = [];
    renderUsers([]);
    setStatus("Error: could not load users. " + error.message);
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  if (allUsers.length > 0) {
    applyFilter();
  }
});