# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server on port 3000
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - TypeScript type checking
- `npm run clean` - Clean dist directory

## Architecture

This is a **Production Scheduling Dashboard (MES)** for gilding film manufacturing (烫金膜生产排产看板). Built with React 19 + TypeScript + Vite + Tailwind CSS v4.

### Project Structure

```
/Users/kyle/claude project/Pinte-MES/
├── src/
│   ├── App.tsx              # Main app component with view switching
│   ├── main.tsx             # Entry point
│   ├── types.ts             # TypeScript interfaces (Task, Machine)
│   ├── data.ts              # Initial mock data (INITIAL_TASKS, MACHINES)
│   ├── index.css            # Global styles
│   ├── components/          # View components and UI
│   │   ├── TableView.tsx    # Table view of tasks
│   │   ├── CalendarView.tsx # Calendar/Gantt view by machine/time
│   │   ├── TaskView.tsx     # Kanban-style task view
│   │   ├── MetricCard.tsx   # Summary metric cards
│   │   ├── TaskDetailModal.tsx  # Task detail popup
│   │   ├── SettingsModal.tsx    # WPS sync settings
│   │   └── ExcelPreviewModal.tsx # Excel/process card preview
│   └── hooks/               # Custom React hooks
│       ├── useLocalStorage.ts   # Persist state to localStorage
│       └── useAutoScroll.ts     # Auto-scrolling functionality
```

### Key Features

- Three view modes: Table, Calendar (Gantt), and Task (Kanban)
- Search filtering across all task fields (ID, product, machine, operator, notes)
- Real-time clock display
- Auto-scrolling mode for big screen displays
- Three summary metrics: total orders, today's count, today's volume
- Task detail modal
- WPS Office sync integration (placeholder implementation)
- All view preferences persisted to localStorage
- Dark theme with blue color scheme optimized for production floor displays

### Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS v4** - Utility-first CSS via Vite plugin
- **date-fns** - Date manipulation
- **motion (Framer Motion)** - Animations
- **lucide-react** - Icons
- **@dnd-kit** - Drag-and-drop (included, ready for future use)
- **@google/genai** - Google GenAI SDK (configured via `GEMINI_API_KEY`)

## Environment Variables

- `GEMINI_API_KEY` - Gemini API key (required for AI features)
- `DISABLE_HMR` - Disable Hot Module Replacement when set to `true` (used in AI Studio)

## Configuration

- `vite.config.ts` - Vite configuration with environment variable loading
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Example environment variables file
