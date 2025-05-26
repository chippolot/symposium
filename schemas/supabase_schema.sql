-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  credits_balance INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Rooms table
CREATE TABLE public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_model TEXT DEFAULT 'host_pays' CHECK (payment_model IN ('host_pays', 'shared_pool', 'per_message')),
  ai_model TEXT DEFAULT 'gpt-4' CHECK (ai_model IN ('gpt-4', 'gpt-3.5-turbo', 'claude-3')),
  is_active BOOLEAN DEFAULT true,
  max_participants INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants table
CREATE TABLE public.participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(room_id, user_id)
);

-- Messages table
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room credits for shared pool model
CREATE TABLE public.room_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  contributor_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can view rooms they participate in" ON public.rooms
  FOR SELECT USING (
    id IN (
      SELECT room_id FROM public.participants 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Participants can view room participants" ON public.participants
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM public.participants 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Participants can view room messages" ON public.messages
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM public.participants 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Functions for real-time
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable real-time for tables (do this in Supabase dashboard instead)
-- Go to Database > Replication and enable for messages and participants tables