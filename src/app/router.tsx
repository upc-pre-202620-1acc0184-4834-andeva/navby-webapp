import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '@/shared/auth/RouteGuards';
import { AppLayout, type RouteLayoutHandle } from './AppLayout';
import { HomePage } from './HomePage';
import {
  AccountPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './lazyPages';
import { RoutePlaceholderPage } from './RoutePlaceholderPage';

// Solo en desarrollo: captura de skeletons sin sesión (`pnpm bones`); no entra al build.
const BonesCapturePage = import.meta.env.DEV ? lazy(() => import('./BonesCapturePage')) : null;

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            index: true,
            handle: { layout: 'map' } satisfies RouteLayoutHandle,
            element: <HomePage />,
          },
          {
            path: 'itineraries',
            handle: { layout: 'contained' } satisfies RouteLayoutHandle,
            element: (
              <RoutePlaceholderPage
                titleKey="routes.itineraries.title"
                descriptionKey="routes.itineraries.description"
                actionTo="/"
                actionLabelKey="common.backHome"
              />
            ),
          },
          {
            path: 'itineraries/:id',
            handle: { layout: 'contained' } satisfies RouteLayoutHandle,
            element: (
              <RoutePlaceholderPage
                titleKey="routes.itineraries.title"
                descriptionKey="routes.itineraries.description"
                actionTo="/"
                actionLabelKey="common.backHome"
              />
            ),
          },
          {
            path: 'billing',
            handle: { layout: 'contained' } satisfies RouteLayoutHandle,
            element: (
              <RoutePlaceholderPage
                titleKey="routes.billing.title"
                descriptionKey="routes.billing.description"
                actionTo="/"
                actionLabelKey="common.backHome"
              />
            ),
          },
          {
            path: 'billing/result',
            handle: { layout: 'contained' } satisfies RouteLayoutHandle,
            element: (
              <RoutePlaceholderPage
                titleKey="routes.billing.title"
                descriptionKey="routes.billing.description"
                actionTo="/"
                actionLabelKey="common.backHome"
              />
            ),
          },
          {
            path: 'account',
            handle: { layout: 'contained' } satisfies RouteLayoutHandle,
            element: <AccountPage />,
          },
        ],
      },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          {
            path: 'login',
            handle: { layout: 'auth' } satisfies RouteLayoutHandle,
            element: <LoginPage />,
          },
          {
            path: 'register',
            handle: { layout: 'auth' } satisfies RouteLayoutHandle,
            element: <RegisterPage />,
          },
          {
            path: 'verify-email',
            handle: { layout: 'auth' } satisfies RouteLayoutHandle,
            element: <VerifyEmailPage />,
          },
          {
            path: 'forgot-password',
            handle: { layout: 'auth' } satisfies RouteLayoutHandle,
            element: <ForgotPasswordPage />,
          },
        ],
      },
      ...(BonesCapturePage
        ? [{ path: '__bones/podium', element: <BonesCapturePage /> } satisfies RouteObject]
        : []),
      {
        path: 'reset-password',
        handle: { layout: 'auth' } satisfies RouteLayoutHandle,
        element: <ResetPasswordPage />,
      },
      {
        path: '*',
        element: (
          <RoutePlaceholderPage
            titleKey="routes.notFound.title"
            descriptionKey="routes.notFound.description"
            actionTo="/"
            actionLabelKey="common.backHome"
          />
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(routes, {
  basename: '/app',
});
