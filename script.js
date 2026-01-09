// Update current time (not used on main page, kept for compatibility)
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

    // Update main time if element exists
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
        currentTimeEl.textContent = now.toLocaleDateString('en-US', options);
    }
}

// Update last update time
function updateLastUpdate() {
    const now = new Date();
    document.getElementById('last-update').textContent = now.toLocaleString();
}

// Weather functionality
async function updateWeather() {
    const weatherInfo = document.getElementById('weather-info');

    weatherInfo.innerHTML = '<div class="loading">Loading weather data...</div>';

    try {
        // Hardcoded for Sofia, Bulgaria
        const latitude = 42.6977;
        const longitude = 23.3219;
        const name = 'Sofia';
        const country = 'Bulgaria';

        // Get weather data with metric units
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`);
        const weatherData = await weatherResponse.json();

        const current = weatherData.current;
        const weatherDescription = getWeatherDescription(current.weather_code);

        weatherInfo.innerHTML = `
            <div class="weather-data">
                <div class="temperature">${Math.round(current.temperature_2m)}°C</div>
                <div class="weather-description">${weatherDescription}</div>
                <div style="color: var(--text-secondary); margin-top: 0.5rem;">${name}, ${country}</div>
                <div class="weather-details">
                    <div class="weather-detail">💧 Humidity: ${current.relative_humidity_2m}%</div>
                    <div class="weather-detail">🌡️ Feels like: ${Math.round(current.apparent_temperature)}°C</div>
                    <div class="weather-detail">💨 Wind: ${Math.round(current.wind_speed_10m)} km/h</div>
                    <div class="weather-detail">🌧️ Precip: ${current.precipitation} mm</div>
                </div>
            </div>
        `;

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

// Ham radio frequencies are static, no functionality needed

// Camera links are now hardcoded in HTML, no editing needed

// Initialize dashboard
function init() {
    updateTime();
    setInterval(updateTime, 1000);

    updateLastUpdate();

    // Load weather for Sofia, Bulgaria
    updateWeather();
    // Refresh weather every 10 minutes
    setInterval(updateWeather, 10 * 60 * 1000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
