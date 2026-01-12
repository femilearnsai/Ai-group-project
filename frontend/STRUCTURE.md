# Frontend Structure Documentation

## Overview
The frontend has been refactored from a single monolithic `index.jsx` file (825 lines) into a clean, modular component-based architecture.

## New File Structure

```
frontend/
├── index.jsx                      # Entry point (9 lines) - renders App
├── App.jsx                        # Main application component
├── constants.js                   # Tax rates, statutory citations, configs
├── utils.js                       # Tax calculation logic & formatters
│
└── components/
    ├── Card.jsx                   # Reusable card container
    ├── CitationBadge.jsx          # Legal citation badge
    ├── CurrencyDisplay.jsx        # Formatted currency display
    ├── SectionTitle.jsx           # Section heading with icon
    ├── ThinkingDisplay.jsx        # Loading/thinking indicator
    ├── MessageBubble.jsx          # Chat message bubble
    ├── LegalBasisSection.jsx      # Expandable legal references
    ├── CalculatorDashboard.jsx    # Tax calculator interface
    ├── Sidebar.jsx                # Navigation sidebar
    ├── Header.jsx                 # Top navigation header
    ├── ChatSection.jsx            # Chat message display
    └── ChatInput.jsx              # Message input footer
```

## Key Improvements

### 1. **Separation of Concerns**
- **Constants** (`constants.js`): Tax brackets, rates, statutory citations
- **Utils** (`utils.js`): Business logic for tax calculations
- **Components**: Reusable UI elements
- **App** (`App.jsx`): Application state and composition

### 2. **Component Modularity**
Each component has a single responsibility:
- `MessageBubble`: Display chat messages
- `CalculatorDashboard`: Tax calculation interface
- `Sidebar`: Navigation and session management
- `Header`: Top navigation controls
- `ChatInput`: User input handling

### 3. **Reusable UI Components**
- `Card`, `CurrencyDisplay`, `CitationBadge`, `SectionTitle`, `ThinkingDisplay`
- Can be imported and used across the application

### 4. **Clean Entry Point**
`index.jsx` is now just 9 lines - only renders the root App component

## Import Structure

All components use ES6 module imports:
```javascript
import { Component } from './components/Component.jsx';
import { CONSTANTS } from './constants.js';
import { utilFunction } from './utils.js';
```

## Benefits

1. **Maintainability**: Easier to find and update specific functionality
2. **Reusability**: Components can be used in multiple places
3. **Testing**: Easier to test individual components in isolation
4. **Collaboration**: Multiple developers can work on different components
5. **Readability**: Each file has a clear, focused purpose
6. **Scalability**: Easy to add new components without cluttering existing files

## State Management

State is managed in `App.jsx` and passed down to components as props:
- Chat state (messages, sessions, active chat)
- Calculator state (inputs, role, results)
- UI state (sidebar, tabs, search)

## Next Steps for Further Improvement

1. Consider adding PropTypes or TypeScript for type safety
2. Extract API calls into a separate service layer
3. Add unit tests for calculation logic in `utils.js`
4. Create a custom hooks file for shared state logic
5. Add error boundaries for component error handling
