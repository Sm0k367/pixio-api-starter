// src/components/book/book-page-viewer.tsx
import Image from 'next/image';
import { BookPage } from '@/types/db_types';
import { ImageIcon } from 'lucide-react';

interface BookPageViewerProps {
  page: BookPage | { type: 'cover'; url: string | null; prompt: string | null };
  pageNumberDisplay: string;
}

export function BookPageViewer({ page, pageNumberDisplay }: BookPageViewerProps) {
  const imageUrl = 'url' in page ? page.url : page.image_url;
  const text = 'text' in page ? page.text : null; // Cover doesn't have text

  return (
    <div className="flex flex-col h-full w-full p-4 items-center justify-center bg-gradient-to-br from-primary/5 via-secondary/5 to-background rounded-lg shadow-inner border border-white/10">
      {/* Image Area - Fixed height container */}
      <div className="relative w-full h-[60vh] mb-4 rounded-md overflow-hidden bg-black/10 border border-white/15 shadow-md flex items-center justify-center">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`Illustration for ${pageNumberDisplay}`}
            fill
            className="object-contain"
            unoptimized
            onError={(e) => {
              console.error(`Image failed to load: ${imageUrl}`);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="text-center text-muted-foreground/50">
            <ImageIcon className="h-16 w-16 mx-auto mb-2" />
            <p>Image not available</p>
          </div>
        )}
      </div>

      {/* Text Area */}
      {text && (
        <div className="w-full max-h-[20vh] overflow-y-auto text-center text-base md:text-lg text-foreground/90 leading-relaxed px-2">
          <p>{text}</p>
        </div>
      )}

      {/* Page Number Display */}
      <div className="absolute bottom-2 right-3 text-xs font-medium text-muted-foreground bg-black/30 px-2 py-0.5 rounded">
        {pageNumberDisplay}
      </div>
    </div>
  );
}
