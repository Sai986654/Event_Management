# Vedika 360 Frontend

This is the React frontend application for Vedika 360 - a technology-driven event management platform.

## Features

- **Authentication**: User registration and login with JWT
- **Event Management**: Create, edit, and manage events
- **Vendor Marketplace**: Browse and book vendors
- **Guest Management**: Manage guest lists and RSVPs
- **Budget Planning**: Track event budgets and expenses
- **Real-time Updates**: Live updates using Socket.io
- **Responsive Design**: Mobile-friendly interface

## Tech Stack

- **React 18**: UI framework
- **React Router v6**: Client-side routing
- **Ant Design**: UI component library
- **Axios**: HTTP client
- **Socket.io Client**: Real-time communication

## Getting Started

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

1. Clone the repository and navigate to the frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your backend API URL:
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### Running the Application

Start the development server:
```bash
npm start
```

The application will run on `http://localhost:3000`

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## PWA Support (iOS Alternative to App Store)

The web app now supports Progressive Web App (PWA) installation.

- iPhone/iPad users can open the app in Safari and use:
	- Share -> Add to Home Screen
- Android users can open the app in Chrome and use:
	- Browser menu -> Install app (or Add to Home screen)
- Other supported browsers/devices can use the in-app Install button when available.

Notes:
- Service worker registration is enabled in production builds.
- The app can launch in standalone mode when installed from home screen.

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Header.js
│   │   ├── Header.css
│   │   ├── Footer.js
│   │   ├── Footer.css
│   │   └── ProtectedRoute.js
│   ├── context/
│   │   └── AuthContext.js
│   ├── pages/
│   │   ├── Home.js
│   │   ├── Home.css
│   │   ├── Login.js
│   │   ├── Register.js
│   │   ├── AuthPages.css
│   │   ├── Dashboard.js
│   │   ├── Dashboard.css
│   │   ├── EventCreate.js
│   │   ├── EventCreate.css
│   │   ├── VendorMarketplace.js
│   │   └── VendorMarketplace.css
│   ├── services/
│   │   ├── api.js
│   │   ├── authService.js
│   │   ├── eventService.js
│   │   ├── vendorService.js
│   │   ├── bookingService.js
│   │   ├── guestService.js
│   │   ├── budgetService.js
│   │   ├── mediaService.js
│   │   ├── notificationService.js
│   │   └── aiService.js
│   ├── utils/
│   │   └── helpers.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── .env.example
├── package.json
└── README.md
```

## Key Components

### AuthContext
Global state management for authentication. Handles login, registration, and token management.

### Services
API communication services for each module:
- Auth Service: User authentication
- Event Service: Event CRUD operations
- Vendor Service: Vendor search and booking
- Guest Service: Guest management and RSVPs
- Budget Service: Budget planning and tracking
- Media Service: Photo/video uploads and gallery
- Notification Service: Event notifications
- AI Service: AI-powered suggestions

### Pages
- **Home**: Landing page with feature overview
- **Login/Register**: Authentication pages
- **Dashboard**: Main dashboard with event summary
- **EventCreate**: Multi-step event creation wizard
- **VendorMarketplace**: Browse and filter vendors

## API Integration

The frontend communicates with the backend API at `http://localhost:5000/api`. All API requests include JWT authentication tokens in the Authorization header.

## Environment Variables

- `REACT_APP_API_URL`: Backend API base URL
- `REACT_APP_SOCKET_URL`: Socket.io server URL

## Future Enhancements

- [ ] Guest management UI
- [ ] Budget dashboard with analytics
- [ ] Real-time event control panel
- [ ] Media gallery and guest uploads
- [ ] Vendor profile pages
- [ ] Review and rating system
- [ ] AI planning suggestions
- [ ] Event sharing and public pages

## Contributing

Contributions are welcome! Please follow the existing code style and create feature branches for new functionality.

## License

MIT
