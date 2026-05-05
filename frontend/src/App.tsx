import { Route, Routes } from 'react-router-dom'

import { AdminRoute } from '@/components/auth/AdminRoute'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AuthSplitShell } from '@/components/auth/AuthSplitShell'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { AdminBookNewPage } from '@/pages/admin/AdminBookNewPage'
import { AdminBookReviewPage } from '@/pages/admin/AdminBookReviewPage'
import { AdminBooksListPage } from '@/pages/admin/AdminBooksListPage'
import { useThemePreference } from '@/hooks/useThemePreference'
import { AppHomePage } from '@/pages/AppHomePage'
import { BookDetailPage } from '@/pages/BookDetailPage'
import { BooksLibraryPage } from '@/pages/BooksLibraryPage'
import { ChapterReaderPage } from '@/pages/ChapterReaderPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProgressPage } from '@/pages/ProgressPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SignupPage } from '@/pages/SignupPage'

export default function App() {
  useThemePreference()

  return (
    <Routes>
      <Route element={<AuthSplitShell />}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/app" element={<AppHomePage />} />
          <Route path="/app/books" element={<BooksLibraryPage />} />
          <Route path="/app/books/:bookSlug" element={<BookDetailPage />} />
          <Route path="/app/books/:bookSlug/chapters/:chapterNumber" element={<ChapterReaderPage />} />
          <Route path="/app/books/:bookSlug/chapters/:chapterNumber/summary" element={<ChapterReaderPage />} />
          <Route path="/app/books/:bookSlug/chapters/:chapterNumber/quiz" element={<ChapterReaderPage />} />
          <Route path="/app/progress" element={<ProgressPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/books" element={<AdminBooksListPage />} />
            <Route path="/admin/books/new" element={<AdminBookNewPage />} />
            <Route path="/admin/books/:bookId/review" element={<AdminBookReviewPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
