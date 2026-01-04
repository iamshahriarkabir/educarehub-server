require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// ==========================================================
//                  MIDDLEWARE CONFIGURATION
// ==========================================================

// 1. Trust Proxy (Vercel/Heroku তে Secure Cookie এর জন্য মাস্ট)
app.set("trust proxy", 1);

// 2. CORS Configuration (Fixed)
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://educarehub-5b51c.web.app",
    "https://educarehub-5b51c.firebaseapp.com",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// 3. Cookie Options (Secure settings)
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

// ==========================================================
//                  MONGODB CONNECTION
// ==========================================================

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
    const database = client.db("educareHubDB");
    const courseCollection = database.collection("courses");
    const enrollmentCollection = database.collection("enrollments");
    const userCollection = database.collection("users");

    // ==========================================================
    //                  AUTH MIDDLEWARE
    // ==========================================================

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

    // ==========================================================
    //                  AUTH ROUTES
    // ==========================================================

    // Generate JWT
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    // Logout
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    // ==========================================================
    //                     USER ROUTES
    // ==========================================================

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

    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/role/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: role } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // ==========================================================
    //                     COURSE ROUTES
    // ==========================================================

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

      if (category && category !== "All") query.category = category;
      if (isFeatured) query.isFeatured = true;

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

    app.get("/courses-count", async (req, res) => {
      const search = req.query.search || "";
      const category = req.query.category || "";
      let query = { title: { $regex: search, $options: "i" } };
      if (category && category !== "All") query.category = category;
      const count = await courseCollection.countDocuments(query);
      res.send({ count });
    });

    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    app.get("/my-courses/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) return res.status(403).send({ message: "forbidden access" });
      const query = { instructorEmail: email };
      const result = await courseCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    app.post("/courses", verifyToken, async (req, res) => {
      const courseData = req.body;
      courseData.createdAt = new Date();
      const result = await courseCollection.insertOne(courseData);
      res.send(result);
    });

    app.put("/courses/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const courseData = req.body;
      const filter = { _id: new ObjectId(id) };
      // ID এবং _id যেন আপডেট না হয়
      const { _id, ...updatedData } = courseData;
      const updateDoc = {
        $set: updatedData,
      };
      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/courses/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const courseQuery = { _id: new ObjectId(id) };
      const enrollmentQuery = { courseId: id };
      const deleteCourseResult = await courseCollection.deleteOne(courseQuery);
      const deleteEnrollmentsResult = await enrollmentCollection.deleteMany(enrollmentQuery);
      res.send({ courseDeleteInfo: deleteCourseResult, enrollmentDeleteInfo: deleteEnrollmentsResult });
    });

    // ==========================================================
    //                  ENROLLMENT ROUTES
    // ==========================================================

    app.post("/enrollments", verifyToken, async (req, res) => {
      const enrollmentData = req.body;
      enrollmentData.enrollmentDate = new Date();
      const result = await enrollmentCollection.insertOne(enrollmentData);
      res.send(result);
    });

    app.get("/my-enrollments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) return res.status(403).send({ message: "forbidden access" });
      const query = { studentEmail: email };
      const result = await enrollmentCollection.find(query).sort({ enrollmentDate: -1 }).toArray();
      res.send(result);
    });

    // Root endpoint
    app.get("/", (req, res) => {
      res.send("EducareHub Server is running...");
    });

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } finally {
    //
  }
}
run().catch(console.dir);