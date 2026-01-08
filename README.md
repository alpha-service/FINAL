# ALPHA&CO POS System

A full-stack Point of Sale system for building materials store with bilingual (FR/NL) support.

## Features

- 🛒 POS Sales Screen with product search and cart management
- 📄 Document Management (Quotes, Invoices, Receipts, Credit Notes)
- 💳 Payment Processing (Cash, Card, Bank Transfer) with partial payments
- 📊 Sales History with advanced filters
- 💰 Cash Register / Shifts management
- 📦 Inventory tracking with stock movements
- 👥 Customer management
- 🖨️ Professional PDF generation with ALPHA&CO branding
- 🛍️ Shopify integration placeholders

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI (Python), Motor (async MongoDB)
- **Database**: MongoDB
- **PDF Generation**: ReportLab

## Prerequisites

- **Node.js**: v18 or higher ([Download](https://nodejs.org/))
- **Python**: v3.10 or higher ([Download](https://www.python.org/))
- **MongoDB**: v6 or higher ([Download](https://www.mongodb.com/try/download/community))
- **Yarn**: `npm install -g yarn`

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd alphaco-pos
```

### 2. Install Dependencies

**Option A: Install All at Once (Recommended)**
```bash
npm run install:all
```

**Option B: Install Separately**
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
yarn install
```

### 3. Configure Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB connection string if needed
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Edit .env if you need to change the backend URL
```

### 4. Start MongoDB

**macOS (with Homebrew):**
```bash
brew services start mongodb-community
```

**Windows:**
```bash
net start MongoDB
```

**Linux:**
```bash
sudo systemctl start mongod
```

### 5. Run Development Servers

**Option A: Run Both Servers Together (Recommended)**
```bash
npm run dev
```

This starts:
- Backend: http://localhost:8001
- Frontend: http://localhost:3000

**Option B: Run Separately**

*Terminal 1 - Backend:*
```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

*Terminal 2 - Frontend:*
```bash
cd frontend
yarn start
```

### 6. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001/api/
- **API Docs**: http://localhost:8001/docs

## Project Structure

```
alphaco-pos/
├── backend/
│   ├── server.py           # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Backend configuration
├── frontend/
│   ├── src/
│   │   ├── pages/         # React pages
│   │   ├── components/    # Reusable components
│   │   └── utils/         # Helper functions
│   ├── package.json       # Node dependencies
│   └── .env              # Frontend configuration
└── package.json           # Root scripts for easy dev
```

## Available Scripts

### Root Level

- `npm run install:all` - Install all dependencies (backend + frontend)
- `npm run dev` - Start both servers concurrently
- `npm run dev:backend` - Start backend only
- `npm run dev:frontend` - Start frontend only
- `npm run build` - Build frontend for production

### Frontend

```bash
cd frontend
yarn start      # Development server
yarn build      # Production build
yarn test       # Run tests
yarn lint       # Lint code
```

### Backend

```bash
cd backend
uvicorn server:app --reload               # Development
uvicorn server:app --host 0.0.0.0 --port 8001  # Production
```

## Default Credentials

The application uses mock data for initial testing. No authentication is required.

## Troubleshooting

### Port Already in Use

If port 8001 or 3000 is already in use:

**Backend (8001):**
```bash
# macOS/Linux
lsof -ti:8001 | xargs kill -9

# Windows
netstat -ano | findstr :8001
taskkill /PID <PID> /F
```

**Frontend (3000):**
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### MongoDB Connection Issues

1. Check MongoDB is running:
   ```bash
   # macOS/Linux
   ps aux | grep mongod
   
   # Windows
   sc query MongoDB
   ```

2. Verify connection string in `backend/.env`:
   ```
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=alphaco_pos
   ```

### Frontend Dependency Issues

If you encounter peer dependency conflicts:

```bash
cd frontend
rm -rf node_modules package-lock.json
yarn install
```

The project uses `date-fns@^3.6.0` which is compatible with `react-day-picker@8.10.1`.

### Backend Module Not Found

If Python modules are missing:

```bash
cd backend
pip install -r requirements.txt --force-reinstall
```

### PDF Generation Issues

If PDF generation fails, ensure `reportlab` is installed:

```bash
cd backend
pip install reportlab pillow
```

## Environment Variables

### Backend (.env)

```bash
MONGO_URL=mongodb://localhost:27017  # MongoDB connection
DB_NAME=alphaco_pos                  # Database name
PORT=8001                            # Server port
HOST=0.0.0.0                         # Server host
CORS_ORIGINS=http://localhost:3000   # Allowed origins
```

### Frontend (.env)

```bash
REACT_APP_BACKEND_URL=http://localhost:8001  # Backend API URL
```

## Building for Production

### Frontend

```bash
cd frontend
yarn build
```

This creates an optimized build in `frontend/build/`.

### Backend

For production, run with Gunicorn or similar:

```bash
cd backend
gunicorn server:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

## Features Overview

### POS Screen (`/pos`)
- Product search and category filtering
- Cart management with quantity and discounts
- Customer selection
- Multiple payment methods
- Save as quote (no stock impact)
- Complete sale with PDF receipt

### Sales History (`/sales`)
- View all past sales
- Filter by date range, status, payment method, channel
- Reorder (load items back to cart)
- Process returns
- Download PDFs

### Documents Hub (`/documents`)
- View all document types (Quotes, Invoices, Receipts, Credit Notes)
- Filter by type and status
- Convert quotes to invoices
- Download PDFs with proper filenames (FACTURE_XXX.pdf)
- Payment actions

### Document Detail (`/documents/:id`)
- Professional A4 layout with ALPHA&CO branding
- Vendor and client boxes
- Line items table
- VAT breakdown
- Payment history
- Print and PDF download
- Partial payments support

### Cash Register (`/cash-register`)
- Open/close shifts
- Track cash movements
- Generate Z reports

### Inventory (`/inventory`)
- View stock levels
- Track stock movements
- Low stock alerts

## Support

For issues or questions, please contact support@alphaco.be

## License

MIT License - See LICENSE file for details
