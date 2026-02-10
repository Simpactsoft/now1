
-- Create set_config RPC function
CREATE OR REPLACE FUNCTION public.set_config(name text, value text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(name, value, false);
END;
$$;
