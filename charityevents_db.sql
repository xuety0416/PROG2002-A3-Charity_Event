CREATE DATABASE IF NOT EXISTS charityevents_db;
USE charityevents_db;

-- 慈善机构表
CREATE TABLE charity_organisations (
  organisation_id INT PRIMARY KEY AUTO_INCREMENT,
  organisation_name VARCHAR(100) NOT NULL,
  mission TEXT,
  contact_email VARCHAR(100),
  contact_phone VARCHAR(20)
);

-- 活动分类表
CREATE TABLE event_categories (
  category_id INT PRIMARY KEY AUTO_INCREMENT,
  category_name VARCHAR(50) NOT NULL
);

-- 慈善活动主表
CREATE TABLE charity_events (
  event_id INT PRIMARY KEY AUTO_INCREMENT,
  organisation_id INT NOT NULL,
  category_id INT NOT NULL,
  event_title VARCHAR(150) NOT NULL,
  event_description TEXT,
  event_date DATETIME NOT NULL,
  location VARCHAR(150),
  ticket_price DECIMAL(10,2) DEFAULT 0,
  fundraising_goal DECIMAL(12,2),
  current_progress DECIMAL(12,2) DEFAULT 0,
  is_suspended BOOLEAN DEFAULT false,
  FOREIGN KEY (organisation_id) REFERENCES charity_organisations(organisation_id),
  FOREIGN KEY (category_id) REFERENCES event_categories(category_id)
);

-- 插入测试数据
INSERT INTO charity_organisations(organisation_name, mission, contact_email, contact_phone)
VALUES ('City Community Charity','Support local vulnerable groups','info@citycharity.org','0412345678');

INSERT INTO event_categories(category_name)
VALUES ('Fun Run'),('Gala Dinner'),('Silent Auction'),('Charity Concert');

INSERT INTO charity_events(organisation_id,category_id,event_title,event_description,event_date,location,ticket_price,fundraising_goal,current_progress,is_suspended)
VALUES
(1,1,'Community Fun Run','5km community run to raise money for kids','2026-10-12 09:00:00','Central Park',0,5000,1200,false),
(1,2,'Charity Gala Dinner','Formal dinner fundraising night','2026-10-18 18:30:00','City Hotel',85,12000,4500,false),
(1,3,'Silent Auction','Silent auction with donated artworks','2026-10-22 14:00:00','Community Hall',15,8000,3200,false),
(1,4,'Charity Concert','Live music charity performance','2026-10-25 19:00:00','Town Hall',45,10000,6100,false),
(1,1,'Autumn Fun Run','Family fun run event','2026-11-05 08:30:00','Lake Park',0,4000,900,false),
(1,2,'Winter Charity Dinner','Seasonal fundraising dinner','2026-11-12 19:00:00','Harbour Restaurant',95,15000,7800,false),
(1,3,'Book Silent Auction','Second hand book auction','2026-11-18 10:00:00','Library',5,3000,1100,false),
(1,4,'Youth Charity Concert','Youth band charity show','2026-11-20 18:00:00','School Hall',30,6000,2400,false),
(1,1,'Suspended Test Run','This event is suspended','2026-10-01 09:00:00','Test Park',0,2000,500,true);
