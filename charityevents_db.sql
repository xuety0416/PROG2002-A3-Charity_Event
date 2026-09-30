-- =====================================================================
-- PROG2002 Web Development II - Assessment 3
-- Case study : Charity Event (client-side + admin-side dynamic website)
-- File       : charityevents_db.sql
-- Purpose    : Complete database schema + sample data for the A3 project.
--              It extends the Assessment 2 schema with:
--                * latitude / longitude columns on charity_events
--                  (required by the optional Open-Meteo weather API)
--                * a new event_registrations table (Part 1 requirement)
--              The whole file can be imported in one go (MySQL 8).
-- Usage      : mysql -u root -p < charityevents_db.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS charityevents_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE charityevents_db;

-- Re-create the tables in a safe order (children first) so the script can be
-- re-run on an existing database without foreign-key errors.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS event_registrations;
DROP TABLE IF EXISTS charity_events;
DROP TABLE IF EXISTS event_categories;
DROP TABLE IF EXISTS charity_organisations;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. charity_organisations : the charity that owns / hosts the events
-- ---------------------------------------------------------------------
CREATE TABLE charity_organisations (
  organisation_id   INT PRIMARY KEY AUTO_INCREMENT,
  organisation_name VARCHAR(100) NOT NULL,
  mission           TEXT,
  contact_email     VARCHAR(100),
  contact_phone     VARCHAR(20)
);

-- ---------------------------------------------------------------------
-- 2. event_categories : lookup table used by the search filter
-- ---------------------------------------------------------------------
CREATE TABLE event_categories (
  category_id   INT PRIMARY KEY AUTO_INCREMENT,
  category_name VARCHAR(50) NOT NULL
);

-- ---------------------------------------------------------------------
-- 3. charity_events : master table of charity events
--    latitude / longitude were added in A3 so the details page can call the
--    external Open-Meteo API and show a weather forecast for the event day.
-- ---------------------------------------------------------------------
CREATE TABLE charity_events (
  event_id          INT PRIMARY KEY AUTO_INCREMENT,
  organisation_id   INT NOT NULL,
  category_id       INT NOT NULL,
  event_title       VARCHAR(150) NOT NULL,
  event_description TEXT,
  event_date        DATETIME NOT NULL,
  location          VARCHAR(150),
  latitude          DECIMAL(9,6),
  longitude         DECIMAL(9,6),
  ticket_price      DECIMAL(10,2) DEFAULT 0,
  fundraising_goal  DECIMAL(12,2),
  current_progress  DECIMAL(12,2) DEFAULT 0,
  is_suspended      BOOLEAN DEFAULT false,
  CONSTRAINT fk_event_org      FOREIGN KEY (organisation_id) REFERENCES charity_organisations(organisation_id),
  CONSTRAINT fk_event_category FOREIGN KEY (category_id)     REFERENCES event_categories(category_id)
);

