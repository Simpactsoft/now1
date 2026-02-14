-- בדיקה: האם הפונקציה custom_access_token_hook קיימת?

SELECT 
  routine_name,
  routine_schema,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'custom_access_token_hook'
AND routine_schema = 'public';

-- אם זה מחזיר שורה - הפונקציה קיימת
-- אם זה ריק - צריך ליצור אותה מחדש
