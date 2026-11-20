import { lazy } from 'react';

// Plan 3: cada pantalla de acceso y cuenta es un chunk aparte (AppLayout pone el Suspense).
export const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
export const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
export const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'));
export const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
export const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'));
export const AccountPage = lazy(() => import('@/features/account/pages/AccountPage'));
// Plan 6: guardados (US-22 a US-24).
export const ItinerariesPage = lazy(() => import('@/features/itineraries/pages/ItinerariesPage'));
export const ItineraryDetailPage = lazy(() => import('./ItineraryDetailPage'));
// Plan 7: créditos y pagos (US-25 a US-30).
export const BillingPage = lazy(() => import('@/features/billing/pages/BillingPage'));
export const BillingResultPage = lazy(() => import('@/features/billing/pages/BillingResultPage'));
