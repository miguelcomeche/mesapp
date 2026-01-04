-- Create reservation_source enum
CREATE TYPE public.reservation_source AS ENUM ('manual', 'phone', 'walkin', 'covermanager', 'restoo');

-- Add pending_confirmation to reservation_status enum
ALTER TYPE public.reservation_status ADD VALUE 'pending_confirmation' AFTER 'pending';

-- Add source column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN source reservation_source NOT NULL DEFAULT 'manual';