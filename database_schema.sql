-- Table Creation (SCHEMA)

-- 1. Users Table (Authentication & Roles)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin','manager','staff')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Cameras Table
CREATE TABLE cameras (
    camera_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    location VARCHAR(100),
    rtsp_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Shelves Table
CREATE TABLE shelves (
    shelf_id SERIAL PRIMARY KEY,
    shelf_name VARCHAR(50) NOT NULL,
    camera_id INT REFERENCES cameras(camera_id) ON DELETE SET NULL,
    location_description TEXT
);

-- 4. Products Table
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    image_url TEXT
);

-- 5. Images / Assets Table
CREATE TABLE images (
    asset_id SERIAL PRIMARY KEY,
    shelf_id INT REFERENCES shelves(shelf_id) ON DELETE CASCADE,
    product_id INT REFERENCES products(product_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    upload_time TIMESTAMP DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    metadata JSONB
);

-- 6. Stock Levels (Time-Series Table)
CREATE TABLE stock_levels (
    stock_id SERIAL PRIMARY KEY,
    shelf_id INT REFERENCES shelves(shelf_id) ON DELETE CASCADE,
    product_id INT REFERENCES products(product_id) ON DELETE CASCADE,
    stock_percentage NUMERIC(5,2) NOT NULL CHECK (stock_percentage BETWEEN 0 AND 100),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- 7. Alerts Table
CREATE TABLE alerts (
    alert_id SERIAL PRIMARY KEY,
    stock_id INT REFERENCES stock_levels(stock_id) ON DELETE CASCADE,
    alert_type VARCHAR(50),
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    acknowledged_at TIMESTAMP
);

-- 1. Users Table 
-- CREATE
INSERT INTO users (username, email, password_hash, role) 
VALUES ('john_doe', 'john@example.com', 'hashed_password', 'manager');

-- READ
SELECT * FROM users;

-- UPDATE
UPDATE users 
SET role = 'admin' 
WHERE username = 'john_doe';

-- DELETE
DELETE FROM users 
WHERE username = 'john_doe';

-- 2. Products Table 
-- CREATE
INSERT INTO products (name, category, image_url)
VALUES ('Banana', 'Fruit', 'banana.jpg'),
       ('Broccoli', 'Vegetable', 'broccoli.jpg');

-- READ
SELECT * FROM products;

-- UPDATE
UPDATE products 
SET category = 'Fresh Fruit' 
WHERE name = 'Banana';

-- DELETE
DELETE FROM products 
WHERE name = 'Broccoli';

-- 2. Products Table 
-- CREATE
INSERT INTO products (name, category, image_url)
VALUES ('Banana', 'Fruit', 'banana.jpg'),
       ('Broccoli', 'Vegetable', 'broccoli.jpg');

-- READ
SELECT * FROM products;

-- UPDATE
UPDATE products 
SET category = 'Fresh Fruit' 
WHERE name = 'Banana';

-- DELETE
DELETE FROM products 
WHERE name = 'Broccoli';

--  3. Cameras Table 
-- CREATE
INSERT INTO cameras (name, location, rtsp_url)
VALUES ('Camera 1', 'Aisle 1', 'rtsp://camera1/stream');

-- READ
SELECT * FROM cameras;

-- UPDATE
UPDATE cameras 
SET location = 'Aisle 2'
WHERE name = 'Camera 1';

-- DELETE
DELETE FROM cameras 
WHERE name = 'Camera 1';

--  4. Shelves Table 
-- CREATE
INSERT INTO shelves (shelf_name, camera_id, location_description)
VALUES ('Shelf A', 1, 'Near entrance');

-- READ
SELECT * FROM shelves;

-- UPDATE
UPDATE shelves 
SET location_description = 'Next to freezer'
WHERE shelf_name = 'Shelf A';

-- DELETE
DELETE FROM shelves 
WHERE shelf_name = 'Shelf A';

--  5. Images Table 
-- CREATE
INSERT INTO images (shelf_id, product_id, filename, processed, metadata)
VALUES (1, 1, 'banana_shelf1.jpg', false, '{"lighting": "good"}');

-- READ
SELECT * FROM images;

-- UPDATE
UPDATE images 
SET processed = true
WHERE filename = 'banana_shelf1.jpg';

-- DELETE
DELETE FROM images 
WHERE filename = 'banana_shelf1.jpg';

--  6. Stock Levels Table 
-- CREATE
INSERT INTO stock_levels (shelf_id, product_id, stock_percentage)
VALUES (1, 1, 75.5),
       (1, 2, 60.0);

-- READ
SELECT * FROM stock_levels;

-- UPDATE
UPDATE stock_levels 
SET stock_percentage = 80.0
WHERE shelf_id = 1 AND product_id = 1;

-- DELETE
DELETE FROM stock_levels 
WHERE shelf_id = 1 AND product_id = 2;

--  7. Alerts Table 
-- CREATE
INSERT INTO alerts (stock_id, alert_type, message)
VALUES (1, 'Low Stock', 'Banana stock below 20%');

-- READ
SELECT * FROM alerts;

-- UPDATE
UPDATE alerts 
SET acknowledged = true, acknowledged_at = NOW()
WHERE alert_id = 1;

-- DELETE
DELETE FROM alerts 
WHERE alert_id = 1;

