// src/components/dashboard/book-library.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, BookImage, BookX, BookCheck, Library } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { BookCard } from './book-card';
import { fetchUserBooks, checkBookStatus } from '@/lib/actions/book.actions';
import { Book, BookStatus } from '@/types/db_types';
import { BOOK_LIBRARY_TABS, BookLibraryTabValue } from '@/lib/constants/book.constants';

interface BookLibraryProps {
  initialBooks?: Book[];
}

export function BookLibrary({ initialBooks = [] }: BookLibraryProps) {
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [loading, setLoading] = useState(false); // Start with false since we have initialBooks
  const [activeTab, setActiveTab] = useState<BookLibraryTabValue>('all');
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const supabase = createClient();
  const userIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasLoadedBooksRef = useRef(initialBooks.length > 0);

  // A single effect that handles user auth and book loading
  useEffect(() => {
    const setupComponent = async () => {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;
      userIdRef.current = userId;
      
      // Only load books if we don't have initialBooks and have a userId
      if (!hasLoadedBooksRef.current && userId) {
        setLoading(true);
        try {
          console.log("BookLibrary: Fetching books...");
          const result = await fetchUserBooks();
          if (result.success) {
            const fetchedBooks = result.books ?? [];
            setBooks(fetchedBooks);
            hasLoadedBooksRef.current = true;
            
            // Start polling for books in progress
            fetchedBooks.forEach(book => {
              if (['pending', 'generating_text', 'generating_images'].includes(book.status)) {
                startPolling(book.id);
              }
            });
          } else {
            toast.error(result.error || 'Failed to load books');
          }
        } catch (error) {
          console.error('Error loading books:', error);
          toast.error('Failed to load book library');
        } finally {
          setLoading(false);
        }
      } else if (initialBooks.length > 0) {
        // If we have initialBooks, check if any need polling
        initialBooks.forEach(book => {
          if (['pending', 'generating_text', 'generating_images'].includes(book.status)) {
            startPolling(book.id);
          }
        });
      }
      
      // Setup Realtime if we have a userId
      if (userId) {
        setupRealtime(userId);
      }
    };
    
    setupComponent();
    
    return () => {
      cleanupResources();
    };
  }, []); // Empty dependency array - only run once on mount
  
  // --- Cleanup function ---
  const cleanupResources = useCallback(() => {
    // Clean up Realtime subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).catch(err => 
        console.error("Error removing channel:", err)
      );
      channelRef.current = null;
    }
    
    // Clean up polling intervals
    Object.entries(pollingIntervalsRef.current).forEach(([bookId, interval]) => {
      console.log(`Cleaning up interval for book ${bookId}`);
      clearInterval(interval);
    });
    pollingIntervalsRef.current = {};
  }, [supabase]);

  // --- Polling Logic ---
  const stopPolling = useCallback((bookId: string) => {
    if (pollingIntervalsRef.current[bookId]) {
      console.log(`[Book: ${bookId}] Stopping polling.`);
      clearInterval(pollingIntervalsRef.current[bookId]);
      delete pollingIntervalsRef.current[bookId];
    }
  }, []);

  const pollStatus = useCallback(async (bookId: string) => {
    try {
      const result = await checkBookStatus(bookId);
      if (result.success && result.data) {
        setBooks(currentBooks =>
          currentBooks.map(book =>
            book.id === bookId
              ? {
                  ...book,
                  status: result.data!.overallStatus,
                  error_message: result.data!.error ?? null
                }
              : book
          )
        );

        if (result.data.overallStatus === 'completed' || result.data.overallStatus === 'failed') {
          stopPolling(bookId);
        }
      } else if (!result.success && result.error === 'Book not found or access denied.') {
        stopPolling(bookId);
      } else if (!result.success) {
        console.error(`[Book: ${bookId}] Error polling status: ${result.error}`);
      }
    } catch (error) {
      console.error(`[Book: ${bookId}] Exception during polling:`, error);
    }
  }, [stopPolling]);

  const startPolling = useCallback((bookId: string) => {
    // Don't start polling if it's already polling
    if (pollingIntervalsRef.current[bookId]) {
      return;
    }
    
    console.log(`[Book: ${bookId}] Starting polling.`);
    
    // First poll immediately
    pollStatus(bookId);
    
    // Then set up interval
    pollingIntervalsRef.current[bookId] = setInterval(() => pollStatus(bookId), 7000);
  }, [pollStatus]);

  // --- Realtime Setup --- 
  const setupRealtime = useCallback((userId: string) => {
    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).catch(
        err => console.error("Error removing existing channel:", err)
      );
      channelRef.current = null;
    }
    
    console.log(`BookLibrary: Setting up Realtime for user ${userId}`);
    
    const channel = supabase
      .channel(`books-updates-for-${userId}`)
      .on<Book>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'books',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('BookLibrary: Realtime payload received:', payload);
          const newBook = payload.new as Book;
          const oldBook = payload.old as Book & { id: string };
          const eventType = payload.eventType;

          setBooks((currentBooks) => {
            let updatedBooks = [...currentBooks];
            const existingIndex = updatedBooks.findIndex(b => b.id === (newBook?.id || oldBook?.id));

            if (eventType === 'INSERT') {
              if (existingIndex === -1) {
                updatedBooks = [newBook, ...updatedBooks];
                console.log(`BookLibrary: Inserted new book ${newBook.id}`);
                if (['pending', 'generating_text', 'generating_images'].includes(newBook.status)) {
                  startPolling(newBook.id);
                }
              }
            } else if (eventType === 'UPDATE') {
              if (existingIndex !== -1) {
                updatedBooks[existingIndex] = newBook;
                console.log(`BookLibrary: Updated book ${newBook.id}, Status: ${newBook.status}`);
                if (['completed', 'failed'].includes(newBook.status)) {
                  stopPolling(newBook.id);
                } else if (['pending', 'generating_text', 'generating_images'].includes(newBook.status)) {
                  startPolling(newBook.id);
                }
              } else {
                updatedBooks = [newBook, ...updatedBooks];
                console.log(`BookLibrary: Received update for unknown book ${newBook.id}, inserting.`);
                if (['pending', 'generating_text', 'generating_images'].includes(newBook.status)) {
                  startPolling(newBook.id);
                }
              }
            } else if (eventType === 'DELETE') {
              if (oldBook?.id) {
                updatedBooks = updatedBooks.filter(b => b.id !== oldBook.id);
                console.log(`BookLibrary: Deleted book ${oldBook.id}`);
                stopPolling(oldBook.id);
              } else {
                console.warn("BookLibrary: Received DELETE event without old record ID.");
              }
            }
            return updatedBooks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`BookLibrary: Realtime channel SUBSCRIBED for user ${userId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('BookLibrary: Realtime channel error:', err);
          toast.error('Realtime connection error. Library might not update automatically.');
        }
        if (status === 'TIMED_OUT') {
          console.warn('BookLibrary: Realtime connection timed out.');
        }
      });

    channelRef.current = channel;
  }, [supabase, startPolling, stopPolling]);

  // --- Filtering Logic ---
  const inProgressStatuses: BookStatus[] = ['pending', 'generating_text', 'generating_images'];
  const filteredBooks = books.filter(book => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in_progress') return inProgressStatuses.includes(book.status);
    return book.status === activeTab;
  });

  // --- Render ---
  return (
    <div className="mt-12 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-semibold flex items-center gap-2 text-primary/90">
          <Library className="w-7 h-7" />
          My Storybooks
        </h2>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as BookLibraryTabValue)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-4 bg-primary/5 border border-primary/10 p-1 rounded-lg backdrop-blur-sm shadow-inner">
            {BOOK_LIBRARY_TABS.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="ghibli-tab-trigger text-sm sm:text-base"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <AnimatePresence>
          {filteredBooks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <Card className="ghibli-card border-dashed border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                   {activeTab === 'all' && <BookImage className="h-16 w-16 text-secondary/50 mb-4" />}
                   {activeTab === 'in_progress' && <Loader2 className="h-16 w-16 text-secondary/50 mb-4 animate-spin" />}
                   {activeTab === 'completed' && <BookCheck className="h-16 w-16 text-secondary/50 mb-4" />}
                   {activeTab === 'failed' && <BookX className="h-16 w-16 text-secondary/50 mb-4" />}

                  <h3 className="text-xl font-medium mb-2 text-foreground/90">
                    {activeTab === 'all' ? 'No storybooks created yet' : `No ${activeTab.replace('_', ' ')} books`}
                  </h3>
                  <p className="text-muted-foreground max-w-md">
                    {activeTab === 'all'
                      ? "Use the form above to create your first magical storybook!"
                      : `You don't have any books currently in the '${activeTab.replace('_', ' ')}' state.`}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filteredBooks.map((book, index) => (
                 <motion.div
                    key={book.id}
                    layoutId={book.id}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="h-full"
                 >
                    <BookCard book={book} />
                 </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
