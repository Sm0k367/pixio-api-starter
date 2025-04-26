// src/components/dashboard/book-card.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Book, BookStatus } from '@/types/db_types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; // Assuming you have a Badge component
import { Eye, Share2, Trash2, Loader2, AlertTriangle, BookImage } from 'lucide-react';
import { BOOK_STATUS_DISPLAY, BOOK_STATUS_COLORS } from '@/lib/constants/book.constants';
import { BookViewerModal } from './book-viewer-modal'; // Create later
import { ShareBookModal } from './share-book-modal'; // Create later
import { DeleteBookDialog } from './delete-book-dialog'; // Create later

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const statusColor = BOOK_STATUS_COLORS[book.status] || BOOK_STATUS_COLORS.pending;
  const isProcessing = book.status === 'generating_text' || book.status === 'generating_images';
  const isActionable = book.status === 'completed' || book.status === 'failed';

  return (
    <>
      <motion.div
        whileHover={{ y: -5 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="h-full" // Ensure motion div takes full height
      >
        <Card className="ghibli-card h-full flex flex-col overflow-hidden border border-primary/10 shadow-lg hover:shadow-primary/20 transition-shadow duration-300 bg-gradient-to-br from-background via-primary/5 to-secondary/5">
          {/* Cover Image Area */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-b from-primary/10 to-secondary/10 flex items-center justify-center">
            {book.cover_image_url ? (
              <Image
                src={book.cover_image_url}
                alt={`Cover for ${book.title}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
                onError={(e) => { e.currentTarget.src = '/placeholder-cover.png'; }} // Fallback placeholder
              />
            ) : isProcessing ? (
               <Loader2 className="h-12 w-12 text-primary/50 animate-spin" />
            ) : book.status === 'failed' ? (
               <AlertTriangle className="h-12 w-12 text-destructive/50" />
            ): (
              // Placeholder for pending or other states
              <div className="text-center p-4 text-primary/40">
                 <BookImage className="h-16 w-16 mx-auto mb-2"/>
                 <p className="text-xs">Cover Pending</p>
              </div>
            )}
             {/* Status Badge */}
             <Badge
                 variant="outline"
                 className={`absolute top-2 right-2 text-xs font-medium backdrop-blur-sm border ${statusColor}`}
             >
                 {isProcessing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                 {BOOK_STATUS_DISPLAY[book.status]}
             </Badge>
          </div>

          {/* Content Area */}
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-lg font-semibold line-clamp-2 h-14 text-primary/95" title={book.title}>
              {book.title || "Untitled Book"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 flex-grow">
            <CardDescription className="text-sm line-clamp-3 h-[3.75rem] text-muted-foreground">
              {book.short_description || book.original_prompt || "No description available."}
            </CardDescription>
          </CardContent>

          {/* Footer Actions */}
          <CardFooter className="px-4 pb-4 pt-2 mt-auto border-t border-primary/10">
            <div className="flex w-full justify-between items-center gap-2">
               <span className="text-xs text-muted-foreground">
                   {new Date(book.created_at).toLocaleDateString()}
               </span>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  onClick={() => setIsViewModalOpen(true)}
                  disabled={book.status !== 'completed'}
                  title="View Book"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:bg-secondary/10 hover:text-secondary disabled:opacity-50"
                  onClick={() => setIsShareModalOpen(true)}
                  disabled={book.status !== 'completed'}
                  title="Share Book"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                 <Button
                   size="icon"
                   variant="ghost"
                   className="h-8 w-8 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                   onClick={() => setIsDeleteDialogOpen(true)}
                   title="Delete Book"
                 >
                   <Trash2 className="h-4 w-4" />
                 </Button>
              </div>
            </div>
          </CardFooter>
        </Card>
      </motion.div>

      {/* Modals and Dialogs */}
      {isViewModalOpen && book.status === 'completed' && (
        <BookViewerModal
          bookId={book.id}
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
        />
      )}
      {isShareModalOpen && book.status === 'completed' && (
        <ShareBookModal
          bookId={book.id}
          bookTitle={book.title}
          currentShareId={book.share_id}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
       {isDeleteDialogOpen && (
         <DeleteBookDialog
             bookId={book.id}
             bookTitle={book.title}
             isOpen={isDeleteDialogOpen}
             onClose={() => setIsDeleteDialogOpen(false)}
         />
       )}
    </>
  );
}

// You might need to create a simple Badge component if not using shadcn/ui's one
// Example basic Badge component:
// src/components/ui/badge.tsx
/*
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
export { Badge, badgeVariants }
*/

