import {
  AuthResponseSchema,
  CatalogResponseSchema,
  CompleteLessonResponseSchema,
  LessonDetailSchema,
  ProgressSummarySchema,
  HealthResponseSchema,
  UserSchema,
  type AuthResponse,
  type CatalogResponse,
  type CompleteLessonRequest,
  type CompleteLessonResponse,
  type LessonDetail,
  type ProgressSummary,
  type ForgotPasswordRequest,
  type HealthResponse,
  type LoginRequest,
  type RefreshRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type VerifyEmailRequest,
  type User,
} from '@kotgambit/contracts';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { EndpointBuilder } from '@reduxjs/toolkit/query';
import type { KotGambitBaseQuery } from './baseQuery.js';
import type { REDUCER_PATH, TagType } from './tags.js';

type Builder = EndpointBuilder<KotGambitBaseQuery, TagType, typeof REDUCER_PATH>;

/**
 * The endpoints shared by web and mobile. Each app passes them to its own `createApi`
 * (from `@reduxjs/toolkit/query/react`), which is how the React hooks get generated there.
 * Responses are validated against the contracts, a mismatch surfaces as a query error.
 */
export function endpoints(build: Builder) {
  return {
    health: build.query<HealthResponse, void>({
      query: () => '/health',
      responseSchema: HealthResponseSchema,
    }),
    register: build.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      responseSchema: AuthResponseSchema,
      invalidatesTags: ['Me'],
    }),
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      responseSchema: AuthResponseSchema,
      invalidatesTags: ['Me'],
    }),
    // Web ends the session through its cookie, mobile sends the refresh token it keeps
    logout: build.mutation<void, RefreshRequest | void>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', ...(body ? { body } : {}) }),
      invalidatesTags: ['Me'],
    }),
    forgotPassword: build.mutation<void, ForgotPasswordRequest>({
      query: (body) => ({ url: '/auth/password/forgot', method: 'POST', body }),
    }),
    resetPassword: build.mutation<void, ResetPasswordRequest>({
      query: (body) => ({ url: '/auth/password/reset', method: 'POST', body }),
    }),
    verifyEmail: build.mutation<void, VerifyEmailRequest>({
      query: (body) => ({ url: '/auth/email/verify', method: 'POST', body }),
      // The profile shows whether the address is confirmed
      invalidatesTags: ['Me'],
    }),
    resendVerification: build.mutation<void, void>({
      query: () => ({ url: '/auth/email/resend', method: 'POST' }),
    }),
    lessons: build.query<CatalogResponse, void>({
      query: () => '/lessons',
      responseSchema: CatalogResponseSchema,
      providesTags: ['Lessons'],
    }),
    lesson: build.query<LessonDetail, string>({
      query: (id) => `/lessons/${encodeURIComponent(id)}`,
      // The steps have defaults in the content schema: optional in a file, always present in a response.
      // Zod's input type therefore differs from the output type, while RTK Query wants one type for both.
      responseSchema: LessonDetailSchema as unknown as StandardSchemaV1<LessonDetail>,
    }),
    completeLesson: build.mutation<CompleteLessonResponse, CompleteLessonRequest & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `/lessons/${encodeURIComponent(id)}/complete`,
        method: 'POST',
        body,
      }),
      responseSchema: CompleteLessonResponseSchema,
      // Finishing a chapter opens the next one and moves the day bar
      invalidatesTags: ['Lessons', 'Progress'],
    }),
    progress: build.query<ProgressSummary, string>({
      query: (localDate) => `/progress/summary?localDate=${localDate}`,
      responseSchema: ProgressSummarySchema,
      providesTags: ['Progress'],
    }),
    me: build.query<User, void>({
      query: () => '/users/me',
      responseSchema: UserSchema,
      // Provided on failure too, so that signing in repeats a profile request that failed with 401
      providesTags: () => ['Me'],
    }),
  };
}
