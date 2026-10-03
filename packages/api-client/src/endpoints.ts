import {
  ActiveGameSchema,
  SettingsSchema,
  WardrobeSchema,
  CheckoutResponseSchema,
  EntitlementsSchema,
  PaymentStatusSchema,
  PlansResponseSchema,
  SubscriptionViewSchema,
  CardAnswerResponseSchema,
  CardSummarySchema,
  MakeCardsResponseSchema,
  NextCardSchema,
  ProfileSchema,
  PositionAnalysisSchema,
  ReviewStatusSchema,
  AuthResponseSchema,
  BotListSchema,
  CatalogResponseSchema,
  CompleteLessonResponseSchema,
  DailyPuzzleSchema,
  GameHintResponseSchema,
  GameMoveResponseSchema,
  GameSchema,
  LessonDetailSchema,
  ProgressSummarySchema,
  HealthResponseSchema,
  PuzzleGiveUpResponseSchema,
  PuzzleHintResponseSchema,
  PuzzleMoveResponseSchema,
  PuzzleSchema,
  PuzzleStatsSchema,
  PuzzleThemeListSchema,
  UserSchema,
  type ActiveGame,
  type Settings,
  type SetAccessoryRequest,
  type UpdateSettingsRequest,
  type Wardrobe,
  type CheckoutRequest,
  type CheckoutResponse,
  type Entitlements,
  type PaymentStatus,
  type PlansResponse,
  type SubscriptionView,
  type CardAnswerResponse,
  type CardSummary,
  type MakeCardsResponse,
  type NextCard,
  type Profile,
  type PositionAnalysis,
  type ReviewStatus,
  type AuthResponse,
  type BotList,
  type CatalogResponse,
  type CompleteLessonRequest,
  type CompleteLessonResponse,
  type CreateGameRequest,
  type DailyPuzzle,
  type Game,
  type GameHintResponse,
  type GameMoveResponse,
  type LessonDetail,
  type NextPuzzleRequest,
  type ProgressSummary,
  type Puzzle,
  type PuzzleGiveUpResponse,
  type PuzzleHintResponse,
  type PuzzleMoveResponse,
  type PuzzleStats,
  type PuzzleThemeList,
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

function finishedGameTags(game: Game | undefined): ('Games' | 'Progress')[] {
  return game?.status === 'finished' ? ['Games', 'Progress'] : [];
}

function movedGameTags(response: GameMoveResponse | undefined): ('Games' | 'Progress')[] {
  return finishedGameTags(response?.result === 'ok' ? response.game : undefined);
}

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
    // A request that starts a puzzle changes the server (it opens an attempt), so it is a mutation
    nextPuzzle: build.mutation<Puzzle, NextPuzzleRequest>({
      query: (body) => ({ url: '/puzzles/next', method: 'POST', body }),
      responseSchema: PuzzleSchema,
    }),
    puzzleMove: build.mutation<PuzzleMoveResponse, { attemptId: string; move: string }>({
      query: ({ attemptId, move }) => ({
        url: `/puzzles/attempts/${encodeURIComponent(attemptId)}/move`,
        method: 'POST',
        body: { move },
      }),
      responseSchema: PuzzleMoveResponseSchema,
      // A summary comes only when the rating was settled, and then the stats and the catalog are out of date
      invalidatesTags: (result) =>
        result && 'summary' in result && result.summary ? ['Puzzles'] : [],
    }),
    puzzleHint: build.mutation<PuzzleHintResponse, string>({
      query: (attemptId) => ({
        url: `/puzzles/attempts/${encodeURIComponent(attemptId)}/hint`,
        method: 'POST',
      }),
      responseSchema: PuzzleHintResponseSchema,
      invalidatesTags: (result) =>
        result && result.level === 3 && result.summary ? ['Puzzles'] : [],
    }),
    puzzleGiveUp: build.mutation<PuzzleGiveUpResponse, string>({
      query: (attemptId) => ({
        url: `/puzzles/attempts/${encodeURIComponent(attemptId)}/give-up`,
        method: 'POST',
      }),
      responseSchema: PuzzleGiveUpResponseSchema,
      invalidatesTags: (result) => (result?.summary ? ['Puzzles'] : []),
    }),
    puzzleStats: build.query<PuzzleStats, void>({
      query: () => '/puzzles/stats',
      responseSchema: PuzzleStatsSchema,
      providesTags: ['Puzzles'],
    }),
    puzzleThemes: build.query<PuzzleThemeList, void>({
      query: () => '/puzzles/themes',
      responseSchema: PuzzleThemeListSchema,
      providesTags: ['Puzzles'],
    }),
    dailyPuzzle: build.query<DailyPuzzle, string>({
      query: (localDate) => `/puzzles/daily?localDate=${localDate}`,
      responseSchema: DailyPuzzleSchema,
      providesTags: ['Puzzles'],
    }),
    bots: build.query<BotList, void>({
      query: () => '/bots',
      responseSchema: BotListSchema,
    }),
    // Starting a game changes the server, so it is a mutation, like starting a puzzle
    createGame: build.mutation<Game, CreateGameRequest>({
      query: (body) => ({ url: '/games', method: 'POST', body }),
      responseSchema: GameSchema,
      invalidatesTags: ['Games'],
    }),
    activeGame: build.query<ActiveGame, void>({
      query: () => '/games/active',
      responseSchema: ActiveGameSchema,
      providesTags: ['Games'],
    }),
    game: build.query<Game, string>({
      query: (gameId) => `/games/${encodeURIComponent(gameId)}`,
      responseSchema: GameSchema,
      providesTags: ['Games'],
    }),
    gameMove: build.mutation<GameMoveResponse, { gameId: string; move: string }>({
      query: ({ gameId, move }) => ({
        url: `/games/${encodeURIComponent(gameId)}/moves`,
        method: 'POST',
        body: { move },
      }),
      responseSchema: GameMoveResponseSchema,
      // The end of a game brings XP to the day, which the path and the profile show
      invalidatesTags: (result) => movedGameTags(result),
    }),
    // The bot's move when it did not come with the learner's, the engine was busy
    gameBotMove: build.mutation<GameMoveResponse, string>({
      query: (gameId) => ({ url: `/games/${encodeURIComponent(gameId)}/bot-move`, method: 'POST' }),
      responseSchema: GameMoveResponseSchema,
      invalidatesTags: (result) => movedGameTags(result),
    }),
    gameHint: build.mutation<GameHintResponse, string>({
      query: (gameId) => ({ url: `/games/${encodeURIComponent(gameId)}/hint`, method: 'POST' }),
      responseSchema: GameHintResponseSchema,
    }),
    gameUndo: build.mutation<Game, string>({
      query: (gameId) => ({ url: `/games/${encodeURIComponent(gameId)}/undo`, method: 'POST' }),
      responseSchema: GameSchema,
    }),
    gameResign: build.mutation<Game, string>({
      query: (gameId) => ({ url: `/games/${encodeURIComponent(gameId)}/resign`, method: 'POST' }),
      responseSchema: GameSchema,
      invalidatesTags: (result) => finishedGameTags(result),
    }),
    // Looking at a position changes nothing on the server, but each look is a search of the engine,
    // so it is a mutation: it must run when asked, not when a component mounts
    analyzePosition: build.mutation<PositionAnalysis, string>({
      query: (fen) => ({ url: '/analysis/position', method: 'POST', body: { fen } }),
      responseSchema: PositionAnalysisSchema,
    }),
    startReview: build.mutation<ReviewStatus, string>({
      query: (gameId) => ({ url: `/games/${encodeURIComponent(gameId)}/review`, method: 'POST' }),
      responseSchema: ReviewStatusSchema,
      invalidatesTags: ['Reviews'],
    }),
    // The screen polls it with `pollingInterval` while the status is pending or running
    review: build.query<ReviewStatus, string>({
      query: (gameId) => `/games/${encodeURIComponent(gameId)}/review`,
      responseSchema: ReviewStatusSchema,
      providesTags: ['Reviews'],
    }),
    profile: build.query<Profile, string>({
      query: (localDate) => `/profile?localDate=${localDate}`,
      responseSchema: ProfileSchema,
      providesTags: ['Progress', 'Cards'],
    }),
    cardSummary: build.query<CardSummary, void>({
      query: () => '/cards/summary',
      responseSchema: CardSummarySchema,
      providesTags: ['Cards'],
    }),
    // Taking a card to repeat does not change it, but it is a request that must run when asked
    nextCard: build.mutation<NextCard, void>({
      query: () => ({ url: '/cards/next', method: 'POST' }),
      responseSchema: NextCardSchema,
    }),
    answerCard: build.mutation<CardAnswerResponse, { cardId: string; move: string }>({
      query: ({ cardId, move }) => ({
        url: `/cards/${encodeURIComponent(cardId)}/answer`,
        method: 'POST',
        body: { move },
      }),
      responseSchema: CardAnswerResponseSchema,
      // An answer moves the day's XP and the number of cards that are due
      invalidatesTags: (result) =>
        result && result.result !== 'illegal' ? ['Cards', 'Progress'] : [],
    }),
    makeCards: build.mutation<MakeCardsResponse, string>({
      query: (gameId) => ({
        url: `/games/${encodeURIComponent(gameId)}/review/cards`,
        method: 'POST',
      }),
      responseSchema: MakeCardsResponseSchema,
      invalidatesTags: ['Cards'],
    }),
    plans: build.query<PlansResponse, void>({
      query: () => '/billing/plans',
      responseSchema: PlansResponseSchema,
    }),
    subscription: build.query<SubscriptionView, void>({
      query: () => '/billing/subscription',
      responseSchema: SubscriptionViewSchema,
      providesTags: ['Billing'],
    }),
    // What the learner may do and what is left of today's limits, the screens show it before they ask
    entitlements: build.query<Entitlements, void>({
      query: () => '/entitlements',
      responseSchema: EntitlementsSchema,
      providesTags: ['Billing', 'Puzzles'],
    }),
    // Starting a payment creates one at the provider, so it is a mutation
    checkout: build.mutation<CheckoutResponse, CheckoutRequest>({
      query: (body) => ({ url: '/billing/checkout', method: 'POST', body }),
      responseSchema: CheckoutResponseSchema,
    }),
    // Polled by the page the learner comes back to. Only the server's answer counts, never the return itself
    payment: build.query<PaymentStatus, string>({
      query: (paymentId) => `/billing/payments/${encodeURIComponent(paymentId)}`,
      responseSchema: PaymentStatusSchema,
    }),
    cancelSubscription: build.mutation<SubscriptionView, void>({
      query: () => ({ url: '/billing/cancel', method: 'POST' }),
      responseSchema: SubscriptionViewSchema,
      invalidatesTags: ['Billing'],
    }),
    resumeSubscription: build.mutation<SubscriptionView, void>({
      query: () => ({ url: '/billing/resume', method: 'POST' }),
      responseSchema: SubscriptionViewSchema,
      invalidatesTags: ['Billing'],
    }),
    settings: build.query<Settings, void>({
      query: () => '/users/me/settings',
      responseSchema: SettingsSchema,
      providesTags: ['Settings'],
    }),
    updateSettings: build.mutation<Settings, UpdateSettingsRequest>({
      query: (body) => ({ url: '/users/me/settings', method: 'PATCH', body }),
      responseSchema: SettingsSchema,
      // The goal changes the day bar and the name changes the profile and the avatar
      invalidatesTags: ['Settings', 'Progress', 'Me'],
    }),
    // Puts an item of the wardrobe on the cat: the profile shows what is open, the profile of the account says what is worn
    setAccessory: build.mutation<Wardrobe, SetAccessoryRequest>({
      query: (body) => ({ url: '/profile/accessory', method: 'PUT', body }),
      responseSchema: WardrobeSchema,
      invalidatesTags: ['Me', 'Progress'],
    }),
    // Final: the screen asks the learner to type the word first, and signs out afterwards
    deleteAccount: build.mutation<undefined, void>({
      query: () => ({ url: '/users/me', method: 'DELETE' }),
    }),
    me: build.query<User, void>({
      query: () => '/users/me',
      responseSchema: UserSchema,
      // Provided on failure too, so that signing in repeats a profile request that failed with 401
      providesTags: () => ['Me'],
    }),
  };
}
