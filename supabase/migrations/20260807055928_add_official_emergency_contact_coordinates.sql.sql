-- Add GPS coordinates to official emergency contacts so the SOS system can
-- find the nearest authority by distance. Also adds regional police/hospital
-- contacts across Nepal for better nearest-authority matching.

-- National hotlines get a central Kathmandu coordinate as a fallback.
UPDATE public.emergency_contacts
  SET latitude = 27.7172, longitude = 85.3240
  WHERE phone IN ('100', '102', '111', '114') AND latitude IS NULL;

UPDATE public.emergency_contacts
  SET latitude = 27.6934, longitude = 85.3168
  WHERE name = 'Red Cross Nepal' AND latitude IS NULL;

-- Kathmandu hospitals
UPDATE public.emergency_contacts
  SET latitude = 27.7069, longitude = 85.3295
  WHERE name = 'Tribhuvan University Teaching Hospital' AND latitude IS NULL;

UPDATE public.emergency_contacts
  SET latitude = 27.6776, longitude = 85.3246
  WHERE name = 'Patan Hospital' AND latitude IS NULL;

UPDATE public.emergency_contacts
  SET latitude = 27.6806, longitude = 84.4340
  WHERE name = 'Bharatpur Hospital' AND latitude IS NULL;

UPDATE public.emergency_contacts
  SET latitude = 28.2096, longitude = 83.9856
  WHERE name = 'Pokhara Academy of Health Sciences' AND latitude IS NULL;

-- Regional police stations across Nepal
INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Pokhara Police', 'Police', '100', 'Pokhara', 28.2096, 83.9856, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Pokhara Police');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Lalitpur Police', 'Police', '100', 'Lalitpur', 27.6588, 85.3247, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Lalitpur Police');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Bharatpur Police', 'Police', '100', 'Chitwan', 27.6806, 84.4340, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Bharatpur Police');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Biratnagar Police', 'Police', '100', 'Biratnagar', 26.4525, 87.2718, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Biratnagar Police');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Birgunj Police', 'Police', '100', 'Birgunj', 27.0104, 84.8822, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Birgunj Police');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Nepalgunj Police', 'Police', '100', 'Nepalgunj', 28.0500, 81.6167, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Nepalgunj Police');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Dharan Police', 'Police', '100', 'Dharan', 26.8128, 87.2836, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Dharan Police');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Butwal Police', 'Police', '100', 'Butwal', 27.7006, 83.4484, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Butwal Police');

-- Regional hospitals
INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Biratnagar Provincial Hospital', 'Hospital', '021-460101', 'Biratnagar', 26.4720, 87.2880, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Biratnagar Provincial Hospital');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Nepalgunj Regional Hospital', 'Hospital', '081-520200', 'Nepalgunj', 28.0500, 81.6167, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Nepalgunj Regional Hospital');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Dharan BP Koirala Hospital', 'Hospital', '021-490101', 'Dharan', 26.8128, 87.2836, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Dharan BP Koirala Hospital');

-- Ambulance services with coordinates
INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Pokhara Ambulance', 'Ambulance', '102', 'Pokhara', 28.2096, 83.9856, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Pokhara Ambulance');

INSERT INTO public.emergency_contacts (name, role, phone, region, latitude, longitude, is_official)
SELECT 'Chitwan Ambulance', 'Ambulance', '102', 'Chitwan', 27.6806, 84.4340, true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Chitwan Ambulance');
