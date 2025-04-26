// src/lib/actions/book.actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { Book, BookPage, BookStatus, Json } from '@/types/db_types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { nanoid } from 'nanoid';
import { getURL } from '@/lib/utils';

// --- Types ---
export type BookWithPages = Book & {
  pages: BookPage[];
};

export type BookProgressStatus = {
  overallStatus: Book['status'];
  message: string;
  progressPercentage: number;
  currentPage?: number;
  totalPages?: number;
  coverStatus?: string;
  pageStatuses?: { [pageNumber: number]: string };
  error?: string | null;
};

// --- Helper: Fetch and Sort Book Pages ---
async function fetchAndSortBookPages(bookId: string): Promise<{
  success: boolean;
  pages: BookPage[];
  error?: string
}> {
  try {
    console.log(`[Helper fetchAndSortBookPages] Fetching pages for book ${bookId}...`);
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('book_pages')
      .select('*')
      .eq('book_id', bookId)
      .order('page_number', { ascending: true });

    if (pagesError) {
      console.error(`[Helper fetchAndSortBookPages] Error fetching pages for book ${bookId}:`, pagesError);
      return { success: false, pages: [], error: `Database error fetching pages: ${pagesError.message}` };
    }

    if (!pages || pages.length === 0) {
      console.warn(`[Helper fetchAndSortBookPages] No pages found in DB for book ${bookId}.`);
      return { success: true, pages: [] };
    }

    const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);
    console.log(`[Helper fetchAndSortBookPages] Retrieved and sorted ${sortedPages.length} pages for book ${bookId}.`);
    return { success: true, pages: sortedPages };

  } catch (error: any) {
    console.error(`[Helper fetchAndSortBookPages] Unexpected error for book ${bookId}:`, error);
    return { success: false, pages: [], error: `Failed to fetch book pages: ${error.message}` };
  }
}


// --- Generate Book Action ---
export async function generateBook(
  formData: FormData
): Promise<{ success: boolean; bookId?: string; error?: string; message?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  const story_idea = formData.get('story_idea') as string;

  if (!story_idea || typeof story_idea !== 'string' || story_idea.trim().length === 0) {
    return { success: false, error: 'Please provide a story idea.' };
  }

  try {
    console.log(`Action: Invoking generate-book function for user ${user.id}`);
    const { data, error: functionError } = await supabase.functions.invoke(
      'generate-book', // Ensure this matches your deployed function name
      {
        body: { story_idea },
      }
    );

    if (functionError) {
      console.error('Error invoking generate-book function:', functionError);
      let errorMessage = functionError.message;
      if (functionError.context && typeof functionError.context === 'object' && 'error' in functionError.context) {
           const contextError = (functionError.context as any).error;
           if (typeof contextError === 'string') errorMessage = contextError;
      }
       if (functionError.context?.status === 402) {
            const bookId = functionError.context?.bookId;
            return { success: false, error: 'Insufficient credits.', ...(bookId && { bookId }) };
       }
      return { success: false, error: `Failed to start book generation: ${errorMessage}` };
    }

    console.log('generate-book function invocation response:', data);

    if (data?.success && data?.bookId) {
      revalidatePath('/dashboard');
      return { success: true, bookId: data.bookId, message: data.message || "Book generation started." };
    } else {
      return { success: false, error: data?.error || 'Unknown error from generation function.' };
    }

  } catch (error: any) {
    console.error('Error in generateBook action:', error);
    return { success: false, error: `An unexpected error occurred: ${error.message}` };
  }
}

