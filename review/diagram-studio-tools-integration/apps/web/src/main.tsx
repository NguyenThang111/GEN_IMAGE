import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './task-list.css';
import './production-test-layout.css';
import './production-registration.css';
import './member-avatars.css';
import './inventory-grid.css';
import './material-purchase-state.css';
import './production-status-filter.css';
import './production-worklog-groups.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
