import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAuth } from '@/shared/auth/RouteGuards';
import { AppLayout, type RouteLayoutHandle } from './AppLayout';
import { HomePage } from './HomePage';
import { RoutePlaceholderPage } from './RoutePlaceholderPage';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
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
            element: (
              <RoutePlaceholderPage
                titleKey="routes.account.title"
                descriptionKey="routes.account.description"
                actionTo="/"
                actionLabelKey="common.backHome"
              />
            ),
          },
        ],
      },
      {
        path: 'login',
        handle: { layout: 'auth' } satisfies RouteLayoutHandle,
        element: (
          <RoutePlaceholderPage
            titleKey="routes.login.title"
            descriptionKey="routes.login.description"
            actionTo="/register"
            actionLabelKey="routes.login.action"
          />
        ),
      },
      {
        path: 'register',
        handle: { layout: 'auth' } satisfies RouteLayoutHandle,
        element: (
          <RoutePlaceholderPage
            titleKey="routes.register.title"
            descriptionKey="routes.register.description"
            actionTo="/login"
            actionLabelKey="routes.register.action"
          />
        ),
      },
      {
        path: 'verify-email',
        handle: { layout: 'auth' } satisfies RouteLayoutHandle,
        element: (
          <RoutePlaceholderPage
            titleKey="routes.verifyEmail.title"
            descriptionKey="routes.verifyEmail.description"
            actionTo="/login"
            actionLabelKey="routes.verifyEmail.action"
          />
        ),
      },
      {
        path: 'forgot-password',
        handle: { layout: 'auth' } satisfies RouteLayoutHandle,
        element: (
          <RoutePlaceholderPage
            titleKey="routes.forgotPassword.title"
            descriptionKey="routes.forgotPassword.description"
            actionTo="/login"
            actionLabelKey="routes.forgotPassword.action"
          />
        ),
      },
      {
        path: 'reset-password',
        handle: { layout: 'auth' } satisfies RouteLayoutHandle,
        element: (
          <RoutePlaceholderPage
            titleKey="routes.resetPassword.title"
            descriptionKey="routes.resetPassword.description"
            actionTo="/login"
            actionLabelKey="routes.resetPassword.action"
          />
        ),
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
