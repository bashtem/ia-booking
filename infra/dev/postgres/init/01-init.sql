CREATE DATABASE ia_booking_test OWNER ia;

\connect ia_booking
CREATE EXTENSION IF NOT EXISTS btree_gist;

\connect ia_booking_test
CREATE EXTENSION IF NOT EXISTS btree_gist;
