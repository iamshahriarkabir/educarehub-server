require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;




const app = express();
const port = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: (origin, callback) => {
    // !origin allows requests from non-browser sources (like Postman) or same-origin
    if (!origin || [
      "http://localhost:5173",
      "https://educarehub-5b51c.web.app",
      "https://educarehub-5b51c.firebaseapp.com"
    ].includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin); // ডিবাগিং এর জন্য
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


// MongoDB Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@z4tech.as3lfup.mongodb.net/?appName=Z4Tech`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // --- Database Collections ---
    const database = client.db("educareHubDB");
    const courseCollection = database.collection("courses");
    const enrollmentCollection = database.collection("enrollments");
    const userCollection = database.collection("users");

    // ==========================================================
    //                  AUTH & SECURITY MIDDLEWARE
    // ==========================================================

    // Custom Middleware: Verify Token
    const verifyToken = (req, res, next) => {
      const token = req.cookies?.token;
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decoded;
        next();
      });
    };

    // 1. Create JWT Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // 2. Logout
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // ==========================================================
    //                     USER API (UPDATED)
    // ==========================================================

    // Save User (Register)
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Get User Role (For Hooks)
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    // --- NEW: Get All Users (Admin Only - simplified logic for now) ---
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // --- NEW: Update User Role (Make Admin/Instructor) ---
    app.patch("/users/role/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // ==========================================================
    //                     COURSE API
    // ==========================================================

    // GET all courses
    app.get("/courses", async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 10;
      const search = req.query.search || "";
      const category = req.query.category || "";
      const sort = req.query.sort || "createdAt";
      const isFeatured = req.query.featured === "true";

      let query = {
        title: { $regex: search, $options: "i" },
      };

      if (category && category !== "All") {
        query.category = category;
      }
      if (isFeatured) {
        query.isFeatured = true;
      }

      let sortOptions = { createdAt: -1 };
      if (sort === "price-asc") sortOptions = { price: 1 };
      if (sort === "price-desc") sortOptions = { price: -1 };

      const cursor = courseCollection
        .find(query)
        .sort(sortOptions)
        .skip(page * size)
        .limit(size);

      const result = await cursor.toArray();
      res.send(result);
    });

    // GET Total Count
    app.get("/courses-count", async (req, res) => {
      const search = req.query.search || "";
      const category = req.query.category || "";

      let query = {
        title: { $regex: search, $options: "i" },
      };
      if (category && category !== "All") {
        query.category = category;
      }
      
      const count = await courseCollection.countDocuments(query);
      res.send({ count });
    });

    // GET single course
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    // GET my added courses
    app.get("/my-courses/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { instructorEmail: email };
      const result = await courseCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // POST new course
    app.post("/courses", verifyToken, async (req, res) => {
      const courseData = req.body;
      courseData.createdAt = new Date();
      const result = await courseCollection.insertOne(courseData);
      res.send(result);
    });

    // UPDATE course
    app.put("/courses/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const courseData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: courseData.title,
          imageUrl: courseData.imageUrl,
          price: courseData.price,
          duration: courseData.duration,
          category: courseData.category,
          description: courseData.description,
          isFeatured: courseData.isFeatured,
        },
      };
      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // DELETE course
    app.delete("/courses/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const courseQuery = { _id: new ObjectId(id) };
      const enrollmentQuery = { courseId: id };

      const deleteCourseResult = await courseCollection.deleteOne(courseQuery);
      const deleteEnrollmentsResult = await enrollmentCollection.deleteMany(
        enrollmentQuery
      );

      res.send({
        courseDeleteInfo: deleteCourseResult,
        enrollmentDeleteInfo: deleteEnrollmentsResult,
      });
    });

    // ==========================================================
    //                  ENROLLMENT API
    // ==========================================================

    app.post("/enrollments", verifyToken, async (req, res) => {
      const enrollmentData = req.body;
      enrollmentData.enrollmentDate = new Date();
      const result = await enrollmentCollection.insertOne(enrollmentData);
      res.send(result);
    });

    app.get("/my-enrollments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { studentEmail: email };
      const result = await enrollmentCollection
        .find(query)
        .sort({ enrollmentDate: -1 })
        .toArray();
      res.send(result);
    });

    // Root endpoint
    app.get("/", (req, res) => {
      res.send("EducareHub Server is running!");
    });

    app.listen(port, () => {
      console.log(`EducareHub Server is running on port ${port}`);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


