-- Fix stale Apple CDN URL for MacBook Pro template
-- The image_url was pointing to Apple's CDN which returns 404 due to hotlink protection
-- Update to use the local image we already have in /public/cpq/macbook-pro/

UPDATE product_templates 
SET image_url = '/cpq/macbook-pro/macbook_pro_hero.png'
WHERE image_url LIKE '%store.storeimages.cdn-apple.com%'
  AND name ILIKE '%macbook%';
