-- GymFlow V.1.062
-- Vincula la biblioteca importada con los GIFs alojados en Cloudinary.

update public.gf_exercises
set image_url = 'https://res.cloudinary.com/po0pnxfc/image/upload/' || library_codes[1]::text || '.gif'
where coalesce(array_length(library_codes, 1), 0) > 0
  and (image_url is null or btrim(image_url) = '');
