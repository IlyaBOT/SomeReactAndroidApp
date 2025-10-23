CREATE TABLE
    IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(64) NOT NULL,
        role ENUM ('user', 'businessOwner', 'moderator', 'admin') DEFAULT 'user',
        token VARCHAR(64)
    );

CREATE TABLE
    IF NOT EXISTS places (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        owner_id INT,
        FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
    );