# EducareHub Server 🚀

This is the backend server for **EducareHub**, a comprehensive e-learning platform. The server provides RESTful APIs to manage users, courses, and student enrollments. It is built using Node.js, Express.js, and MongoDB.

## 🔗 Live URL
> **[Insert Your Live Server URL Here]**

---

## 🛠️ Technologies Used

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (using Native Driver)
- **Authentication/Security:** CORS, Dotenv
- **Deployment:** Vercel

---

## ✨ Key Features

- **User Management:** Securely create and store user profiles.
- **Course Management:**
  - **Filter & Sort:** Filter courses by category and view featured courses.
  - **Instructor Dashboard:** Instructors can view, add, update, and delete their own courses.
  - **Dynamic Updates:** Real-time updates for course details (Price, Description, Image, etc.).
  - **Cascade Delete:** Deleting a course automatically removes all related enrollment records to maintain database integrity.
- **Enrollment System:**
  - Students can enroll in courses.
  - View personal enrollment history sorted by date.

---

## 📂 API Endpoints

### 🟢 **Root**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Health check (Returns server status) |

### 👤 **Users**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/users` | Create a new user (Prevents duplicates based on email) |

### 📚 **Courses**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/courses` | Get all courses. <br> **Query Params:** <br> `?category=Name` (Filter by category) <br> `?featured=true` (Get top 6 featured courses) |
| `GET` | `/courses/:id` | Get details of a single course by ID |
| `GET` | `/my-courses/:email` | Get courses added by a specific instructor |
| `POST` | `/courses` | Add a new course |
| `PUT` | `/courses/:id` | Update an existing course |
| `DELETE` | `/courses/:id` | Delete a course and its associated enrollments |

### 📝 **Enrollments**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/enrollments` | Enroll a student in a course |
| `GET` | `/my-enrollments/:email` | Get enrolled courses for a specific student |

---

## ⚙️ Environment Variables

To run this project locally, create a `.env` file in the root directory and add the following variables:

```env

DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
PORT=5000
DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
PORT=5000