// --- Check Book Status / Progress ---
export async function checkBookStatus(bookId: string): Promise<{ success: boolean; data?: BookProgressStatus; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };
    if (!bookId) return { success: false, error: 'Book ID is required.' };

    try {
        const { data: book, error: bookError } = await supabase
            .from('books')
            .select('*')
            .eq('id', bookId)
            .eq('user_id', user.id)
            .single();

        if (bookError || !book) {
            return { success: false, error: 'Book not found or access denied.' };
        }

        const { data: pages, error: pagesError } = await supabaseAdmin
            .from('book_pages')
            .select('page_number, generation_status')
            .eq('book_id', bookId)
            .order('page_number', { ascending: true });

        if (pagesError) {
            console.error(`Error fetching pages for book ${bookId}:`, pagesError);
             return { success: true, data: {
                overallStatus: book.status,
                message: `Current status: ${book.status}. Error loading page details.`,
                progressPercentage: 0,
                error: book.error_message
            }};
        }

        let message = `Status: ${book.status}`;
        let progressPercentage = 0;
        let currentPage: number | undefined = undefined;
        const totalPagesWithImages = (pages?.length || 0) + 1;
        let completedImages = 0;
        const pageStatuses: { [pageNumber: number]: string } = {};
        let coverStatus = 'pending';

        const bookMetadata = book.metadata as { cover_run_id?: string; cover_error?: string; [key: string]: any } | null;

        if (book.cover_storage_path && book.cover_image_url) {
            coverStatus = 'completed';
            completedImages++;
        } else if (bookMetadata?.cover_run_id && !bookMetadata?.cover_error) {
             coverStatus = 'processing';
        } else if (bookMetadata?.cover_error) {
             coverStatus = 'failed';
        } else if (['generating_images', 'completed', 'failed'].includes(book.status)) {
             coverStatus = book.status === 'generating_images' ? 'processing' : 'pending';
        }

        if (book.status === 'generating_text') {
            progressPercentage = 10;
            message = "Generating story text...";
        } else if (['generating_images', 'completed', 'failed'].includes(book.status)) {
             if (coverStatus === 'processing') {
                 message = "Generating cover image...";
                 currentPage = -1;
             }

            pages?.forEach(page => {
                pageStatuses[page.page_number] = page.generation_status;
                if (page.generation_status === 'completed') {
                    completedImages++;
                } else if (page.generation_status === 'processing' && currentPage === undefined) {
                    currentPage = page.page_number;
                    message = `Generating image for page ${currentPage}...`;
                } else if (page.generation_status === 'failed' && !message.includes("Failed")) {
                     message = `Failed generating image for page ${page.page_number}.`;
                }
            });

             if (currentPage === undefined && coverStatus === 'processing' && !message.includes("cover")) {
                 message = "Generating cover image...";
                 currentPage = -1;
             }

            progressPercentage = 10 + Math.round((completedImages / totalPagesWithImages) * 90);

             if (book.status === 'completed') {
                 message = "Book generation complete!";
                 progressPercentage = 100;
             } else if (book.status === 'failed' && !message.includes("Failed")) {
                 message = `Book generation failed: ${book.error_message || 'Unknown reason'}`;
                 progressPercentage = Math.max(10, progressPercentage);
             } else if (book.status === 'generating_images' && currentPage === undefined && coverStatus !== 'processing') {
                 message = "Preparing image generation...";
             }
        } else if (book.status === 'pending') {
            message = "Generation pending...";
            progressPercentage = 0;
        }

        progressPercentage = Math.max(0, Math.min(100, progressPercentage));

        const progressData: BookProgressStatus = {
            overallStatus: book.status,
            message: message,
            progressPercentage: progressPercentage,
            currentPage: currentPage,
            totalPages: totalPagesWithImages,
            coverStatus: coverStatus,
            pageStatuses: pageStatuses,
            error: book.error_message
        };

        return { success: true, data: progressData };

    } catch (error: any) {
        console.error(`Error checking status for book ${bookId}:`, error);
        return { success: false, error: `Failed to check book status: ${error.message}` };
    }
}

// --- Fetch User Books ---
export async function fetchUserBooks(): Promise<{ success: boolean; books?: Book[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { success: false, error: 'Unauthorized', books: [] };

  try {
    const { data, error } = await supabase.from('books').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, books: data || [] };
  } catch (error: any) {
    console.error('Error fetching user books:', error);
    return { success: false, error: `Failed to fetch books: ${error.message}`, books: [] };
  }
}

