CREATE TABLE
    IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email   VARCHAR(100)    UNIQUE,
        password VARCHAR(64) NOT NULL,
        role ENUM ('user', 'businessOwner', 'moderator', 'admin') DEFAULT 'user',
        token VARCHAR(64)
    );

CREATE TABLE
    IF NOT EXISTS places (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        lat DECIMAL(9,6) NULL,
        lon DECIMAL(9,6) NULL,
        owner_id INT,
        FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
    );

-- Таблица отзывов
CREATE TABLE IF NOT EXISTS reviews (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  place_id  INT NOT NULL,
  user_id   INT NOT NULL,
  text      TEXT NOT NULL,
  created_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  CONSTRAINT fk_reviews_place  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user   FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Нужные индексы
CREATE INDEX idx_reviews_place_id ON reviews(place_id);
CREATE INDEX idx_reviews_user_id  ON reviews(user_id);