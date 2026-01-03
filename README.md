# Custom Dashboard

A modern, customizable dashboard with weather, public cameras, news shortcuts, traffic info, and more. Built for Cloudflare Pages.

## Features

- **Real-time Weather**: Get current weather for any city using Open-Meteo API (no API key required)
- **Public Cameras**: Customizable links to your local public cameras
- **News Outlets**: Quick access to major news sources
- **Traffic Info**: Links to traffic maps and local DOT resources
- **Quick Links**: Customizable shortcuts to your favorite websites
- **Quick Notes**: Local notes saved in your browser
- **Live Clock**: Always know the current time
- **Dark Theme**: Easy on the eyes with a modern dark interface
- **Fully Responsive**: Works great on desktop, tablet, and mobile

## Quick Start

### Deploy to Cloudflare Pages

1. **Fork or clone this repository**

2. **Connect to Cloudflare Pages**:
   - Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Go to Pages → Create a project
   - Connect your GitHub repository
   - Select this repository

3. **Configure build settings**:
   - Framework preset: `None`
   - Build command: (leave empty)
   - Build output directory: `/`
   - Root directory: `/`

4. **Deploy**:
   - Click "Save and Deploy"
   - Your dashboard will be live in seconds!

### Local Development

Simply open `index.html` in your browser. No build process required!

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (Python)
python -m http.server 8000

# Option 3: Use a local server (Node.js)
npx serve
```

## Customization

### Weather

1. Click on the city input field
2. Enter your city name
3. Click "Update"
4. Your preference is saved automatically

### Public Cameras

1. Click on any camera link to edit it
2. Click "+ Add Camera" to add new cameras
3. Enter the camera name and URL
4. Changes are saved automatically in your browser

### News & Traffic Links

Edit the links directly in `index.html`:

```html
<a href="YOUR_URL" target="_blank" class="link-item">
    <span>EMOJI</span>
    <p>Link Name</p>
</a>
```

### Quick Notes

Type in the notes section - everything is automatically saved to your browser's local storage.

### Color Scheme

Edit CSS variables in `style.css`:

```css
:root {
    --primary-color: #6366f1;      /* Primary accent */
    --secondary-color: #8b5cf6;    /* Secondary accent */
    --background: #0f172a;         /* Main background */
    --surface: #1e293b;            /* Card background */
    /* ... more colors ... */
}
```

## APIs Used

- **Open-Meteo**: Free weather API with no API key required
  - Geocoding: `https://geocoding-api.open-meteo.com`
  - Weather: `https://api.open-meteo.com`

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Opera: ✅ Full support

## File Structure

```
.
├── index.html      # Main dashboard HTML
├── style.css       # All styles
├── script.js       # JavaScript functionality
├── _headers        # Security headers for Cloudflare Pages
├── .gitignore      # Git ignore rules
└── README.md       # This file
```

## Privacy

All data is stored locally in your browser using `localStorage`:
- Weather city preference
- Camera links
- Quick notes

No data is sent to any server except for weather API calls.

## Tips

- **Bookmark it**: Set this dashboard as your browser's homepage
- **Mobile**: Add to your home screen for quick access
- **Cameras**: Find public traffic cameras on your city's DOT website
- **News**: Customize the news section with your preferred sources
- **Notes**: Great for quick reminders and tasks

## Troubleshooting

**Weather not loading?**
- Check your internet connection
- Try a different city name
- Check browser console for errors

**Links not saving?**
- Make sure cookies/local storage is enabled
- Try a different browser
- Check if you're in private/incognito mode

**Dashboard not updating after changes?**
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Clear your browser cache

## License

MIT License - Feel free to customize and use however you like!

## Contributing

Feel free to open issues or submit pull requests with improvements!

---

Made with ❤️ for a better browsing experience