-- ---------------------------------------------------------------------
-- 4. event_registrations : NEW in A3 (Part 1 requirement)
--    Records who registered for which event and how many tickets they bought.
--    Business rules enforced by the schema:
--      * One user (identified by attendee_email) may register for many events.
--      * A user can only register for the SAME event once -> the composite
--        UNIQUE key (event_id, attendee_email) guarantees this at DB level.
-- ---------------------------------------------------------------------
CREATE TABLE event_registrations (
  registration_id     INT PRIMARY KEY AUTO_INCREMENT,
  event_id            INT NOT NULL,
  attendee_name       VARCHAR(100) NOT NULL,
  attendee_email      VARCHAR(150) NOT NULL,
  contact_phone       VARCHAR(30),
  tickets_purchased   INT NOT NULL DEFAULT 1,
  total_amount        DECIMAL(10,2) DEFAULT 0,
  registration_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registration_status ENUM('Confirmed','Pending','Cancelled') NOT NULL DEFAULT 'Confirmed',
  CONSTRAINT fk_registration_event FOREIGN KEY (event_id) REFERENCES charity_events(event_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_registration_event_email UNIQUE (event_id, attendee_email)
);

-- =====================================================================
-- Sample data
-- =====================================================================

INSERT INTO charity_organisations
  (organisation_name, mission, contact_email, contact_phone)
VALUES
  ('City Community Charity',
   'Support local vulnerable groups and raise funds for community projects through charity events.',
   'info@citycharity.org', '0412345678');

INSERT INTO event_categories (category_name)
VALUES ('Fun Run'), ('Gala Dinner'), ('Silent Auction'), ('Charity Concert');

-- Events: upcoming (active), past and suspended, so the admin list can
-- demonstrate every possible status.
INSERT INTO charity_events
  (organisation_id, category_id, event_title, event_description, event_date,
   location, latitude, longitude, ticket_price, fundraising_goal, current_progress, is_suspended)
VALUES
  (1, 1, 'Community Fun Run',
   'A 5km community run to raise money for local children in need. All ages welcome and every entry includes a finisher medal.',
   '2026-10-12 09:00:00', 'Central Park', -33.888600, 151.204400, 0, 5000, 1200, false),
  (1, 2, 'Charity Gala Dinner',
   'A formal fundraising dinner with a three-course meal, live auction and guest speakers from the community.',
   '2026-10-18 18:30:00', 'City Hotel', -33.868800, 151.209300, 85, 12000, 4500, false),
  (1, 3, 'Silent Auction',
   'A silent auction featuring donated artworks, vouchers and memorabilia. Bidding closes at 4pm sharp.',
   '2026-10-22 14:00:00', 'Community Hall', -33.873100, 151.206500, 15, 8000, 3200, false),
  (1, 4, 'Charity Concert',
   'An evening of live music performed by local bands to raise funds for the community program.',
   '2026-10-25 19:00:00', 'Town Hall', -33.873100, 151.206300, 45, 10000, 6100, false),
  (1, 1, 'Autumn Fun Run',
   'A family friendly fun run around the lake with a shorter 2km course for younger participants.',
   '2026-11-05 08:30:00', 'Lake Park', -33.920000, 151.230000, 0, 4000, 900, false),
  (1, 2, 'Winter Charity Dinner',
   'A seasonal fundraising dinner celebrating local produce, with all proceeds supporting the winter appeal.',
   '2026-11-12 19:00:00', 'Harbour Restaurant', -33.856800, 151.215300, 95, 15000, 7800, false),
  (1, 3, 'Book Silent Auction',
   'A second hand book auction with thousands of donated titles across every genre.',
   '2026-11-18 10:00:00', 'Library', -33.865000, 151.209000, 5, 3000, 1100, false),
  (1, 4, 'Youth Charity Concert',
   'A youth band charity show supporting local music education programs.',
   '2026-11-20 18:00:00', 'School Hall', -33.890000, 151.220000, 30, 6000, 2400, false),
  (1, 1, 'Spring Fundraising Breakfast',
   'A community breakfast that kicked off the spring fundraising campaign.',
   '2026-09-20 07:30:00', 'Community Hall', -33.873100, 151.206500, 25, 3500, 3500, false),
  (1, 4, 'Winter Food Drive Concert',
   'A benefit concert held to support the winter food drive for families in need.',
   '2026-08-15 18:00:00', 'Town Hall', -33.873100, 151.206300, 20, 5000, 4200, false),
  (1, 1, 'Suspended Test Run',
   'This event has been suspended and is only kept for administrative testing.',
   '2026-12-01 09:00:00', 'Test Park', -33.900000, 151.200000, 0, 2000, 500, true);

-- Registrations (>= 10 records as required by Part 1).
-- Registration dates are intentionally different so the "sorted by latest
-- purchase date" feature on the event page is clearly visible.
INSERT INTO event_registrations
  (event_id, attendee_name, attendee_email, contact_phone, tickets_purchased, total_amount, registration_date, registration_status)
VALUES
  (2, 'Tianyu Xue',    'xty3488543330@qq.com',      '0412345678', 2, 170.00, '2026-09-28 10:15:00', 'Confirmed'),
  (2, 'Liwei Jin',     '1778257879@qq.com',         '0423456789', 4, 340.00, '2026-10-01 14:05:00', 'Confirmed'),
  (2, 'Emma Wilson',   'emma.wilson@example.com',   '0434567890', 1, 85.00,  '2026-10-03 09:40:00', 'Confirmed'),
  (2, 'Noah Brown',    'noah.brown@example.com',    '0445678901', 2, 170.00, '2026-10-05 20:10:00', 'Confirmed'),
  (3, 'Olivia Taylor', 'olivia.taylor@example.com', '0456789012', 3, 45.00,  '2026-09-30 11:20:00', 'Confirmed'),
  (3, 'Liam Martin',   'liam.martin@example.com',   '0467890123', 1, 15.00,  '2026-10-04 16:45:00', 'Pending'),
  (4, 'Sophia Lee',    'sophia.lee@example.com',    '0478901234', 2, 90.00,  '2026-10-02 08:30:00', 'Confirmed'),
  (4, 'Jack Anderson', 'jack.anderson@example.com', '0489012345', 5, 225.00, '2026-10-06 19:00:00', 'Confirmed'),
  (5, 'Mia Thomas',    'mia.thomas@example.com',    '0490123456', 2, 0.00,   '2026-10-06 12:00:00', 'Confirmed'),
  (6, 'William Clark', 'william.clark@example.com', '0401234567', 3, 285.00, '2026-10-07 10:25:00', 'Confirmed'),
  (6, 'Isabella Hall', 'isabella.hall@example.com', '0412340987', 1, 95.00,  '2026-10-08 15:50:00', 'Confirmed'),
  (7, 'James Young',   'james.young@example.com',   '0423451987', 6, 30.00,  '2026-10-08 18:05:00', 'Confirmed'),
  (8, 'Ava King',      'ava.king@example.com',      '0434562876', 2, 60.00,  '2026-10-09 09:15:00', 'Confirmed'),
  (1, 'Tianyu Xue',    'xty3488543330@qq.com',      '0412345678', 1, 0.00,   '2026-10-09 08:45:00', 'Confirmed');

-- =====================================================================
-- Quick verification query (optional - run manually after import)
-- =====================================================================
-- SELECT e.event_id, e.event_title, COUNT(r.registration_id) AS registrations
-- FROM charity_events e
-- LEFT JOIN event_registrations r ON e.event_id = r.event_id
-- GROUP BY e.event_id, e.event_title
-- ORDER BY e.event_id;
