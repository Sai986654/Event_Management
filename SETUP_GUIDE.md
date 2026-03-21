# EventOS - Complete Setup Guide

## Project Overview

EventOS is a production-ready MERN (MongoDB/PostgreSQL, Express.js, React, Node.js) application for technology-driven event management. The project is now complete with both backend and frontend implementations.

## Frontend Implementation Complete ✅

The frontend has been fully scaffolded with:
- **React 18** with modern hooks
- **Ant Design** for UI components
- **React Router v6** for client-side routing
- **Axios** for API communication
- **JWT-based authentication**
- **Responsive design** (mobile-friendly)
- **Context API** for state management

## Project Structure

```
EventManagement/
├── backend/               # Node.js + Express API
│   ├── config/           # Database and service configs
│   ├── controllers/      # Request handlers (8 modules)
│   ├── models/          # Database models (Prisma)
│   ├── routes/          # API routes
│   ├── middleware/      # Auth, validation, error handling
│   ├── seeds/           # Database seeding scripts
│   ├── socket.js        # Socket.io setup
│   ├── server.js        # Main application
│   ├── package.json
│   └── Dockerfile
│
├── frontend/             # React SPA Application
│   ├── public/          # Static assets
│   ├── src/
│   │   ├── components/  # Shared components (Header, Footer, etc.)
│   │   ├── context/     # Auth context
│   │   ├── hooks/       # Custom hooks
│   │   ├── pages/       # Page components (10+ pages)
│   │   ├── services/    # API services
│   │   ├── utils/       # Helper functions
│   │   ├── App.js       # Main app component
│   │   └── index.js     # Entry point
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.example
│   └── README.md
│
├── docker-compose.yml   # Multi-container orchestration
└── README.md
```

## Quick Start (Frontend)

### Prerequisites
- Node.js 14+ installed
- Backend running on `http://localhost:5000/api`

### Installation & Setup

1. **Navigate to frontend folder:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
```bash
cp .env.example .env
```

4. **Update .env if needed:**
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

5. **Start development server:**
```bash
npm start
```

The app will run on `http://localhost:3000`

## Quick Start (Full Stack with Docker)

### Prerequisites
- Docker & Docker Compose installed

### Setup

1. **Ensure .env files exist in backend:**
```bash
cd backend
cp .env.example .env
# Update .env with your configuration
cd ..
```

2. **Start all services:**
```bash
docker-compose up -d
```

3. **Services will be available at:**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5000`
   - PostgreSQL: `localhost:5432`

4. **View logs:**
```bash
docker-compose logs -f
```

## Frontend Pages & Features

### Public Pages
- **Home** (`/`) - Landing page with feature overview
- **Login** (`/login`) - User authentication
- **Register** (`/register`) - New user registration
- **Public Event Page** (`/public/:eventSlug`) - Event details for guests

### Protected Pages (Organizers)
- **Dashboard** (`/dashboard`) - Event summary and statistics
- **Create Event** (`/events/create`) - Multi-step event creation wizard
- **Event Details** (`/events/:eventId`) - Complete event information
- **Guest Management** (`/events/:eventId/guests`) - Guest list and RSVPs
- **Budget Dashboard** (`/events/:eventId/budget`) - Budget planning and tracking

### Marketplace
- **Vendor Marketplace** (`/vendors`) - Browse and filter vendors by category

## API Integration

### Authentication Flow
```
User registers/logs in
    ↓
Backend returns JWT token + user data
    ↓
Token stored in localStorage
    ↓
Token included in all API requests
    ↓
On logout, token removed from storage
```

### Available API Services

Each service module handles communication with backend:

- **authService** - Login, register, profile management
- **eventService** - Event CRUD operations
- **vendorService** - Vendor search and filtering
- **bookingService** - Vendor booking management
- **guestService** - Guest list and RSVP management
- **budgetService** - Budget planning and allocation
- **mediaService** - Photo/video uploads and gallery
- **notificationService** - Event notifications
- **aiService** - AI-powered suggestions

### Example API Call Pattern
```javascript
// In a component
const [events, setEvents] = useState([]);

