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
    document.getElementById('last-update').textContent = now.toLocaleString('bg-BG');
}

// Weather functionality
async function updateWeather() {
    const weatherInfo = document.getElementById('weather-info');

    weatherInfo.innerHTML = '<div class="loading">Зареждане...</div>';

    try {
        // Hardcoded for Sofia, Bulgaria
        const latitude = 42.6977;
        const longitude = 23.3219;
        const name = 'София';
        const country = 'България';

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
                    <div class="weather-detail">💧 Влажност: ${current.relative_humidity_2m}%</div>
                    <div class="weather-detail">🌡️ Усеща се: ${Math.round(current.apparent_temperature)}°C</div>
                    <div class="weather-detail">💨 Вятър: ${Math.round(current.wind_speed_10m)} км/ч</div>
                    <div class="weather-detail">🌧️ Валежи: ${current.precipitation} мм</div>
                </div>
            </div>
        `;

        updateLastUpdate();
    } catch (error) {
        console.error('Weather error:', error);
        weatherInfo.innerHTML = '<div class="error">Неуспешно зареждане на времето. Опитайте по-късно.</div>';
    }
}

// Convert WMO weather codes to descriptions
function getWeatherDescription(code) {
    const weatherCodes = {
        0: '☀️ Ясно',
        1: '🌤️ Предимно ясно',
        2: '⛅ Разкъсана облачност',
        3: '☁️ Облачно',
        45: '🌫️ Мъгла',
        48: '🌫️ Мъгла',
        51: '🌦️ Слаб ръмеж',
        53: '🌦️ Ръмеж',
        55: '🌦️ Силен ръмеж',
        61: '🌧️ Слаб дъжд',
        63: '🌧️ Дъжд',
        65: '🌧️ Силен дъжд',
        71: '🌨️ Слаб сняг',
        73: '🌨️ Сняг',
        75: '🌨️ Силен снеговалеж',
        77: '❄️ Снежни зърна',
        80: '🌦️ Слаби превалявания',
        81: '🌧️ Превалявания',
        82: '🌧️ Пороен дъжд',
        85: '🌨️ Слаби снежни превалявания',
        86: '🌨️ Силни снежни превалявания',
        95: '⛈️ Гръмотевична буря',
        96: '⛈️ Буря с градушка',
        99: '⛈️ Буря с градушка'
    };
    return weatherCodes[code] || '🌡️ Няма данни';
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
