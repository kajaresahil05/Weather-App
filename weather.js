// DOM Elements
const weatherForm = document.querySelector(".weatherForm");
const cityInput = document.querySelector(".cityInput");
const card = document.querySelector(".card");
const loader = document.getElementById("loader");
const geoBtn = document.getElementById("geoBtn");
const installBtn = document.getElementById("installBtn");
const offlineBadge = document.getElementById("offlineBadge");
const iosPrompt = document.getElementById("iosPrompt");
const closeIosPrompt = document.getElementById("closeIosPrompt");
const body = document.querySelector("body");

const apiKey = "d24a30d1f83151fe9cf15ac985f57578";

// Register Service Worker for PWA (Relative path for GitHub Pages compatibility)
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./sw.js")
            .then(reg => {
                console.log("Service Worker registered successfully with scope:", reg.scope);
            })
            .catch(error => {
                console.error("Service Worker registration failed:", error);
            });
    });
}

// PWA Install Prompt handling
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
    // Prevent the default mini-infobar
    event.preventDefault();
    deferredInstallPrompt = event;

    // Only show if not in standalone mode
    if (!isStandalone()) {
        if (installBtn) {
            installBtn.classList.remove("hidden");
        }
    }
});

if (installBtn) {
    installBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);

        deferredInstallPrompt = null;
        installBtn.classList.add("hidden");
    });
}

window.addEventListener("appinstalled", () => {
    console.log("Weather App was successfully installed!");
    if (installBtn) {
        installBtn.classList.add("hidden");
    }
});

// Check if running in Standalone (Installed) Mode
function isStandalone() {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
    );
}

// iOS Install Guidance
const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
if (isIos && !isStandalone() && iosPrompt) {
    const iosDismissed = localStorage.getItem("iosPromptDismissed");
    if (!iosDismissed) {
        iosPrompt.classList.remove("hidden");
    }
}

if (closeIosPrompt) {
    closeIosPrompt.addEventListener("click", () => {
        iosPrompt.classList.add("hidden");
        localStorage.setItem("iosPromptDismissed", "true");
    });
}

// Network Status Handling
function updateOnlineStatus() {
    if (navigator.onLine) {
        offlineBadge.classList.add("hidden");
    } else {
        offlineBadge.classList.remove("hidden");
    }
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// Weather Form Submit Event
weatherForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const city = cityInput.value.trim();
    if (city) {
        await fetchAndDisplayWeather(city);
    } else {
        displayError("Please enter a city name");
    }
});

// Geolocation Button Event
if (geoBtn) {
    geoBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
            displayError("Geolocation is not supported by your browser");
            return;
        }

        showLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const weatherData = await getWeatherDataByCoords(latitude, longitude);
                    displayWeatherInfo(weatherData);
                    cityInput.value = weatherData.name;
                    localStorage.setItem("lastCity", weatherData.name);
                } catch (error) {
                    console.error(error);
                    displayError(error.message || "Could not fetch weather for your location");
                } finally {
                    showLoading(false);
                }
            },
            (error) => {
                showLoading(false);
                let message = "Unable to retrieve your location";
                if (error.code === error.PERMISSION_DENIED) {
                    message = "Location access was denied. Please enter a city manually.";
                }
                displayError(message);
            },
            { timeout: 10000 }
        );
    });
}

// Fetch by City Name
async function getWeatherData(city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`City "${city}" not found`);
        }
        if (response.status === 503) {
            const errData = await response.json();
            throw new Error(errData.message || "Offline and no cached data available");
        }
        throw new Error("Could not fetch weather data");
    }

    return await response.json();
}

// Fetch by Coordinates
async function getWeatherDataByCoords(lat, lon) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error("Could not fetch weather data for your coordinates");
    }

    return await response.json();
}

// Orchestrator: Fetch and display with loading state
async function fetchAndDisplayWeather(city) {
    showLoading(true);
    try {
        const weatherData = await getWeatherData(city);
        displayWeatherInfo(weatherData);
        localStorage.setItem("lastCity", city);
    } catch (error) {
        console.error(error);
        if (!navigator.onLine) {
            displayError("You are currently offline. Check your internet connection.");
        } else {
            displayError(error.message || "Could not fetch weather");
        }
    } finally {
        showLoading(false);
    }
}

