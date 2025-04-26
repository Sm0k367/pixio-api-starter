-- schema.sql

-- Drop existing types and tables if they exist (for clean setup)
DROP TABLE IF EXISTS public.generated_media CASCADE;
DROP TABLE IF EXISTS public.credit_usage CASCADE;
DROP TABLE IF EXISTS public.credit_purchases CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.prices CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TYPE IF EXISTS public.subscription_status;
DROP TYPE IF EXISTS public.pricing_type;
DROP TYPE IF EXISTS public.pricing_plan_interval;
DROP TYPE IF EXISTS public.book_status; -- NEW

-- Create ENUM types
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');
CREATE TYPE public.pricing_type AS ENUM ('one_time', 'recurring');
CREATE TYPE public.pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');
CREATE TYPE public.book_status AS ENUM ('pending', 'generating_text', 'generating_images', 'failed', 'completed'); -- NEW

-- USERS Table: Stores public user profile information and credits.
CREATE TABLE public.users (
 id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text,
 avatar_url text,
 billing_address jsonb,
 payment_method jsonb,
 -- Credit System Fields
 subscription_credits INTEGER DEFAULT 0 NOT NULL,
 purchased_credits INTEGER DEFAULT 0 NOT NULL,
 last_credits_reset_date TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON public.users FOR SELECT USING (true);
CREATE POLICY "Can update own user data." ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Can view own user data." ON public.users FOR SELECT USING (auth.uid() = id);

-- Function to automatically create a public user profile when a new auth user signs up
-- Initializes credits (e.g., 250 for one free book)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 INSERT INTO public.users (id, full_name, avatar_url, subscription_credits, purchased_credits, last_credits_reset_date)
 VALUES (
   new.id,
   new.raw_user_meta_data->>'full_name',
   new.raw_user_meta_data->>'avatar_url',
   250, -- Initial credits (cost of one book)
   0,   -- Start with zero purchased credits
   timezone('utc'::text, now())
 );
 RETURN new;
END;
$$;

-- Trigger the function after user creation
CREATE TRIGGER on_auth_user_created
 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CUSTOMERS Table: Maps Supabase auth users to Stripe customer IDs. (Accessed via service_role)
CREATE TABLE public.customers (
 id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 stripe_customer_id text UNIQUE
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- No policies needed if accessed only via service_role key.

-- PRODUCTS Table: Stores product information synced from Stripe.
CREATE TABLE public.products (
 id text PRIMARY KEY, -- Stripe Product ID
 active boolean,
 name text,
 description text,
 image text,          -- Stripe Product Image URL
 metadata jsonb
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON public.products FOR SELECT USING (true);

-- PRICES Table: Stores price information synced from Stripe.
CREATE TABLE public.prices (
 id text PRIMARY KEY, -- Stripe Price ID
 product_id text REFERENCES public.products(id) ON DELETE CASCADE,
 active boolean,
 description text,
 unit_amount bigint, -- Amount in cents/smallest currency unit
 currency text CHECK (char_length(currency) = 3),
 type public.pricing_type,
 interval public.pricing_plan_interval,
 interval_count integer,
 trial_period_days integer,
 metadata jsonb
);
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON public.prices FOR SELECT USING (true);

-- SUBSCRIPTIONS Table: Stores user subscription information synced from Stripe.
CREATE TABLE public.subscriptions (
 id text PRIMARY KEY, -- Stripe Subscription ID
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status public.subscription_status,
 metadata jsonb,
 price_id text REFERENCES public.prices(id),
 quantity integer,
 cancel_at_period_end boolean,
 created timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
 current_period_start timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
 current_period_end timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
 ended_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
 cancel_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
 canceled_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
 trial_start timestamp with time zone DEFAULT timezone('utc'::text, now()),
 trial_end timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own subscription data." ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- CREDIT PURCHASES Table: Records one-time credit pack purchases
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  price_id TEXT NOT NULL, -- Stripe Price ID of the credit pack
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own credit purchases" ON public.credit_purchases FOR SELECT USING (auth.uid() = user_id);

-- CREDIT USAGE Table: Records when credits are spent
CREATE TABLE public.credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Amount of credits used (should be positive, represents cost)
  description TEXT, -- Description of usage (e.g., "Generated book: Sunny's Smile")
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own credit usage" ON public.credit_usage FOR SELECT USING (auth.uid() = user_id);

-- BOOKS Table: Stores information about each generated children's book
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_prompt TEXT, -- The user's initial idea/prompt
  short_description TEXT, -- For sharing/opengraph meta tags
  cover_image_prompt TEXT,
  cover_image_url TEXT, -- Public URL from storage for the cover
  cover_storage_path TEXT, -- Path in storage for the cover image
  status public.book_status NOT NULL DEFAULT 'pending',
  share_id TEXT UNIQUE, -- Unique ID for public sharing link (e.g., nanoid)
  credits_cost INTEGER NOT NULL DEFAULT 250,
  error_message TEXT, -- Store error details if status is 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own books" ON public.books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own books" ON public.books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own books" ON public.books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own books" ON public.books FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public can view shared books" ON public.books FOR SELECT USING (share_id IS NOT NULL); -- Allows reading if share_id exists

-- BOOK PAGES Table: Stores the text and image details for each page of a book
CREATE TABLE public.book_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text TEXT,
  image_prompt TEXT,
  image_url TEXT, -- Public URL from storage for the page image
  storage_path TEXT, -- Path in storage for the page image
  generation_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed (for individual image)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (book_id, page_number) -- Ensure page numbers are unique per book
);
ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;
-- Users can manage pages belonging to their own books
CREATE POLICY "Users can manage pages for their own books" ON public.book_pages
  FOR ALL -- SELECT, INSERT, UPDATE, DELETE
  USING (auth.uid() = (SELECT user_id FROM public.books WHERE id = book_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.books WHERE id = book_id));
-- Allow public read access to pages of a shared book
CREATE POLICY "Public can view pages of shared books" ON public.book_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.books
      WHERE public.books.id = public.book_pages.book_id AND public.books.share_id IS NOT NULL
    )
  );

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for books table
CREATE TRIGGER update_books_updated_at
BEFORE UPDATE ON public.books
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for book_pages table
CREATE TRIGGER update_book_pages_updated_at
BEFORE UPDATE ON public.book_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
ALTER PUBLICATION supabase_realtime ADD TABLE public.book_pages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_usage; -- Ensure this is enabled if not already
ALTER PUBLICATION supabase_realtime ADD TABLE public.users; -- Ensure this is enabled if not already

-- Create indexes for faster lookups
CREATE INDEX idx_books_user_id ON public.books(user_id);
CREATE INDEX idx_books_share_id ON public.books(share_id);
CREATE INDEX idx_book_pages_book_id ON public.book_pages(book_id);

ALTER TABLE public.book_pages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Function to get a specific book with its pages, checking ownership
CREATE OR REPLACE FUNCTION get_book_with_pages(requested_book_id uuid)
RETURNS json -- Returns a single JSON object containing the book and its pages
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Runs with the privileges of the function owner (usually postgres)
AS $$
DECLARE
  result json;
  requesting_user_id uuid := auth.uid(); -- Get the ID of the user making the request
  target_book record;
BEGIN
  -- First, check if the requesting user owns the book
  SELECT * INTO target_book
  FROM public.books
  WHERE id = requested_book_id AND user_id = requesting_user_id;

  -- If the book is not found or not owned by the user, return null
  IF NOT FOUND THEN
    RAISE WARNING '[get_book_with_pages] Book % not found or user % does not own it.', requested_book_id, requesting_user_id;
    RETURN NULL;
  END IF;

  -- If ownership is confirmed, fetch the book and its pages as JSON
  SELECT json_build_object(
    'book', to_jsonb(b),
    'pages', COALESCE(
      (SELECT json_agg(to_jsonb(p) ORDER BY p.page_number)
       FROM public.book_pages p
       WHERE p.book_id = b.id),
      '[]'::json -- Return empty array if no pages found
    )
  )
  INTO result
  FROM public.books b
  WHERE b.id = requested_book_id;

  -- Log the count of pages found within the function
  RAISE LOG '[get_book_with_pages] Found % pages for book %.', json_array_length(result->'pages'), requested_book_id;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_book_with_pages(uuid) TO authenticated;

-- Function to get a specific PUBLIC book with its pages via share_id
CREATE OR REPLACE FUNCTION get_book_with_pages_public(requested_share_id text)
RETURNS json -- Returns a single JSON object containing the book and its pages
LANGUAGE plpgsql
SECURITY DEFINER -- Run with higher privileges to read any completed, shared book
AS $$
DECLARE
  result json;
  target_book record;
BEGIN
  -- Find the book by share_id, ensuring it's completed
  SELECT * INTO target_book
  FROM public.books
  WHERE share_id = requested_share_id AND status = 'completed'; -- Check status here

  -- If the book is not found or not completed/shared, return null
  IF NOT FOUND THEN
    RAISE WARNING '[get_book_with_pages_public] Shared book % not found or not completed.', requested_share_id;
    RETURN NULL;
  END IF;

  -- Fetch the book and its pages as JSON
  SELECT json_build_object(
    'book', to_jsonb(b),
    'pages', COALESCE(
      (SELECT json_agg(to_jsonb(p) ORDER BY p.page_number)
       FROM public.book_pages p
       WHERE p.book_id = b.id),
      '[]'::json
    )
  )
  INTO result
  FROM public.books b
  WHERE b.id = target_book.id; -- Use the found book's ID

  RAISE LOG '[get_book_with_pages_public] Found % pages for shared book %.', json_array_length(result->'pages'), requested_share_id;

  RETURN result;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_book_with_pages_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_book_with_pages_public(text) TO authenticated;