useEffect(() => {
  eventService.getEvents({ limit: 10 })
    .then(data => setEvents(data.events))
    .catch(error => message.error(error.message));
}, []);
```

## Features Implemented

### ✅ Completed Components

**Authentication**
- Registration with role selection
- JWT-based login
- Protected routes
- Token persistence

**Event Management**
- Create events with details
- View event summary
- Edit event information
- Delete events

**Vendor System**
- Search vendors by name
- Filter by category
- View vendor details
- Vendor ratings and reviews

**Guest Management**
- Add/remove guests
- Bulk import from CSV
- RSVP tracking
- Check-in functionality

**Budget Planning**
- Budget allocation by category
- Expense tracking
- AI budget optimization
- Real-time calculations

**Event Gallery**
- Photo/video uploads
- Guest uploads (with moderation)
- Public gallery access

## Component Architecture

### Header Component
- Logo and branding
- Navigation menu
- User profile dropdown
- Login/Register buttons (for non-authenticated users)

### AuthContext
Global state management for:
- User authentication state
- Login/logout functions
- User data persistence
- Auto-logout on token expiration

### Protected Route
Wrapper component that:
- Checks authentication status
- Validates user role
- Redirects to login if unauthorized
- Shows loading spinner while checking auth

## Styling & Design

- **Color Scheme**: Purple gradient (`#667eea` to `#764ba2`)
- **Component Library**: Ant Design 5.11
- **Responsive**: Mobile-first approach
- **Custom CSS**: Modular stylesheets per page

### CSS Structure
```
- Global styles (App.css)
- Page-specific styles (PageName.css)
- Component styles (ComponentName.css)
```

## Development Workflow

### Adding a New Page
1. Create page component in `src/pages/PageName.js`
2. Create corresponding CSS file `src/pages/PageName.css`
3. Add route in `src/App.js`
4. Create API service if needed in `src/services/`

### Adding a New Component
1. Create component in `src/components/ComponentName.js`
2. Create CSS file `src/components/ComponentName.css`
3. Export from component directory
4. Import where needed

## Environment Variables

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### Backend (.env in backend/)
Configure database, email, cloud storage, and JWT settings.

## Future Enhancements

### Short Term
- [ ] Real-time event control panel (Socket.io)
- [ ] Event timeline/task management
- [ ] Notification bell with unread count
- [ ] Profile/settings pages
- [ ] Forgot password flow
- [ ] Guest check-in via QR code scanner

### Medium Term
- [ ] Advanced search and filters
- [ ] Event templates library
- [ ] Vendor analytics dashboard
- [ ] Automated reminders via email
- [ ] Guest communication portal
- [ ] Analytics and reporting

### Long Term
- [ ] Mobile app (React Native)
- [ ] Video conferencing integration
- [ ] Payment gateway integration
- [ ] Multi-language support
- [ ] Advanced AI suggestions
- [ ] 3D event preview

## Troubleshooting

### Frontend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### API connection errors
- Ensure backend is running on port 5000
- Check `REACT_APP_API_URL` in `.env`
- Review browser console for CORS errors

### Build issues
```bash
# Create build directory
npm run build

# Test build locally
npm install -g serve
serve -s build -l 3000
```

## Testing

### Manual Testing Checklist
- [ ] User registration and login
- [ ] Event creation flow
- [ ] Vendor search and filtering
- [ ] Guest management operations
- [ ] Budget calculations
- [ ] Responsive design on mobile
- [ ] API error handling
- [ ] Token expiration and refresh

### Run Tests (when available)
```bash
npm test
```

## Production Deployment

### Using Docker
```bash
# Build and push images
docker-compose build
docker push yourusername/eventos-frontend:latest

# Deploy to server
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment
```bash
# Build production version
npm run build

# Deploy build/ folder to hosting (Netlify, Vercel, S3, etc.)
```

## Support & Documentation

- **Frontend README**: `frontend/README.md`
- **Backend README**: `backend/README.md`
- **API Documentation**: (To be added)
- **Postman Collection**: (To be added)

## Next Steps

1. **Setup Database**: Run backend database migrations
2. **Seed Data**: Populate with sample vendors and events
3. **Configure Email**: Setup email service for notifications
4. **Test Integration**: Verify frontend-backend communication
5. **Deploy**: Follow deployment guides for your platform

## Architecture Decisions

### Frontend Stack
- **React**: Component-based UI with hooks
- **Ant Design**: Professional UI components
- **Context API**: Lightweight state management (no Redux)
- **Axios**: Simplified HTTP requests
- **CSS Modules**: Scoped styling per component

### Why These Choices?
- React + Ant Design = Fast prototyping with professional look
- Context API = Sufficient for current complexity, easy to scale to Redux
- Functional components = Modern React patterns
- CSS files = Easy debugging and customization

## Contributing

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes following code style
3. Test thoroughly in development
4. Submit pull request with description

## License

MIT License - See LICENSE file for details

---

**Happy Event Planning! 🎉**

For questions or issues, please refer to the README files in backend/ and frontend/ directories.
