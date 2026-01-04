require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

/* ==========================================================
   MIDDLEWARES
========================================================== */

// Trust proxy (Vercel এর জন্য MUST)
app.set("trust proxy", 1);

// CORS (Firebase + Local)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://educarehub-5b51c.web.app",
      "https://educarehub-5b51c.firebaseapp.com",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

/* ==========================================================
   COOKIE OPTIONS (🔥 FIXED)
========================================================== */

const cookieOptions = {
  httpOnly: true,
  secure: true,     // HTTPS required
  sameSite: "none", // cross-site cookie
};

/* ==========================================================
   MONGODB SETUP
========================================================== */

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

    /* ==========================================================
       AUTH MIDDLEWARE
    ========================================================== */

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

    /* ==========================================================
       AUTH ROUTES
    ========================================================== */

    // Generate JWT
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });

      res
        .cookie("token", token, cookieOptions)
        .send({ success: true });
    });

    // Logout
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", cookieOptions)
        .send({ success: true });
    });

    /* ==========================================================
       USER ROUTES
    ========================================================== */

    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/:email", verifyToken, async (req, res) => {
      if (req.params.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const user = await userCollection.findOne({ email: req.params.email });
      res.send(user);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.patch("/users/role/:id", verifyToken, async (req, res) => {
      const { role } = req.body;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role } }
      );
      res.send(result);
    });

    /* ==========================================================
       COURSE ROUTES (PUBLIC)
    ========================================================== */

    app.get("/courses", async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 8;
      const search = req.query.search || "";
      const category = req.query.category || "";
      const sort = req.query.sort || "createdAt";
      const featured = req.query.featured === "true";

      let query = {
        title: { $regex: search, $options: "i" },
      };

      if (category && category !== "All") query.category = category;
      if (featured) query.isFeatured = true;

      let sortQuery = { createdAt: -1 };
      if (sort === "price-asc") sortQuery = { price: 1 };
      if (sort === "price-desc") sortQuery = { price: -1 };

      const courses = await courseCollection
        .find(query)
        .sort(sortQuery)
        .skip(page * size)
        .limit(size)
        .toArray();

      res.send(courses);
    });

    app.get("/courses-count", async (req, res) => {
      const search = req.query.search || "";
      const category = req.query.category || "";

      let query = {
        title: { $regex: search, $options: "i" },
      };
      if (category && category !== "All") query.category = category;

      const count = await courseCollection.countDocuments(query);
      res.send({ count });
    });

    app.get("/courses/:id", async (req, res) => {
      const course = await courseCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(course);
    });

    /* ==========================================================
       PROTECTED COURSE ROUTES
    ========================================================== */

    app.get("/my-courses/:email", verifyToken, async (req, res) => {
      if (req.params.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await courseCollection
        .find({ instructorEmail: req.params.email })
        .toArray();
      res.send(result);
    });

    app.post("/courses", verifyToken, async (req, res) => {
      const course = { ...req.body, createdAt: new Date() };
      const result = await courseCollection.insertOne(course);
      res.send(result);
    });

    app.put("/courses/:id", verifyToken, async (req, res) => {
      const { _id, ...rest } = req.body;
      const result = await courseCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: rest }
      );
      res.send(result);
    });

    app.delete("/courses/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      await enrollmentCollection.deleteMany({ courseId: id });
      const result = await courseCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    /* ==========================================================
       ENROLLMENTS
    ========================================================== */

    app.post("/enrollments", verifyToken, async (req, res) => {
      const enrollment = {
        ...req.body,
        enrollmentDate: new Date(),
      };
      const result = await enrollmentCollection.insertOne(enrollment);
      res.send(result);
    });

    app.get("/my-enrollments/:email", verifyToken, async (req, res) => {
      if (req.params.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await enrollmentCollection
        .find({ studentEmail: req.params.email })
        .toArray();
      res.send(result);
    });

    /* ==========================================================
       ROOT
    ========================================================== */

    app.get("/", (req, res) => {
      res.send("EducareHub Server is running 🚀");
    });

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error(error);
  }
}

run();
