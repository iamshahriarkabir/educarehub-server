require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
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

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@z4tech.as3lfup.mongodb.net/?appName=Z4Tech`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database & Collections Reference
const db = client.db("educareHubDB");
const userCollection = db.collection("users");
const courseCollection = db.collection("courses");
const enrollmentCollection = db.collection("enrollments");

// Connect to DB Function
async function connectDB() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error);
  }
}
connectDB();

// ==========================================================
//    ROUTES (GLOBAL SCOPE)
// ==========================================================

// Root
app.get("/", (req, res) => {
  res.send("EducareHub Server is Running...");
});

// Auth (Dummy for now to fix frontend)
app.post("/jwt", (req, res) => {
  res.send({ success: true });
});
app.post("/logout", (req, res) => {
  res.send({ success: true });
});

// --- USERS ---
app.get("/users", async (req, res) => {
  try {
    const result = await userCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Database Error", error: error.message });
  }
});

app.get("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const user = await userCollection.findOne({ email });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Database Error" });
  }
});

app.post("/users", async (req, res) => {
  const user = req.body;
  const existing = await userCollection.findOne({ email: user.email });
  if (existing) return res.send({ message: "User exists" });
  const result = await userCollection.insertOne(user);
  res.send(result);
});

app.patch("/users/role/:id", async (req, res) => {
  const { role } = req.body;
  const result = await userCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { role } }
  );
  res.send(result);
});

// --- COURSES ---
app.get("/courses", async (req, res) => {
  const page = parseInt(req.query.page) || 0;
  const size = parseInt(req.query.size) || 10;
  const search = req.query.search || "";
  const category = req.query.category || "";
  const sort = req.query.sort || "createdAt";
  const isFeatured = req.query.featured === "true";

  let query = { title: { $regex: search, $options: "i" } };
  if (category && category !== "All") query.category = category;
  if (isFeatured) query.isFeatured = true;

  let sortOptions = { createdAt: -1 };
  if (sort === "price-asc") sortOptions = { price: 1 };
  if (sort === "price-desc") sortOptions = { price: -1 };

  const result = await courseCollection.find(query).sort(sortOptions).skip(page * size).limit(size).toArray();
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
  const result = await courseCollection.findOne({ _id: new ObjectId(req.params.id) });
  res.send(result);
});

app.get("/my-courses/:email", async (req, res) => {
  const result = await courseCollection.find({ instructorEmail: req.params.email }).toArray();
  res.send(result);
});

app.post("/courses", async (req, res) => {
  const course = { ...req.body, createdAt: new Date() };
  const result = await courseCollection.insertOne(course);
  res.send(result);
});

app.put("/courses/:id", async (req, res) => {
  const { _id, ...rest } = req.body;
  const result = await courseCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: rest });
  res.send(result);
});

app.delete("/courses/:id", async (req, res) => {
  const id = req.params.id;
  await enrollmentCollection.deleteMany({ courseId: id });
  const result = await courseCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// --- ENROLLMENTS ---
app.post("/enrollments", async (req, res) => {
  const enrollment = { ...req.body, enrollmentDate: new Date() };
  const result = await enrollmentCollection.insertOne(enrollment);
  res.send(result);
});

app.get("/my-enrollments/:email", async (req, res) => {
  const result = await enrollmentCollection.find({ studentEmail: req.params.email }).toArray();
  res.send(result);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;