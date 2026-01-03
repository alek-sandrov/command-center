// Update current time
function updateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    document.getElementById('current-time').textContent = now.toLocaleDateString('en-US', options);
}

// Update last update time
function updateLastUpdate() {
    const now = new Date();
    document.getElementById('last-update').textContent = now.toLocaleString();
}

// Weather functionality
async function updateWeather() {
    const city = document.getElementById('city-input').value;
    const weatherInfo = document.getElementById('weather-info');

    if (!city) {
        weatherInfo.innerHTML = '<div class="error">Please enter a city name</div>';
        return;
    }

    weatherInfo.innerHTML = '<div class="loading">Loading weather data...</div>';

    try {
        // Using Open-Meteo API (free, no API key required)
        // First, get coordinates for the city using geocoding
        const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            weatherInfo.innerHTML = '<div class="error">City not found. Please try another city.</div>';
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];

        // Get weather data
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
        const weatherData = await weatherResponse.json();

        const current = weatherData.current;
        const weatherDescription = getWeatherDescription(current.weather_code);

        weatherInfo.innerHTML = `
            <div class="weather-data">
                <div class="temperature">${Math.round(current.temperature_2m)}°F</div>
                <div class="weather-description">${weatherDescription}</div>
                <div style="color: var(--text-secondary); margin-top: 0.5rem;">${name}, ${country}</div>
                <div class="weather-details">
                    <div class="weather-detail">💧 Humidity: ${current.relative_humidity_2m}%</div>
                    <div class="weather-detail">🌡️ Feels like: ${Math.round(current.apparent_temperature)}°F</div>
                    <div class="weather-detail">💨 Wind: ${Math.round(current.wind_speed_10m)} mph</div>
                    <div class="weather-detail">🌧️ Precip: ${current.precipitation} mm</div>
                </div>
            </div>
        `;

        // Save city preference
        localStorage.setItem('preferredCity', city);
        updateLastUpdate();
    } catch (error) {
        console.error('Weather error:', error);
        weatherInfo.innerHTML = '<div class="error">Failed to load weather data. Please try again.</div>';
    }
}

// Convert WMO weather codes to descriptions
function getWeatherDescription(code) {
    const weatherCodes = {
        0: '☀️ Clear sky',
        1: '🌤️ Mainly clear',
        2: '⛅ Partly cloudy',
        3: '☁️ Overcast',
        45: '🌫️ Foggy',
        48: '🌫️ Foggy',
        51: '🌦️ Light drizzle',
        53: '🌦️ Moderate drizzle',
        55: '🌦️ Dense drizzle',
        61: '🌧️ Slight rain',
        63: '🌧️ Moderate rain',
        65: '🌧️ Heavy rain',
        71: '🌨️ Slight snow',
        73: '🌨️ Moderate snow',
        75: '🌨️ Heavy snow',
        77: '❄️ Snow grains',
        80: '🌦️ Slight rain showers',
        81: '🌧️ Moderate rain showers',
        82: '🌧️ Violent rain showers',
        85: '🌨️ Slight snow showers',
        86: '🌨️ Heavy snow showers',
        95: '⛈️ Thunderstorm',
        96: '⛈️ Thunderstorm with hail',
        99: '⛈️ Thunderstorm with hail'
    };
    return weatherCodes[code] || '🌡️ Unknown';
}

// Notes functionality
function loadNotes() {
    const savedNotes = localStorage.getItem('dashboardNotes');
    if (savedNotes) {
        document.getElementById('notes').value = savedNotes;
    }
}

function saveNotes() {
    const notes = document.getElementById('notes').value;
    localStorage.setItem('dashboardNotes', notes);
}

// Link editing functionality
function editLink(element, event) {
    event.preventDefault();

    const currentText = element.querySelector('p').textContent;
    const currentUrl = element.href;

    const newText = prompt('Enter link name:', currentText);
    if (newText === null) return;

    const newUrl = prompt('Enter URL:', currentUrl);
    if (newUrl === null) return;

    element.querySelector('p').textContent = newText || currentText;
    element.href = newUrl || currentUrl;

    // Save to localStorage
    saveCameraLinks();
}

// Add new camera link
function addCameraLink() {
    const name = prompt('Enter camera name:');
    if (!name) return;

    const url = prompt('Enter camera URL:');
    if (!url) return;

    const camerasCard = document.querySelector('.cameras-card .links-grid');
    const newLink = document.createElement('a');
    newLink.href = url;
    newLink.className = 'link-item camera-link';
    newLink.target = '_blank';
    newLink.onclick = (e) => editLink(newLink, e);
    newLink.innerHTML = `
        <span>📷</span>
        <p>${name}</p>
    `;

    camerasCard.appendChild(newLink);
    saveCameraLinks();
}

// Save camera links to localStorage
function saveCameraLinks() {
    const cameraLinks = [];
    document.querySelectorAll('.camera-link').forEach(link => {
        cameraLinks.push({
            name: link.querySelector('p').textContent,
            url: link.href
        });
    });
    localStorage.setItem('cameraLinks', JSON.stringify(cameraLinks));
}

// Load camera links from localStorage
function loadCameraLinks() {
    const saved = localStorage.getItem('cameraLinks');
    if (!saved) return;

    const links = JSON.parse(saved);
    const camerasCard = document.querySelector('.cameras-card .links-grid');
    camerasCard.innerHTML = '';

    links.forEach(link => {
        const newLink = document.createElement('a');
        newLink.href = link.url;
        newLink.className = 'link-item camera-link';
        newLink.target = '_blank';
        newLink.onclick = (e) => editLink(newLink, e);
        newLink.innerHTML = `
            <span>📷</span>
            <p>${link.name}</p>
        `;
        camerasCard.appendChild(newLink);
    });
}

// Initialize dashboard
function init() {
    updateTime();
    setInterval(updateTime, 1000);

    updateLastUpdate();

    // Load saved preferences
    const savedCity = localStorage.getItem('preferredCity');
    if (savedCity) {
        document.getElementById('city-input').value = savedCity;
    }

    // Load weather
    updateWeather();

    // Load notes
    loadNotes();

    // Load camera links
    loadCameraLinks();

    // Save notes on input
    document.getElementById('notes').addEventListener('input', saveNotes);

    // Allow Enter key to update weather
    document.getElementById('city-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            updateWeather();
        }
    });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
