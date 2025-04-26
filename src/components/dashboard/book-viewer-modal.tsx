// src/components/dashboard/book-viewer-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
// Import BOTH types
import useEmblaCarousel, { UseEmblaCarouselType } from 'embla-carousel-react';
import type { EmblaCarouselType } from 'embla-carousel'; // Import core type
import { Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchBookById, BookWithPages } from '@/lib/actions/book.actions';
import { BookPageViewer } from '@/components/book/book-page-viewer';
import { toast } from 'sonner';

interface BookViewerModalProps {
  bookId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BookViewerModal({ bookId, isOpen, onClose }: BookViewerModalProps) {
  const [bookData, setBookData] = useState<BookWithPages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // emblaApi is of type UseEmblaCarouselType | undefined
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'center',
    containScroll: 'trimSnaps'
  });

  // --- Carousel Navigation ---
  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // --- Update selected index on scroll ---
  // FIX: Use the core EmblaCarouselType for the callback parameter
  const onSelect = useCallback((emblaApiInstance: EmblaCarouselType) => {
    // FIX: selectedScrollSnap() exists on the core type
    setSelectedIndex(emblaApiInstance.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    // FIX: The instance passed to onSelect initially IS the core type
    onSelect(emblaApi);

    // FIX: The event listeners receive the core EmblaCarouselType
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);

    // Cleanup function
    return () => {
      if (emblaApi) {
        emblaApi.off('select', onSelect);
        emblaApi.off('reInit', onSelect);
      }
    };
  }, [emblaApi, onSelect]); // emblaApi and onSelect are dependencies


  // --- Fetch Book Data ---
  useEffect(() => {
    if (isOpen && bookId) {
      setIsLoading(true);
      setError(null);
      setBookData(null);
      setSelectedIndex(0);

      const loadBook = async () => {
        console.log(`[Modal] Loading book data for ID: ${bookId}`);
        try {
          const result = await fetchBookById(bookId);
          console.log('[Modal] Raw fetch result:', result);

          if (result.success && result.book) {
            console.log(`[Modal] Book fetched successfully. Status: ${result.book.status}, Page count: ${result.book.pages?.length ?? 'undefined'}`);
            const processedBookData = {
                ...result.book,
                pages: Array.isArray(result.book.pages) ? result.book.pages : []
            };
            setBookData(processedBookData);
            console.log('[Modal] State set with book data. Pages array length:', processedBookData.pages.length);

             if (emblaApi) {
                 // Use requestAnimationFrame to ensure DOM is updated before reInit
                 requestAnimationFrame(() => {
                     requestAnimationFrame(() => { // Double RAF for extra safety
                         if (emblaApi) {
                             console.log('[Modal] Reinitializing Embla carousel...');
                             emblaApi.reInit();
                         }
                     });
                 });
             }
          } else {
            const errorMsg = result.error || 'Failed to load book data.';
            console.error('[Modal] Error loading book:', errorMsg);
            setError(errorMsg);
            toast.error(errorMsg);
          }
        } catch (err: any) {
          console.error('[Modal] Exception loading book:', err);
          setError('An unexpected error occurred while loading the book.');
          toast.error('An unexpected error occurred.');
        } finally {
          setIsLoading(false);
        }
      };
      loadBook();
    } else {
         setIsLoading(false);
         setError(null);
         setBookData(null);
         setSelectedIndex(0);
    }
  // Only run when isOpen or bookId changes. emblaApi change shouldn't trigger data refetch.
  }, [isOpen, bookId]);


  // Log bookData whenever it changes
  useEffect(() => {
      console.log('[Modal] bookData state updated:', bookData);
  }, [bookData]);

  // --- Keyboard Navigation ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || !emblaApi) return;
      if (event.key === 'ArrowLeft') scrollPrev();
      else if (event.key === 'ArrowRight') scrollNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, emblaApi, scrollPrev, scrollNext]);

  console.log('[Modal] Rendering. isLoading:', isLoading, 'error:', error, 'bookData exists:', !!bookData, 'pages count:', bookData?.pages?.length ?? 'N/A');

  const totalSlides = (bookData?.pages?.length ?? 0) + 1;

  const renderNoPagesMessage = () => {
      console.warn(`[Modal] Rendering "No pages found" slide. bookData.pages:`, bookData?.pages);
      return (
          <div className="text-center text-muted-foreground p-8">
              <p className="text-lg font-medium">No pages found for this book.</p>
              <p className="text-sm mt-2">(Status: {bookData?.status})</p>
          </div>
      );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="ghibli-dialog sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[90vh] flex flex-col p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-4 pb-2 border-b border-primary/10 relative">
          <DialogTitle className="text-xl text-primary/90 pr-10">
            {isLoading ? 'Loading Book...' : bookData?.title || 'Storybook Viewer'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pr-10">
            Use arrow keys or the buttons to navigate through the pages.
          </DialogDescription>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="flex-grow overflow-hidden p-1 md:p-2 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-destructive text-center p-6 z-20">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && bookData && (
            <div className="h-full w-full relative">
              <div className="embla h-full w-full" ref={emblaRef}>
                <div className="embla__container h-full flex">
                  {/* Cover Page Slide */}
                  <div className="embla__slide min-w-full h-full flex items-center justify-center p-2">
                    <BookPageViewer
                      page={{
                        type: 'cover',
                        url: bookData.cover_image_url,
                        prompt: bookData.cover_image_prompt
                      }}
                      pageNumberDisplay="Cover"
                    />
                  </div>

                  {/* Book Pages Slides */}
                  {Array.isArray(bookData.pages) && bookData.pages.length > 0 ? (
                    bookData.pages.map((page, index) => (
                      <div key={page.id || `page-${index}`} className="embla__slide min-w-full h-full flex items-center justify-center p-2">
                        <BookPageViewer
                          page={page}
                          pageNumberDisplay={`Page ${page.page_number}`}
                        />
                      </div>
                    ))
                  ) : (
                     <div className="embla__slide min-w-full h-full flex items-center justify-center p-2">
                       {renderNoPagesMessage()}
                     </div>
                  )}
                </div>
              </div>

              {/* Carousel Controls */}
              {totalSlides > 1 && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm disabled:opacity-30 z-10"
                        onClick={scrollPrev}
                        disabled={!emblaApi?.canScrollPrev()}
                        aria-label="Previous Page"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm disabled:opacity-30 z-10"
                        onClick={scrollNext}
                        disabled={!emblaApi?.canScrollNext()}
                        aria-label="Next Page"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </Button>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white/80 z-10">
                        {selectedIndex + 1} / {totalSlides}
                    </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
