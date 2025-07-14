-- Run all producer portal related migrations
-- Execute this file in your PostgreSQL database

-- 1. Producer portal foundation
\i migrations/013_producer_portal_foundation_postgres.sql

-- 2. Add producer portal permissions
\i migrations/014_create_permissions_and_add_producer_portal.sql

-- 3. Extend custom routes for producers
\i migrations/015_extend_custom_routes_for_producers.sql

-- 4. Add rating type columns to LOB (if not already run)
\i migrations/018_add_rating_type_to_lob.sql

-- 5. Add rater file columns to LOB
\i migrations/019_add_rater_file_to_lob.sql