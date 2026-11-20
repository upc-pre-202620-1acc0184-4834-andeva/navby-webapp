import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '@/shared/auth/RouteGuards';
import { AppLayout, type RouteLayoutHandle } from './AppLayout';
import {
  AccountPage,
  BillingPage,
  BillingResultPage,
  ForgotPasswordPage,
  HomePage,
  ItinerariesPage,
  ItineraryDetailPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './lazyPages';
import { RoutePlaceholderPage } from './RoutePlaceholderPage';

// Solo en desarrollo: captura de skeletons sin sesión (`pnpm bones`); no entra al build.
const BonesCapturePage = import.meta.env.DEV ? lazy(() => import('./BonesCapturePage')) : null;
const BonesItinerariesPage = import.meta.env.DEV
  ? lazy(() =>
      import('./BonesCapturePage').then((m) => ({ default: m.BonesItinerariesCapturePage })),
    )
  : null;
const BonesBillingPage = import.meta.env.DEV
  ? lazy(() => import('./BonesCapturePage').then((m) => ({ default: m.BonesBillingCapturePage })))
  : null;

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            index: true,
            handle: { layout: 'map', titleKey: 'routes.titles.home' } satisfies RouteLayoutHandle,
            element: <HomePage />,
          },
          {
            path: 'itineraries',
            handle: {
              layout: 'contained',
              titleKey: 'routes.titles.itineraries',
            } satisfies RouteLayoutHandle,
            element: <ItinerariesPage />,
          },
          {
            path: 'itineraries/:id',
            handle: {
              layout: 'contained',
              titleKey: 'routes.titles.itineraryDetail',
            } satisfies RouteLayoutHandle,
            element: <ItineraryDetailPage />,
          },
          {
            path: 'billing',
            handle: {
              layout: 'contained',
              titleKey: 'routes.titles.billing',
            } satisfies RouteLayoutHandle,
            element: <BillingPage />,
          },
          {
            path: 'billing/result',
            handle: {
              layout: 'contained',
              titleKey: 'routes.titles.billingResult',
            } satisfies RouteLayoutHandle,
            element: <BillingResultPage />,
          },
          {
            path: 'account',
            handle: {
              layout: 'contained',
              titleKey: 'routes.titles.account',
            } satisfies RouteLayoutHandle,
            element: <AccountPage />,
          },
        ],
      },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          {
            path: 'login',
            handle: { layout: 'auth', titleKey: 'routes.titles.login' } satisfies RouteLayoutHandle,
            element: <LoginPage />,
          },
          {
            path: 'register',
            handle: {
              layout: 'auth',
              titleKey: 'routes.titles.register',
            } satisfies RouteLayoutHandle,
            element: <RegisterPage />,
          },
          {
            path: 'verify-email',
            handle: {
              layout: 'auth',
              titleKey: 'routes.titles.verifyEmail',
            } satisfies RouteLayoutHandle,
            element: <VerifyEmailPage />,
          },
          {
            path: 'forgot-password',
            handle: {
              layout: 'auth',
              titleKey: 'routes.titles.forgotPassword',
            } satisfies RouteLayoutHandle,
            element: <ForgotPasswordPage />,
          },
        ],
      },
      ...(BonesCapturePage
        ? [{ path: '__bones/podium', element: <BonesCapturePage /> } satisfies RouteObject]
        : []),
      ...(BonesItinerariesPage
        ? [{ path: '__bones/itineraries', element: <BonesItinerariesPage /> } satisfies RouteObject]
        : []),
      ...(BonesBillingPage
        ? [{ path: '__bones/billing', element: <BonesBillingPage /> } satisfies RouteObject]
        : []),
      {
        path: 'reset-password',
        handle: {
          layout: 'auth',
          titleKey: 'routes.titles.resetPassword',
        } satisfies RouteLayoutHandle,
        element: <ResetPasswordPage />,
      },
      {
        path: '*',
        handle: { titleKey: 'routes.titles.notFound' } satisfies RouteLayoutHandle,
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