// --- Fetch Single Book (for viewing/sharing) ---
export async function fetchBookById(bookId: string): Promise<{ success: boolean; book?: BookWithPages; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };
    if (!bookId) return { success: false, error: 'Book ID is required.' };

    console.log(`[Action fetchBookById] Calling RPC get_book_with_pages for book ${bookId}`);

    try {
        // Call the database function
        // FIX: Ensure RPC function name matches exactly what's in the DB and generated types
        const { data, error: rpcError } = await supabase.rpc('get_book_with_pages', {
            requested_book_id: bookId
        });

        if (rpcError) {
            console.error(`[Action fetchBookById] RPC error for book ${bookId}:`, rpcError);
            throw new Error(`Database function error: ${rpcError.message}`);
        }

        if (data === null) {
             console.warn(`[Action fetchBookById] RPC returned null for book ${bookId}. Book not found or access denied.`);
             return { success: false, error: 'Book not found or access denied.' };
        }

        // Type assertion might be needed if types aren't perfectly inferred after generation
        const resultData = data as { book: Book; pages: BookPage[] };

        if (!resultData || !resultData.book || !Array.isArray(resultData.pages)) {
            console.error(`[Action fetchBookById] Invalid data structure received from RPC for book ${bookId}:`, resultData);
            throw new Error('Invalid data structure received from database function.');
        }

        const bookWithPages: BookWithPages = {
            ...resultData.book,
            pages: resultData.pages
        };

        console.log(`[Action fetchBookById] RPC successful. Returning book with ${bookWithPages.pages.length} pages.`);
        return { success: true, book: bookWithPages };

    } catch (error: any) {
        console.error(`[Action fetchBookById] Unexpected error fetching book ${bookId}:`, error);
        return { success: false, error: `Failed to fetch book details: ${error.message}` };
    }
}


// --- Delete Book ---
export async function deleteBook(bookId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { success: false, error: 'Unauthorized' };
  if (!bookId) return { success: false, error: 'Book ID is required.' };

  try {
    const { data: bookData, error: fetchError } = await supabaseAdmin
      .from('books').select('id, user_id, cover_storage_path').eq('id', bookId).single();
    if (fetchError || !bookData) return { success: false, error: 'Book not found.' };
    if (bookData.user_id !== user.id) return { success: false, error: 'Permission denied.' };

    const { data: pagePaths, error: pathError } = await supabaseAdmin
        .from('book_pages').select('storage_path').eq('book_id', bookId).not('storage_path', 'is', null);
     if (pathError) console.error(`Error fetching page storage paths for book ${bookId}:`, pathError);

    const pathsToDelete: string[] = [];
    if (bookData.cover_storage_path) pathsToDelete.push(bookData.cover_storage_path);
    if (pagePaths) pagePaths.forEach(p => { if (p.storage_path) pathsToDelete.push(p.storage_path); });

    if (pathsToDelete.length > 0) {
        console.log(`Deleting ${pathsToDelete.length} files from storage for book ${bookId}...`);
        const { data: deleteData, error: storageError } = await supabaseAdmin
            .storage.from('book-images').remove(pathsToDelete);
        if (storageError) console.error(`Storage deletion error for book ${bookId}:`, storageError);
        else console.log(`Storage deletion successful for book ${bookId}. Files deleted:`, deleteData?.length);
    }

    const { error: dbError } = await supabaseAdmin.from('books').delete().eq('id', bookId);
    if (dbError) throw new Error(`Database deletion failed: ${dbError.message}`);

    console.log(`Successfully deleted book ${bookId} and associated data.`);
    revalidatePath('/dashboard');
    return { success: true };

  } catch (error: any) {
    console.error(`Error deleting book ${bookId}:`, error);
    return { success: false, error: `Failed to delete book: ${error.message}` };
  }
}

// --- Share Book ---
export async function shareBook(bookId: string): Promise<{ success: boolean; shareUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { success: false, error: 'Unauthorized' };
  if (!bookId) return { success: false, error: 'Book ID is required.' };

  try {
     const { data: bookOwner, error: ownerError } = await supabase
       .from('books').select('id').eq('id', bookId).eq('user_id', user.id).maybeSingle();
     if (ownerError || !bookOwner) return { success: false, error: 'Book not found or permission denied.' };

    const share_id = nanoid(10);
    const { error: updateError } = await supabaseAdmin.from('books').update({ share_id: share_id }).eq('id', bookId);

    if (updateError) {
      if (updateError.code === '23505') return { success: false, error: 'Could not generate unique share link, please try again.' };
      throw new Error(`Failed to update book with share ID: ${updateError.message}`);
    }

    const shareUrl = `${getURL()}/book/${share_id}`;
    revalidatePath('/dashboard');
    return { success: true, shareUrl };

  } catch (error: any) {
    console.error(`Error sharing book ${bookId}:`, error);
    return { success: false, error: `Failed to share book: ${error.message}` };
  }
}


