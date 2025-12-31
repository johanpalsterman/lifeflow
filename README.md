# LifeFlow - Personal Command Center

Een AI-gestuurde persoonlijke life management applicatie, onderdeel van het WishFlow ecosysteem.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm of yarn

### 1. Clone en installeer dependencies

```bash
cd lifeflow-app
npm install
```

### 2. Start de database

```bash
docker-compose up -d
```

Dit start:
- PostgreSQL op port 5432
- Redis op port 6379
- Adminer (DB UI) op port 8080

### 3. Configureer environment

```bash
cp .env.example .env.local
```

Update `.env.local` met:
```
DATABASE_URL="postgresql://lifeflow:lifeflow_dev_password@localhost:5432/lifeflow?schema=public"
```

### 4. Setup database

```bash
# Genereer Prisma client
npm run db:generate

# Push schema naar database
npm run db:push

# Seed initiële data
npm run db:seed
```

### 5. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
lifeflow-app/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed data
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── dashboard/
│   │   │   ├── tasks/
│   │   │   ├── rules/
│   │   │   └── wishes/
│   │   ├── (dashboard)/   # Dashboard pages
│   │   └── (auth)/        # Auth pages
│   ├── components/
│   │   ├── ui/            # Base UI components
│   │   ├── dashboard/     # Dashboard widgets
│   │   ├── rules/         # AI Rules components
│   │   └── wishes/        # Wish Board components
│   ├── lib/
│   │   ├── prisma.ts      # Database client
│   │   └── utils.ts       # Utility functions
│   ├── hooks/             # React hooks
│   └── types/             # TypeScript types
├── docker-compose.yml
└── package.json
```

## 🔧 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

## 🗄️ Database

### Prisma Studio

```bash
npm run db:studio
```

Opens een visuele database editor op [http://localhost:5555](http://localhost:5555)

### Migrations

```bash
# Create a migration
npm run db:migrate -- --name your_migration_name

# Apply migrations
npm run db:migrate
```

## 🔗 API Endpoints

### Dashboard
- `GET /api/dashboard/summary` - Dashboard aggregated data

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### AI Rules
- `GET /api/rules` - List rules
- `POST /api/rules` - Create rule
- `PATCH /api/rules/:id` - Update rule
- `POST /api/rules/:id/toggle` - Toggle rule
- `POST /api/rules/:id/test` - Test rule

### Wishes
- `GET /api/wishes` - List wishes
- `POST /api/wishes` - Create wish
- `POST /api/wishes/:id/vote` - Vote for wish
- `DELETE /api/wishes/:id/vote` - Remove vote

## 🚢 Deployment

### Azure Container Apps

1. Build Docker image:
```bash
docker build -t lifeflow-app .
```

2. Push to Azure Container Registry:
```bash
az acr login --name yourregistry
docker tag lifeflow-app yourregistry.azurecr.io/lifeflow-app
docker push yourregistry.azurecr.io/lifeflow-app
```

3. Deploy to Container Apps via Azure Portal of CLI

### Environment Variables (Production)

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.lifeflow.app
```

## 📚 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Styling**: Tailwind CSS
- **State**: Zustand + SWR
- **Auth**: NextAuth.js
- **Validation**: Zod
- **Icons**: Lucide React

## 🔐 WishFlow Integration

LifeFlow integreert met het WishFlow ecosysteem:

- **TrustAI**: Document processing met PII anonimisatie
- **FlowEngine**: RPA automatisering triggers
- **Board of Directors**: Multi-AI strategisch advies
- **CRM**: Contact synchronisatie

## 📄 License

Proprietary - WishFlow
