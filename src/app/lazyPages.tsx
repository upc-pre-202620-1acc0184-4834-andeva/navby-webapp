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
