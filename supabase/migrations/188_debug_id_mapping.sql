
-- Migration: 188_debug_id_mapping.sql
-- Description: Join Auth Users to Profiles BY ID to see what RootLayout sees.

SELECT 
    u.id AS auth_id,
    u.email AS auth_email,
    p.id AS profile_id,
    p.email AS profile_email,
    p.first_name,
    p.last_name,
    p.role
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE u.email ILIKE '%sales%';
