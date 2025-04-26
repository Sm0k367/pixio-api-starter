// src/app/(app)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getUserCredits } from '@/lib/credits';
import { redirect } from 'next/navigation';
import { BookOpenText } from 'lucide-react'; // Use a relevant icon

import { BookGenerationForm } from '@/components/dashboard/book-generation-form';
import { BookLibrary } from '@/components/dashboard/book-library';
import { fetchUserBooks } from '@/lib/actions/book.actions'; // Use book action

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile, credits, and initial books concurrently
  const [profileResult, creditsResult, initialBooksResult] = await Promise.all([
    supabase.from('users').select('id, full_name').eq('id', user.id).single(),
    getUserCredits(),
    fetchUserBooks() // Fetch initial book data on the server
  ]);

  const profile = profileResult.data;
  const { total: totalCredits } = creditsResult;
  const initialBooks = initialBooksResult.success ? initialBooksResult.books : [];

  // Extract first name for greeting, default to 'Storyteller'
  const firstName = profile?.full_name?.split(' ')[0] || 'Storyteller';

  return (
    <div className="container mx-auto px-4 py-10 space-y-10">

      {/* Welcome Header - Ghibli Style */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 ghibli-title inline-block">
          Welcome back, {firstName}!
        </h1>
        <p className="text-xl ghibli-subtitle">
          Ready to create a magical storybook?
        </p>
      </div>

      {/* Book Generation Section */}
      {/* The Card component is now inside BookGenerationForm */}
      <BookGenerationForm
        userCredits={totalCredits}
        // onGenerationStart could be used to optimistically update UI if needed
      />

      {/* Book Library Section */}
      <BookLibrary initialBooks={initialBooks} />

    </div>
  );
}
