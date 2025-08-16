# SpeakAI - Frontend

A modern React-based frontend for the SpeakAI platform - an intelligent AI agent management system for businesses.

## Features

- **Modern UI/UX**: Built with React and TailwindCSS for a responsive, modern interface
- **Authentication**: Complete login/register system with role-based access control
- **Agent Management**: Create, configure, and manage AI agents for different use cases
- **Dashboard Analytics**: Real-time performance metrics and insights
- **Voice Configuration**: Upload voice samples for agent customization
- **Knowledge Base**: Upload documents to train agents
- **Subscription Management**: Integrated billing and subscription handling
- **Call Monitoring**: View call logs, recordings, and transcripts
- **Super Admin Panel**: Platform-wide management for administrators

## Tech Stack

- **Frontend**: React 18, TailwindCSS, Heroicons
- **State Management**: Zustand
- **Routing**: React Router DOM
- **Forms**: React Hook Form
- **UI Components**: Headless UI
- **Charts**: Chart.js, Recharts
- **Notifications**: React Toastify
- **HTTP Client**: Axios
- **Payment**: Stripe integration ready

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd SpeakAi
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Demo Credentials

For testing purposes, you can use these demo credentials:

- **Admin**: admin@demo.com / password123
- **Super Admin**: superadmin@demo.com / password123

## Project Structure

```
src/
├── components/
│   └── Layout/
│       ├── Layout.js          # Main app layout
│       └── AuthLayout.js      # Authentication layout
├── pages/
│   ├── Auth/                  # Authentication pages
│   ├── Dashboard/             # Dashboard components
│   ├── Agents/                # Agent management
│   ├── Billing/               # Billing and subscriptions
│   ├── CallLogs/              # Call history and recordings
│   ├── Training/              # Agent training
│   ├── Settings/              # App settings
│   └── Profile/               # User profile
├── store/
│   ├── authStore.js           # Authentication state
│   └── appStore.js            # Application state
├── App.js                     # Main app component
├── index.js                   # Entry point
└── index.css                  # Global styles
```

## Key Features

### Authentication System
- Role-based access control (Admin, Super Admin)
- Protected routes
- Persistent login state
- Password reset functionality

### Agent Management
- Create agents for different use cases:
  - Customer Support
  - Lead Generation
  - Appointment Scheduling
- Voice cloning with file upload
- Knowledge base integration
- Real-time status monitoring

### Dashboard Analytics
- Performance metrics
- Call statistics
- Success rate tracking
- Recent activity feeds

### Subscription Management
- Multiple subscription tiers
- Stripe integration ready
- Usage monitoring
- Billing history

## API Integration

The frontend is designed to integrate with a REST API backend. API endpoints are currently mocked but can be easily connected to:

- Authentication endpoints
- Agent management endpoints
- Analytics endpoints
- Billing endpoints
- File upload endpoints

## Customization

### Styling
- TailwindCSS for utility-first styling
- Custom color scheme defined in `tailwind.config.js`
- Responsive design with mobile-first approach

### Components
- Reusable components with consistent styling
- Icon system using Heroicons
- Form components with validation

## Build

To build the project for production:

```bash
npm run build
```

This creates a `build` folder with optimized production files.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team. 