// Loading state controller
function showLoading(isLoading) {
    if (isLoading) {
        card.style.display = "none";
        loader.classList.remove("hidden");
    } else {
        loader.classList.add("hidden");
    }
}

// Display Weather Information
function displayWeatherInfo(data) {
    const {
        name: city,
        sys: { country } = {},
        main: { temp, humidity, feels_like },
        wind: { speed: windSpeed } = {},
        weather: [{ description, id }]
    } = data;

    card.textContent = "";
    card.style.display = "flex";

    const cityDisplay = document.createElement("h1");
    const weatherEmoji = document.createElement("p");
    const tempDisplay = document.createElement("p");
    const descDisplay = document.createElement("p");
    const humidityDisplay = document.createElement("p");

    cityDisplay.textContent = country ? `${city}, ${country}` : city;
    tempDisplay.textContent = `${(temp - 273.15).toFixed(1)}°C`;
    humidityDisplay.textContent = `💧 Humidity: ${humidity}%`;
    descDisplay.textContent = description;
    weatherEmoji.textContent = getWeatherEmoji(id);

    cityDisplay.classList.add("cityDisplay");
    weatherEmoji.classList.add("weatherEmoji");
    tempDisplay.classList.add("tempDisplay");
    descDisplay.classList.add("descDisplay");
    humidityDisplay.classList.add("humidityDisplay");

    card.appendChild(cityDisplay);
    card.appendChild(weatherEmoji);
    card.appendChild(tempDisplay);
    card.appendChild(descDisplay);
    card.appendChild(humidityDisplay);

    // Extra details (feels like, wind speed)
    const extraInfo = document.createElement("div");
    extraInfo.classList.add("additional-info");

    const feelsLikeItem = document.createElement("div");
    feelsLikeItem.classList.add("info-item");
    feelsLikeItem.innerHTML = `Feels Like<span class="val">${(feels_like - 273.15).toFixed(1)}°C</span>`;

    const windItem = document.createElement("div");
    windItem.classList.add("info-item");
    const speedKmH = windSpeed ? (windSpeed * 3.6).toFixed(1) : "0";
    windItem.innerHTML = `Wind<span class="val">${speedKmH} km/h</span>`;

    extraInfo.appendChild(feelsLikeItem);
    extraInfo.appendChild(windItem);
    card.appendChild(extraInfo);
}

// Weather emoji and dynamic background assignment
function getWeatherEmoji(weatherId) {
    switch (true) {
        case (weatherId >= 200 && weatherId < 300):
            body.style.backgroundImage = "url('images/thunderstorm.jpg')";
            return "⛈️";
        case (weatherId >= 300 && weatherId < 500):
            body.style.backgroundImage = "url('images/mist.jpg')";
            return "🌦️";
        case (weatherId >= 500 && weatherId < 600):
            body.style.backgroundImage = "url('images/rainy.jpg')";
            return "🌧️";
        case (weatherId >= 600 && weatherId < 700):
            body.style.backgroundImage = "url('images/snowy.jpg')";
            return "❄️";
        case (weatherId >= 700 && weatherId < 800):
            body.style.backgroundImage = "url('images/fogy.jpg')";
            return "🌫️";
        case (weatherId === 800):
            body.style.backgroundImage = "url('images/sunny.jpg')";
            return "☀️";
        case (weatherId >= 801 && weatherId < 810):
            body.style.backgroundImage = "url('images/cloudy.jpg')";
            return "☁️";
        default:
            body.style.backgroundImage = "none";
            return "❓";
    }
}

// Error state display
function displayError(message) {
    const errorDisplay = document.createElement("p");
    errorDisplay.textContent = message;
    errorDisplay.classList.add("errorDisplay");
    body.style.backgroundImage = "none";

    card.textContent = "";
    card.style.display = "flex";
    card.appendChild(errorDisplay);
}

// Auto-load last city or fallback city on startup
window.addEventListener("DOMContentLoaded", () => {
    const lastCity = localStorage.getItem("lastCity") || "London";
    cityInput.value = lastCity;
    fetchAndDisplayWeather(lastCity);
});