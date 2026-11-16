import { createBrowserRouter } from 'react-router';
import { HomePage } from './HomePage';

// Las pantallas de docs/navby-webapp-documentation.md §1 se agregan aquí, cada una desde su feature.
export const router = createBrowserRouter([{ path: '/', element: <HomePage /> }], {
  basename: '/app',
});
