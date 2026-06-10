import { createBrowserRouter } from 'react-router';
import { Placeholder } from './routes/placeholder.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Placeholder />,
  },
]);