// --- Fetch Shared Book Data ---
export async function getBookByShareId(shareId: string): Promise<{ success: boolean; book?: BookWithPages; error?: string }> {
    if (!shareId) return { success: false, error: 'Share ID is required.' };

    console.log(`[Action getBookByShareId] Calling RPC get_book_with_pages_public for shareId ${shareId}`);

    try {
        // FIX: Ensure RPC function name matches exactly what's in the DB and generated types
        const { data, error: rpcError } = await supabaseAdmin.rpc('get_book_with_pages_public', {
            requested_share_id: shareId
        });

        if (rpcError) {
            console.error(`[Action getBookByShareId] RPC error for shareId ${shareId}:`, rpcError);
            throw new Error(`Database function error: ${rpcError.message}`);
        }

        if (data === null) {
             console.warn(`[Action getBookByShareId] RPC returned null for shareId ${shareId}. Book not found, not completed, or not shared.`);
             return { success: false, error: 'Shared book not found or not ready.' };
        }

        const resultData = data as { book: Book; pages: BookPage[] };

        if (!resultData || !resultData.book || !Array.isArray(resultData.pages)) {
            console.error(`[Action getBookByShareId] Invalid data structure received from RPC for shareId ${shareId}:`, resultData);
            throw new Error('Invalid data structure received from database function.');
        }

        const bookWithPages: BookWithPages = {
            ...resultData.book,
            pages: resultData.pages
        };

        console.log(`[Action getBookByShareId] RPC successful for shareId ${shareId}. Returning book with ${bookWithPages.pages.length} pages.`);
        return { success: true, book: bookWithPages };

    } catch (error: any) {
        console.error(`[Action getBookByShareId] Unexpected error fetching shared book ${shareId}:`, error);
        return { success: false, error: `Failed to fetch shared book: ${error.message}` };
    }
}


// --- Admin: Diagnose Book Issues ---
export async function diagnoseBookIssues(bookId: string): Promise<{
  success: boolean;
  diagnosis?: {
    bookExists: boolean;
    bookStatus: string;
    hasCoverImage: boolean;
    pageCount: number;
    pagesWithoutImages: number;
    recommendation: string;
  };
  error?: string
}> {
  try {
    const { data: book, error: bookError } = await supabaseAdmin.from('books').select('*').eq('id', bookId).single();
    if (bookError) return { success: false, error: `Book not found: ${bookError.message}` };

    const { data: pages, error: pagesError, count } = await supabaseAdmin.from('book_pages').select('*', { count: 'exact' }).eq('book_id', bookId);
    if (pagesError) return { success: false, error: `Could not fetch pages: ${pagesError.message}` };

    const pageCount = count ?? 0;
    const pagesWithoutImages = pages?.filter(p => !p.image_url).length || 0;
    let recommendation = "Book appears normal.";

    if (book.status === 'completed' && pageCount === 0) recommendation = "Book is marked as completed but has no pages. Consider regenerating.";
    else if (book.status === 'completed' && pagesWithoutImages > 0) recommendation = `Book is marked as completed but has ${pagesWithoutImages} pages without images. Consider regenerating.`;
    else if (book.status === 'failed') recommendation = `Book failed generation with error: ${book.error_message || 'Unknown error'}`;

    return {
      success: true,
      diagnosis: {
        bookExists: true,
        bookStatus: book.status,
        hasCoverImage: !!book.cover_image_url,
        pageCount: pageCount,
        pagesWithoutImages,
        recommendation
      }
    };
  } catch (error: any) {
    // FIX: Added return statement in catch block
    console.error(`Error running diagnostics for book ${bookId}:`, error);
    return { success: false, error: `Error running diagnostics: ${error.message}` };
  }
}

// --- Regenerate Book Pages ---
export async function regenerateBookPages(bookId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  if (!bookId) return { success: false, error: 'Book ID is required' };

  try {
    const { data: book, error: bookError } = await supabase.from('books').select('*').eq('id', bookId).eq('user_id', user.id).single();
    if (bookError || !book) return { success: false, error: 'Book not found or access denied' };

    // Placeholder - Actual regeneration logic needed here
    return { success: false, error: "Regeneration feature not yet implemented. Please delete the book and create a new one instead." };
  } catch (error: any) {
    // FIX: Corrected catch block syntax
    console.error(`Error in regenerateBookPages for ${bookId}:`, error);
    return { success: false, error: `Failed to regenerate book pages: ${error.message}` };
  }
}
