// src/lib/constants/book.constants.ts

import { BookStatus } from "@/types/db_types";

export const BOOK_GENERATION_COST = 250;

export const BOOK_STATUS_DISPLAY: Record<BookStatus, string> = {
  pending: "Pending",
  generating_text: "Generating Story",
  generating_images: "Generating Images",
  failed: "Failed",
  completed: "Finished",
};

export const BOOK_STATUS_COLORS: Record<BookStatus, string> = {
    pending: "bg-gray-500/20 text-gray-300 border-gray-600",
    generating_text: "bg-blue-500/20 text-blue-300 border-blue-600 animate-pulse",
    generating_images: "bg-purple-500/20 text-purple-300 border-purple-600 animate-pulse",
    failed: "bg-red-500/20 text-red-300 border-red-600",
    completed: "bg-green-500/20 text-green-300 border-green-600",
};

export const BOOK_LIBRARY_TABS = [
    { value: 'all', label: 'All Books' },
    { value: 'in_progress', label: 'In Progress' }, // Combines pending, generating_text, generating_images
    { value: 'completed', label: 'Finished' },
    { value: 'failed', label: 'Failed' },
] as const;

export type BookLibraryTabValue = typeof BOOK_LIBRARY_TABS[number]['value'];

